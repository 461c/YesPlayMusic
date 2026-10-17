package com.yesplaymusic.tablet;

import android.content.Context;
import android.net.Uri;
import androidx.media3.common.C;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.datasource.cache.Cache;
import androidx.media3.datasource.cache.CacheDataSource;
import androidx.media3.datasource.cache.CacheEvictor;
import androidx.media3.datasource.cache.CacheSpan;
import androidx.media3.datasource.cache.ContentMetadata;
import androidx.media3.datasource.cache.ContentMetadataMutations;
import androidx.media3.datasource.cache.SimpleCache;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.json.JSONObject;

/** One persistent native cache shared by playback and the Settings controls. */
@androidx.media3.common.util.UnstableApi
final class AudioCache {
    private static final String INFO = "ypm.audio-info";
    private static SimpleCache cache;
    private static DynamicEvictor evictor;

    private static long maximum(Context context) {
        if (ApiClient.preferences(context).getBoolean("archiveMode", false)) return Long.MAX_VALUE;
        long mb = ApiClient.preferences(context).getLong("cacheLimitMb", 8192);
        return mb <= 0 ? Long.MAX_VALUE : mb * 1024L * 1024L;
    }
    static synchronized SimpleCache get(Context context) {
        if (cache == null) {
            Context app = context.getApplicationContext();
            evictor = new DynamicEvictor(app, maximum(app));
            cache = new SimpleCache(new File(app.getFilesDir(), "music-cache"), evictor,
                new StandaloneDatabaseProvider(app));
        }
        return cache;
    }
    static synchronized void configure(Context context, boolean enabled, long limitMb) {
        ApiClient.preferences(context).edit().putBoolean("cacheEnabled", enabled)
            .putLong("cacheLimitMb", Math.max(0, Math.min(1048576, limitMb))).apply();
        if (cache != null) {
            evictor.maximum = maximum(context);
            evictor.trim(cache, 0);
        }
    }
    static synchronized void preserve(Context context, boolean enabled) {
        ApiClient.preferences(context).edit().putBoolean("archiveMode", enabled).apply();
        if (evictor != null) evictor.maximum = maximum(context);
    }
    private static String key(Context context, String id, String level) {
        String server = ApiClient.preferences(context).getBoolean("useRemoteApi", false)
            ? ApiClient.preferences(context).getString("apiUrl", "") : "embedded-api";
        String scope = server + "\n" + ApiClient.preferences(context).getString("cookie", "");
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(scope.getBytes(StandardCharsets.UTF_8));
            StringBuilder hash = new StringBuilder();
            for (byte value : digest) hash.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            return "track:" + id + ":" + level + ":" + hash;
        } catch (Exception error) { throw new IllegalStateException(error); }
    }

    private static String[] levels() { return new String[] { "standard", "higher", "exhigh", "lossless", "hires" }; }
    private static boolean complete(SimpleCache storage, String key) {
        long length = ContentMetadata.getContentLength(storage.getContentMetadata(key));
        return length > 0 && storage.isCached(key, 0, length);
    }
    static synchronized int preserveTrack(Context context, String id) {
        if (!id.matches("\\d+")) return 0;
        SimpleCache storage = get(context);
        java.util.Set<String> pinned = new java.util.HashSet<>(ApiClient.preferences(context).getStringSet("preservedAudio", java.util.Collections.emptySet()));
        int state = 0;
        for (String level : levels()) {
            String entry = key(context, id, level);
            if (!storage.getCachedSpans(entry).isEmpty()) {
                pinned.add(entry);
                state = Math.max(state, complete(storage, entry) ? 2 : 1);
            }
        }
        if (state > 0) ApiClient.preferences(context).edit().putStringSet("preservedAudio", pinned).apply();
        return state;
    }

    static DataSource.Factory dataSources(Context context, DefaultHttpDataSource.Factory network) {
        Context app = context.getApplicationContext();
        return () -> {
            String level = ApiClient.preferences(app).getString("qualityLevel", "exhigh");
            String[] id = { null }, cacheKey = { null };
            DataSource.Factory upstream = () -> new ResolvingDataSource(network.createDataSource(), spec -> {
                if (ApiClient.preferences(app).getBoolean("archiveMode", false))
                    throw new java.io.IOException("纪念模式：此歌曲没有完整本地缓存");
                if (id[0] == null) return spec;
                // Always refresh through the original track, even if cached redirect URLs have expired.
                Uri address;
                try { address = ApiClient.resolveAudio(app, id[0], level); }
                catch (java.io.IOException error) { preserveTrack(app, id[0]); throw error; }
                try {
                    get(app).applyContentMetadataMutations(cacheKey[0], new ContentMetadataMutations()
                        .set(INFO, ApiClient.audioInfo(app, id[0]).toString()));
                } catch (Exception ignored) { /* Metadata failure must not interrupt audio. */ }
                return spec.withUri(address);
            });
            CacheDataSource.Factory factory = new CacheDataSource.Factory().setCache(get(app))
                .setUpstreamDataSourceFactory(upstream).setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
                .setCacheKeyFactory(spec -> {
                    if (!"ypm".equals(spec.uri.getScheme())) return spec.uri.toString();
                    id[0] = spec.uri.getLastPathSegment();
                    cacheKey[0] = key(app, id[0], level);
                    java.util.Set<String> pinned = ApiClient.preferences(app).getStringSet("preservedAudio", java.util.Collections.emptySet());
                    if (!complete(get(app), cacheKey[0])) {
                        for (String other : levels()) {
                            String candidate = key(app, id[0], other);
                            if ((pinned.contains(candidate) || ApiClient.preferences(app).getBoolean("archiveMode", false)) && complete(get(app), candidate)) { cacheKey[0] = candidate; break; }
                        }
                    }
                    try {
                        String info = get(app).getContentMetadata(cacheKey[0]).get(INFO, "");
                        if (!info.isEmpty()) ApiClient.restoreAudioInfo(id[0], new JSONObject(info));
                    } catch (Exception ignored) { }
                    return cacheKey[0];
                });
            // Disabling automatic caching stops new writes; existing music can still be read.
            if (ApiClient.preferences(app).getBoolean("archiveMode", false) || !ApiClient.preferences(app).getBoolean("cacheEnabled", true)) factory.setCacheWriteDataSinkFactory(null);
            return factory.createDataSource();
        };
    }

    static JSONObject stats(Context context) {
        JSONObject result = new JSONObject();
        try {
            SimpleCache storage = get(context);
            int complete = 0, partial = 0;
            for (String key : storage.getKeys()) {
                if (storage.getCachedSpans(key).isEmpty()) continue;
                long length = ContentMetadata.getContentLength(storage.getContentMetadata(key));
                if (length > 0 && storage.isCached(key, 0, length)) complete++;
                else partial++;
            }
            result.put("bytes", storage.getCacheSpace()).put("length", complete).put("partial", partial);
        } catch (Exception error) {
            try { result.put("error", "无法读取歌曲缓存"); } catch (Exception ignored) { }
        }
        return result;
    }
    static JSONObject clear(Context context) {
        try {
            SimpleCache storage = get(context);
            for (String key : storage.getKeys()) storage.removeResource(key);
            return stats(context);
        } catch (Exception error) {
            JSONObject result = new JSONObject();
            try { result.put("error", "无法清除歌曲缓存，请稍后重试"); } catch (Exception ignored) { }
            return result;
        }
    }

    /** Dynamic capacity changes do not close a cache currently used by the player. */
    private static final class DynamicEvictor implements CacheEvictor {
        volatile long maximum;
        final Context app;
        DynamicEvictor(Context app, long maximum) { this.app = app; this.maximum = maximum; }
        @Override public boolean requiresCacheSpanTouches() { return true; }
        @Override public void onCacheInitialized() { }
        @Override public void onStartFile(Cache cache, String key, long position, long length) {
            trim(cache, length == C.LENGTH_UNSET ? 0 : length);
        }
        @Override public void onSpanAdded(Cache cache, CacheSpan span) { trim(cache, 0); }
        @Override public void onSpanRemoved(Cache cache, CacheSpan span) { }
        @Override public void onSpanTouched(Cache cache, CacheSpan oldSpan, CacheSpan newSpan) { }
        void trim(Cache cache, long incoming) {
            if (maximum == Long.MAX_VALUE || cache.getCacheSpace() <= maximum - incoming) return;
            List<CacheSpan> spans = new ArrayList<>();
            for (String key : cache.getKeys()) spans.addAll(cache.getCachedSpans(key));
            spans.sort(Comparator.comparingLong(span -> span.lastTouchTimestamp));
            java.util.Set<String> pinned = ApiClient.preferences(app).getStringSet("preservedAudio", java.util.Collections.emptySet());
            for (CacheSpan span : spans) {
                if (pinned.contains(span.key)) continue;
                if (cache.getCacheSpace() <= maximum - incoming) break;
                try { cache.removeSpan(span); } catch (RuntimeException error) { break; }
            }
        }
    }
}
