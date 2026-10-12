package br.com.novabytesolucoes.divulgarobo;

import android.content.Context;
import android.content.SharedPreferences;

final class PostStore {
    static final String PREFS = "novabyte_robo_local";
    static final String WAIT_GROUP = "WAIT_GROUP";
    static final String WAIT_EDITOR = "WAIT_EDITOR";
    static final String WAIT_PUBLISH = "WAIT_PUBLISH";
    static final String COMPLETED = "COMPLETED";
    static final String STOPPED = "STOPPED";
    static final String ERROR = "ERROR";
    private PostStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void begin(Context context, String url, String message, String facebookPackage) {
        prefs(context).edit()
            .putBoolean("active", true)
            .putString("url", url)
            .putString("message", message)
            .putString("package", facebookPackage)
            .putString("state", WAIT_GROUP)
            .putString("status", "Iniciado pelo usuário. Aguardando a tela do grupo.")
            .putLong("started_at", System.currentTimeMillis())
            .putBoolean("post_clicked", false)
            .apply();
    }

    static void next(Context context, String state, String status) {
        prefs(context).edit().putString("state", state).putString("status", status).apply();
    }

    static void finish(Context context, String state, String status, boolean postClicked) {
        prefs(context).edit()
            .putBoolean("active", false)
            .putString("state", state)
            .putString("status", status)
            .putBoolean("post_clicked", postClicked)
            .apply();
    }

    static void stop(Context context) {
        finish(context, STOPPED, "Interrompido pelo usuário. Nenhum novo toque será executado.", false);
    }

    static boolean active(Context context) { return prefs(context).getBoolean("active", false); }
    static String value(Context context, String key) { return prefs(context).getString(key, ""); }
}
