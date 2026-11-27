package xyz.xanderxx.pluhub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureSessionPlugin.class);
        registerPlugin(ScreenAwakePlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(BarcodeScannerPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) { moveTaskToBack(true); return; }
                // The app is a single WebView document: its dialogs/tabs are not browser history.
                // Fixed trusted code only; camera/settings/installer activities retain their own Back.
                bridge.getWebView().evaluateJavascript(
                    "(function(){try{return typeof window.pluHandleBack==='function' && window.pluHandleBack()===true;}catch(e){return false;}})()",
                    handled -> {
                        if ("true".equals(handled)) return;
                        if (bridge.getWebView().canGoBack()) bridge.getWebView().goBack();
                        else moveTaskToBack(true); // Home/root Back backgrounds, never kills a save/session.
                    });
            }
        });
    }
}
