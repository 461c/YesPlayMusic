package com.yesplaymusic.tablet;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.Collections;
import org.json.JSONArray;
import org.json.JSONObject;

@androidx.media3.common.util.UnstableApi
public final class PlaybackService extends MediaSessionService {
    private MediaSession session;
    private ExoPlayer player;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean loadingFm = new AtomicBoolean(false);
    private String metadataId = "";
    private int consecutiveErrors = 0;

    @Override public void onCreate() {
        super.onCreate();
        ResolvingDataSource.Factory source = new ResolvingDataSource.Factory(
            new DefaultHttpDataSource.Factory().setUserAgent("YesPlayMusic-Android")
                .setDefaultRequestProperties(Collections.singletonMap("Referer", "https://music.163.com/"))
                .setAllowCrossProtocolRedirects(true),
            spec -> "ypm".equals(spec.uri.getScheme())
                ? spec.withUri(ApiClient.resolveAudio(this, spec.uri.getLastPathSegment())) : spec);
        player = new ExoPlayer.Builder(this)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(source)).build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.setWakeMode(C.WAKE_MODE_NETWORK);
        PendingIntent activity = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        session = new MediaSession.Builder(this, player).setSessionActivity(activity).build();
        player.addListener(new Player.Listener() {
            @Override public void onMediaItemTransition(MediaItem item, int reason) {
                if (item != null) updateMetadata(item.mediaId);
                refillFm();
            }
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) refillFm();
            }
            @Override public void onIsPlayingChanged(boolean playing) {
                if (playing) consecutiveErrors = 0;
            }
            @Override public void onPlayerError(PlaybackException error) {
                if (++consecutiveErrors < 3 && player.hasNextMediaItem()) {
                    player.seekToNextMediaItem();
                    player.prepare();
                    player.play();
                } else {
                    player.pause();
                }
            }
        });
    }

    private void updateMetadata(String id) {
        if (id.equals(metadataId)) return;
        metadataId = id;
        worker.execute(() -> {
            try {
                JSONArray songs = ApiClient.json(this, "/song/detail?ids=" + Uri.encode(id)).optJSONArray("songs");
                if (songs == null || songs.length() == 0) return;
                JSONObject song = songs.getJSONObject(0);
                JSONArray artists = song.optJSONArray("ar");
                StringBuilder names = new StringBuilder();
                if (artists != null) for (int i = 0; i < artists.length(); i++) {
                    if (i > 0) names.append(", ");
                    names.append(artists.getJSONObject(i).optString("name"));
                }
                JSONObject album = song.optJSONObject("al");
                MediaMetadata.Builder metadata = new MediaMetadata.Builder()
                    .setTitle(song.optString("name")).setArtist(names.toString());
                if (album != null) {
                    metadata.setAlbumTitle(album.optString("name"));
                    String art = album.optString("picUrl");
                    if (!art.isEmpty()) metadata.setArtworkUri(Uri.parse(art + "?param=192y192"));
                }
                main.post(() -> {
                    MediaItem current = player.getCurrentMediaItem();
                    if (current == null || !id.equals(current.mediaId)) return;
                    metadata.setExtras(current.mediaMetadata.extras);
                    player.replaceMediaItem(player.getCurrentMediaItemIndex(),
                        current.buildUpon().setMediaMetadata(metadata.build()).build());
                });
            } catch (Exception ignored) { /* Keep the metadata provided by the UI. */ }
        });
    }

    private void refillFm() {
        if (!ApiClient.preferences(this).getBoolean("personalFm", false)
            || player.getCurrentMediaItemIndex() < player.getMediaItemCount() - 2
            || !loadingFm.compareAndSet(false, true)) return;
        worker.execute(() -> {
            try {
                JSONArray data = ApiClient.json(this, "/personal_fm").optJSONArray("data");
                main.post(() -> {
                    if (!ApiClient.preferences(this).getBoolean("personalFm", false)) {
                        loadingFm.set(false); return;
                    }
                    if (data != null) for (int i = 0; i < data.length(); i++) {
                        JSONObject song = data.optJSONObject(i);
                        if (song == null) continue;
                        String id = song.optString("id");
                        boolean exists = false;
                        for (int j = Math.max(0, player.getCurrentMediaItemIndex()); j < player.getMediaItemCount(); j++) {
                            if (id.equals(player.getMediaItemAt(j).mediaId)) exists = true;
                        }
                        if (!exists) player.addMediaItem(MainActivity.item(id, null, song, -1));
                    }
                    if (player.getPlaybackState() == Player.STATE_ENDED && player.hasNextMediaItem()) {
                        player.seekToNextMediaItem(); player.prepare(); player.play();
                    }
                    loadingFm.set(false);
                });
            } catch (Exception error) { loadingFm.set(false); }
        });
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo info) { return session; }

    @Override public void onDestroy() {
        worker.shutdownNow();
        main.removeCallbacksAndMessages(null);
        if (session != null) session.release();
        if (player != null) player.release();
        super.onDestroy();
    }
}
