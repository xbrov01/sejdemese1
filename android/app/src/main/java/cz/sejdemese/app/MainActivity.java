package cz.sejdemese.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Povolit vzdálené ladění WebView v prohlížeči Google Chrome (chrome://inspect)
        WebView.setWebContentsDebuggingEnabled(true);

        // Pojistka pro bezpečnou inicializaci Firebase v případě, že se nenačetl google-services.json
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId("1:247696266737:android:0c6ef5fa5dc79a40f4e050")
                    .setApiKey("AIzaSyDZckrmqLevKi5RH84T61CoQUvdm6a_Qps")
                    .setProjectId("gen-lang-client-0627024616")
                    .setGcmSenderId("247696266737")
                    .build();
                FirebaseApp.initializeApp(this, options);
            }
        } catch (Throwable t) {
            android.util.Log.w("MainActivity", "Firebase safeguard init: " + t.getMessage());
        }
    }
}
