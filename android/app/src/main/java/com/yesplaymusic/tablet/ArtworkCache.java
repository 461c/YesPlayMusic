package com.yesplaymusic.tablet;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONArray;
import org.json.JSONObject;

/** Explicit library artwork only. Browsing or playing a random track never enrolls an image. */
final class ArtworkCache {
    private static ArtworkCache instance;
    static synchronized ArtworkCache get(Context context) {
        if (instance == null) instance = new ArtworkCache(context.getApplicationContext());
        return instance;
    }
    private final File directory;
    private final ExecutorService downloads = Executors.newFixedThreadPool(2);
    private final Set<String> pending = ConcurrentHashMap.newKeySet();
    private final AtomicLong bytes = new AtomicLong(), count = new AtomicLong();
    private volatile long generation;
    private ArtworkCache(Context context) {
        directory = new File(context.getFilesDir(), "library-artwork");
        directory.mkdirs();
        File[] files = directory.listFiles();
        if (files != null) for (File file : files) {
            if (file.getName().endsWith(".img")) { bytes.addAndGet(file.length()); count.incrementAndGet(); }
            else file.delete();
        }
    }
    static String canonical(String address) {
        try {
            Uri uri = Uri.parse(address);
            String host = uri.getHost();
            if (host == null || !host.matches("p[0-9]+\\.music\\.126\\.net")
                || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getEncodedPath() == null
                || uri.getEncodedPath().isEmpty()) return null;
            return "https://" + host + uri.getEncodedPath();
        } catch (Exception ignored) { return null; }
    }
    private File file(String address) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(address.getBytes(StandardCharsets.UTF_8));
        StringBuilder key = new StringBuilder();
        for (byte part : hash) key.append(String.format(Locale.ROOT, "%02x", part & 255));
        return new File(directory, key + ".img");
    }
    void enqueue(String json) {
        try {
            JSONArray urls = new JSONArray(json);
            for (int i = 0; i < urls.length(); i++) {
                String url = canonical(urls.optString(i));
                if (url == null || file(url).isFile() || !pending.add(url)) continue;
                long epoch = generation;
                downloads.execute(() -> {
                    try { if (epoch == generation) download(url, epoch); }
                    finally { if (epoch == generation) pending.remove(url); }
                });
            }
        } catch (Exception ignored) { }
    }
    private void download(String address, long epoch) {
        HttpURLConnection connection = null;
        File temporary = null;
        try {
            if (directory.getUsableSpace() < 128L * 1024 * 1024) return;
            File target = file(address);
            if (target.isFile()) return;
            connection = (HttpURLConnection) new URL(address + "?param=1024y1024").openConnection();
            connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Referer", "https://music.163.com/");
            if (connection.getResponseCode() != 200) return;
            String mime = connection.getContentType();
            if (mime == null || !mime.toLowerCase(Locale.ROOT).startsWith("image/")) return;
            mime = mime.split(";")[0];
            temporary = File.createTempFile("artwork-", ".tmp", directory);
            long expected = connection.getContentLengthLong();
            if (expected > 16L * 1024 * 1024) return;
            long size = 0;
            try (InputStream input = connection.getInputStream();
                 DataOutputStream output = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(temporary)))) {
                output.writeUTF(mime);
                byte[] buffer = new byte[16384]; int length;
                while ((length = input.read(buffer)) != -1) {
                    if (epoch != generation || (size += length) > 16L * 1024 * 1024) return;
                    output.write(buffer, 0, length);
                }
            }
            if (size == 0 || (expected >= 0 && size != expected)) return;
            synchronized (this) {
                if (epoch != generation || target.exists()) return;
                if (temporary.renameTo(target)) { bytes.addAndGet(target.length()); count.incrementAndGet(); }
            }
        } catch (Exception ignored) { /* Keep ordinary remote image loading available. */ }
        finally {
            if (connection != null) connection.disconnect();
            if (temporary != null) temporary.delete();
        }
    }
    WebResourceResponse read(Uri uri) {
        String address = canonical(uri.toString());
        if (address == null) return null;
        // Only square display variants may reuse the 1024px master; other transforms stay remote.
        String query = uri.getEncodedQuery();
        if (query != null) {
            if (!query.matches("param=[0-9]+y[0-9]+")) return null;
            String[] dimensions = query.substring(6).split("y");
            if (!dimensions[0].equals(dimensions[1])) return null;
        }
        DataInputStream input = null;
        try {
            input = new DataInputStream(new BufferedInputStream(new FileInputStream(file(address))));
            String mime = input.readUTF();
            WebResourceResponse response = new WebResourceResponse(mime, null, input);
            response.setResponseHeaders(Collections.singletonMap("Access-Control-Allow-Origin", "*"));
            return response;
        } catch (Exception ignored) {
            if (input != null) try { input.close(); } catch (IOException ignoredClose) { }
            return null;
        }
    }
    JSONObject stats() {
        JSONObject value = new JSONObject();
        try { value.put("bytes", bytes.get()).put("count", count.get()).put("pending", pending.size()); }
        catch (Exception ignored) { }
        return value;
    }
    synchronized JSONObject clear() {
        generation++; pending.clear();
        File[] files = directory.listFiles();
        if (files != null) for (File file : files) {
            if (file.getName().endsWith(".img")) file.delete();
        }
        // Recount to report any files that could not be deleted.
        bytes.set(0); count.set(0);
        files = directory.listFiles();
        if (files != null) for (File file : files) if (file.getName().endsWith(".img")) {
            bytes.addAndGet(file.length()); count.incrementAndGet();
        }
        return stats();
    }
}
