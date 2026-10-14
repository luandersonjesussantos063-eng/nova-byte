(()=>{
"use strict";
const $=id=>document.getElementById(id);
const PROVIDER="https://rdcanais.org/premiereclubes";
let currentUrl="",currentTitle="";
const player=()=>$("iframe-channel-player");
function note(message){const el=$("nplay-channel-notice");if(el)el.textContent=message}
function closeChannel(){
 const el=player();if(el)el.replaceChildren();
 currentUrl="";currentTitle="";
 $("iframe-channel-viewer").hidden=true;
 note("");
}
function openChannel(url,title){
 let parsed;
 try{parsed=new URL(url);if(parsed.protocol!=="https:")throw Error("HTTPS necessário")}catch(e){note("Endereço do canal inválido.");return}
 currentUrl=parsed.href;currentTitle=title;
 const el=player();el.replaceChildren();
 const frame=document.createElement("iframe");
 frame.src=currentUrl;frame.title=title;
 frame.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
 frame.allowFullscreen=true;

 frame.loading="eager";
 frame.referrerPolicy="strict-origin-when-cross-origin";
 frame.style.cssText="display:block;width:100%;height:100%;border:0;background:#000";
 // O provedor bloqueia iframe sandboxed. Mantemos incorporação padrão sem alterar o conteúdo remoto.
 el.append(frame);
 $("iframe-channel-heading").textContent=title;
 $("iframe-channel-viewer").hidden=false;
 note("Transmissão incorporada. O fornecedor pode abrir anúncios em novas abas.");
 $("iframe-channel-viewer").scrollIntoView({behavior:"smooth",block:"start"});
}
async function load(){
 const list=$("iframe-channel-list");if(!list)return;
 list.replaceChildren();
 const channels=[{title:"Premiere Clubes · Ao vivo",embed_url:PROVIDER}];
 if(window.supabase){
  try{
   const db=window.supabase.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
   const {data,error}=await db.from("novaplay_live_embeds").select("id,title,embed_url").eq("is_published",true).order("created_at",{ascending:false});
   if(error)throw error;
   const seen=new Set([PROVIDER]);
   for(const item of data||[]){
    if(!item.embed_url||seen.has(item.embed_url))continue;
    seen.add(item.embed_url);channels.push(item);
   }
  }catch(e){note("Alguns canais cadastrados não puderam ser carregados. O Premiere Clubes continua disponível.")}
 }

 for(const item of channels){
  const isPremiere=item.embed_url===PROVIDER;
  const card=document.createElement("article");
  card.className="nplay-live-card";
  const button=document.createElement("button");
  button.type="button";button.className="nplay-live-cover";
  button.setAttribute("aria-label","Assistir "+item.title);
  const art=document.createElement("span");
  art.className="nplay-live-art"+(isPremiere?" nplay-premiere-art":"");
  if(isPremiere){
   const emblem=document.createElement("span");emblem.className="nplay-premiere-emblem";emblem.textContent="P";
   const brand=document.createElement("span");brand.className="nplay-premiere-brand";brand.textContent="PREMIERE";
   art.append(emblem,brand);
  }else{
   const tv=document.createElement("span");tv.className="nplay-generic-channel";tv.textContent="TV";
   art.append(tv);
  }
  const badge=document.createElement("span");badge.className="nplay-live-badge";badge.textContent="● AO VIVO";
  const play=document.createElement("span");play.className="nplay-live-play";play.textContent="▶";
  button.append(art,badge,play);
  const title=document.createElement("strong");title.className="nplay-live-title";title.textContent=item.title;
  const subtitle=document.createElement("span");subtitle.className="nplay-live-subtitle";subtitle.textContent="Canal ao vivo · Assistir agora";
  button.onclick=()=>openChannel(item.embed_url,item.title);
  card.append(button,title,subtitle);list.append(card);
 }
}
function init(){
 window.addEventListener("nplay:tv-open",()=>{const panel=$("iframe-channels-panel");if(panel){panel.hidden=false;load()}});
 if(location.hash==="#tv")load();
 $("iframe-channel-close").onclick=closeChannel;
 const reload=$("nplay-channel-reload");
 if(reload)reload.onclick=()=>{if(currentUrl)openChannel(currentUrl,currentTitle)};
 const fullscreen=$("nplay-channel-fullscreen");
 if(fullscreen)fullscreen.onclick=async()=>{const el=player();if(!el||!currentUrl)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await el.requestFullscreen()}catch(e){note("Tela cheia não está disponível neste navegador.")}};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();