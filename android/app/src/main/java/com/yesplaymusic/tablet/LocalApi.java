package com.yesplaymusic.tablet;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import java.io.IOException;
import java.util.concurrent.CompletableFuture;

/** Bind the API process for the lifetime of the UI/playback process. Never load Node here. */
final class LocalApi {
    private static CompletableFuture<String> startup;
    private static volatile String address = "";

    static synchronized CompletableFuture<String> ensureStarted(Context context) {
        if (startup != null) return startup;
        Context app = context.getApplicationContext();
        CompletableFuture<String> result = new CompletableFuture<>();
        startup = result;
        Messenger reply = new Messenger(new Handler(Looper.getMainLooper(), message -> {
            synchronized (LocalApi.class) {
                if (startup != result) return true;
                String url = message.getData().getString("address", "");
                if (message.what == 1 && url.startsWith("http://127.0.0.1:")) {
                    address = url;
                    result.complete(url);
                } else {
                    result.completeExceptionally(new IOException("本地音乐接口启动失败"));
                }
            }
            return true;
        }));
        ServiceConnection connection = new ServiceConnection() {
            @Override public void onServiceConnected(ComponentName name, IBinder binder) {
                Message request = Message.obtain(null, 1);
                request.replyTo = reply;
                try { new Messenger(binder).send(request); }
                catch (Exception error) { result.completeExceptionally(error); }
            }
            @Override public void onServiceDisconnected(ComponentName name) {
                synchronized (LocalApi.class) {
                    if (startup == result) { startup = null; address = ""; }
                }
                result.completeExceptionally(new IOException("本地音乐接口进程已结束"));
                try { app.unbindService(this); } catch (IllegalArgumentException ignored) { }
            }
            @Override public void onBindingDied(ComponentName name) { onServiceDisconnected(name); }
            @Override public void onNullBinding(ComponentName name) {
                result.completeExceptionally(new IOException("无法连接本地音乐接口"));
            }
        };
        if (!app.bindService(new Intent(app, LocalApiService.class), connection,
                Context.BIND_AUTO_CREATE | Context.BIND_IMPORTANT)) {
            result.completeExceptionally(new IOException("无法启动本地音乐接口服务"));
        }
        return result;
    }

    static String address() { return address; }
}
