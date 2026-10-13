/* NovaPlay v0.35.0 · Cards de paisagem com prévia silenciosa ao passar o mouse. */
(function(){
"use strict";
let layer=null,owner=null,timer=null,closeTimer=null,clipTimer=null,hls=null,token=0;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function close(){
 token++;clearTimeout(timer);clearTimeout(closeTimer);clearTimeout(clipTimer);
 timer=null;closeTimer=null;clipTimer=null;
 if(hls){try{hls.destroy()}catch(e){}hls=null}
 if(layer){
  const v=layer.querySelector("video");if(v){try{v.pause();v.removeAttribute("src");v.load()}catch(e){}}
  const f=layer.querySelector("iframe");if(f)f.src="about:blank";
  layer.remove();layer=null;
 }
 owner=null;
}
function maybeClose(card){
 clearTimeout(closeTimer);
 closeTimer=setTimeout(()=>{
  if(owner===card&&!card.matches(":hover")&&!layer?.matches(":hover"))close();
 },190);
}
async function playPreview(item,view,settings,id){
 if(item.catalogOnly||item.kind==="tv"||navigator.connection?.saveData||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const media=item.kind==="series"?(item.episodes||[])[0]:item.kind==="episode"?(item.episode||item):item;
 if(!media)return;
 const area=view.querySelector(".np-hover-media"),note=view.querySelector(".np-hover-hint");
 if(/^[A-Za-z0-9_-]{11}$/.test(media.youtube_id||"")){
  const frame=document.createElement("iframe");
  frame.title="Prévia silenciosa de "+item.title;
  frame.allow="autoplay; encrypted-media; picture-in-picture";
  frame.referrerPolicy="strict-origin-when-cross-origin";
  frame.tabIndex=-1;
  frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(media.youtube_id)
   +"?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&start=12&end=37";
  if(id!==token||layer!==view)return;
  area.append(frame);
  note.textContent="Prévia sem som · reprodução sujeita às permissões do YouTube";
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
  note.textContent="Fim da prévia · clique para assistir";
 },25000);
}
function open(card,item,settings){
 if(!card.isConnected||!card.matches(":hover"))return;
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
 view.setAttribute("aria-label","Detalhes e prévia de "+item.title);
 view.innerHTML='<div class="np-hover-media"><img class="np-hover-poster" loading="eager" src="'+esc(item.cover||"./assets/icon.svg")+'" alt=""></div>'
  +'<div class="np-hover-body"><div class="np-hover-title">'+esc(item.title)+'</div>'
  +'<div class="np-hover-actions">'
  +(item.catalogOnly?"":'<button type="button" class="np-hover-action np-primary" aria-label="Assistir '+esc(item.title)+'" title="Assistir">▶</button>')
  +'<button type="button" class="np-hover-action np-details" aria-label="Mais informações de '+esc(item.title)+'" title="Mais informações">ⓘ</button></div>'
  +'<div class="np-hover-metadata">'+esc(item.catalogOnly?"EM BREVE":item.category||"NovaPlay")+'</div>'
  +'<div class="np-hover-hint">'+esc(item.catalogOnly?"Aguardando vídeo autorizado":"Prévia automática quando disponível")+'</div></div>';
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
function attach(card,item,settings){
 if(!window.matchMedia?.("(hover:hover) and (pointer:fine)").matches)return;
 card.addEventListener("mouseenter",()=>{
  clearTimeout(timer);clearTimeout(closeTimer);
  if(owner===card)return;
  timer=setTimeout(()=>{if(card.matches(":hover"))open(card,item,settings)},460);
 });
 card.addEventListener("mouseleave",()=>{
  clearTimeout(timer);
  if(owner===card)maybeClose(card);
 });
}
document.addEventListener("scroll",()=>{if(layer)close()},true);
window.addEventListener("resize",()=>{if(layer)close()});
document.addEventListener("visibilitychange",()=>{if(document.hidden)close()});
window.NovaPlayHover=Object.freeze({attach,close});
})();