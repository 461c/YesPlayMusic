package com.yesplaymusic.tablet;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;

final class ApiClient {
    private static final class AudioSource {
        final String url;
        final JSONObject info;
        final long expires;
        AudioSource(String url, JSONObject info, long lifetime) {
            this.url = url; this.info = info; this.expires = SystemClock.elapsedRealtime() + lifetime;
        }
    }
    private static final ConcurrentHashMap<String, AudioSource> audioUrls = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, AudioSource> resolvedAudio = new ConcurrentHashMap<>();
    static String qualityLevel(String quality) {
        switch (quality) {
            case "128000": case "standard": return "standard";
            case "192000": case "higher": return "higher";
            case "flac": case "lossless": return "lossless";
            case "999000": case "hires": return "hires";
            default: return "exhigh";
        }
    }
    static void setQuality(Context context, String quality) {
        String level = qualityLevel(quality);
        if (!level.equals(preferences(context).getString("qualityLevel", "exhigh"))) audioUrls.clear();
        preferences(context).edit().putString("qualityLevel", level).apply();
    }
    static void setCookie(Context context, String cookie) {
        if (!cookie.equals(preferences(context).getString("cookie", ""))) audioUrls.clear();
        preferences(context).edit().putString("cookie", cookie).apply();
    }
    private static String audioKey(Context context, String id, String level) {
        return id + ":" + level + ":"
            + preferences(context).getString("cookie", "") + ":" + baseUrl(context);
    }
    static JSONObject audioInfo(Context context, String id) {
        AudioSource source = resolvedAudio.get(id);
        try { return source == null ? new JSONObject() : new JSONObject(source.info.toString()); }
        catch (Exception ignored) { return new JSONObject(); }
    }
    static void restoreAudioInfo(String id, JSONObject info) {
        if (resolvedAudio.size() > 100) resolvedAudio.clear();
        resolvedAudio.put(id, new AudioSource("", info, 0));
    }
    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("android-player", Context.MODE_PRIVATE);
    }
    static String baseUrl(Context context) {
        return preferences(context).getBoolean("useRemoteApi", false)
            ? preferences(context).getString("apiUrl", "") : LocalApi.address();
    }
    static void setBaseUrl(Context context, String address) {
        if (address.trim().isEmpty()) {
            preferences(context).edit().putBoolean("useRemoteApi", false).apply();
            audioUrls.clear();
            LocalApi.ensureStarted(context);
            return;
        }
        Uri uri = Uri.parse(address.trim());
        if ((!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme())) || uri.getHost() == null) {
            throw new IllegalArgumentException("请输入有效的 HTTP 或 HTTPS 接口地址");
        }
        preferences(context).edit().putBoolean("useRemoteApi", true).putString("apiUrl", address.trim().replaceAll("/+$", "")).apply();
        audioUrls.clear();
    }
    static byte[] read(InputStream stream) throws IOException {
        if (stream == null) return new byte[0];
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toByteArray();
        }
    }
    static JSONObject json(Context context, String path) throws Exception {
        return json(context, path, preferences(context).getString("cookie", ""),
            preferences(context).getBoolean("useRemoteApi", false) ? baseUrl(context) : "local");
    }
    static JSONObject json(Context context, String path, String cookie, String api) throws Exception {
        String separator = path.contains("?") ? "&" : "?";
        ensureReady(context);
        URL url = new URL(("local".equals(api) ? baseUrl(context) : api) + path + separator + "cookie=" + Uri.encode(cookie));
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        try {
            if (connection.getResponseCode() != 200) throw new IOException("音乐接口请求失败");
            return new JSONObject(new String(read(connection.getInputStream()), StandardCharsets.UTF_8));
        } finally { connection.disconnect(); }
    }
    static Uri resolveAudio(Context context, String id) throws IOException {
        return resolveAudio(context, id, preferences(context).getString("qualityLevel", "exhigh"));
    }
    static Uri resolveAudio(Context context, String id, String level) throws IOException {
        String key = audioKey(context, id, level);
        AudioSource cached = audioUrls.get(key);
        if (cached != null && cached.expires > SystemClock.elapsedRealtime()) {
            resolvedAudio.put(id, cached);
            return Uri.parse(cached.url);
        }
        String result;
        JSONObject info = new JSONObject();
        long lifetime = 120000;
        String cookie = preferences(context).getString("cookie", "");
        if (cookie.contains("MUSIC_U=")) {
            try {
                JSONObject response = json(context, "/song/url/v1?id=" + Uri.encode(id) + "&level=" + Uri.encode(level));
                JSONArray data = response.optJSONArray("data");
                JSONObject track = data == null ? null : data.optJSONObject(0);
                result = track == null ? "" : track.optString("url", "");
                if (result.isEmpty() || (track.has("freeTrialInfo") && !track.isNull("freeTrialInfo"))) {
                    throw new IOException("该曲目没有可用的完整音源");
                }
                info.put("requestedLevel", level).put("sourceLevel", track.optString("level", ""))
                    .put("bitrate", track.optLong("br", 0)).put("sourceFormat", track.optString("type", ""));
                lifetime = Math.max(1000, Math.min(120000, track.optLong("expi", 120) * 1000 - 10000));
            } catch (Exception error) { throw new IOException(error); }
        } else {
            result = "https://music.163.com/song/media/outer/url?id=" + Uri.encode(id);
            try { info.put("requestedLevel", level).put("guest", true); } catch (Exception ignored) { }
        }
        if (audioUrls.size() > 100) audioUrls.clear();
        AudioSource source = new AudioSource(result, info, lifetime);
        audioUrls.put(key, source);
        if (resolvedAudio.size() > 100) resolvedAudio.clear();
        resolvedAudio.put(id, source);
        return Uri.parse(result);
    }
    static void ensureReady(Context context) throws Exception {
        if (preferences(context).getBoolean("archiveMode", false)) throw new IOException("纪念模式：停止接口更新");
        if (!preferences(context).getBoolean("useRemoteApi", false)) {
            LocalApi.ensureStarted(context).get(45, java.util.concurrent.TimeUnit.SECONDS);
        }
    }

    // WebView interception cannot read POST bodies. The JS adapter passes the full request.
    static JSONObject request(Context context, JSONObject request) throws Exception {
        ensureReady(context);
        String path = request.getString("url");
        if (!path.startsWith("/api/")) throw new IllegalArgumentException("Invalid API route");
        HttpURLConnection connection = (HttpURLConnection) new URL(baseUrl(context) + path.substring(4)).openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        connection.setReadTimeout(Math.min(300000, Math.max(15000, request.optInt("timeout", 15000))));
        connection.setRequestMethod(request.optString("method", "GET").toUpperCase(java.util.Locale.ROOT));
        JSONObject headers = request.optJSONObject("headers");
        if (headers != null) {
            for (String name : new String[] {"Content-Type", "Accept"}) {
                String value = headers.optString(name, "");
                if (!value.isEmpty()) connection.setRequestProperty(name, value);
            }
        }
        try {
            if (request.has("body") || request.has("bodyBase64")) {
                byte[] body = request.has("bodyBase64")
                    ? Base64.decode(request.getString("bodyBase64"), Base64.DEFAULT)
                    : request.getString("body").getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                try (java.io.OutputStream stream = connection.getOutputStream()) { stream.write(body); }
            }
            int code = connection.getResponseCode();
            JSONObject response = new JSONObject();
            response.put("status", code);
            response.put("data", new String(read(code >= 400 ? connection.getErrorStream() : connection.getInputStream()), StandardCharsets.UTF_8));
            response.put("headers", new JSONObject().put("content-type", connection.getContentType()));
            return response;
        } finally { connection.disconnect(); }
    }
}
