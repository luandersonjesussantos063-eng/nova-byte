(()=>{
"use strict";
const URL="https://vajlhodqxskozuxxlujv.supabase.co",KEY="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const $=id=>document.getElementById(id);
let db=null,userId=null,news=[],history=[],readIds=new Set(),starting=false,ready=false,historyShown=false;
function readKey(){return "nplay-news-read-v1:"+(userId||"anonymous")}
function loadRead(){
 try{readIds=new Set((JSON.parse(localStorage.getItem(readKey())||"[]")||[]).map(Number))}catch{readIds=new Set()}
}
function saveRead(){try{localStorage.setItem(readKey(),JSON.stringify(Array.from(readIds).slice(-200)))}catch{}}
function versionId(version){
 // Same stable negative ID format used before: previously read versions stay read.
 return /^(\d+)\.(\d+)\.(\d+)$/.test(version)?
   -Number(version.split(".").map((part,i)=>String(Number(part)).padStart(i===0?1:3,"0")).join("")):null;
}
function releaseEntries(){
 const version=document.querySelector('meta[name="nplay-version"]')?.content||"";
 const all=Array.isArray(window.NPlayReleaseNotes)?window.NPlayReleaseNotes:[];
 const selected=all.find(r=>r.version===version);
 const convert=(r,old=false)=>({
  id:versionId(r.version),version:r.version,
  title:r.title||"NPlay atualizada · versão "+r.version,
  body:r.intro||"Veja o que mudou nesta atualização:",
  changes:Array.isArray(r.changes)?r.changes.filter(x=>typeof x==="string").slice(0,8):[],
  category:"atualizacao",dateLabel:r.date?.split("-").reverse().join("/")||"",
  action:old?null:r.action,actionLabel:old?null:r.actionLabel,
  historical:old,created_at:r.date?r.date+"T12:00:00":new Date().toISOString()
 });
 // Admin-only maintenance must never create an automatic customer notice.
 // The bell announces a release only if editorial customer-facing notes exist.
 const current=selected?convert(selected):null;
 const old=all.filter(r=>r.version!==version&&versionId(r.version)!==null&&versionId(r.version)>versionId(version))
  .map(r=>convert(r,true));
 return {current,old};
}
function formatDate(value){try{return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value))}catch{return ""}}
function unread(){return news.filter(x=>!readIds.has(Number(x.id))).length}
function markRead(entry){readIds.add(Number(entry.id));saveRead();paint()}
function paint(){
 const badge=$("nplay-notice-count"),button=$("nplay-notice-bell"),list=$("nplay-notice-items");
 if(!badge||!button||!list)return;
 const count=unread(),enabled=window.NPlaySettings?.get().notifications!==false;badge.hidden=count===0||!enabled;badge.textContent=count>9?"9+":String(count);
 button.setAttribute("aria-label",count&&enabled?"Notificações: "+count+" não lidas":"Notificações");
 list.replaceChildren();
 const entries=historyShown?[...news,...history]:news;
 if(!entries.length){
  const empty=document.createElement("p");empty.className="nplay-notice-empty";
  empty.textContent="Nenhuma novidade por enquanto. As atualizações aparecerão aqui.";
  list.append(empty);return;
 }
 for(const entry of entries){
  const wrapper=document.createElement("div");wrapper.className="nplay-notice-item";
  const card=document.createElement("button");card.type="button";
  card.className="nplay-notice-entry"+(!entry.historical&&!readIds.has(Number(entry.id))?" unread":"");
  const category=document.createElement("small");
  category.textContent=entry.historical?"Versão anterior":entry.category==="aviso"?"Aviso":entry.category==="novidade"?"Novidade":"Atualização";
  const title=document.createElement("strong");title.textContent=entry.title;
  const body=document.createElement("span");body.textContent=entry.body;
  card.append(category,title,body);
  if(Array.isArray(entry.changes)&&entry.changes.length){
   const changes=document.createElement("ul");changes.className="nplay-notice-changes";
   for(const change of entry.changes){const li=document.createElement("li");li.textContent=change;changes.append(li)}
   card.append(changes);
  }
  const date=document.createElement("time");
  date.textContent=entry.dateLabel||formatDate(entry.created_at);
  card.append(date);
  card.onclick=()=>markRead(entry);
  wrapper.append(card);
  if(entry.action==="preview-intro-audio"){
   const tryIt=document.createElement("button");tryIt.type="button";
   tryIt.className="nplay-notice-cta";
   tryIt.textContent=entry.actionLabel||"▶ Experimentar novo som";
   tryIt.onclick=()=>{
    // Call from the direct tap gesture. The browser may block unattended audio.
    void window.NPlayIntroAudio?.preview?.();
    markRead(entry);
   };
   wrapper.append(tryIt);
  }
  list.append(wrapper);
 }
 const historyButton=$("nplay-notice-history");
 if(historyButton){
  historyButton.hidden=history.length===0;
  historyButton.textContent=historyShown?"Ocultar versões anteriores":"Ver melhorias anteriores";
  historyButton.setAttribute("aria-expanded",String(historyShown));
 }
}
async function refresh(){
 if(!db||!userId)return;
 const {data,error}=await db.from("novaplay_announcements")
  .select("id,title,body,category,created_at").eq("is_published",true).order("created_at",{ascending:false}).limit(35);
 const releases=releaseEntries();
 history=releases.old;
 news=[...(releases.current?[releases.current]:[]),...(data||[])];
 if(error){
  console.warn("NPlay: avisos remotos temporariamente indisponíveis",error.message);
 }
 paint();
}
function openPanel(show){
 const panel=$("nplay-notice-panel"),trigger=$("nplay-notice-bell");
 if(!panel||!trigger)return;
 panel.hidden=!show;trigger.setAttribute("aria-expanded",String(show));
 if(show)refresh();
}
function setup(){
 window.addEventListener("nplay-settings-change",paint);
 $("nplay-notice-bell")?.addEventListener("click",()=>{const panel=$("nplay-notice-panel");openPanel(panel.hidden)});
 $("nplay-notice-close")?.addEventListener("click",()=>openPanel(false));
 $("nplay-notice-read-all")?.addEventListener("click",()=>{news.forEach(n=>readIds.add(Number(n.id)));saveRead();paint()});
 $("nplay-notice-history")?.addEventListener("click",()=>{historyShown=!historyShown;paint()});
 document.addEventListener("click",e=>{
  if(!$("nplay-notice-panel")?.hidden&&!e.target.closest("#nplay-notice-area"))openPanel(false);
 });
 document.addEventListener("keydown",e=>{if(e.key==="Escape")openPanel(false)});
}
async function connect(){
 if(starting||ready)return;
 starting=true;
 try{
  if(!window.supabase?.createClient)return;
  db=window.NPlayAccessClient||window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true}});
  const {data:{session}}=await db.auth.getSession();
  if(!session?.user?.id)return;
  userId=session.user.id;loadRead();
  await refresh();ready=true;
  db.channel("nplay-customer-news-"+userId)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"novaplay_announcements"},refresh)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"novaplay_announcements"},refresh)
   .on("postgres_changes",{event:"DELETE",schema:"public",table:"novaplay_announcements"},refresh)
   .subscribe();
 }catch(e){console.warn("NPlay: não foi possível carregar avisos",e)}
 finally{starting=false;}
}
function init(){
 setup();connect();
 setInterval(()=>{if(!ready)connect()},5000);
 setInterval(()=>{if(ready&&!document.hidden)refresh()},60000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
 window.addEventListener("focus",()=>{if(!ready)connect();else refresh()});
}
window.NPlayNotificationCore=Object.freeze({versionId,releaseEntries});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();