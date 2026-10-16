package com.yesplaymusic.tablet;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.res.Configuration;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.view.WindowInsets;
import android.view.View;
import android.view.WindowManager;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.webkit.WebViewAssetLoader;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.IOException;
import java.net.URLConnection;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

@androidx.media3.common.util.UnstableApi
public final class MainActivity extends Activity {
    private WebView web;
    private android.widget.FrameLayout content;
    private volatile boolean destroyed = false;
    private final ExecutorService apiWorker = Executors.newFixedThreadPool(4);
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<JSONObject> pending = new ArrayList<>();
    private volatile String snapshot = "{}";
    private boolean pageReady = false;
    private volatile boolean apiStartupFailed = false;
    private java.util.concurrent.CompletableFuture<String> observedApiStartup;
    private boolean visible = false;
    private volatile String environment = "{}";
    private int insetTop, insetBottom, insetLeft, insetRight;
    private boolean appearanceDark, lyricsOpen;
    private final android.content.SharedPreferences.OnSharedPreferenceChangeListener audioInfoListener = (preferences, key) -> {
        if ("currentAudioInfo".equals(key)) handler.post(() -> {
            if (!destroyed) emitState();
        });
    };
    private final Runnable progress = new Runnable() {
        @Override public void run() {
            if (!visible) return;
            emitState();
            handler.postDelayed(this, 1000);
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ApiClient.preferences(this).registerOnSharedPreferenceChangeListener(audioInfoListener);
        configureSystemBars();
        web = new WebView(this);
        // Native edge stretching scales the entire WebView, including fixed navbar/player.
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        content = new android.widget.FrameLayout(this);
        content.setBackgroundColor(appearanceDark ? android.graphics.Color.BLACK : android.graphics.Color.WHITE);
        content.addView(web, new android.widget.FrameLayout.LayoutParams(-1, -1));
        setContentView(content);
        content.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                insetLeft = bars.left; insetTop = bars.top; insetRight = bars.right; insetBottom = bars.bottom;
            } else {
                insetLeft = insets.getSystemWindowInsetLeft(); insetTop = insets.getSystemWindowInsetTop();
                insetRight = insets.getSystemWindowInsetRight(); insetBottom = insets.getSystemWindowInsetBottom();
                if (Build.VERSION.SDK_INT >= 28 && insets.getDisplayCutout() != null) {
                    insetLeft = Math.max(insetLeft, insets.getDisplayCutout().getSafeInsetLeft());
                    insetTop = Math.max(insetTop, insets.getDisplayCutout().getSafeInsetTop());
                    insetRight = Math.max(insetRight, insets.getDisplayCutout().getSafeInsetRight());
                    insetBottom = Math.max(insetBottom, insets.getDisplayCutout().getSafeInsetBottom());
                }
            }
            view.post(this::emitEnvironment);
            return insets;
        });
        web.addOnLayoutChangeListener((view, l, t, r, b, oldL, oldT, oldR, oldB) -> emitEnvironment());
        web.setBackgroundColor(appearanceDark ? android.graphics.Color.BLACK : android.graphics.Color.WHITE);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        web.addJavascriptInterface(new Bridge(), "YesPlayMusicAndroid");
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder().addPathHandler("/", path -> {
            String file = path.isEmpty() || !path.substring(path.lastIndexOf('/') + 1).contains(".")
                ? "index.html" : path;
            String mime = URLConnection.guessContentTypeFromName(file);
            if (file.endsWith(".js")) mime = "application/javascript";
            if (file.endsWith(".css")) mime = "text/css";
            if (file.endsWith(".svg")) mime = "image/svg+xml";
            try {
                return new WebResourceResponse(mime == null ? "application/octet-stream" : mime,
                    "UTF-8", getAssets().open("web/" + file));
            } catch (IOException error) { return null; }
        }).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!"appassets.androidplatform.net".equals(uri.getHost())) return ArtworkCache.get(MainActivity.this).read(uri);
                return assets.shouldInterceptRequest(uri);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) return false;
                if (request.isForMainFrame()) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (Exception ignored) { }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                pageReady = true;
                emitApiStartup();
                emitEnvironment();
                emitState();
            }
        });
        SessionToken token = new SessionToken(this, new ComponentName(this, PlaybackService.class));
        controllerFuture = new MediaController.Builder(this, token).buildAsync();
        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
                controller.addListener(new Player.Listener() {
                    @Override public void onEvents(Player player, Player.Events events) { emitState(); }
                });
                for (JSONObject command : new ArrayList<>(pending)) handle(command);
                pending.clear();
                emitState();
            } catch (Exception error) { showError("无法连接后台播放器"); }
        }, command -> handler.post(command));
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
        // Paint navigation immediately. API requests wait asynchronously for startup in the adapter.
        content.requestApplyInsets();
        loadPage();
        startApi();
    }

    private void startApi() {
        if (destroyed) return;
        java.util.concurrent.CompletableFuture<String> startup = LocalApi.ensureStarted(this);
        if (observedApiStartup == startup) return;
        observedApiStartup = startup;
        apiStartupFailed = false;
        startup.whenComplete((address, error) -> handler.post(() -> {
            if (destroyed || observedApiStartup != startup) return;
            apiStartupFailed = error != null;
            emitApiStartup();
            if (error != null) showError("本地音乐接口启动失败，可重启应用后重试");
        }));
    }

    private String apiStartupState() {
        if (ApiClient.preferences(this).getBoolean("useRemoteApi", false) || !LocalApi.address().isEmpty()) return "ready";
        return apiStartupFailed ? "error" : "starting";
    }
    private void emitApiStartup() {
        if (!pageReady || destroyed) return;
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('yesplaymusic-api-startup',{detail:"
            + JSONObject.quote(apiStartupState()) + "}));", null);
    }

    private void loadPage() { pageReady = false; web.loadUrl("https://appassets.androidplatform.net/"); }
    private boolean systemDark() {
        return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }
    private void configureSystemBars() {
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        appearanceDark = systemDark();
        updateSystemBarIcons();
    }
    private void updateSystemBarIcons() {
        int flags = getWindow().getDecorView().getSystemUiVisibility();
        flags = appearanceDark || lyricsOpen ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            : flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        if (Build.VERSION.SDK_INT >= 26) flags = appearanceDark || lyricsOpen
            ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        getWindow().getDecorView().setSystemUiVisibility(flags);
    }
    private void emitEnvironment() {
        try {
            float density = getResources().getDisplayMetrics().density;
            int[] origin = new int[2];
            web.getLocationOnScreen(origin);
            // Some vendor windows already lay WebView below the status bar.
            int overlappingTop = Math.max(0, insetTop - Math.max(0, origin[1]));
            environment = new JSONObject().put("dark", systemDark()).put("top", overlappingTop / density)
                .put("bottom", insetBottom / density).put("left", insetLeft / density)
                .put("right", insetRight / density).toString();
            if (pageReady && !destroyed) web.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('yesplaymusic-native-environment',{detail:" + environment + "}));", null);
        } catch (Exception ignored) { }
    }
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        content.requestApplyInsets();
        emitEnvironment();
    }
    private void showError(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    static MediaItem item(String id, String source, JSONObject song, int logicalIndex) {
        Bundle extras = new Bundle();
        extras.putInt("playlistIndex", logicalIndex);
        String title = song == null ? "曲目 " + id : song.optString("name", "曲目 " + id);
        MediaMetadata.Builder metadata = new MediaMetadata.Builder().setTitle(title).setDisplayTitle(title)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC).setIsPlayable(true).setIsBrowsable(false).setExtras(extras);
        if (song != null) {
            JSONArray artists = song.optJSONArray("ar");
            StringBuilder names = new StringBuilder();
            if (artists != null) for (int i = 0; i < artists.length(); i++) {
                JSONObject artist = artists.optJSONObject(i);
                if (artist == null) continue;
                if (i > 0) names.append(", ");
                names.append(artist.optString("name"));
            }
            metadata.setArtist(names.toString()).setSubtitle(names.toString());
            JSONObject album = song.optJSONObject("al");
            if (album != null) {
                metadata.setAlbumTitle(album.optString("name"));
                String art = album.optString("picUrl");
                if (!art.isEmpty()) metadata.setArtworkUri(Uri.parse(art + "?param=192y192"));
            }
        }
        return new MediaItem.Builder().setMediaId(id)
            .setUri(id.matches("\\d+") || source == null || source.isEmpty() ? "ypm://track/" + id : source)
            .setMediaMetadata(metadata.build()).build();
    }

    private void handle(JSONObject command) {
        if (controller == null) { pending.add(command); return; }
        try {
            String action = command.optString("action");
            switch (action) {
                case "load": case "queue": {
                    boolean resume = "queue".equals(action) && controller.getPlayWhenReady();
                    long position = "queue".equals(action) ? controller.getCurrentPosition() : 0;
                    JSONArray queue = command.getJSONArray("queue");
                    List<MediaItem> items = new ArrayList<>();
                    int index = command.optInt("index", 0);
                    for (int i = 0; i < queue.length(); i++) {
                        JSONObject entry = queue.getJSONObject(i);
                        items.add(item(entry.getString("id"), i == index ? command.optString("source", "") : null,
                            i == index ? command.optJSONObject("track") : null, entry.optInt("logicalIndex", -1)));
                    }
                    ApiClient.setCookie(this, command.optString("cookie", ""));
                    ApiClient.preferences(this).edit().putBoolean("personalFm", command.optBoolean("personalFm", false)).apply();
                    controller.setMediaItems(items, index, position);
                    controller.setRepeatMode(command.optInt("repeatMode", Player.REPEAT_MODE_OFF));
                    controller.setVolume((float) command.optDouble("volume", 1));
                    controller.prepare();
                    if (resume) controller.play();
                    break;
                }
                case "play": controller.play(); break;
                case "pause": controller.pause(); break;
                case "stop": controller.stop(); break;
                case "seek": controller.seekTo((long) (command.optDouble("position") * 1000)); break;
                case "volume": controller.setVolume((float) command.optDouble("value", 1)); break;
                case "repeat": controller.setRepeatMode(command.optInt("value", Player.REPEAT_MODE_OFF)); break;
            }
            emitState();
        } catch (Exception error) { showError("播放器操作失败：" + error.getMessage()); }
    }

    private void emitState() {
        if (controller == null) return;
        try {
            MediaItem current = controller.getCurrentMediaItem();
            JSONObject state = new JSONObject();
            state.put("ready", true);
            state.put("trackId", current == null ? "" : current.mediaId);
            state.put("position", Math.max(0, controller.getCurrentPosition()) / 1000.0);
            state.put("duration", Math.max(0, controller.getDuration()) / 1000.0);
            state.put("playing", controller.isPlaying());
            state.put("ended", controller.getPlaybackState() == Player.STATE_ENDED);
            state.put("playlistIndex", current == null || current.mediaMetadata.extras == null ? -1
                : current.mediaMetadata.extras.getInt("playlistIndex", -1));
            String diagnostic = ApiClient.preferences(this).getString("currentAudioInfo", "");
            if (current != null && !diagnostic.isEmpty()) {
                JSONObject info = new JSONObject(diagnostic);
                if (current.mediaId.equals(info.optString("trackId"))) state.put("audioInfo", info);
            }
            if (controller.getPlayerError() != null) state.put("error", controller.getPlayerError().getMessage());
            snapshot = state.toString();
            if (visible && pageReady) {
                web.evaluateJavascript("window.dispatchEvent(new CustomEvent('yesplaymusic-native-state',{detail:"
                    + snapshot + "}));", null);
            }
        } catch (Exception ignored) { }
    }

    public final class Bridge {
        @JavascriptInterface public String getEnvironment() { return environment; }
        @JavascriptInterface public boolean isSystemDark() { return systemDark(); }
        @JavascriptInterface public void setAppearance(boolean dark) {
            handler.post(() -> { appearanceDark = dark; updateSystemBarIcons(); });
        }
        @JavascriptInterface public void setLyricsOpen(boolean open) {
            handler.post(() -> { lyricsOpen = open; updateSystemBarIcons(); });
        }
        @JavascriptInterface public String getState() { return snapshot; }
        @JavascriptInterface public String getApiStartupState() {
            String state = apiStartupState();
            // Recover a stopped API process without requiring a network request to start it.
            if ("starting".equals(state)) handler.post(MainActivity.this::startApi);
            return state;
        }
        @JavascriptInterface public String getApiUrl() {
            return ApiClient.preferences(MainActivity.this).getBoolean("useRemoteApi", false)
                ? ApiClient.baseUrl(MainActivity.this) : "";
        }
        @JavascriptInterface public void setCookie(String cookie) {
            ApiClient.setCookie(MainActivity.this, cookie);
        }
        @JavascriptInterface public void setMusicQuality(String quality) { ApiClient.setQuality(MainActivity.this, quality); }
        @JavascriptInterface public void setConcurrentPlayback(boolean enabled) {
            ApiClient.preferences(MainActivity.this).edit().putBoolean("allowConcurrentPlayback", enabled).apply();
        }
        @JavascriptInterface public void configureAudioCache(boolean enabled, long limitMb) {
            AudioCache.configure(MainActivity.this, enabled, limitMb);
        }
        @JavascriptInterface public void resetArtworkEligibility() { ArtworkCache.get(MainActivity.this).resetEligibility(); }
        @JavascriptInterface public void allowLibraryArtwork(String urls) { ArtworkCache.get(MainActivity.this).allow(urls); }
        @JavascriptInterface public void cacheLibraryArtwork(String urls) { ArtworkCache.get(MainActivity.this).enqueue(urls); }
        @JavascriptInterface public String getArtworkCacheStats() { return ArtworkCache.get(MainActivity.this).stats().toString(); }
        @JavascriptInterface public String clearArtworkCache() { return ArtworkCache.get(MainActivity.this).clear().toString(); }
        @JavascriptInterface public String getAudioCacheStats() { return AudioCache.stats(MainActivity.this).toString(); }
        @JavascriptInterface public String clearAudioCache() { return AudioCache.clear(MainActivity.this).toString(); }
        @JavascriptInterface public void request(String id, String json) {
            apiWorker.execute(() -> {
                JSONObject result;
                try { result = ApiClient.request(MainActivity.this, new JSONObject(json)); }
                catch (Exception error) {
                    result = new JSONObject();
                    try { result.put("error", "音乐接口请求失败：" + error.getMessage()); }
                    catch (Exception ignored) { }
                }
                try { result.put("id", id); } catch (Exception ignored) { }
                String response = result.toString();
                handler.post(() -> {
                    if (!destroyed) web.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('yesplaymusic-api-response',{detail:" + response + "}));", null);
                });
            });
        }
        @JavascriptInterface public void setApiUrl(String url) { ApiClient.setBaseUrl(MainActivity.this, url); }
        @JavascriptInterface public void send(String json) {
            try {
                JSONObject command = new JSONObject(json);
                handler.post(() -> handle(command));
            } catch (Exception ignored) { }
        }
    }

    @Override protected void onResume() {
        super.onResume(); visible = true;
        web.onResume(); web.resumeTimers();
        emitEnvironment();
        handler.removeCallbacks(progress); handler.post(progress);
    }
    @Override protected void onPause() {
        visible = false; handler.removeCallbacks(progress);
        web.onPause(); web.pauseTimers(); super.onPause();
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.yesplaymusicAndroidBack && window.yesplaymusicAndroidBack()", value -> {
            if (!"true".equals(value)) {
                if (web.canGoBack()) web.goBack();
                else super.onBackPressed();
            }
        });
    }
    @Override protected void onDestroy() {
        destroyed = true;
        ApiClient.preferences(this).unregisterOnSharedPreferenceChangeListener(audioInfoListener);
        apiWorker.shutdownNow();
        handler.removeCallbacksAndMessages(null);
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        web.removeJavascriptInterface("YesPlayMusicAndroid"); web.destroy();
        super.onDestroy();
    }
}
