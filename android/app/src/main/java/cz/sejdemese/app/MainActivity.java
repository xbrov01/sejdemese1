package cz.sejdemese.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Záchranný handler proti neošetřeným výjimkám z notifikačních nebo Firebase vláken
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            String msg = throwable != null ? throwable.toString() : "";
            if (msg.contains("Firebase") || msg.contains("PushNotification") || msg.contains("DEFAULT_APP") || msg.contains("FirebaseApp")) {
                Log.e(TAG, "Zabráněno fatálnímu pádu aplikace z notifikačního modulu: " + msg, throwable);
                return;
            }
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        super.onCreate(savedInstanceState);

        // Povolit vzdálené ladění WebView v prohlížeči Google Chrome (chrome://inspect)
        WebView.setWebContentsDebuggingEnabled(true);

        // Bezpečná programová inicializace FirebaseApp, aby FirebaseMessaging.getInstance() nevyhodil IllegalStateException
        try {
            Class<?> firebaseAppClass = Class.forName("com.google.firebase.FirebaseApp");
            java.lang.reflect.Method getAppsMethod = firebaseAppClass.getMethod("getApps", android.content.Context.class);
            java.util.List<?> apps = (java.util.List<?>) getAppsMethod.invoke(null, this);
            if (apps == null || apps.isEmpty()) {
                Class<?> optionsBuilderClass = Class.forName("com.google.firebase.FirebaseOptions$Builder");
                Object builder = optionsBuilderClass.getDeclaredConstructor().newInstance();

                optionsBuilderClass.getMethod("setApplicationId", String.class).invoke(builder, "1:247696266737:android:0c6ef5fa5dc79a40f4e050");
                optionsBuilderClass.getMethod("setApiKey", String.class).invoke(builder, "AIzaSyDZckrmqLevKi5RH84T61CoQUvdm6a_Qps");
                optionsBuilderClass.getMethod("setProjectId", String.class).invoke(builder, "gen-lang-client-0627024616");
                optionsBuilderClass.getMethod("setGcmSenderId", String.class).invoke(builder, "247696266737");

                Object options = optionsBuilderClass.getMethod("build").invoke(builder);

                java.lang.reflect.Method initMethod = firebaseAppClass.getMethod("initializeApp", android.content.Context.class, Class.forName("com.google.firebase.FirebaseOptions"));
                initMethod.invoke(null, this, options);
                Log.i(TAG, "FirebaseApp byl úspěšně programově inicializován.");
            }
        } catch (Throwable t) {
            Log.w(TAG, "Inicializace FirebaseApp přeskočena nebo nebyla nutná: " + t.getMessage());
        }
    }
}
