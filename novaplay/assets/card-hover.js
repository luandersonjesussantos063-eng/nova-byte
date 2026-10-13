/* NovaPlay v0.38.3 · Ampliação progressiva a partir da capa de origem, com áudio sob controle. */
(function(){
"use strict";
let layer=null,owner=null,timer=null,closeTimer=null,clipTimer=null,hls=null,token=0;
let pendingCard=null,pointerX=-1,pointerY=-1;
const FIRST_HOVER_MS=415,SWITCH_HOVER_MS=235,CLOSE_GRACE_MS=165;
const EXIT_ANIMATION_MS=135;
const cardSettings=new WeakMap();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const MUTED_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m17 9 5 6m0-6-5 6"/></svg>';
const SOUND_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/></svg>';
function setSoundButton(button,enabled){
 button.setAttribute("aria-pressed",String(enabled));
 button.setAttribute("aria-label",enabled?"Desligar áudio da prévia":"Ativar áudio da prévia");
 button.title=enabled?"Desligar som":"Ativar som";
 button.innerHTML=enabled?SOUND_ICON:MUTED_ICON;
}
function youtubeCommand(frame,func,args=[]){
 try{frame.contentWindow?.postMessage(JSON.stringify({event:"command",func,args}),"https://www.youtube-nocookie.com")}catch(e){}
}
function attachSoundButton(view){
 const area=view.querySelector(".np-hover-media");
 const button=area.querySelector(".np-hover-sound");
 const note=view.querySelector(".np-hover-hint");
 button.addEventListener("click",e=>{
  e.preventDefault();e.stopPropagation();
  if(view!==layer)return;
  const video=area.querySelector("video"),frame=area.querySelector("iframe");
  if(!video&&!frame)return;
  const enabled=button.getAttribute("aria-pressed")!=="true";
  if(video){
   video.muted=!enabled;
   if(enabled){video.volume=1;video.play().catch(()=>{
    if(view!==layer)return;
    video.muted=true;setSoundButton(button,false);
    note.textContent="O navegador bloqueou o áudio. Tente tocar em ativar som novamente.";
   })}
   note.textContent=enabled?"Áudio ativado · clique para silenciar":"Prévia sem som";
  }else if(frame){
   youtubeCommand(frame,enabled?"unMute":"mute");
   if(enabled){youtubeCommand(frame,"setVolume",[100]);youtubeCommand(frame,"playVideo")}
   note.textContent=enabled?"Som solicitado · pode depender do YouTube":"Prévia sem som";
  }
  setSoundButton(button,enabled);
 });
 setSoundButton(button,false);
 return button;
}
function close(){
 token++;clearTimeout(timer);clearTimeout(closeTimer);clearTimeout(clipTimer);
 pendingCard=null;
 timer=null;closeTimer=null;clipTimer=null;
 if(hls){try{hls.destroy()}catch(e){}hls=null}
 if(layer){
  const outgoing=layer;
  const v=outgoing.querySelector("video");
  if(v){try{v.pause();v.removeAttribute("src");v.load()}catch(e){}v.remove()}
  const f=outgoing.querySelector("iframe");
  if(f){f.src="about:blank";f.remove()}
  // Silenciar e interromper o conteúdo imediatamente; suavizar somente a capa.
  layer=null;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){
   outgoing.remove();
  }else{
   outgoing.style.pointerEvents="none";
   outgoing.classList.remove("np-is-playing");
   outgoing.classList.add("np-hover-leaving");
   setTimeout(()=>outgoing.remove(),EXIT_ANIMATION_MS+20);
  }
 }
 owner=null;
}
function maybeClose(card){
 clearTimeout(closeTimer);
 closeTimer=setTimeout(()=>{
  if(owner===card&&!card.matches(":hover")&&!layer?.matches(":hover"))close();
 },CLOSE_GRACE_MS);
}
async function playPreview(item,view,settings,id){
 if(item.catalogOnly||item.kind==="tv"||navigator.connection?.saveData||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const media=item.kind==="series"?(item.episodes||[])[0]:item.kind==="episode"?(item.episode||item):item;
 if(!media)return;
 const area=view.querySelector(".np-hover-media"),note=view.querySelector(".np-hover-hint");
 const soundButton=area.querySelector(".np-hover-sound");
 if(/^[A-Za-z0-9_-]{11}$/.test(media.youtube_id||"")){
  const frame=document.createElement("iframe");
  frame.title="Prévia silenciosa de "+item.title;
  frame.allow="autoplay; encrypted-media; picture-in-picture";
  frame.referrerPolicy="strict-origin-when-cross-origin";
  frame.tabIndex=-1;
  frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(media.youtube_id)
   +"?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&start=12&end=37&enablejsapi=1&origin="+encodeURIComponent(location.origin);
  if(id!==token||layer!==view)return;
  area.append(frame);
  soundButton.hidden=false;
  note.textContent="Prévia sem som · clique no alto-falante para ativar áudio";
 }else{
  if(media.google_drive_id){note.textContent="Capa ampliada · clique em assistir para abrir o vídeo";return}
  let src=media.licensed_stream_url||media.src||"";
  if(media.video_path){
   try{src=await settings.signedUrl(media.video_path)||""}catch(e){src=""}
   if(id!==token||layer!==view)return;
  }
  if(!/^https:\/\//i.test(src))return;
  const video=document.createElement("video");
  video.muted=true;video.defaultMuted=true;video.autoplay=true;video.playsInline=true;
  video.preload="metadata";video.controls=false;
  video.setAttribute("aria-label","Prévia sem áudio de "+item.title);
  video.addEventListener("playing",()=>{
   if(id!==token||layer!==view)return;
   view.classList.add("np-is-playing");
   note.textContent="Prévia sem som · clique para assistir";
  });
  video.addEventListener("loadedmetadata",()=>{
   if(id!==token||layer!==view||!Number.isFinite(video.duration)||video.duration<=28)return;
   try{video.currentTime=Math.min(12,video.duration-25)}catch(e){}
  },{once:true});
  video.addEventListener("error",()=>{if(id===token)note.textContent="Prévia indisponível para esta fonte"});
  area.append(video);
  soundButton.hidden=false;
  if(/\.m3u8(?:\?|$)/i.test(src)&&!video.canPlayType("application/vnd.apple.mpegurl")&&window.Hls?.isSupported()){
   hls=new window.Hls({enableWorker:true,maxBufferLength:8});
   hls.loadSource(src);hls.attachMedia(video);
   hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{if(id===token)video.play().catch(()=>{})});
  }else{video.src=src;video.play().catch(()=>{})}
 }
 clipTimer=setTimeout(()=>{
  if(id!==token||view!==layer)return;
  const v=area.querySelector("video"),f=area.querySelector("iframe");
  if(v){v.pause();v.removeAttribute("src");v.load()}
  if(f){f.src="about:blank";f.remove()}
  if(hls){try{hls.destroy()}catch(e){}hls=null}
  view.classList.remove("np-is-playing");
  soundButton.hidden=true;setSoundButton(soundButton,false);
  note.textContent="Fim da prévia · clique para assistir";
 },25000);
}
function open(card,item,settings){
 if(!card.isConnected||!pointerIsOver(card))return;
 close();
 const rect=card.querySelector(".cover").getBoundingClientRect();
 if(!rect.width)return;
 const width=Math.min(438,Math.max(290,Math.round(rect.width*1.38)));
 const height=Math.round(width*9/16)+142;
 const left=Math.round(Math.max(9,Math.min(innerWidth-width-9,rect.left-(width-rect.width)/2)));
 const top=Math.round(Math.max(80,Math.min(innerHeight-height-9,rect.top-35)));
 const view=document.createElement("section");
 view.className="np-hover-card";
 view.style.cssText="left:"+left+"px;top:"+top+"px;width:"+width+"px";
 // Usar posição e dimensão REAIS da capa como início da ampliação.
 // Com origem no canto superior esquerdo, a imagem começa exatamente
 // sobre a miniatura e cresce até a dimensão final, sem salto.
 const startScale=Math.min(1,rect.width/width);
 view.style.setProperty("--np-hover-from-x",(rect.left-left).toFixed(2)+"px");
 view.style.setProperty("--np-hover-from-y",(rect.top-top).toFixed(2)+"px");
 view.style.setProperty("--np-hover-from-scale",startScale.toFixed(4));
 view.setAttribute("aria-label","Detalhes e prévia de "+item.title);
 view.innerHTML='<div class="np-hover-media"><img class="np-hover-poster" loading="eager" src="'+esc(item.cover||"./assets/icon.svg")+'" alt=""><button type="button" class="np-hover-sound" aria-label="Ativar áudio da prévia" aria-pressed="false" title="Ativar som" hidden></button></div>'
  +'<div class="np-hover-body"><div class="np-hover-title">'+esc(item.title)+'</div>'
  +'<div class="np-hover-actions">'
  +(item.catalogOnly?"":'<button type="button" class="np-hover-action np-primary" aria-label="Assistir '+esc(item.title)+'" title="Assistir">▶</button>')
  +'<button type="button" class="np-hover-action np-details" aria-label="Mais informações de '+esc(item.title)+'" title="Mais informações">ⓘ</button></div>'
  +'<div class="np-hover-metadata">'+esc(item.catalogOnly?"EM BREVE":item.category||"NovaPlay")+'</div>'
  +'<div class="np-hover-hint">'+esc(item.catalogOnly?"Aguardando vídeo autorizado":"Prévia automática quando disponível")+'</div></div>';
 attachSoundButton(view);
 const picture=view.querySelector(".np-hover-poster");
 picture.addEventListener("error",function(){
  if(this.dataset.replaced)return;this.dataset.replaced="yes";
  this.src=window.NovaPlayCover?.genrePoster?.(item.title,item.category)||"./assets/posters/autoral.svg";
 });
 view.querySelector(".np-primary")?.addEventListener("click",e=>{e.stopPropagation();close();settings.play()});
 view.querySelector(".np-details").addEventListener("click",e=>{e.stopPropagation();close();settings.details()});
 view.addEventListener("mouseenter",()=>clearTimeout(closeTimer));
 view.addEventListener("mouseleave",()=>maybeClose(card));
 document.body.append(view);
 layer=view;owner=card;
 const id=token;
 playPreview(item,view,settings,id).catch(()=>{});
}
/* Hover anterior é silenciado imediatamente e sua capa desaparece suavemente.
   O próximo card aguarda o final dessa saída para evitar sobreposições. */
function hoveredCardAt(x,y){
 if(x<0||y<0||!document.elementsFromPoint)return null;
 for(const element of document.elementsFromPoint(x,y)){
  const card=element.closest?.(".poster-card");
  if(card&&cardSettings.has(card))return card;
 }
 return null;
}
function pointerIsOver(card){
 if(!card.isConnected)return false;
 if(pointerX>=0&&pointerY>=0){
  const rect=card.getBoundingClientRect();
  return pointerX>=rect.left&&pointerX<rect.right
   &&pointerY>=rect.top&&pointerY<rect.bottom
   &&hoveredCardAt(pointerX,pointerY)===card;
 }
 return card.matches(":hover");
}
function requestHover(card){
 const settings=cardSettings.get(card);
 if(!settings||!card.isConnected)return;
 if(card===owner&&layer){clearTimeout(closeTimer);return}
 if(card===pendingCard)return;
 const changing=!!(layer||pendingCard);
 // Eliminar a prévia velha imediatamente, incluindo som e vídeo.
 if(layer){close()}else{clearTimeout(timer);timer=null}
 pendingCard=card;
 timer=setTimeout(()=>{
  if(pendingCard!==card)return;
  pendingCard=null;timer=null;
  if(pointerIsOver(card))open(card,settings.item,settings);
 },changing?SWITCH_HOVER_MS:FIRST_HOVER_MS);
}
function attach(card,item,settings){
 if(!window.matchMedia?.("(hover:hover) and (pointer:fine)").matches)return;
 cardSettings.set(card,{item,...settings});
 card.addEventListener("mouseenter",()=>requestHover(card));
 card.addEventListener("mouseleave",()=>{
  if(pendingCard===card){clearTimeout(timer);timer=null;pendingCard=null}
  if(owner===card)maybeClose(card);
 });
}
/* Uma prévia ampliada pode cobrir o card vizinho: localizar o card
   fisicamente sob o cursor, mesmo com o painel em primeiro plano. */
document.addEventListener("pointermove",event=>{
 if(event.pointerType!=="mouse")return;
 pointerX=event.clientX;pointerY=event.clientY;
 if(!layer&&!pendingCard)return;
 // Ao usar ações ou som, manter o card atual aberto.
 if(event.target?.closest?.(".np-hover-body, .np-hover-sound"))return;
 const underneath=hoveredCardAt(pointerX,pointerY);
 if(underneath&&underneath!==owner)requestHover(underneath);
},{passive:true});
document.addEventListener("scroll",()=>{if(layer)close()},true);
window.addEventListener("resize",()=>{if(layer)close()});
document.addEventListener("visibilitychange",()=>{if(document.hidden)close()});
window.NovaPlayHover=Object.freeze({attach,close});
})();