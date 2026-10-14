package com.yesplaymusic.tablet;

import android.content.Context;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import org.json.JSONArray;
import org.json.JSONObject;

/** One embedded runtime per application process, shared with the playback service. */
final class LocalApi {
    private static CompletableFuture<String> startup;
    private static volatile String address = "";
    private static volatile boolean exited;
    private static native int startNode(String directory, int port);

    static synchronized CompletableFuture<String> ensureStarted(Context context) {
        if (startup != null) return startup;
        Context app = context.getApplicationContext();
        startup = CompletableFuture.supplyAsync(() -> {
            try {
                Log.i("YesPlayMusicAPI", "Installing local API assets");
                File directory = install(app);
                Log.i("YesPlayMusicAPI", "Loading embedded Node runtime");
                int port;
                try (ServerSocket socket = new ServerSocket(0, 0, InetAddress.getByName("127.0.0.1"))) {
                    port = socket.getLocalPort();
                }
                System.loadLibrary("node");
                System.loadLibrary("ypm-node");
                String url = "http://127.0.0.1:" + port;
                new Thread(() -> {
                    int result = startNode(directory.getAbsolutePath(), port);
                    exited = true;
                    Log.e("YesPlayMusicAPI", "Embedded Node exited: " + result);
                }, "YesPlayMusicAPI").start();
                long deadline = System.nanoTime() + 30000000000L;
                while (System.nanoTime() < deadline && !exited) {
                    HttpURLConnection connection = null;
                    try {
                        connection = (HttpURLConnection) new URL(url + "/ypm/health").openConnection();
                        connection.setConnectTimeout(500);
                        connection.setReadTimeout(500);
                        JSONObject health = new JSONObject(new String(ApiClient.read(connection.getInputStream()), StandardCharsets.UTF_8));
                        if ("yesplaymusic-local-api".equals(health.optString("service"))) {
                            address = url;
                            Log.i("YesPlayMusicAPI", "Local API ready at " + url);
                            return url;
                        }
                    } catch (Exception ignored) { /* Wait for the embedded server to listen. */ }
                    finally { if (connection != null) connection.disconnect(); }
                    Thread.sleep(100);
                }
                throw new IOException("本地音乐接口启动失败，请关闭应用后重试");
            } catch (Exception | LinkageError error) {
                Log.e("YesPlayMusicAPI", "Local API startup failed", error);
                throw new java.util.concurrent.CompletionException(error);
            }
        });
        return startup;
    }

    static String address() { return address; }

    private static File install(Context context) throws Exception {
        JSONObject manifest = new JSONObject(new String(ApiClient.read(context.getAssets().open("api/manifest.json")), StandardCharsets.UTF_8));
        File parent = new File(context.getNoBackupFilesDir(), "music-api");
        File directory = new File(parent, manifest.getString("version"));
        File marker = new File(directory, ".installed");
        if (!marker.exists()) {
            directory.mkdirs();
            JSONArray files = manifest.getJSONArray("files");
            for (int i = 0; i < files.length(); i++) {
                String path = files.getString(i);
                File target = new File(directory, path);
                if (!target.getCanonicalPath().startsWith(directory.getCanonicalPath() + File.separator)) {
                    throw new IOException("Invalid API asset path");
                }
                target.getParentFile().mkdirs();
                if (i % 500 == 0) Log.i("YesPlayMusicAPI", "Installing API file " + i + "/" + files.length());
                try (FileOutputStream output = new FileOutputStream(target)) {
                    output.write(ApiClient.read(context.getAssets().open("api/" + path)));
                }
            }
            if (!marker.createNewFile()) throw new IOException("Cannot finish API installation");
        }
        new File(directory, "tmp").mkdirs();
        // The previous version cannot be running: Node only starts once in this process.
        File[] previous = parent.listFiles();
        if (previous != null) for (File file : previous) {
            if (!file.equals(directory)) delete(file);
        }
        return directory;
    }

    private static void delete(File file) throws IOException {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) delete(child);
        if (file.exists() && !file.delete()) throw new IOException("Cannot remove old API files");
    }
}
