/* NovaPlay V 0.36.2 — prévias curtas dos destaques, via player oficial do YouTube.
   Os tempos são segmentos editoriais aproximados de trailers/clipes divulgados:
   não são arquivos de filmes nem atestam ser a "cena mais engraçada".
   Fontes: promo Ice Age 4 Scrat, trailer Disney Meet the Robinsons,
   vídeo YouTube registrado pelo administrador de A Grande Família,
   trailer Warner Bros. Charlie and the Chocolate Factory.
   Para uma cena ainda não verificada, mantém-se a capa estática. */
(function(){
"use strict";
const SAMPLES=Object.freeze({
 "a era do gelo 4":{id:"TzzGPfVx32M",start:8,end:42,label:"Scrat · confusão com a noz"},
 "a familia do futuro":{id:"RfuiGZ4FIBg",start:32,end:62,label:"Trailer oficial Disney"},
 "a grande familia o roubo":{fromCatalog:true,start:12,end:42,label:"Trecho do vídeo cadastrado"},
 "a fantastica fabrica de chocolate":{id:"p6JAQ2aoXm0",start:26,end:56,label:"Trailer Warner Bros."}
});
const normalize=text=>String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
let generation=0,player=null,apiPromise=null,retryTimer=null,visible=false,soundOn=false,lastItem=null;
let scrollSuspended=false;
const STOP_SCROLL_PX=150,RESUME_SCROLL_PX=70;
/* Histerese: a cena para quando a pessoa sai do topo. Recomeça apenas
   quando ela volta perto do início; não liga/desliga repetidamente. */
function canPreviewInView(){
 const home=document.getElementById("view-home");
 return !document.hidden && !!home && !home.hidden && window.scrollY<=STOP_SCROLL_PX;
}
function syncScrollPlayback(){
 if(window.scrollY>STOP_SCROLL_PX){
  if(!scrollSuspended){
   scrollSuspended=true;
   teardown();
  }
 }else if(window.scrollY<RESUME_SCROLL_PX&&scrollSuspended){
  scrollSuspended=false;
  if(lastItem&&canPreviewInView())show(lastItem);
 }
}
const el=id=>document.getElementById(id);
/* O player de terceiros não obedece object-fit:cover.
   Redimensionar proporcionalmente o iframe completo para cobrir todo o hero. */
function fitHeroFrame(){
 const hero=el("hero"),iframe=player?.getIframe?.();
 if(!hero||!iframe)return;
 const w=hero.clientWidth,h=hero.clientHeight;
 if(!w||!h)return;
 const width=Math.ceil(Math.max(w,h*16/9)*1.12);
 const height=Math.ceil(width*9/16);
 iframe.style.width=width+"px";
 iframe.style.height=height+"px";
 iframe.style.maxWidth="none";
 iframe.style.position="absolute";
 iframe.style.left="50%";
 iframe.style.top="50%";
 iframe.style.transform="translate(-50%,-50%)";
}

function soundButton(){
 const button=el("hero-scene-sound");
 if(!button)return;
 button.textContent=soundOn?"🔊":"🔇";
 button.title=soundOn?"Desligar som da cena":"Ativar som da cena";
 button.setAttribute("aria-label",button.title);
 button.setAttribute("aria-pressed",String(soundOn));
}
function teardown(){
 generation++;clearTimeout(retryTimer);retryTimer=null;
 try{player?.mute?.();player?.stopVideo?.();player?.destroy?.()}catch(e){}
 player=null;visible=false;soundOn=false;
 el("hero")?.classList.remove("hero-scene-visible");
 const layer=el("hero-scene");
 if(layer){layer.classList.remove("is-playing");layer.setAttribute("aria-hidden","true")}
 if(el("hero-scene-sound"))el("hero-scene-sound").hidden=true;
 const mount=el("hero-scene-player");if(mount)mount.replaceChildren();
 soundButton();
}
function youtubeAPI(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=function(){
   try{if(typeof previous==="function")previous()}catch(e){}
   if(window.YT?.Player)resolve(window.YT);else reject(new Error("YouTube API indisponível"));
  };
  const script=document.createElement("script");
  script.src="https://www.youtube.com/iframe_api";
  script.async=true;
  script.onerror=()=>reject(new Error("YouTube bloqueado"));
  document.head.append(script);
 });
 return apiPromise;
}
function choose(item){
 const s=SAMPLES[normalize(item?.title)];
 if(s?.id&&/^[a-zA-Z0-9_-]{11}$/.test(s.id))return s;
 if(s?.fromCatalog&&/^[a-zA-Z0-9_-]{11}$/.test(item?.youtube_id||""))return {...s,id:item.youtube_id};
 // Um sexto filme incluído depois poderá ter prévia se estiver cadastrado no YouTube.
 if(!s&&/^[a-zA-Z0-9_-]{11}$/.test(item?.youtube_id||""))
  return {id:item.youtube_id,start:15,end:45,label:"Trecho do vídeo cadastrado"};
 return null;
}
async function show(item){
 teardown();lastItem=item||null;
 if(!canPreviewInView())return;
 if(!item||item.catalogOnly||item.kind==="tv")return;
 // Allow mobile previews too; browsers may require a tap before enabling sound.
 if(matchMedia("(prefers-reduced-motion:reduce)").matches||navigator.connection?.saveData)return;
 const clip=choose(item);if(!clip)return;
 const id=generation;
 try{
  const YT=await youtubeAPI();
  if(id!==generation||!canPreviewInView())return;
  const mount=el("hero-scene-player");
  if(!mount)return;
  mount.replaceChildren();
  const div=document.createElement("div");mount.append(div);
  retryTimer=setTimeout(()=>{if(id===generation&&!visible)teardown()},9500);
  player=new YT.Player(div,{
   videoId:clip.id,
   width:"100%",height:"100%",
   host:"https://www.youtube-nocookie.com",
   playerVars:{
    autoplay:1,mute:0,controls:1,playsinline:1,rel:0,
    iv_load_policy:3,start:clip.start,end:clip.end,
    origin:location.origin
   },
   events:{
    onReady(event){
     if(id!==generation||!canPreviewInView()){if(id===generation)teardown();return}
     try{fitHeroFrame();event.target.unMute();event.target.setVolume(100);soundOn=true;soundButton();event.target.seekTo(clip.start,true);event.target.playVideo()}catch(e){}
    },
    onStateChange(event){
     if(id!==generation)return;
     if(event.data===1){
      visible=true;clearTimeout(retryTimer);
      el("hero-scene")?.classList.add("is-playing");
      el("hero-scene")?.setAttribute("aria-hidden","false");
      el("hero")?.classList.add("hero-scene-visible");
      if(el("hero-scene-sound"))el("hero-scene-sound").hidden=false;
      soundButton();
     }else if(event.data===0){
      // O trecho acabou: mostre a capa até o próximo destaque selecionado.
      teardown();
     }
    },
    onError(){if(id===generation)teardown()}
   }
  });
 }catch(e){if(id===generation)teardown()}
}
function toggleSound(){
 if(!visible||!player)return;
 try{
  if(soundOn)player.mute();else{player.unMute();player.setVolume(100)}
  soundOn=!soundOn;soundButton();
 }catch(e){soundOn=false;soundButton()}
}
function init(){
 el("hero-scene-sound")?.addEventListener("click",toggleSound);
 scrollSuspended=window.scrollY>STOP_SCROLL_PX;
 window.addEventListener("scroll",syncScrollPlayback,{passive:true});
 window.addEventListener("resize",fitHeroFrame,{passive:true});
 document.addEventListener("visibilitychange",()=>{if(document.hidden)teardown();else if(lastItem&&canPreviewInView())show(lastItem)});
 window.addEventListener("pagehide",teardown);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
window.NovaPlayHeroScenes=Object.freeze({show,stop:teardown});
})();