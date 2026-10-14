(()=>{
"use strict";
const $=id=>document.getElementById(id);
const PROVIDER="https://rdcanais.org/premiereclubes";
let currentUrl="",currentTitle="",experimental=false;
const player=()=>$("iframe-channel-player");
function note(message){const el=$("nplay-channel-notice");if(el)el.textContent=message}
function closeChannel(){
 const el=player();if(el)el.replaceChildren();
 currentUrl="";currentTitle="";
 $("iframe-channel-viewer").hidden=true;
 note("");
}
function openChannel(url,title,mode=experimental){
 let parsed;
 try{parsed=new URL(url);if(parsed.protocol!=="https:")throw Error("HTTPS necessário")}catch(e){note("Endereço do canal inválido.");return}
 currentUrl=parsed.href;currentTitle=title;experimental=Boolean(mode);
 const el=player();el.replaceChildren();
 const frame=document.createElement("iframe");
 frame.src=currentUrl;frame.title=title;
 frame.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
 frame.allowFullscreen=true;
 if(experimental)frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-presentation");
 frame.loading="eager";
 frame.referrerPolicy="strict-origin-when-cross-origin";
 frame.style.cssText="display:block;width:100%;height:100%;border:0;background:#000";
 // O provedor bloqueia iframe sandboxed. Mantemos incorporação padrão sem alterar o conteúdo remoto.
 el.append(frame);
 $("iframe-channel-heading").textContent=title;
 $("iframe-channel-viewer").hidden=false;
 note(experimental?"MODO EXPERIMENTAL: novas abas bloqueadas pelo navegador. Se o fornecedor bloquear o vídeo, clique em ‘Voltar ao normal’.":"Modo normal: o fornecedor pode abrir anúncios em novas abas.");
 const modeButton=$("nplay-channel-experiment");if(modeButton)modeButton.textContent=experimental?"↩ Voltar ao normal":"🛡 Testar bloqueio de abas";
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
  const button=document.createElement("button");
  button.type="button";button.textContent="📺 "+item.title;
  button.style.cssText="border:1px solid #365075;border-radius:12px;background:#14243c;color:white;padding:16px;text-align:left;cursor:pointer";
  button.onclick=()=>openChannel(item.embed_url,item.title);
  list.append(button);
 }
}
function init(){
 const button=$("iframe-channels-open");if(!button)return;
 const mobile=$("iframe-channels-open-mobile");if(mobile)mobile.onclick=()=>button.click();
 button.onclick=()=>{$("iframe-channels-panel").hidden=false;$("iframe-channels-panel").scrollIntoView({behavior:"smooth"});load()};
 $("iframe-channel-close").onclick=closeChannel;
 const experiment=$("nplay-channel-experiment");
 if(experiment)experiment.onclick=()=>{if(currentUrl)openChannel(currentUrl,currentTitle,!experimental)};
 const reload=$("nplay-channel-reload");
 if(reload)reload.onclick=()=>{if(currentUrl)openChannel(currentUrl,currentTitle)};
 const fullscreen=$("nplay-channel-fullscreen");
 if(fullscreen)fullscreen.onclick=async()=>{const el=player();if(!el||!currentUrl)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await el.requestFullscreen()}catch(e){note("Tela cheia não está disponível neste navegador.")}};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();