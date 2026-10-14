package com.yesplaymusic.tablet;

import static org.junit.Assert.*;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.media.browse.MediaBrowser;
import android.media.session.PlaybackState;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.MimeTypes;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@androidx.media3.common.util.UnstableApi
@RunWith(AndroidJUnit4.class)
public class SystemMediaTest {
    private void ui(Runnable task) { InstrumentationRegistry.getInstrumentation().runOnMainSync(task); }
    private interface Condition { boolean check(); }
    private void await(Condition condition) throws Exception {
        long deadline = System.currentTimeMillis() + 15000;
        while (System.currentTimeMillis() < deadline) {
            AtomicReference<Boolean> ready = new AtomicReference<>(false);
            ui(() -> ready.set(condition.check()));
            if (ready.get()) return;
            Thread.sleep(100);
        }
        fail("Timed out waiting for native system media state");
    }
    private android.media.session.MediaController platform(Context context) {
        for (StatusBarNotification entry : ((NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE)).getActiveNotifications()) {
            android.media.session.MediaSession.Token token = entry.getNotification().extras.getParcelable(Notification.EXTRA_MEDIA_SESSION);
            if (token != null) {
                assertEquals(Notification.CATEGORY_TRANSPORT, entry.getNotification().category);
                return new android.media.session.MediaController(context, token);
            }
        }
        return null;
    }

    @Test public void systemBrowserTokenControlsAndResumption() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.startActivity(new android.content.Intent().setComponent(new ComponentName(context.getPackageName(),
            "com.yesplaymusic.tablet.MainActivity")).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        AtomicReference<ListenableFuture<MediaController>> connecting = new AtomicReference<>();
        ui(() -> connecting.set(new MediaController.Builder(context, new SessionToken(context,
            new ComponentName(context.getPackageName(), "com.yesplaymusic.tablet.PlaybackService"))).buildAsync()));
        MediaController controller = connecting.get().get(15, TimeUnit.SECONDS);
        MediaBrowser browser = null;
        try (Fixture fixture = new Fixture()) {
            List<MediaItem> queue = Arrays.asList(
                new MediaItem.Builder().setMediaId("system-fixture-a").setUri(fixture.url())
                    .setMimeType(MimeTypes.AUDIO_WAV).setMediaMetadata(new MediaMetadata.Builder()
                        .setTitle("System Track A").setArtist("System Artist").build()).build(),
                new MediaItem.Builder().setMediaId("system-fixture-b").setUri(fixture.url())
                    .setMimeType(MimeTypes.AUDIO_WAV).setMediaMetadata(new MediaMetadata.Builder()
                        .setTitle("System Track B").setArtist("System Artist").build()).build());
            ui(() -> { controller.setVolume(0); controller.setMediaItems(queue); controller.prepare(); controller.play(); });
            await(() -> controller.isPlaying() && platform(context) != null);
            android.media.session.MediaController system = platform(context);
            await(() -> system.getPlaybackState() != null && system.getPlaybackState().getState() == PlaybackState.STATE_PLAYING);
            await(() -> system.getMetadata() != null && "System Track A".equals(system.getMetadata().getString(android.media.MediaMetadata.METADATA_KEY_TITLE)));
            await(() -> system.getMetadata().getLong(android.media.MediaMetadata.METADATA_KEY_DURATION) > 0);
            assertTrue((system.getPlaybackState().getActions() & PlaybackState.ACTION_SKIP_TO_NEXT) != 0);

            CountDownLatch connected = new CountDownLatch(1);
            AtomicReference<MediaBrowser> reference = new AtomicReference<>();
            ui(() -> {
                MediaBrowser nativeBrowser = new MediaBrowser(context,
                    new ComponentName(context.getPackageName(), "com.yesplaymusic.tablet.PlaybackService"),
                    new MediaBrowser.ConnectionCallback() {
                        @Override public void onConnected() { connected.countDown(); }
                    }, null);
                reference.set(nativeBrowser);
                nativeBrowser.connect();
            });
            assertTrue("Platform MediaBrowser must discover the library service", connected.await(15, TimeUnit.SECONDS));
            browser = reference.get();
            MediaBrowser activeBrowser = browser;
            CountDownLatch children = new CountDownLatch(1);
            AtomicReference<List<MediaBrowser.MediaItem>> contents = new AtomicReference<>();
            ui(() -> activeBrowser.subscribe(activeBrowser.getRoot(), new MediaBrowser.SubscriptionCallback() {
                @Override public void onChildrenLoaded(String root, List<MediaBrowser.MediaItem> items) {
                    if (items.size() == 2) { contents.set(items); children.countDown(); }
                }
            }));
            assertTrue("System browser must receive the native queue", children.await(15, TimeUnit.SECONDS));
            assertTrue(contents.get().get(0).isPlayable());
            assertEquals("System Track A", contents.get().get(0).getDescription().getTitle().toString());

            system.getTransportControls().pause();
            await(() -> !controller.isPlaying());
            system.getTransportControls().skipToNext();
            await(() -> controller.getCurrentMediaItem() != null && "system-fixture-b".equals(controller.getCurrentMediaItem().mediaId));
            system.getTransportControls().seekTo(2000);
            await(() -> controller.getCurrentPosition() >= 1900);
            // Clear only the live timeline. System resumption must restore the saved queue and position.
            ui(controller::clearMediaItems);
            await(() -> controller.getMediaItemCount() == 0);
            system.getTransportControls().play();
            await(() -> controller.isPlaying() && controller.getMediaItemCount() == 2
                && "system-fixture-b".equals(controller.getCurrentMediaItem().mediaId));
            assertTrue("Resume must preserve the saved seek position", controller.getCurrentPosition() >= 1900);
        } finally {
            if (browser != null) { MediaBrowser cleanup = browser; ui(cleanup::disconnect); }
            ui(() -> { controller.stop(); controller.release(); });
        }
    }

    /** Offline PCM fixture served on loopback; no music account or public API is used. */
    private static final class Fixture implements AutoCloseable {
        private final ServerSocket server = new ServerSocket(0, 0, java.net.InetAddress.getByName("127.0.0.1"));
        private volatile boolean open = true;
        Fixture() throws Exception {
            byte[] pcm = new byte[1920000];
            ByteBuffer wav = ByteBuffer.allocate(44 + pcm.length).order(ByteOrder.LITTLE_ENDIAN);
            wav.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + pcm.length)
                .put("WAVEfmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short) 1).putShort((short) 1)
                .putInt(16000).putInt(32000).putShort((short) 2).putShort((short) 16)
                .put("data".getBytes(StandardCharsets.US_ASCII)).putInt(pcm.length).put(pcm);
            byte[] bytes = wav.array();
            Thread worker = new Thread(() -> {
                while (open) try (Socket socket = server.accept()) {
                    socket.setSoTimeout(5000);
                    ByteArrayOutputStream header = new ByteArrayOutputStream();
                    int value;
                    while (header.size() < 8192 && (value = socket.getInputStream().read()) != -1) {
                        header.write(value);
                        if (header.toString("US-ASCII").endsWith("\r\n\r\n")) break;
                    }
                    OutputStream output = socket.getOutputStream();
                    output.write(("HTTP/1.1 200 OK\r\nContent-Type: audio/wav\r\nContent-Length: " + bytes.length
                        + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                    output.write(bytes); output.flush();
                } catch (Exception ignored) { }
            }, "SystemMediaFixture");
            worker.setDaemon(true); worker.start();
        }
        String url() { return "http://127.0.0.1:" + server.getLocalPort() + "/fixture.wav"; }
        @Override public void close() throws Exception { open = false; server.close(); }
    }
}
