(()=>{
"use strict";
const URL="https://vajlhodqxskozuxxlujv.supabase.co",KEY="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const $=id=>document.getElementById(id);
let db=null,userId=null,news=[],readIds=new Set(),channel=null,starting=false,ready=false;
function readKey(){return "nplay-news-read-v1:"+(userId||"anonymous")}
function loadRead(){
 try{readIds=new Set((JSON.parse(localStorage.getItem(readKey())||"[]")||[]).map(Number))}catch{readIds=new Set()}
}
function saveRead(){try{localStorage.setItem(readKey(),JSON.stringify(Array.from(readIds).slice(-200)))}catch{}}
function formatDate(value){try{return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value))}catch{return ""}}
function unread(){return news.filter(x=>!readIds.has(Number(x.id))).length}
function paint(){
 const badge=$("nplay-notice-count"),button=$("nplay-notice-bell"),list=$("nplay-notice-items");
 if(!badge||!button||!list)return;
 const count=unread();badge.hidden=count===0;badge.textContent=count>9?"9+":String(count);
 button.setAttribute("aria-label",count?"Notificações: "+count+" não lidas":"Notificações");
 list.replaceChildren();
 if(!news.length){const empty=document.createElement("p");empty.className="nplay-notice-empty";empty.textContent="Nenhuma novidade por enquanto. As atualizações aparecerão aqui.";list.append(empty);return}
 for(const entry of news){
  const card=document.createElement("button");card.type="button";
  card.className="nplay-notice-entry"+(readIds.has(Number(entry.id))?"":" unread");
  const category=document.createElement("small");category.textContent=entry.category==="aviso"?"Aviso":entry.category==="novidade"?"Novidade":"Atualização";
  const title=document.createElement("strong");title.textContent=entry.title;
  const body=document.createElement("span");body.textContent=entry.body;
  const date=document.createElement("time");date.textContent=formatDate(entry.created_at);
  card.append(category,title,body,date);
  card.onclick=()=>{readIds.add(Number(entry.id));saveRead();paint()};
  list.append(card);
 }
}
async function refresh(){
 if(!db||!userId)return;
 const {data,error}=await db.from("novaplay_announcements")
 .select("id,title,body,category,created_at").eq("is_published",true).order("created_at",{ascending:false}).limit(35);
 if(error){
  if($("nplay-notice-items"))$("nplay-notice-items").textContent="Não foi possível carregar as novidades.";
  return;
 }
 news=data||[];
 // Every published NPlay version automatically creates a local unread notice.
 // No database write, no client privileges and no personal data are needed.
 const version=document.querySelector('meta[name="nplay-version"]')?.content||"";
 if(/^\d+\.\d+\.\d+$/.test(version)){
  const identifier=-Number(version.split(".").map((part,i)=>String(Number(part)).padStart(i===0?1:3,"0")).join(""));
  news.unshift({id:identifier,title:"NPlay atualizada · versão "+version,
   body:"Uma nova versão da NPlay está disponível. Confira as melhorias e continue aproveitando seus conteúdos.",
   category:"atualizacao",created_at:new Date().toISOString()});
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
 $("nplay-notice-bell")?.addEventListener("click",()=>{
  const panel=$("nplay-notice-panel");openPanel(panel.hidden);
 });
 $("nplay-notice-close")?.addEventListener("click",()=>openPanel(false));
 $("nplay-notice-read-all")?.addEventListener("click",()=>{news.forEach(n=>readIds.add(Number(n.id)));saveRead();paint()});
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
  channel=db.channel("nplay-customer-news-"+userId)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"novaplay_announcements"},refresh)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"novaplay_announcements"},refresh)
   .on("postgres_changes",{event:"DELETE",schema:"public",table:"novaplay_announcements"},refresh)
   .subscribe();
 }catch(e){console.warn("NPlay: não foi possível carregar avisos",e);}
 finally{starting=false;}
}
function init(){
 setup();connect();
 setInterval(()=>{if(!ready)connect()},5000);
 setInterval(()=>{if(ready&&!document.hidden)refresh()},60000);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
 window.addEventListener("focus",()=>{if(!ready)connect();else refresh()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();