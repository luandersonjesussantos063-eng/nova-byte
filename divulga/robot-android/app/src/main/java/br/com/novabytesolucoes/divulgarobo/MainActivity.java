package br.com.novabytesolucoes.divulgarobo;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.net.URI;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int NAVY = Color.rgb(8, 18, 34);
    private static final int SURFACE = Color.rgb(24, 40, 63);
    private static final int LIGHT = Color.rgb(235, 243, 255);
    private static final int MUTED = Color.rgb(163, 183, 210);
    private static final int ORANGE = Color.rgb(255, 143, 69);

    private EditText groupField;
    private EditText messageField;
    private Spinner appField;
    private CheckBox permissionCheck;
    private TextView status;
    private TextView serviceStatus;

    private int dp(int value) { return (int)(value * getResources().getDisplayMetrics().density + .5f); }

    private LinearLayout.LayoutParams margins(int top, int bottom) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(top), 0, dp(bottom));
        return lp;
    }

    private TextView text(String content, int size, int color) {
        TextView result = new TextView(this);
        result.setText(content);
        result.setTextColor(color);
        result.setTextSize(size);
        result.setLineSpacing(dp(2), 1.1f);
        return result;
    }

    private EditText field(String hint, boolean multiline) {
        EditText result = new EditText(this);
        result.setHint(hint);
        result.setTextColor(LIGHT);
        result.setHintTextColor(MUTED);
        result.setTextSize(15);
        result.setPadding(dp(13), dp(12), dp(13), dp(12));
        result.setBackgroundTintList(android.content.res.ColorStateList.valueOf(ORANGE));
        result.setInputType(multiline
            ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        if(multiline) {
            result.setMinLines(5);
            result.setMaxLines(11);
        }
        return result;
    }

    private Button action(String label, boolean primary) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(14);
        b.setTextColor(primary ? NAVY : LIGHT);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(primary ? ORANGE : SURFACE));
        return b;
    }

    @Override
    public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        ScrollView outer = new ScrollView(this);
        outer.setFillViewport(true);
        outer.setBackgroundColor(NAVY);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dp(20), dp(26), dp(20), dp(28));
        outer.addView(layout);

        TextView title = text("NovaByte Robô", 28, LIGHT);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        layout.addView(title);
        layout.addView(text("Experimento Android · Uma publicação por execução", 13, ORANGE), margins(3,16));

        TextView notice = text(
            "AVISO E CONSENTIMENTO\n\n" +
            "Este aplicativo pode ler os elementos visíveis do Facebook ou Facebook Lite e acionar " +
            "botões em seu nome usando a Acessibilidade do Android. Ao iniciar, ele tentará abrir " +
            "um grupo, preencher o texto e tocar uma única vez em Publicar. A publicação pode falhar, " +
            "ficar pendente de aprovação ou causar restrições à sua conta.\n\n" +
            "Não acessa senhas, não envia dados para servidores, não resolve verificações, " +
            "não executa publicações em segundo plano nem repete tentativas sozinho. " +
            "Use somente em grupos que permitem publicidade.",
            13, LIGHT);
        notice.setPadding(dp(12),dp(14),dp(12),dp(14));
        notice.setBackgroundTintList(null);
        notice.setBackgroundColor(SURFACE);
        layout.addView(notice, margins(0,16));

        serviceStatus = text("", 14, MUTED);
        layout.addView(serviceStatus, margins(0,5));
        Button access = action("1. Ativar Acessibilidade no Android", false);
        access.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        layout.addView(access, margins(5,17));

        layout.addView(text("2. Link direto do grupo", 15, LIGHT), margins(0,5));
        groupField = field("https://www.facebook.com/groups/...", false);
        layout.addView(groupField, margins(3,13));

        layout.addView(text("3. Texto da publicação", 15, LIGHT), margins(0,5));
        messageField = field("Divulgação da NovaByte Soluções…", true);
        layout.addView(messageField, margins(3,13));

        layout.addView(text("4. Qual aplicativo do Facebook?", 15, LIGHT), margins(0,5));
        appField = new Spinner(this);
        String[] apps = {"Facebook normal", "Facebook Lite"};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
            this, android.R.layout.simple_spinner_item, apps);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        appField.setAdapter(adapter);
        layout.addView(appField, margins(0,13));

        permissionCheck = new CheckBox(this);
        permissionCheck.setText("Autorizo o robô a tentar publicar ESTE anúncio somente neste grupo, nesta execução.");
        permissionCheck.setTextColor(LIGHT);
        permissionCheck.setTextSize(14);
        permissionCheck.setButtonTintList(android.content.res.ColorStateList.valueOf(ORANGE));
        layout.addView(permissionCheck, margins(2,12));

        Button start = action("INICIAR PUBLICAÇÃO EXPERIMENTAL", true);
        start.setOnClickListener(v -> startRobot());
        layout.addView(start, margins(8,4));

        Button stop = action("PARAR ROBÔ", false);
        stop.setOnClickListener(v -> {
            PostStore.stop(this);
            refreshStatus();
            Toast.makeText(this,"Execução interrompida.",Toast.LENGTH_SHORT).show();
        });
        layout.addView(stop, margins(3,13));

        status = text("", 14, MUTED);
        layout.addView(status, margins(2,13));
        layout.addView(text(
            "Como enviar direto da central web: no NovaByte Divulga, abra a fila e use " +
            "“Enviar ao robô Android”; escolha NovaByte Robô. Confira o grupo e o texto antes de autorizar.",
            12, MUTED), margins(8,8));

        setContentView(outer);
        handleSharedIntent(getIntent());
        refreshStatus();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSharedIntent(intent);
    }

    private void handleSharedIntent(Intent intent) {
        if(intent==null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        if(!"text/plain".equals(intent.getType())) return;
        String body=intent.getStringExtra(Intent.EXTRA_TEXT);
        if(body==null)return;
        String header="NOVABYTE_ROBO_V1\nGRUPO=";
        if(body.startsWith(header)) {
            int at=body.indexOf("\nTEXTO:\n");
            if(at>0) {
                groupField.setText(body.substring(header.length(),at).trim());
                messageField.setText(body.substring(at+"\nTEXTO:\n".length()).trim());
            }
        } else messageField.setText(body);
        permissionCheck.setChecked(false);
        Toast.makeText(this,"Conteúdo recebido. Revise antes de iniciar.",Toast.LENGTH_LONG).show();
    }

    private boolean enabled() {
        String enabled=Settings.Secure.getString(getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if(enabled==null)return false;
        String target=new ComponentName(this,FacebookAssistService.class).flattenToString();
        for(String item:enabled.split(":")) {
            ComponentName component=ComponentName.unflattenFromString(item);
            if(component!=null && component.equals(ComponentName.unflattenFromString(target)))return true;
        }
        return false;
    }

    private static String groupUrl(String input) {
        try {
            URI uri=new URI(input.trim());
            String host=uri.getHost();
            String path=uri.getPath();
            if(host==null || path==null || uri.getScheme()==null)return null;
            String domain=host.toLowerCase(Locale.ROOT);
            if(!("facebook.com".equals(domain)||"www.facebook.com".equals(domain)||
                "m.facebook.com".equals(domain)||"web.facebook.com".equals(domain)))return null;
            if(!"https".equalsIgnoreCase(uri.getScheme()))return null;
            if(!(path.matches("/groups/[^/]+/?(?:.*)?")||path.matches("/share/g/[^/]+/?")))return null;
            return uri.toString();
        } catch(Exception e){return null;}
    }

    private void startRobot() {
        if(!enabled()) {
            Toast.makeText(this,"Ative NovaByte Robô na Acessibilidade primeiro.",Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            return;
        }
        if(!permissionCheck.isChecked()) {
            Toast.makeText(this,"Marque a autorização específica desta publicação.",Toast.LENGTH_LONG).show();
            return;
        }
        String url=groupUrl(groupField.getText().toString());
        if(url==null) {groupField.setError("Use um link direto de um grupo do Facebook.");return;}
        String message=messageField.getText().toString().trim();
        if(message.length()<15 || message.length()>4000) {
            messageField.setError("O anúncio deve ter entre 15 e 4.000 caracteres.");
            return;
        }
        String target=appField.getSelectedItemPosition()==1?"com.facebook.lite":"com.facebook.katana";
        Intent intent=new Intent(Intent.ACTION_VIEW,Uri.parse(url));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.setPackage(target);
        try {
            if(intent.resolveActivity(getPackageManager())==null) {
                Toast.makeText(this,"Instale ou selecione o Facebook correspondente.",Toast.LENGTH_LONG).show();
                return;
            }
            PostStore.begin(this,url,message,target);
            permissionCheck.setChecked(false);
            startActivity(intent);
        } catch(ActivityNotFoundException | SecurityException error) {
            PostStore.finish(this,PostStore.ERROR,"Não foi possível abrir o Facebook selecionado.",false);
            refreshStatus();
        }
    }

    private void refreshStatus(){
        if(serviceStatus!=null) serviceStatus.setText(enabled()
            ?"Acessibilidade ativada. Serviço disponível."
            :"Acessibilidade desativada. Abra Configurações e habilite NovaByte Robô.");
        if(status!=null) {
            String current=PostStore.value(this,"status");
            status.setText("Status: "+(current.isEmpty()?"Nenhuma publicação executada.":current));
        }
    }

    @Override
    protected void onResume(){
        super.onResume();
        if(status!=null)refreshStatus();
    }
}
