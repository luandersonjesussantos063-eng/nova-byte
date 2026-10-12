package br.com.novabytesolucoes.divulgarobo;

import android.accessibilityservice.AccessibilityService;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayDeque;
import java.util.Locale;

public class FacebookAssistService extends AccessibilityService {
    private static final long TIMEOUT_MS = 75_000L;
    private static final long STEP_DELAY_MS = 750L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean scheduled = false;
    private boolean inAction = false;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        // Eventos e pacotes observados definidos em accessibility_service_config.xml.
        // Não acompanha outros aplicativos, não guarda árvore acessível ou senhas.
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if(event==null || !PostStore.active(this))return;
        CharSequence pkg=event.getPackageName();
        if(pkg==null || !allowedPackage(pkg.toString()))return;
        String configured=PostStore.value(this,"package");
        if(!configured.equals(pkg.toString()))return;
        if(!scheduled && !inAction) {
            scheduled=true;
            handler.postDelayed(this::step, STEP_DELAY_MS);
        }
    }

    private boolean allowedPackage(String pkg){
        return "com.facebook.katana".equals(pkg) || "com.facebook.lite".equals(pkg);
    }

    private void step() {
        scheduled=false;
        if(inAction || !PostStore.active(this))return;
        long start=PostStore.prefs(this).getLong("started_at",0L);
        if(start<=0||System.currentTimeMillis()-start>TIMEOUT_MS){
            PostStore.finish(this,PostStore.ERROR,
                "Tempo limite atingido. A interface do Facebook pode ter mudado. Nenhuma nova tentativa será feita.",false);
            return;
        }
        AccessibilityNodeInfo root=getRootInActiveWindow();
        if(root==null||root.getPackageName()==null||
            !PostStore.value(this,"package").equals(root.getPackageName().toString()))return;
        inAction=true;
        try {
            String state=PostStore.value(this,"state");
            if(PostStore.WAIT_GROUP.equals(state)){
                AccessibilityNodeInfo compose=findComposer(root);
                if(compose!=null && clickClosest(compose)){
                    PostStore.next(this,PostStore.WAIT_EDITOR,
                        "Campo de criação de postagem encontrado. Aguardando editor do Facebook.");
                    scheduleStep();
                }
            } else if(PostStore.WAIT_EDITOR.equals(state)){
                // Evita preencher buscas, mensagens ou comentários sem antes entrar no editor.
                if(!hasPublishAction(root))return;
                AccessibilityNodeInfo input=findEditableForPost(root);
                if(input==null)return;
                String message=PostStore.value(this,"message");
                if(message.length()<15)return;
                Bundle arguments=new Bundle();
                arguments.putCharSequence(
                    AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, message);
                boolean entered=input.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,arguments);
                if(entered){
                    PostStore.next(this,PostStore.WAIT_PUBLISH,
                        "Texto inserido. O robô tentará tocar uma vez em Publicar.");
                    scheduleStep();
                }
            } else if(PostStore.WAIT_PUBLISH.equals(state)) {
                AccessibilityNodeInfo publish=findPublish(root);
                if(publish!=null && clickClosest(publish)){
                    // O aplicativo não tem API para confirmar se o post foi publicado,
                    // rejeitado pelo Facebook ou colocado em aprovação.
                    PostStore.finish(this,PostStore.COMPLETED,
                        "O robô acionou Publicar uma vez. Confira no grupo se foi enviado, " +
                        "se está em aprovação ou se o Facebook exibiu um erro.",true);
                }
            }
        } catch(RuntimeException error) {
            PostStore.finish(this,PostStore.ERROR,
                "Não foi possível controlar esta tela do Facebook. Pare e revise o fluxo manualmente.",false);
        } finally {
            inAction=false;
        }
    }

    private void scheduleStep() {
        if(!scheduled && PostStore.active(this)){
            scheduled=true;
            handler.postDelayed(this::step,STEP_DELAY_MS);
        }
    }

    private String normalize(CharSequence text){
        return text==null?"":text.toString().trim().toLowerCase(Locale.ROOT)
            .replace("\u2019","'").replace("\u00a0"," ");
    }

    private String nodeLabel(AccessibilityNodeInfo node){
        String text=normalize(node.getText());
        String description=normalize(node.getContentDescription());
        return (text+" "+description).trim();
    }

    private boolean composerLabel(String label) {
        return label.contains("escreva algo") ||
            label.contains("escreva alguma coisa") ||
            label.contains("no que você está pensando") ||
            label.contains("no que voce esta pensando") ||
            label.contains("compartilhe algo") ||
            label.contains("criar publicação") ||
            label.contains("criar publicacao") ||
            label.contains("write something") ||
            label.contains("what's on your mind") ||
            label.contains("create a post");
    }

    private AccessibilityNodeInfo findComposer(AccessibilityNodeInfo root) {
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        int limit=0;
        while(!queue.isEmpty() && limit++<600) {
            AccessibilityNodeInfo n=queue.removeFirst();
            if(n.isVisibleToUser()&&n.isEnabled()&&composerLabel(nodeLabel(n)))return n;
            for(int i=0;i<n.getChildCount();i++){
                AccessibilityNodeInfo child=n.getChild(i);
                if(child!=null)queue.addLast(child);
            }
        }
        return null;
    }

    private boolean isPublishLabel(String label){
        return label.equals("publicar") || label.equals("post") ||
            label.equals("publicar agora") || label.equals("publish") ||
            label.equals("compartilhar");
    }

    private AccessibilityNodeInfo findPublish(AccessibilityNodeInfo root){
        ArrayDeque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(root);
        int limit=0;
        while(!queue.isEmpty()&&limit++<600){
            AccessibilityNodeInfo n=queue.removeFirst();
            if(n.isVisibleToUser()&&n.isEnabled()&&isPublishLabel(nodeLabel(n)))return n;
            for(int i=0;i<n.getChildCount();i++){
                AccessibilityNodeInfo child=n.getChild(i);
                if(child!=null)queue.addLast(child);
            }
        }
        return null;
    }

    private boolean hasPublishAction(AccessibilityNodeInfo root) {
        return findPublish(root)!=null;
    }

    private AccessibilityNodeInfo findEditableForPost(AccessibilityNodeInfo root) {
        ArrayDeque<AccessibilityNodeInfo> queue=new ArrayDeque<>();
        queue.add(root);
        AccessibilityNodeInfo candidate=null;
        int count=0;
        int limit=0;
        while(!queue.isEmpty() && limit++<600) {
            AccessibilityNodeInfo n=queue.removeFirst();
            if(n.isVisibleToUser()&&n.isEnabled()&&n.isEditable()){
                String desc=nodeLabel(n);
                // Não preenche busca do Facebook, campos de senha nem chat.
                if(desc.contains("pesquisar")||desc.contains("search")||
                   desc.contains("senha")||desc.contains("password")||
                   desc.contains("comentário")||desc.contains("comment"))continue;
                count++;
                candidate=n;
            }
            for(int i=0;i<n.getChildCount();i++){
                AccessibilityNodeInfo child=n.getChild(i);
                if(child!=null)queue.addLast(child);
            }
        }
        // Não chutar o campo certo caso a tela exponha vários inputs.
        return count==1?candidate:null;
    }

    private boolean clickClosest(AccessibilityNodeInfo source){
        AccessibilityNodeInfo node=source;
        for(int attempts=0;node!=null&&attempts<6;attempts++) {
            if(node.isClickable()&&node.isEnabled()&&node.isVisibleToUser()){
                return node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
            }
            node=node.getParent();
        }
        return false;
    }

    @Override
    public void onInterrupt() {
        if(PostStore.active(this))
            PostStore.finish(this,PostStore.STOPPED,
                "Serviço de acessibilidade interrompido. Nenhum novo toque será executado.",false);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
