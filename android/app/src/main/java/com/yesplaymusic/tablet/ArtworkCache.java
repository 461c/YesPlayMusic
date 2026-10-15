package com.yesplaymusic.tablet;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONArray;
import org.json.JSONObject;

/** Playlist covers may prefetch; song artwork downloads only on an actual eligible image request. */
final class ArtworkCache {
    private static ArtworkCache instance;
    static synchronized ArtworkCache get(Context context) {
        if (instance == null) instance = new ArtworkCache(context.getApplicationContext());
        return instance;
    }
    private final File directory;
    private final ExecutorService downloads = Executors.newFixedThreadPool(2);
    private final Set<String> eligible = ConcurrentHashMap.newKeySet();
    private final ConcurrentHashMap<String, FutureTask<Boolean>> pending = new ConcurrentHashMap<>();
    private final AtomicLong bytes = new AtomicLong(), count = new AtomicLong();
    private final AtomicLong hits = new AtomicLong(), network = new AtomicLong(), failures = new AtomicLong();
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
    static String identity(String address) {
        Uri uri = Uri.parse(address);
        String path = uri.getEncodedPath();
        String name = path.substring(path.lastIndexOf('/') + 1);
        // NetEase photo IDs are shared across CDN shards, signatures and resize parameters.
        return name.matches("[0-9]+\\.(jpg|jpeg|png|webp)")
            ? "netease-photo:" + name.substring(0, name.lastIndexOf('.')) : "netease-path:" + path;
    }
    private File hashedFile(String key) throws Exception {
        byte[] hash = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
        StringBuilder name = new StringBuilder();
        for (byte part : hash) name.append(String.format(Locale.ROOT, "%02x", part & 255));
        return new File(directory, name + ".img");
    }
    private File file(String address, int size) throws Exception {
        return hashedFile(identity(address) + (size == 224 ? ":224" : ""));
    }
    private File existing(String address, int size) throws Exception {
        File large = file(address, 1024);
        if (large.isFile()) return large;
        File small = file(address, 224);
        if (size == 224 && small.isFile()) return small;
        // Older releases keyed 1024px entries by the full CDN hostname. Keep those caches usable.
        String path = Uri.parse(address).getEncodedPath();
        for (int shard = 1; shard <= 10; shard++) {
            File legacy = hashedFile("https://p" + shard + ".music.126.net" + path);
            if (legacy.isFile()) {
                synchronized (this) {
                    if (!large.exists()) legacy.renameTo(large);
                }
                return large.isFile() ? large : legacy;
            }
        }
        return null;
    }
    void resetEligibility() { eligible.clear(); }
    void allow(String json) {
        try {
            JSONArray urls = new JSONArray(json);
            for (int i = 0; i < urls.length(); i++) {
                String address = canonical(urls.optString(i));
                if (address != null) eligible.add(identity(address));
            }
        } catch (Exception ignored) { }
    }
    private FutureTask<Boolean> task(String address, int size) {
        String key = identity(address) + ":" + size;
        long epoch = generation;
        FutureTask<Boolean> candidate = new FutureTask<Boolean>(() -> {
            if (epoch != generation) return false;
            boolean result = download(address, size, epoch);
            if (!result && epoch == generation) failures.incrementAndGet();
            return result;
        }) {
            @Override protected void done() { pending.remove(key, this); }
        };
        FutureTask<Boolean> active = pending.putIfAbsent(key, candidate);
        return active == null ? candidate : active;
    }
    void enqueue(String json) {
        try {
            JSONArray urls = new JSONArray(json);
            for (int i = 0; i < urls.length(); i++) {
                String address = canonical(urls.optString(i));
                if (address == null) continue;
                eligible.add(identity(address));
                if (existing(address, 1024) == null) downloads.execute(task(address, 1024));
            }
        } catch (Exception ignored) { }
    }
    private boolean download(String address, int size, long epoch) {
        HttpURLConnection connection = null;
        File temporary = null;
        try {
            if (existing(address, size) != null) return true;
            if (directory.getUsableSpace() < 128L * 1024 * 1024) return false;
            File target = file(address, size);
            String location = address + "?param=" + size + "y" + size;
            for (int redirect = 0; redirect <= 3; redirect++) {
                network.incrementAndGet();
                connection = (HttpURLConnection) new URL(location).openConnection();
                connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Referer", "https://music.163.com/");
                int status = connection.getResponseCode();
                if (status == 200) break;
                if (status < 300 || status > 399 || redirect == 3) return false;
                String next = new URL(new URL(location), connection.getHeaderField("Location")).toString();
                if (canonical(next) == null || !"https".equals(Uri.parse(next).getScheme())) return false;
                connection.disconnect(); connection = null;
                location = next;
            }
            String mime = connection.getContentType();
            if (mime == null || !mime.toLowerCase(Locale.ROOT).startsWith("image/")) return false;
            mime = mime.split(";")[0];
            temporary = File.createTempFile("artwork-", ".tmp", directory);
            long expected = connection.getContentLengthLong();
            if (expected > 16L * 1024 * 1024) return false;
            long sizeRead = 0;
            try (InputStream input = connection.getInputStream();
                 DataOutputStream output = new DataOutputStream(new BufferedOutputStream(new FileOutputStream(temporary)))) {
                output.writeUTF(mime);
                byte[] buffer = new byte[16384]; int length;
                while ((length = input.read(buffer)) != -1) {
                    if (epoch != generation || (sizeRead += length) > 16L * 1024 * 1024) return false;
                    output.write(buffer, 0, length);
                }
            }
            if (sizeRead == 0 || (expected >= 0 && sizeRead != expected)) return false;
            synchronized (this) {
                if (epoch != generation) return false;
                if (target.exists()) return true;
                if (!temporary.renameTo(target)) return false;
                bytes.addAndGet(target.length()); count.incrementAndGet();
            }
            return true;
        } catch (Exception ignored) { return false; }
        finally {
            if (connection != null) connection.disconnect();
            if (temporary != null) temporary.delete();
        }
    }
    static int requestedSize(Uri uri) {
        for (String name : uri.getQueryParameterNames()) {
            if (!Arrays.asList("param", "imageView", "thumbnail", "quality", "enlarge", "type").contains(name)) return 0;
        }
        String dimensions = uri.getQueryParameter("param");
        if (dimensions == null) dimensions = uri.getQueryParameter("thumbnail");
        if (dimensions == null) return 1024;
        try {
            String[] parts = dimensions.split("[yx]");
            if (parts.length != 2) return 0;
            return Math.max(Integer.parseInt(parts[0]), Integer.parseInt(parts[1])) <= 256 ? 224 : 1024;
        } catch (Exception ignored) { return 0; }
    }
    WebResourceResponse read(Uri uri) {
        String address = canonical(uri.toString());
        if (address == null) return null;
        int size = requestedSize(uri);
        if (size == 0) return null;
        DataInputStream input = null;
        try {
            File cached = existing(address, size);
            boolean hit = cached != null;
            if (cached == null && eligible.contains(identity(address))) {
                FutureTask<Boolean> active = pending.get(identity(address) + ":1024");
                if (active == null) active = task(address, size);
                // Run a queued task now or share the in-flight one; never fall through just because it is pending.
                active.run(); active.get(35, TimeUnit.SECONDS);
                cached = existing(address, size);
            }
            if (cached == null) return null;
            input = new DataInputStream(new BufferedInputStream(new FileInputStream(cached)));
            String mime = input.readUTF();
            WebResourceResponse response = new WebResourceResponse(mime, null, input);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "public, max-age=31536000, immutable");
            response.setResponseHeaders(headers);
            if (hit) hits.incrementAndGet();
            return response;
        } catch (Exception ignored) {
            if (input != null) try { input.close(); } catch (IOException ignoredClose) { }
            return null;
        }
    }
    JSONObject stats() {
        JSONObject value = new JSONObject();
        try { value.put("bytes", bytes.get()).put("count", count.get()).put("pending", pending.size())
            .put("hits", hits.get()).put("downloads", network.get()).put("failures", failures.get()); }
        catch (Exception ignored) { }
        return value;
    }
    synchronized JSONObject clear() {
        generation++; pending.clear();
        File[] files = directory.listFiles();
        if (files != null) for (File file : files) if (file.getName().endsWith(".img")) file.delete();
        bytes.set(0); count.set(0); hits.set(0); network.set(0); failures.set(0);
        files = directory.listFiles();
        if (files != null) for (File file : files) if (file.getName().endsWith(".img")) {
            bytes.addAndGet(file.length()); count.incrementAndGet();
        }
        return stats();
    }
}
