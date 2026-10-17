(()=>{
"use strict";
const URL="https://vajlhodqxskozuxxlujv.supabase.co",KEY="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const $=id=>document.getElementById(id);
let db=null,started=false,seen=new Set(),initialized=false,ringEnabled=false,audio=null,subscription=null;
let pendingCount=0;
function setMessage(message){const el=$("nplay-admin-alert-status");if(el)el.textContent=message;}
function badge(n){
 pendingCount=n;const label=$("nplay-admin-alert-count");if(label)label.textContent=String(n);
 const btn=$("nplay-admin-alerts");if(btn)btn.setAttribute("aria-label",n+" solicitações de acesso pendentes");
 const access=document.querySelector('[data-admin-tab="acessos"]');
 if(access)access.textContent=n?"Autorizações ("+n+")":"Autorizações";
}
function alarm(item){
 if(!ringEnabled)return;
 try{
  if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==="suspended")audio.resume().catch(()=>{});
  const t=audio.currentTime;
  [0,0.22,0.44].forEach((offset,i)=>{
   const oscillator=audio.createOscillator(),gain=audio.createGain();
   oscillator.type="sine";oscillator.frequency.value=i===1?1046:784;
   gain.gain.setValueAtTime(0.0001,t+offset);
   gain.gain.exponentialRampToValueAtTime(0.13,t+offset+0.025);
   gain.gain.exponentialRampToValueAtTime(0.0001,t+offset+0.19);
   oscillator.connect(gain).connect(audio.destination);
   oscillator.start(t+offset);oscillator.stop(t+offset+0.2);
  });
 }catch(e){console.warn("NPlay: áudio de alerta indisponível",e)}
 if("Notification" in window&&Notification.permission==="granted"){
  try{
   const n=new Notification("NPlay · Nova solicitação de acesso",{
    body:(item.display_name||"Novo cliente").slice(0,80)+" aguarda liberação.",
    icon:"../assets/icon.svg",tag:"nplay-access-"+item.user_id
   });
   n.onclick=()=>{window.focus();$("nplay-admin-alerts")?.click();n.close();};
  }catch(e){console.warn("NPlay: notificação do navegador bloqueada",e)}
 }
}
function onIncoming(item){
 if(!item||item.status!=="pending")return;
 const key=String(item.user_id||"")+":"+String(item.created_at||"");
 if(!item.user_id||seen.has(key))return;
 seen.add(key);
 badge(pendingCount+1);
 setMessage("Novo pedido de acesso: "+(item.display_name||"Cliente")+" · clique em Autorizações.");
 alarm(item);
}
async function syncAccess(){
 if(!db||!started)return;
 const {data,error}=await db.from("novaplay_access_requests")
  .select("user_id,display_name,status,created_at").eq("status","pending").order("created_at",{ascending:false}).limit(200);
 if(error){setMessage("Não foi possível conferir solicitações: "+error.message);return}
 if(!initialized){
  seen=new Set((data||[]).map(x=>x.user_id+":"+x.created_at));
  initialized=true;
  badge((data||[]).length);
 }else{
  for(const item of data||[])onIncoming(item);
  badge((data||[]).length);
 }
}
async function enableAlerts(){
 if(!started)return;
 try{
  if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();
  await audio.resume();
  ringEnabled=true;localStorage.setItem("nplay-admin-alerts-sound","1");
  if("Notification" in window&&Notification.permission==="default"){
   // Explicit click permits asking to display OS-level notices while this page remains open.
   await Notification.requestPermission();
  }
  $("nplay-alert-enable").textContent="🔔 Alertas ligados";
  setMessage("Som ativado. Notificações do navegador: "+("Notification" in window?Notification.permission:"não disponíveis")+".");
  alarm({user_id:"teste",display_name:"Som de teste"});
 }catch(e){setMessage("O navegador não permitiu o som. Interaja novamente com o botão.");}
}
function setupAccessAlerts(){
 $("nplay-alert-enable")?.addEventListener("click",enableAlerts);
 $("nplay-admin-alerts")?.addEventListener("click",()=>{
  document.querySelector('[data-admin-tab="acessos"]')?.click();
  $("nplay-access-refresh")?.click();
  $("nplay-access-admin")?.scrollIntoView({behavior:"smooth",block:"start"});
 });
 ringEnabled=localStorage.getItem("nplay-admin-alerts-sound")==="1";
 $("nplay-alert-enable").textContent=ringEnabled?"🔔 Alertas ligados":"🔔 Ativar som e notificação";
 syncAccess();
 subscription=db.channel("nplay-admin-requests-"+Date.now())
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"novaplay_access_requests"},event=>{onIncoming(event.new);syncAccess();})
  .on("postgres_changes",{event:"UPDATE",schema:"public",table:"novaplay_access_requests"},()=>syncAccess())
  .subscribe(status=>{if(status==="CHANNEL_ERROR")setMessage("Tempo real indisponível; usando verificação a cada 20 segundos.");});
 setInterval(syncAccess,20000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)syncAccess();});
}
function prettyDate(stamp){try{return new Date(stamp).toLocaleString("pt-BR")}catch{return ""}}
function renderAnnouncements(rows){
 const box=$("nplay-news-admin-list");if(!box)return;
 box.replaceChildren();
 if(!rows.length){box.textContent="Nenhuma atualização cadastrada.";return}
 for(const row of rows){
  const card=document.createElement("article");card.className="nplay-news-admin-row";
  const heading=document.createElement("strong");heading.textContent=row.title;
  const body=document.createElement("p");body.textContent=row.body;
  const foot=document.createElement("small");foot.textContent=(row.is_published?"● Publicado":"○ Rascunho")+" · "+prettyDate(row.created_at);
  const action=document.createElement("button");action.type="button";action.className="outline";
  action.textContent=row.is_published?"Retirar da grade de avisos":"Publicar aviso";
  action.onclick=async()=>{
   action.disabled=true;
   const {error}=await db.from("novaplay_announcements").update({is_published:!row.is_published,updated_at:new Date().toISOString()}).eq("id",row.id);
   if(error)setMessage(error.message);
   await fetchAnnouncements();
  };
  card.append(heading,body,foot,action);box.append(card);
 }
}
async function fetchAnnouncements(){
 const {data,error}=await db.from("novaplay_announcements")
  .select("id,title,body,category,is_published,created_at").order("created_at",{ascending:false}).limit(50);
 if(error){$("nplay-news-admin-list").textContent="Não foi possível carregar avisos: "+error.message;return}
 renderAnnouncements(data||[]);
}
async function publishNotice(e){
 e.preventDefault();
 const title=$("nplay-news-title").value.trim(),body=$("nplay-news-message").value.trim(),category=$("nplay-news-category").value;
 const button=$("nplay-news-submit");button.disabled=true;
 try{
  const {error}=await db.from("novaplay_announcements").insert({title,body,category,is_published:true});
  if(error)throw error;
  $("nplay-news-form").reset();
  $("nplay-news-status").textContent="Aviso publicado! Os clientes verão no sino da NPlay.";
  await fetchAnnouncements();
 }catch(error){$("nplay-news-status").textContent="Não foi possível publicar: "+error.message}
 finally{button.disabled=false;}
}
async function boot(){
 if(started||!window.supabase?.createClient||!$("dashboard")||$("dashboard").hidden)return;
 try{
  db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  const {data:{user}}=await db.auth.getUser();if(!user)return;
  const {data:admin,error}=await db.from("novaplay_admins").select("user_id").eq("user_id",user.id).maybeSingle();
  if(error||!admin)return;
  started=true;
  setupAccessAlerts();
  $("nplay-news-form")?.addEventListener("submit",publishNotice);
  $("nplay-news-refresh")?.addEventListener("click",fetchAnnouncements);
  fetchAnnouncements();
 }catch(e){setMessage("Falha ao iniciar alertas: "+String(e.message||e).slice(0,180));}
}
function init(){
 const dash=$("dashboard");if(!dash)return;
 new MutationObserver(()=>{if(!dash.hidden)boot()}).observe(dash,{attributes:true,attributeFilter:["hidden"]});
 if(!dash.hidden)boot();
 window.addEventListener("pageshow",boot);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();