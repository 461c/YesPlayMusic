package com.yesplaymusic.tablet;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.DecoderReuseEvaluation;
import androidx.media3.exoplayer.analytics.AnalyticsListener;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaLibraryService;
import androidx.media3.session.LibraryResult;
import androidx.media3.session.SessionError;
import com.google.common.collect.ImmutableList;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.Collections;
import org.json.JSONArray;
import org.json.JSONObject;

@androidx.media3.common.util.UnstableApi
public final class PlaybackService extends MediaLibraryService {
    private MediaLibrarySession session;
    private ExoPlayer player;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean loadingFm = new AtomicBoolean(false);
    private String metadataId = "";
    private int consecutiveErrors = 0;
    private final SharedPreferences.OnSharedPreferenceChangeListener preferenceListener = (preferences, key) -> {
        if ("allowConcurrentPlayback".equals(key)) main.post(() -> {
            if (player != null) applyAudioFocusPolicy();
        });
    };
    private final Runnable savePosition = new Runnable() {
        @Override public void run() {
            if (player != null && player.isPlaying()) {
                PlaybackResumeStore.save(PlaybackService.this, player, false);
                main.postDelayed(this, 5000);
            }
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        LocalApi.ensureStarted(this);
        DefaultHttpDataSource.Factory network = new DefaultHttpDataSource.Factory().setUserAgent("YesPlayMusic-Android")
            .setDefaultRequestProperties(Collections.singletonMap("Referer", "https://music.163.com/"))
            .setAllowCrossProtocolRedirects(true);
        player = new ExoPlayer.Builder(this)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(AudioCache.dataSources(this, network))).build();
        applyAudioFocusPolicy();
        ApiClient.preferences(this).registerOnSharedPreferenceChangeListener(preferenceListener);
        player.setHandleAudioBecomingNoisy(true);
        player.setWakeMode(C.WAKE_MODE_NETWORK);
        PendingIntent activity = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Bundle extras = new Bundle();
        extras.putBoolean("android.media.playback.ALWAYS_RESERVE_SPACE_FOR.ACTION_SKIP_TO_PREVIOUS", true);
        extras.putBoolean("android.media.playback.ALWAYS_RESERVE_SPACE_FOR.ACTION_SKIP_TO_NEXT", true);
        session = new MediaLibrarySession.Builder(this, player, new LibraryCallback())
            .setId("yesplaymusic").setSessionExtras(extras).setSessionActivity(activity).build();
        player.addAnalyticsListener(new AnalyticsListener() {
            @Override public void onAudioInputFormatChanged(EventTime event, Format format, DecoderReuseEvaluation reuse) {
                publishAudioInfo(format);
            }
        });
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
                main.removeCallbacks(savePosition);
                if (playing) main.post(savePosition);
            }
            @Override public void onEvents(Player source, Player.Events events) {
                boolean queueChanged = events.contains(Player.EVENT_TIMELINE_CHANGED)
                    || events.contains(Player.EVENT_MEDIA_METADATA_CHANGED);
                PlaybackResumeStore.save(PlaybackService.this, player, queueChanged);
                if (queueChanged || events.contains(Player.EVENT_MEDIA_ITEM_TRANSITION)) {
                    session.notifyChildrenChanged("queue", browseItems(false).size(), null);
                    session.notifyChildrenChanged("recent", browseItems(true).size(), null);
                }
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

    private void applyAudioFocusPolicy() {
        boolean concurrent = ApiClient.preferences(this).getBoolean("allowConcurrentPlayback", false);
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), !concurrent);
    }

    private void publishAudioInfo(Format format) {
        MediaItem current = player.getCurrentMediaItem();
        if (current == null || format == null) return;
        try {
            JSONObject info = ApiClient.audioInfo(this, current.mediaId);
            info.put("trackId", current.mediaId).put("mime", format.sampleMimeType)
                .put("sampleRate", Math.max(0, format.sampleRate)).put("channels", Math.max(0, format.channelCount));
            if (info.optLong("bitrate") <= 0) info.put("bitrate", Math.max(0, format.averageBitrate));
            int depth = format.pcmEncoding == C.ENCODING_PCM_16BIT ? 16
                : format.pcmEncoding == C.ENCODING_PCM_24BIT ? 24
                : format.pcmEncoding == C.ENCODING_PCM_32BIT ? 32
                : format.pcmEncoding == C.ENCODING_PCM_8BIT ? 8 : 0;
            if (depth > 0) info.put("bitDepth", depth);
            Bundle extras = current.mediaMetadata.extras == null ? new Bundle() : new Bundle(current.mediaMetadata.extras);
            String json = info.toString();
            if (json.equals(extras.getString("androidAudioInfo"))) return;
            extras.putString("androidAudioInfo", json);
            player.replaceMediaItem(player.getCurrentMediaItemIndex(), current.buildUpon()
                .setMediaMetadata(current.mediaMetadata.buildUpon().setExtras(extras).build()).build());
        } catch (Exception ignored) { /* Diagnostics must never interrupt playback. */ }
    }

    private void updateMetadata(String id) {
        if (!id.matches("\\d+") || id.equals(metadataId)) return;
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
                    .setTitle(song.optString("name")).setDisplayTitle(song.optString("name"))
                    .setArtist(names.toString()).setSubtitle(names.toString())
                    .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC).setIsPlayable(true).setIsBrowsable(false);
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

    private List<MediaItem> browseItems(boolean recent) {
        List<MediaItem> items = new ArrayList<>();
        if (player.getMediaItemCount() > 0) {
            if (recent) items.add(player.getCurrentMediaItem());
            else for (int i = 0; i < player.getMediaItemCount(); i++) items.add(player.getMediaItemAt(i));
        } else {
            items = PlaybackResumeStore.load(this);
            if (recent && !items.isEmpty()) {
                int index = Math.max(0, Math.min(items.size() - 1, ApiClient.preferences(this).getInt("resumeIndex", 0)));
                items = new ArrayList<>(Collections.singletonList(items.get(index)));
            }
        }
        List<MediaItem> browsable = new ArrayList<>();
        for (MediaItem item : items) if (item != null) browsable.add(item.buildUpon().setMediaMetadata(
            item.mediaMetadata.buildUpon().setIsBrowsable(false).setIsPlayable(true).build()).build());
        return browsable;
    }

    private MediaItem root(String id) {
        return new MediaItem.Builder().setMediaId(id).setMediaMetadata(new MediaMetadata.Builder()
            .setTitle("YesPlayMusic").setIsBrowsable(true).setIsPlayable(false).build()).build();
    }

    private final class LibraryCallback implements MediaLibrarySession.Callback {
        @Override public ListenableFuture<LibraryResult<MediaItem>> onGetLibraryRoot(
                MediaLibrarySession session, MediaSession.ControllerInfo browser, LibraryParams params) {
            return Futures.immediateFuture(LibraryResult.ofItem(root(params != null && params.isRecent ? "recent" : "queue"), params));
        }
        @Override public ListenableFuture<LibraryResult<MediaItem>> onGetItem(
                MediaLibrarySession session, MediaSession.ControllerInfo browser, String id) {
            if ("queue".equals(id) || "recent".equals(id)) return Futures.immediateFuture(LibraryResult.ofItem(root(id), null));
            for (MediaItem item : browseItems(false)) if (id.equals(item.mediaId))
                return Futures.immediateFuture(LibraryResult.ofItem(item, null));
            return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE));
        }
        @Override public ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> onGetChildren(
                MediaLibrarySession session, MediaSession.ControllerInfo browser, String parentId, int page, int pageSize, LibraryParams params) {
            if (!"queue".equals(parentId) && !"recent".equals(parentId))
                return Futures.immediateFuture(LibraryResult.ofError(SessionError.ERROR_BAD_VALUE));
            List<MediaItem> items = browseItems("recent".equals(parentId));
            long offset = (long) page * pageSize;
            int from = (int) Math.min(items.size(), offset);
            int to = (int) Math.min(items.size(), offset + pageSize);
            return Futures.immediateFuture(LibraryResult.ofItemList(items.subList(from, to), params));
        }
        @Override public ListenableFuture<List<MediaItem>> onAddMediaItems(
                MediaSession session, MediaSession.ControllerInfo controller, List<MediaItem> requested) {
            List<MediaItem> resolved = new ArrayList<>();
            for (MediaItem item : requested) {
                if (item.localConfiguration != null) { resolved.add(item); continue; }
                MediaItem match = null;
                for (MediaItem candidate : browseItems(false)) if (item.mediaId.equals(candidate.mediaId)) { match = candidate; break; }
                if (match == null) return Futures.immediateFailedFuture(new IllegalArgumentException("Unknown queue item"));
                resolved.add(match);
            }
            return Futures.immediateFuture(resolved);
        }
        @Override public ListenableFuture<MediaSession.MediaItemsWithStartPosition> onPlaybackResumption(
                MediaSession session, MediaSession.ControllerInfo controller) {
            List<MediaItem> items = PlaybackResumeStore.load(PlaybackService.this);
            if (items.isEmpty()) return Futures.immediateFailedFuture(new UnsupportedOperationException("No saved queue"));
            int index = Math.max(0, Math.min(items.size() - 1, ApiClient.preferences(PlaybackService.this).getInt("resumeIndex", 0)));
            long position = Math.max(0, ApiClient.preferences(PlaybackService.this).getLong("resumePosition", 0));
            player.setRepeatMode(ApiClient.preferences(PlaybackService.this).getInt("resumeRepeat", Player.REPEAT_MODE_OFF));
            player.setVolume(ApiClient.preferences(PlaybackService.this).getFloat("resumeVolume", 1));
            return Futures.immediateFuture(new MediaSession.MediaItemsWithStartPosition(items, index, position));
        }
    }

    @Override public MediaLibrarySession onGetSession(MediaSession.ControllerInfo info) { return session; }

    @Override public void onDestroy() {
        ApiClient.preferences(this).unregisterOnSharedPreferenceChangeListener(preferenceListener);
        if (player != null) PlaybackResumeStore.save(this, player, true);
        worker.shutdownNow();
        main.removeCallbacksAndMessages(null);
        if (session != null) session.release();
        if (player != null) player.release();
        super.onDestroy();
    }
}
