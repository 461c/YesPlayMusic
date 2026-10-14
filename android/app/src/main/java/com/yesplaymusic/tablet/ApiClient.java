package com.yesplaymusic.tablet;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ConcurrentHashMap;
import org.json.JSONArray;
import org.json.JSONObject;

final class ApiClient {
    private static final ConcurrentHashMap<String, String> audioUrls = new ConcurrentHashMap<>();
    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("android-player", Context.MODE_PRIVATE);
    }
    static String baseUrl(Context context) {
        return preferences(context).getString("apiUrl", "");
    }
    static void setBaseUrl(Context context, String address) {
        Uri uri = Uri.parse(address.trim());
        if ((!"https".equals(uri.getScheme()) && !"http".equals(uri.getScheme())) || uri.getHost() == null) {
            throw new IllegalArgumentException("请输入有效的 HTTP 或 HTTPS 接口地址");
        }
        preferences(context).edit().putString("apiUrl", address.trim().replaceAll("/+$", "")).apply();
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
        String cookie = preferences(context).getString("cookie", "");
        String separator = path.contains("?") ? "&" : "?";
        URL url = new URL(baseUrl(context) + path + separator + "cookie=" + Uri.encode(cookie));
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        try {
            if (connection.getResponseCode() != 200) throw new IOException("音乐接口请求失败");
            return new JSONObject(new String(read(connection.getInputStream()), StandardCharsets.UTF_8));
        } finally { connection.disconnect(); }
    }
    static Uri resolveAudio(Context context, String id) throws IOException {
        String key = id + ":" + (System.currentTimeMillis() / 120000);
        String cached = audioUrls.get(key);
        if (cached != null) return Uri.parse(cached);
        String result;
        String cookie = preferences(context).getString("cookie", "");
        if (cookie.contains("MUSIC_U=")) {
            try {
                JSONObject response = json(context, "/song/url?id=" + Uri.encode(id) + "&br=320000");
                JSONArray data = response.optJSONArray("data");
                JSONObject track = data == null ? null : data.optJSONObject(0);
                result = track == null ? "" : track.optString("url", "");
                if (result.isEmpty() || (track.has("freeTrialInfo") && !track.isNull("freeTrialInfo"))) {
                    throw new IOException("该曲目没有可用的完整音源");
                }
            } catch (Exception error) { throw new IOException(error); }
        } else {
            result = "https://music.163.com/song/media/outer/url?id=" + Uri.encode(id);
        }
        if (audioUrls.size() > 100) audioUrls.clear();
        audioUrls.put(key, result);
        return Uri.parse(result);
    }
    static WebResourceResponse proxy(Context context, Uri uri, String method) {
        HttpURLConnection connection = null;
        try {
            String endpoint = uri.getEncodedPath().substring(4);
            String query = uri.getEncodedQuery();
            URL url = new URL(baseUrl(context) + endpoint + (query == null ? "" : "?" + query));
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(15000);
            if ("POST".equals(method)) {
                connection.setDoOutput(true);
                connection.getOutputStream().close();
            }
            int code = connection.getResponseCode();
            byte[] body = read(code >= 400 ? connection.getErrorStream() : connection.getInputStream());
            return new WebResourceResponse("application/json", "UTF-8", code, "Response",
                Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(body));
        } catch (Exception error) {
            byte[] body = "{\"code\":502,\"msg\":\"音乐接口连接失败，请在设置中检查接口地址\"}".getBytes(StandardCharsets.UTF_8);
            return new WebResourceResponse("application/json", "UTF-8", 502, "Bad Gateway",
                Collections.emptyMap(), new ByteArrayInputStream(body));
        } finally { if (connection != null) connection.disconnect(); }
    }
}
