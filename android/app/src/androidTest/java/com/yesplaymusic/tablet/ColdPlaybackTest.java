package com.yesplaymusic.tablet;

import static org.junit.Assert.*;
import static com.yesplaymusic.tablet.TabletUiTest.awaitJs;
import static com.yesplaymusic.tablet.TabletUiTest.js;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class ColdPlaybackTest {
    private static final String PLAYER = "document.querySelector('#app').__vue__.$store.state.player";
    private Context app;
    private String previousApi, previousCookie, previousRealIP, previousProxy;
    private boolean remote, archive;

    @Before public void rememberSettings() {
        app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferences settings = ApiClient.preferences(app);
        previousApi = settings.getString("apiUrl", "");
        remote = settings.getBoolean("useRemoteApi", false);
        previousCookie = settings.getString("cookie", "");
        previousRealIP = settings.getString("audioRealIP", "");
        previousProxy = settings.getString("audioProxy", "");
        archive = settings.getBoolean("archiveMode", false);
        AudioCache.preserve(app, false);
    }
    @After public void restoreSettings() {
        ApiClient.preferences(app).edit().putString("apiUrl", previousApi).putBoolean("useRemoteApi", remote)
            .putString("audioRealIP", previousRealIP).putString("audioProxy", previousProxy).apply();
        ApiClient.setCookie(app, previousCookie);
        AudioCache.preserve(app, archive);
    }
    private static JSONObject result(JSONObject track) throws Exception {
        return new JSONObject().put("code", 200).put("data", new JSONArray().put(track));
    }
    private static void awaitPlayback(Activity activity, long id) throws Exception {
        awaitJs(activity, "JSON.parse(YesPlayMusicAndroid.getState()).trackId === '" + id + "' && "
            + "JSON.parse(YesPlayMusicAndroid.getState()).playing && " + PLAYER + ".seek() > 0.2");
    }

    @Test public void selectUncachedSongsThenReplayOffline() throws Exception {
        long first = System.currentTimeMillis(), second = first + 1;
        List<String> requests = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger audioReads = new AtomicInteger();
        try (SystemMediaTest.Fixture fixture = new SystemMediaTest.Fixture((request, origin) -> {
            String path = request.getPath(), id = request.getQueryParameter("id");
            if (path.startsWith("/audio/")) { audioReads.incrementAndGet(); return null; }
            if ("/song/url/v1".equals(path) || "/song/url".equals(path)) {
                requests.add(path);
                return result(new JSONObject().put("id", id).put("url", origin + "/audio/" + id + ".wav"));
            }
            // No song metadata, artwork, lyrics or public music service is needed to start the stream.
            return new JSONObject().put("code", 200).put("songs", new JSONArray()).put("data", new JSONArray());
        })) {
            ApiClient.setBaseUrl(app, fixture.origin());
            Activity activity = InstrumentationRegistry.getInstrumentation().startActivitySync(
                new Intent(app, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            try {
                awaitJs(activity, PLAYER);
                assertEquals(0, AudioCache.state(app, String.valueOf(first)));
                assertEquals(0, AudioCache.state(app, String.valueOf(second)));
                assertTrue(js(activity, "(" + PLAYER + ".volume = 0, "
                    + PLAYER + ".replacePlaylist([" + first + "], 1, 'playlist'), true)"));
                awaitPlayback(activity, first);
                assertTrue(js(activity, "(" + PLAYER + ".replacePlaylist([" + second + "], 2, 'playlist'), true)"));
                awaitPlayback(activity, second);
                assertEquals(java.util.Arrays.asList("/song/url", "/song/url"), requests);
                assertTrue(audioReads.get() >= 2);
                awaitJs(activity, "JSON.parse(YesPlayMusicAndroid.getLibraryAudioStates('[" + second + "]'))['" + second + "'] === 2");

                assertTrue(js(activity, "(" + PLAYER + ".pause(), true)"));
                awaitJs(activity, "!JSON.parse(YesPlayMusicAndroid.getState()).playing");
                AudioCache.preserve(app, true);
                int reads = audioReads.get();
                assertTrue(js(activity, "(" + PLAYER + ".replacePlaylist([" + second + "], 2, 'playlist'), true)"));
                awaitPlayback(activity, second);
                assertEquals("Complete audio should replay entirely from disk", reads, audioReads.get());
            } finally {
                js(activity, "(" + PLAYER + ".pause(), true)");
                InstrumentationRegistry.getInstrumentation().runOnMainSync(activity::finish);
            }
        }
    }

    @Test public void legacyEndpointKeepsCredentialsAndHonorsPlaybackRestrictions() throws Exception {
        String cookie = "MUSIC_U=playback-fixture;";
        List<String> requests = Collections.synchronizedList(new ArrayList<>());
        ApiClient.preferences(app).edit().putString("audioRealIP", "211.161.244.70")
            .putString("audioProxy", "HTTPS://proxy.example:443").apply();
        try (SystemMediaTest.Fixture fixture = new SystemMediaTest.Fixture((request, origin) -> {
            String id = request.getQueryParameter("id");
            boolean legacy = "/song/url".equals(request.getPath());
            requests.add(request.getPath() + ":" + id + ":" + request.getQueryParameter("cookie") + ":"
                + request.getQueryParameter(legacy ? "br" : "level") + ":"
                + request.getQueryParameter("realIP") + ":" + request.getQueryParameter("proxy"));
            if ("92".equals(id)) return result(new JSONObject().put("id", id).put("url", origin + "/trial.wav")
                .put("freeTrialInfo", new JSONObject().put("end", 30)));
            if ("93".equals(id)) return new JSONObject().put("code", 429);
            return result(new JSONObject().put("id", id).put("url", origin + "/full.wav"));
        })) {
            ApiClient.setBaseUrl(app, fixture.origin());
            ApiClient.setCookie(app, cookie);
            assertEquals(fixture.origin() + "/full.wav", ApiClient.resolveAudio(app, "91", "higher").toString());
            for (String id : new String[] {"92", "93"}) {
                try { ApiClient.resolveAudio(app, id, "higher"); fail("Restricted response must not produce a source"); }
                catch (IOException expected) { }
            }
            assertEquals(java.util.Arrays.asList(
                "/song/url:91:" + cookie + ":192000:211.161.244.70:HTTPS://proxy.example:443",
                "/song/url:92:" + cookie + ":192000:211.161.244.70:HTTPS://proxy.example:443",
                "/song/url:93:" + cookie + ":192000:211.161.244.70:HTTPS://proxy.example:443"), requests);
        }
    }
}
