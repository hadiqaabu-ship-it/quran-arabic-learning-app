package com.sahara.quranlearning;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String APP_HOST = "app.local";
    private static final String APP_URL = "https://app.local/index.html?v=" + BuildConfig.VERSION_NAME;
    private static final int AUDIO_PERMISSION_REQUEST = 101;
    private static final int FILE_CHOOSER_REQUEST = 102;
    private static final String TAG = "QuranLearningApp";

    private WebView webView;
    private PermissionRequest pendingAudioRequest;
    private ValueCallback<Uri[]> fileChooserCallback;
    private int safeTopCss;
    private int safeBottomCss;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 91, 66));
        getWindow().setNavigationBarColor(Color.WHITE);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            int directTop;
            int directBottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                directTop = bars.top;
                directBottom = bars.bottom;
            } else {
                directTop = insets.getSystemWindowInsetTop();
                directBottom = insets.getSystemWindowInsetBottom();
            }
            float density = getResources().getDisplayMetrics().density;
            int statusResource = systemDimension("status_bar_height");
            int navigationResource = systemDimension("navigation_bar_height");
            safeTopCss = resolveCssInset(directTop, statusResource, density, 38, 72);
            safeBottomCss = 0;
            Log.i(TAG, "Insets direct=" + directTop + "/" + directBottom
                + " resources=" + statusResource + "/" + navigationResource
                + " css=" + safeTopCss + "/" + safeBottomCss);
            injectSafeInsets();
            return insets;
        });
        setContentView(webView);
        hideNavigationBar();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " QuranLearningApp/" + BuildConfig.VERSION_NAME);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new OfflineWebViewClient());
        webView.setWebChromeClient(new AppChromeClient());
        webView.loadUrl(APP_URL);
    }

    private final class OfflineWebViewClient extends WebViewClient {
        @Override
        public void onPageFinished(WebView view, String url) {
            injectSafeInsets();
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!APP_HOST.equals(uri.getHost())) {
                return response(403, "Forbidden", "text/plain", "Blocked: offline app".getBytes(StandardCharsets.UTF_8), null);
            }
            String assetPath = uri.getPath();
            if (assetPath == null || assetPath.equals("/")) assetPath = "/index.html";
            assetPath = Uri.decode(assetPath.substring(1));
            if (assetPath.contains("..")) return response(400, "Bad Request", "text/plain", new byte[0], null);
            try {
                byte[] data = readAsset("app/" + assetPath);
                String mime = mimeType(assetPath);
                String range = request.getRequestHeaders().get("Range");
                if (range != null && range.startsWith("bytes=")) {
                    String[] parts = range.substring(6).split("-", 2);
                    int start = Integer.parseInt(parts[0]);
                    int end = parts.length > 1 && !parts[1].isEmpty() ? Math.min(Integer.parseInt(parts[1]), data.length - 1) : data.length - 1;
                    if (start >= 0 && start <= end && start < data.length) {
                        byte[] slice = Arrays.copyOfRange(data, start, end + 1);
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Accept-Ranges", "bytes");
                        headers.put("Content-Range", "bytes " + start + "-" + end + "/" + data.length);
                        headers.put("Content-Length", String.valueOf(slice.length));
                        return response(206, "Partial Content", mime, slice, headers);
                    }
                }
                Map<String, String> headers = new HashMap<>();
                headers.put("Content-Length", String.valueOf(data.length));
                headers.put("Cache-Control", "public, max-age=31536000, immutable");
                return response(200, "OK", mime, data, headers);
            } catch (Exception error) {
                return response(404, "Not Found", "text/plain", "Not found".getBytes(StandardCharsets.UTF_8), null);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return !APP_HOST.equals(request.getUrl().getHost());
        }
    }

    private final class AppChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                boolean asksForAudio = Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
                if (!asksForAudio || !APP_HOST.equals(request.getOrigin().getHost())) {
                    request.deny();
                    return;
                }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                } else {
                    pendingAudioRequest = request;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST);
                }
            });
        }

        @Override
        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = callback;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            startActivityForResult(intent, FILE_CHOOSER_REQUEST);
            return true;
        }
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public int getSafeTop() {
            return safeTopCss;
        }

        @JavascriptInterface
        public int getSafeBottom() {
            return safeBottomCss;
        }

        @JavascriptInterface
        public void saveBackup(String json, String filename) {
            saveToDownloads(filename, "application/json", json.getBytes(StandardCharsets.UTF_8), false);
        }

    }

    private void saveToDownloads(String filename, String mime, byte[] bytes, boolean openAfterSave) {
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/QuranLearning");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("No downloads URI");
            try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("No output stream");
                output.write(bytes);
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            getContentResolver().update(uri, values, null, null);
            if (openAfterSave) {
                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(uri, mime);
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (viewIntent.resolveActivity(getPackageManager()) != null) startActivity(viewIntent);
                else toast("PDF 已保存到 Downloads/QuranLearning。");
            } else {
                toast("学习备份已保存到 Downloads/QuranLearning。");
            }
        } catch (Exception error) {
            toast("保存失败，请确认手机存储空间后重试。");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == AUDIO_PERMISSION_REQUEST && pendingAudioRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingAudioRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            } else {
                pendingAudioRequest.deny();
                toast("需要麦克风权限才能保存你的跟读录音。");
            }
            pendingAudioRequest = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && fileChooserCallback != null) {
            Uri[] result = resultCode == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null;
            fileChooserCallback.onReceiveValue(result);
            fileChooserCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        webView.evaluateJavascript("window.quranHandleAndroidBack ? window.quranHandleAndroidBack() : false", handled -> {
            if (!"true".equals(handled)) MainActivity.super.onBackPressed();
        });
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        hideNavigationBar();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        hideNavigationBar();
        if (webView != null) {
            webView.requestApplyInsets();
            injectSafeInsets();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideNavigationBar();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    private byte[] readAsset(String path) throws Exception {
        try (InputStream input = getAssets().open(path); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toByteArray();
        }
    }

    private void injectSafeInsets() {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
            "window.quranSetNativeInsets && window.quranSetNativeInsets(" + safeTopCss + "," + safeBottomCss + ")",
            null
        ));
    }

    @SuppressLint("DiscouragedApi")
    private int systemDimension(String name) {
        int id = getResources().getIdentifier(name, "dimen", "android");
        return id == 0 ? 0 : getResources().getDimensionPixelSize(id);
    }

    private void hideNavigationBar() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller == null) return;
            controller.hide(WindowInsets.Type.navigationBars());
            controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            return;
        }
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );
    }

    private int resolveCssInset(int directPx, int resourcePx, float density, int fallbackDp, int maxDp) {
        int maxPx = Math.round(maxDp * density);
        int selectedPx = directPx > 0 && directPx <= maxPx ? directPx
            : resourcePx > 0 && resourcePx <= maxPx ? resourcePx
            : Math.round(fallbackDp * density);
        return Math.round(selectedPx / density);
    }

    private String mimeType(String path) {
        if (path.endsWith(".webmanifest")) return "application/manifest+json";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".mp3")) return "audio/mpeg";
        if (path.endsWith(".pdf")) return "application/pdf";
        String guessed = URLConnection.guessContentTypeFromName(path);
        return guessed == null ? "application/octet-stream" : guessed;
    }

    private WebResourceResponse response(int status, String reason, String mime, byte[] data, Map<String, String> headers) {
        return new WebResourceResponse(mime, "UTF-8", status, reason, headers == null ? new HashMap<>() : headers, new ByteArrayInputStream(data));
    }

    private void toast(String message) {
        runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show());
    }
}
