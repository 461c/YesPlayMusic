package com.yesplaymusic.tablet;

import android.content.Context;
import android.net.Uri;
import android.os.SystemClock;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

/** Native session reporting survives an inactive WebView and autonomous queue/repeat playback. */
@androidx.media3.common.util.UnstableApi
final class PlaybackHistory implements Player.Listener {
    private final Context context;
    private final Player player;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean draining = new AtomicBoolean(false);
    private ListeningSession current;
    static volatile String status = "尚无已结束的播放记录";
    PlaybackHistory(Context context, Player player) { this.context = context; this.player = player; }
    private String cookie() { return ApiClient.preferences(context).getString("cookie", ""); }
    private String apiScope() { return ApiClient.preferences(context).getBoolean("useRemoteApi", false) ? ApiClient.baseUrl(context) : "local"; }
    private boolean archived() { return ApiClient.preferences(context).getBoolean("archiveMode", false); }
    private void begin(MediaItem item) {
        if (item == null || !item.mediaId.matches("\\d+") || archived()) return;
        String source = ApiClient.preferences(context).getString("historySourceId", "0");
        if (!source.matches("\\d+")) source = "0";
        current = new ListeningSession(item.mediaId, source, cookie(), apiScope(),
            SystemClock.elapsedRealtime(), player.isPlaying());
    }
    @Override public void onMediaItemTransition(MediaItem item, int reason) {
        boolean same = current != null && item != null && current.id.equals(item.mediaId)
            && current.cookie.equals(cookie()) && current.api.equals(apiScope());
        // Replacing queue metadata must not manufacture a second listen.
        if (same && reason != Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT) return;
        finish();
        begin(item);
    }
    @Override public void onIsPlayingChanged(boolean playing) {
        if (current != null) current.update(SystemClock.elapsedRealtime(), playing && !archived());
        if (playing) drain();
    }
    @Override public void onEvents(Player source, Player.Events events) {
        if (archived()) { current = null; return; }
        if (player.getPlaybackState() == Player.STATE_ENDED || player.getPlaybackState() == Player.STATE_IDLE) {
            finish();
        } else if (player.isPlaying() && current == null) begin(player.getCurrentMediaItem());
    }
    private void finish() {
        ListeningSession session = current;
        current = null;
        if (session == null) return;
        long seconds = session.finish(SystemClock.elapsedRealtime());
        if (seconds < 1 || !session.cookie.contains("MUSIC_U=") || archived()) return;
        try {
            JSONObject report = new JSONObject().put("token", java.util.UUID.randomUUID().toString())
                .put("id", session.id).put("sourceId", session.sourceId).put("time", seconds)
                .put("cookie", session.cookie).put("api", session.api);
            synchronized (this) {
                JSONArray pending = pending();
                pending.put(report);
                while (pending.length() > 100) pending.remove(0);
                save(pending);
                status = "待同步播放记录：" + pending.length();
            }
            drain();
        } catch (Exception ignored) { /* History must never stop audio. */ }
    }
    private JSONArray pending() {
        try { return new JSONArray(ApiClient.preferences(context).getString("pendingPlayHistory", "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }
    private void save(JSONArray reports) {
        ApiClient.preferences(context).edit().putString("pendingPlayHistory", reports.toString()).apply();
    }
    private void drain() {
        if (archived() || !draining.compareAndSet(false, true)) return;
        worker.execute(() -> {
            try {
                JSONArray reports;
                synchronized (this) { reports = pending(); }
                for (int i = 0; i < reports.length(); i++) {
                    JSONObject report = reports.getJSONObject(i);
                    // Never send one account's saved listen with another account/API's credentials.
                    if (archived() || !report.getString("cookie").equals(cookie())
                        || !report.getString("api").equals(apiScope())) continue;
                    JSONObject response = ApiClient.json(context, "/scrobble?id=" + Uri.encode(report.getString("id"))
                        + "&sourceid=" + Uri.encode(report.getString("sourceId"))
                        + "&time=" + report.getLong("time") + "&timestamp=" + System.currentTimeMillis(),
                        report.getString("cookie"), report.getString("api"));
                    if (response.optInt("code") != 200 || !"success".equals(response.optString("data"))) {
                        status = "网易云打卡未接受，已保留待重试（" + response.optInt("code") + "）"; break;
                    }
                    status = "已提交网易云：" + report.getString("id") + "，实际播放 " + report.getLong("time") + " 秒";
                    synchronized (this) {
                        JSONArray all = pending(), remaining = new JSONArray();
                        for (int j = 0; j < all.length(); j++) if (!report.getString("token").equals(all.getJSONObject(j).optString("token"))) remaining.put(all.get(j));
                        save(remaining);
                    }
                }
            } catch (Exception error) { status = "打卡请求失败，已保留待重试：" + error.getClass().getSimpleName(); }
            finally { draining.set(false); }
        });
    }
    void close() { finish(); worker.shutdown(); }
}
