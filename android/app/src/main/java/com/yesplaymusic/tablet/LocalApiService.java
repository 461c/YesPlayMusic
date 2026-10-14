package com.yesplaymusic.tablet;

import android.app.Service;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import java.util.concurrent.CompletableFuture;

/** A private bound process keeps Node's native runtime apart from Chromium and Media3. */
public final class LocalApiService extends Service {
    private CompletableFuture<String> startup;
    private Messenger messenger;

    @Override public void onCreate() {
        super.onCreate();
        startup = EmbeddedApi.ensureStarted(this);
        messenger = new Messenger(new Handler(Looper.getMainLooper(), request -> {
            if (request.what != 1 || request.replyTo == null) return false;
            Messenger client = request.replyTo;
            startup.whenComplete((address, error) -> {
                Message response = Message.obtain(null, error == null ? 1 : 2);
                Bundle data = new Bundle();
                if (error == null) data.putString("address", address);
                response.setData(data);
                try { client.send(response); } catch (Exception ignored) { }
            });
            return true;
        }));
    }

    @Override public IBinder onBind(Intent intent) { return messenger.getBinder(); }
}
