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
    private static String configuredApi(Context context) {
        return preferences(context).getBoolean("useRemoteApi", false)
            ? preferences(context).getString("apiUrl", "") : "local";
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
        return json(context, path, preferences(context).getString("cookie", ""), configuredApi(context));
    }
    private static final class ApiStatusException extends IOException {
        final int status;
        ApiStatusException(int status) {
            super("音乐接口请求失败（HTTP " + status + "）");
            this.status = status;
        }
    }
    static JSONObject json(Context context, String path, String cookie, String api) throws Exception {
        if (preferences(context).getBoolean("archiveMode", false)) throw new IOException("纪念模式：停止接口更新");
        String base = "local".equals(api)
            ? LocalApi.ensureStarted(context).get(45, java.util.concurrent.TimeUnit.SECONDS) : api;
        Uri.Builder requestUri = Uri.parse(base + path).buildUpon();
        requestUri.appendQueryParameter("cookie", cookie);
        String realIP = preferences(context).getString("audioRealIP", "");
        String proxy = preferences(context).getString("audioProxy", "");
        if (!realIP.isEmpty()) requestUri.appendQueryParameter("realIP", realIP);
        if (!proxy.isEmpty()) requestUri.appendQueryParameter("proxy", proxy);
        URL url = new URL(requestUri.build().toString());
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(path.startsWith("/scrobble?") ? 45000 : 15000);
        try {
            int status = connection.getResponseCode();
            if (status != 200) throw new ApiStatusException(status);
            return new JSONObject(new String(read(connection.getInputStream()), StandardCharsets.UTF_8));
        } finally { connection.disconnect(); }
    }
    static Uri resolveAudio(Context context, String id) throws IOException {
        return resolveAudio(context, id, preferences(context).getString("qualityLevel", "exhigh"));
    }
    static Uri resolveAudio(Context context, String id, String level) throws IOException {
        if (preferences(context).getBoolean("archiveMode", false)) throw new IOException("纪念模式：停止接口更新");
        String cookie = preferences(context).getString("cookie", "");
        String api = configuredApi(context);
        String key = id + ":" + level + ":" + cookie + ":" + api;
        AudioSource cached = audioUrls.get(key);
        if (cached != null && cached.expires > SystemClock.elapsedRealtime()) {
            resolvedAudio.put(id, cached);
            return Uri.parse(cached.url);
        }
        AudioSource source;
        try {
            String encodedId = Uri.encode(id);
            source = requestAudio(context, "/song/url?id=" + encodedId + "&br=" + legacyBitrate(level),
                id, level, cookie, api);
            if (source == null && !cookie.contains("MUSIC_U=")) {
                source = new AudioSource("https://music.163.com/song/media/outer/url?id=" + encodedId,
                    new JSONObject().put("requestedLevel", level).put("guest", true), 120000);
            }
            if (source == null) throw new IOException("该曲目没有可用的完整音源");
        } catch (IOException error) { throw error; }
        catch (Exception error) { throw new IOException("无法获取歌曲音源", error); }
        if (audioUrls.size() > 100) audioUrls.clear();
        audioUrls.put(key, source);
        if (resolvedAudio.size() > 100) resolvedAudio.clear();
        resolvedAudio.put(id, source);
        return Uri.parse(source.url);
    }
    private static int legacyBitrate(String level) {
        switch (level) {
            case "standard": return 128000;
            case "higher": return 192000;
            case "lossless": return 350000;
            case "hires": return 999000;
            default: return 320000;
        }
    }
    private static boolean unsupportedRoute(int code) {
        return code == 404 || code == 405 || code == 501;
    }
    /** A missing route or unusable address may use the other API with the same credentials. */
    private static AudioSource requestAudio(Context context, String path, String id, String level,
            String cookie, String api) throws Exception {
        JSONObject response;
        try { response = json(context, path, cookie, api); }
        catch (ApiStatusException error) {
            if (unsupportedRoute(error.status)) return null;
            throw error;
        } catch (org.json.JSONException invalidResponse) { return null; }
        int code = response.optInt("code", 200);
        String message = response.optString("message", response.optString("msg", ""));
        if (message.matches(".*(验证码|风控|访问频繁|操作频繁|安全验证|限流).*"))
            throw new IOException("音乐接口返回（API " + code + "）：" + message);
        if (unsupportedRoute(code)) return null;
        if (code != 200) throw new IOException("音乐接口返回（API " + code + "）：" + message);
        JSONArray data = response.optJSONArray("data");
        JSONObject track = data == null ? null : data.optJSONObject(0);
        if (track == null || !id.equals(track.optString("id", id))) return null;
        if (track.optInt("code", 200) != 200 || !track.isNull("freeTrialInfo"))
            throw new IOException("该曲目没有可用的完整音源");
        Object rawUrl = track.opt("url");
        if (!(rawUrl instanceof String)) return null;
        Uri uri = Uri.parse(((String) rawUrl).trim());
        if (uri.getHost() == null || uri.getHost().isEmpty()
                || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) return null;
        JSONObject info = new JSONObject().put("requestedLevel", level).put("sourceLevel", track.optString("level", ""))
            .put("bitrate", track.optLong("br", 0)).put("sourceFormat", track.optString("type", ""));
        if (!cookie.contains("MUSIC_U=")) info.put("guest", true);
        long lifetime = Math.max(1000, Math.min(120000, track.optLong("expi", 120) * 1000 - 10000));
        return new AudioSource(uri.toString(), info, lifetime);
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
