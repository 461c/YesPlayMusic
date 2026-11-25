package com.yesplaymusic.tablet;

import android.content.Context;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** Explicit manual task, isolated from playback and never crawling a playlist natively. */
@androidx.media3.common.util.UnstableApi
final class LibraryCacheTask {
    private static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final ConcurrentHashMap<String, Task> tasks = new ConcurrentHashMap<>();
    private static final AtomicBoolean busy = new AtomicBoolean(false);
    private static final class Task {
        final AtomicBoolean stopped = new AtomicBoolean(false), paused = new AtomicBoolean(false);
        volatile String state = "running", message = "";
        volatile String phase = "准备缓存", current = "";
        volatile long bytes = 0, totalBytes = 0;
        volatile Thread thread;
    }
    static String start(Context context, String json) {
        if (!busy.compareAndSet(false, true)) return "";
        Context app = context.getApplicationContext();
        String id = UUID.randomUUID().toString();
        Task task = new Task();
        if (tasks.size() > 32) tasks.entrySet().removeIf(entry -> !"running".equals(entry.getValue().state));
        tasks.put(id, task);
        String cookie = ApiClient.preferences(app).getString("cookie", "");
        String api = ApiClient.baseUrl(app);
        worker.execute(() -> {
            task.thread = Thread.currentThread();
            try {
                JSONObject command = new JSONObject(json);
                task.current = command.optString("id", "");
                task.phase = "image".equals(command.optString("kind")) ? "下载封面" : "下载音乐";
                java.util.function.BooleanSupplier cancelled = () -> task.stopped.get()
                    || !cookie.equals(ApiClient.preferences(app).getString("cookie", ""))
                    || !api.equals(ApiClient.baseUrl(app)) || ApiClient.preferences(app).getBoolean("archiveMode", false);
                java.util.function.BooleanSupplier checkpoint = () -> {
                    while (task.paused.get() && !cancelled.getAsBoolean()) {
                        task.phase = "已暂停";
                        try { Thread.sleep(100); }
                        catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                    }
                    return cancelled.getAsBoolean();
                };
                if (cancelled.getAsBoolean()) throw new java.io.IOException("已停止");
                if ("image".equals(command.optString("kind"))) {
                    if (!ArtworkCache.get(app).cacheSelected(command.getString("url"), checkpoint, (bytes, total) -> {
                        task.bytes = bytes;
                        task.totalBytes = total;
                        task.phase = "下载封面";
                    })) throw new java.io.IOException("图片缓存失败");
                } else AudioCache.cacheSelected(app, command.getString("id"), () -> {
                    return checkpoint.getAsBoolean();
                }, (bytes, total) -> {
                    task.bytes = bytes;
                    task.totalBytes = total;
                    task.phase = "下载音乐";
                });
                task.state = cancelled.getAsBoolean() ? "cancelled" : "done";
            } catch (Exception error) {
                task.message = error.getMessage() == null ? "缓存请求失败" : error.getMessage();
                task.state = task.message.contains("完整音源") ? "unavailable" : "error";
            } finally { task.thread = null; Thread.interrupted(); busy.set(false); }
        });
        return id;
    }
    static String status(String id) {
        Task task = tasks.get(id);
        try { return new JSONObject().put("state", task == null ? "missing" : task.state)
            .put("message", task == null ? "任务已结束" : task.message)
            .put("phase", task == null ? "" : task.phase)
            .put("current", task == null ? "" : task.current)
            .put("bytes", task == null ? 0 : task.bytes)
            .put("totalBytes", task == null ? 0 : task.totalBytes).toString(); }
        catch (Exception ignored) { return "{}"; }
    }
    static void cancel(String id) { Task task = tasks.get(id); if (task != null) { task.stopped.set(true); Thread thread = task.thread; if (thread != null) thread.interrupt(); } }
    static void pause(String id) { Task task = tasks.get(id); if (task != null) task.paused.set(true); }
    static void resume(String id) { Task task = tasks.get(id); if (task != null) { task.paused.set(false); task.phase = "下载音乐"; } }
}
