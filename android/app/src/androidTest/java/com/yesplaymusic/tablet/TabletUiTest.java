package com.yesplaymusic.tablet;

import static org.junit.Assert.*;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import java.io.File;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class TabletUiTest {
    private WebView findWeb(View view) {
        if (view instanceof WebView) return (WebView) view;
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup) view).getChildCount(); i++) {
            WebView found = findWeb(((ViewGroup) view).getChildAt(i));
            if (found != null) return found;
        }
        return null;
    }
    private boolean js(Activity activity, String expression) throws Exception {
        AtomicReference<String> result = new AtomicReference<>("false");
        CountDownLatch done = new CountDownLatch(1);
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            WebView web = findWeb(activity.getWindow().getDecorView());
            if (web == null) { done.countDown(); return; }
            web.evaluateJavascript("(function(){try{return Boolean(" + expression
                + ");}catch(e){return false;}})()", value -> { result.set(value); done.countDown(); });
        });
        assertTrue(done.await(5, TimeUnit.SECONDS));
        return "true".equals(result.get());
    }
    private void awaitJs(Activity activity, String expression) throws Exception {
        long deadline = System.currentTimeMillis() + 30000;
        while (System.currentTimeMillis() < deadline) {
            if (js(activity, expression)) return;
            Thread.sleep(100);
        }
        fail("WebView did not satisfy: " + expression);
    }
    @Test public void transparentInsetsAndLiveSystemAppearance() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Activity activity = InstrumentationRegistry.getInstrumentation().startActivitySync(
            new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        File report = new File(context.getExternalFilesDir(null), "android-ui");
        report.mkdirs();
        try {
            awaitJs(activity, "document.querySelector('#app').__vue__.$store");
            assertTrue(js(activity, "(document.querySelector('#app').__vue__.$store.state.settings.appearance='auto',true)"));
            device.executeShellCommand("cmd uimode night no");
            awaitJs(activity, "document.body.dataset.theme === 'light'");
            awaitJs(activity, "parseFloat(getComputedStyle(document.querySelector('nav')).paddingTop) >= "
                + "JSON.parse(YesPlayMusicAndroid.getEnvironment()).top && "
                + "JSON.parse(YesPlayMusicAndroid.getEnvironment()).top > 0 && "
                + "document.querySelector('nav').getBoundingClientRect().top === 0 && "
                + "getComputedStyle(document.querySelector('nav')).backdropFilter === 'blur(10px)'");
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                int[] origin = new int[2];
                findWeb(activity.getWindow().getDecorView()).getLocationOnScreen(origin);
                assertEquals("WebView must draw behind the transparent status bar", 0, origin[1]);
                assertEquals(android.graphics.Color.TRANSPARENT, activity.getWindow().getStatusBarColor());
            });
            device.takeScreenshot(new File(report, "tablet-light.png"));
            device.executeShellCommand("cmd uimode night yes");
            awaitJs(activity, "document.body.dataset.theme === 'dark' && YesPlayMusicAndroid.isSystemDark()");
            device.takeScreenshot(new File(report, "tablet-dark.png"));
            assertTrue(js(activity, "(document.querySelector('#app').__vue__.$store.state.settings.appearance='dark',true)"));
            device.executeShellCommand("cmd uimode night no");
            awaitJs(activity, "!YesPlayMusicAndroid.isSystemDark() && document.body.dataset.theme === 'dark'");
            assertTrue(js(activity, "(document.querySelector('#app').__vue__.$store.state.player._enabled=true,"
                + "true)"));
            awaitJs(activity, "document.querySelector('.player')");
            assertTrue(js(activity, "(document.querySelector('.player').style.bottom='140px',"
                + "document.querySelector('#app').__vue__.$store.commit('toggleLyrics'),true)"));
            awaitJs(activity, "document.querySelector('.lyrics-page') && "
                + "document.querySelector('.lyrics-page').getBoundingClientRect().top === 0 && "
                + "document.querySelector('.player').getBoundingClientRect().top >= document.documentElement.clientHeight && "
                + "getComputedStyle(document.querySelector('.player')).opacity === '1'");
            device.takeScreenshot(new File(report, "tablet-lyrics.png"));
            assertTrue(js(activity, "(document.querySelector('#app').__vue__.$store.commit('toggleLyrics'),true)"));
            awaitJs(activity, "document.querySelector('.player').getBoundingClientRect().top < "
                + "document.documentElement.clientHeight && document.querySelector('.player').style.bottom === '140px'");
        } finally {
            js(activity, "(document.querySelector('#app').__vue__.$store.state.settings.appearance='auto',"
                + "document.querySelector('#app').__vue__.$store.state.showLyrics=false,true)");
            device.executeShellCommand("cmd uimode night auto");
            InstrumentationRegistry.getInstrumentation().runOnMainSync(activity::finish);
        }
    }
}
