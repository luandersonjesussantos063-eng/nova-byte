/* Controles do player nativo. Players oficiais incorporados mantêm seus controles. */
(()=>{
"use strict";
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const clock=seconds=>{
 const n=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=String(n%60).padStart(2,"0");
 return (h?h+":"+String(m).padStart(2,"0"):String(m))+":"+s;
};
function parseClock(value){
 const parts=String(value).trim().split(":");
 if(!/^\d+(?::[0-5]\d){0,2}$/.test(String(value).trim()))return NaN;
 return parts.reduce((sum,part)=>sum*60+Number(part),0);
}
function seekRange(media,{live=false}={}){
 if(!media||media.canSeek===false)return null;
 const ranges=[];
 try{for(let i=0;i<(media.seekable?.length||0);i++){
  const start=media.seekable.start(i),end=media.seekable.end(i);
  if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)ranges.push({start,end});
 }}catch(e){return null;}
 const position=Number(media.currentTime)||0;
 if(ranges.length)return ranges.find(r=>position>=r.start&&position<=r.end)||ranges.reduce((a,b)=>Math.min(Math.abs(position-a.start),Math.abs(position-a.end))<=Math.min(Math.abs(position-b.start),Math.abs(position-b.end))?a:b);
 return !live&&Number.isFinite(media.duration)&&media.duration>0?{start:0,end:media.duration}:null;
}
function seekTarget(media,delta,options){
 const range=seekRange(media,options),position=Number(media?.currentTime);
 if(!range||!Number.isFinite(position)||!Number.isFinite(delta))return null;
 const target=clamp(position+delta,range.start,range.end);
 return (delta>0&&target>position)||(delta<0&&target<position)?target:null;
}
function bindDoubleTap(video,{enabled=()=>true,rotated=()=>false,onSeek,now=()=>performance.now()}={}){
 let down=null,last=null;const pointers=new Set();
 const reset=()=>{down=null;last=null;pointers.clear();};
 const handlers={
  pointerdown(e){
   pointers.add(e.pointerId);
   if(!enabled()||e.isPrimary===false||pointers.size>1||(e.button!==undefined&&e.button!==0)){down=null;last=null;return;}
   down={id:e.pointerId,x:e.clientX,y:e.clientY,time:now()};
   try{video.setPointerCapture(e.pointerId);}catch(err){}
  },
  pointermove(e){if(down?.id===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>24){down=null;last=null;}},
  pointerup(e){
   pointers.delete(e.pointerId);const tap=down;down=null;
   if(!tap||tap.id!==e.pointerId||!enabled()||pointers.size||now()-tap.time>300||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>24){last=null;return;}
   const rect=video.getBoundingClientRect(),turn=rotated();
   const extent=turn?rect.height:rect.width,point=turn?e.clientY-rect.top:e.clientX-rect.left;
   if(extent<=0||point<0||point>extent){last=null;return;}
   const side=point<extent/2?-1:1,time=now();
   if(last&&last.side===side&&time-last.time<=350&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<=80){last=null;onSeek(side*10);}
   else last={side,time,x:e.clientX,y:e.clientY};
  },
  pointercancel(){reset();},
  emptied(){reset();}
 };
 for(const [event,handler] of Object.entries(handlers))video.addEventListener(event,handler);
 return {reset,destroy(){reset();for(const [event,handler] of Object.entries(handlers))video.removeEventListener(event,handler);}};
}
const playIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M17 7v50l39-25z"/></svg>';
const pauseIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><rect fill="currentColor" x="11" y="5" width="17" height="54" rx="2"/><rect fill="currentColor" x="36" y="5" width="17" height="54" rx="2"/></svg>';
function create({layer,video,getHls=()=>null,getRemote=()=>null,command=()=>false,isLive=()=>false,onInteraction=()=>{}}){
 const $=id=>layer.querySelector("#"+id),controls=$("cinema-controls"),settings=$("cinema-settings"),body=$("cinema-settings-body");
 let locked=false,seeking=false,clip=null,returnFocus=null,previousPaused=null;
 const native=()=>!layer.hidden&&layer.classList.contains("native-player");
 const media=()=>getRemote()||video;
 const range=()=>clip&&!getRemote()?{start:clip.start,end:clip.end}:seekRange(media(),{live:isLive()});
 function seekTo(position){
  if(locked||!native())return false;
  const r=range();if(!r||!Number.isFinite(position))return false;
  const target=clamp(position,r.start,r.end);
  try{if(getRemote()){if(!command("seek",target))return false;}else video.currentTime=target;}catch(e){return false;}
  if(clip)clip.finished=false;update();onInteraction();return true;
 }
 function seekBy(delta){
  const target=clip&&!getRemote()?clamp(video.currentTime+delta,clip.start,clip.end):seekTarget(media(),delta,{live:isLive()});
  return target!==null&&seekTo(target);
 }
 function update(){
  if(!native())return;
  const m=media(),r=range(),position=Number(m.currentTime)||0;
  if(previousPaused!==m.paused){
   previousPaused=m.paused;$("cinema-play").innerHTML=m.paused?playIcon:pauseIcon;
   $("cinema-play").setAttribute("aria-label",m.paused?"Reproduzir":"Pausar");
  }
  $("cinema-seek").disabled=!r;
  $("cinema-rewind").disabled=!r||position<=r.start;
  $("cinema-forward").disabled=!r||position>=r.end;
  $("cinema-duration").textContent=isLive()?"AO VIVO":r?clock(r.end-position):"Carregando…";
  $("cinema-duration").setAttribute("aria-label",isLive()?"Transmissão ao vivo":"Tempo restante");
  if(!seeking){
   const percent=r?clamp((position-r.start)/(r.end-r.start)*100,0,100):0;
   $("cinema-seek").value=String(percent);
   $("cinema-seek").style.setProperty("--played",percent+"%");
   $("cinema-seek").setAttribute("aria-valuetext",r?clock(position-r.start)+" de "+clock(r.end-r.start):"Ao vivo");
   $("cinema-elapsed").textContent=clock(r?position-r.start:0);
  }
  $("cinema-speed-label").textContent="Velocidade ("+(video.playbackRate||1)+"x)";
  if(clip&&!getRemote()&&!clip.finished&&position>=clip.end){clip.finished=true;video.pause();}
 }
 function togglePlay(){
  if(locked||!native())return;
  if(getRemote()){command("toggle");update();onInteraction();return;}
  restoreAudio();
  if(video.paused){
   if(clip&&video.currentTime>=clip.end-.1){video.currentTime=clip.start;clip.finished=false;}
   video.play().catch(onInteraction);
  }else video.pause();
  onInteraction();
 }
 function setLocked(value){
  closeSettings(false);locked=!!value;gestures.reset();
  layer.classList.toggle("controls-locked",locked);controls.inert=locked;
  for(const id of ["player-back","player-close","player-favorite","cinema-cast","cinema-fullscreen","player-live-reload","player-issue-open"])$(id).inert=locked;
  $("cinema-lock").setAttribute("aria-pressed",String(locked));
  $("cinema-lock").setAttribute("aria-label",locked?"Desbloquear controles":"Bloquear controles");
  onInteraction();
 }
 function closeSettings(restore=true){
  settings.hidden=true;controls.inert=locked;
  if(restore&&returnFocus?.isConnected)returnFocus.focus();
  returnFocus=null;
 }
 function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
 function message(text){body.append(node("p",text,"cinema-setting-message"));}
 function choice(label,selected,select){
  const button=node("button",label,"cinema-setting-choice");button.type="button";
  button.setAttribute("aria-pressed",String(selected));button.addEventListener("click",select);body.append(button);return button;
 }
 function openSettings(name,trigger){
  if(locked||!native())return;
  gestures.reset();returnFocus=trigger;body.replaceChildren();
  $("cinema-settings-title").textContent={speed:"Velocidade de reprodução",tracks:"Idioma e legendas",clip:"Recortar"}[name];
  settings.hidden=false;controls.inert=true;onInteraction();
  if(getRemote())message("Use o controle da TV para ajustar a reprodução durante a transmissão.");
  else if(name==="speed")for(const speed of [.5,.75,1,1.25,1.5,1.75,2])choice(speed+"x"+(speed===1?" · Normal":""),video.playbackRate===speed,()=>{video.playbackRate=speed;closeSettings();update();onInteraction();});
  else if(name==="tracks")renderTracks();
  else renderClip();
  $("cinema-settings-close").focus();
 }
 function trackLabel(track,index,prefix){return String(track.name||track.label||track.lang||track.language||prefix+" "+(index+1));}
 function renderTracks(){
  const hls=getHls(),audio=hls?.audioTracks?.length?Array.from(hls.audioTracks):Array.from(video.audioTracks||[]);
  body.append(node("h3","Áudio"));
  if(!audio.length)message("Áudio original deste vídeo. Não há outras faixas disponíveis.");
  audio.forEach((track,index)=>choice(trackLabel(track,index,"Áudio"),hls?.audioTracks?.length?hls.audioTrack===index:!!track.enabled,()=>{
   if(hls?.audioTracks?.length)hls.audioTrack=index;else audio.forEach((t,i)=>{t.enabled=i===index;});
   openSettings("tracks",returnFocus);
  }));
  const useHls=!!hls?.subtitleTracks?.length;
  const captions=useHls?Array.from(hls.subtitleTracks):Array.from(video.textTracks||[]).filter(t=>["subtitles","captions"].includes(t.kind));
  body.append(node("h3","Legendas"));
  const selected=useHls?(hls.subtitleDisplay===false?-1:hls.subtitleTrack):captions.findIndex(t=>t.mode==="showing");
  const select=index=>{if(useHls){hls.subtitleTrack=index;hls.subtitleDisplay=index>=0;}else captions.forEach((t,i)=>{t.mode=i===index?"showing":"disabled";});openSettings("tracks",returnFocus);};
  choice("Desativadas",selected<0,()=>select(-1));
  captions.forEach((track,index)=>choice(trackLabel(track,index,"Legenda"),selected===index,()=>select(index)));
  if(!captions.length)message("Este vídeo não oferece legendas selecionáveis.");
 }
 function renderClip(){
  const full=seekRange(video,{live:isLive()});
  if(!full||isLive()){message("O recorte fica disponível em filmes e episódios com duração definida.");return;}
  message("Escolha um trecho para assistir. Para voltar ao vídeo inteiro, remova o recorte.");
  const start=clip?.start??clamp(Math.floor(video.currentTime||0),full.start,Math.max(full.start,full.end-1));
  const end=clip?.end??Math.min(full.end,start+30);
  const input=(label,value)=>{const wrap=node("label",label),field=node("input");field.type="text";field.inputMode="numeric";field.value=clock(value);field.placeholder="0:00";wrap.append(field);body.append(wrap);return field;};
  const from=input("Início (h:mm:ss)",start),to=input("Fim (h:mm:ss)",end),feedback=node("p",undefined,"cinema-setting-message");feedback.setAttribute("role","status");body.append(feedback);
  choice("Assistir trecho",false,()=>{
   const a=parseClock(from.value),b=parseClock(to.value);
   if(!Number.isFinite(a)||!Number.isFinite(b)||a<full.start||b>full.end||b<=a){feedback.textContent="Informe início e fim válidos dentro da duração do vídeo.";return;}
   clip={start:a,end:b,finished:false};closeSettings();seekTo(a);video.play().catch(onInteraction);update();
  });
  if(clip)choice("Remover recorte",false,()=>{clip=null;closeSettings();update();onInteraction();});
 }
 const gestures=bindDoubleTap(video,{enabled:()=>native()&&!locked&&settings.hidden,rotated:()=>layer.classList.contains("force-landscape"),onSeek:seekBy});
 function restoreAudio(){
  if(!native()||locked||!settings.hidden||getRemote())return;
  if(video.muted)video.muted=false;
  if(video.volume===0)video.volume=1;
 }
 video.addEventListener("pointerdown",restoreAudio);
 $("cinema-play").addEventListener("click",togglePlay);
 $("cinema-rewind").addEventListener("click",()=>seekBy(-10));
 $("cinema-forward").addEventListener("click",()=>seekBy(10));
 $("cinema-lock").addEventListener("click",()=>setLocked(!locked));
 $("cinema-brightness").addEventListener("input",e=>{
  if(locked)return;
  const brightness=clamp(Number(e.target.value)||0,0,100);
  $("cinema-dimmer").style.opacity=String((100-brightness)/125);
  e.target.style.setProperty("--brightness",brightness+"%");onInteraction();
 });
 $("cinema-seek").addEventListener("input",e=>{
  if(locked)return;const r=range();if(!r)return;
  seeking=true;const percent=clamp(Number(e.target.value)||0,0,100);
  e.target.style.setProperty("--played",percent+"%");
  $("cinema-elapsed").textContent=clock((r.end-r.start)*percent/100);onInteraction();
 });
 $("cinema-seek").addEventListener("change",e=>{const r=range();seeking=false;if(r)seekTo(r.start+(r.end-r.start)*Number(e.target.value)/100);update();});
 $("cinema-seek").addEventListener("pointercancel",()=>{seeking=false;update();});
 for(const [id,name] of [["cinema-speed","speed"],["cinema-tracks","tracks"],["cinema-clip","clip"]])$(id).addEventListener("click",()=>openSettings(name,$(id)));
 $("cinema-settings-close").addEventListener("click",()=>{closeSettings();onInteraction();});
 settings.addEventListener("click",e=>{if(e.target===settings){closeSettings();onInteraction();}});
 layer.addEventListener("keydown",e=>{
  if(!native())return;
  if(!settings.hidden){
   if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeSettings();onInteraction();}
   if(e.key==="Tab"){
    const focus=Array.from(settings.querySelectorAll("button,input")).filter(n=>!n.disabled);
    const first=focus[0],last=focus[focus.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
   return;
  }
  if(locked){if(e.target!==$("cinema-lock")||e.key==="Escape"){e.preventDefault();e.stopPropagation();}return;}
  if(["INPUT","BUTTON","TEXTAREA","SELECT"].includes(e.target.tagName))return;
  if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();seekBy(e.key==="ArrowLeft"?-10:10);}
  if(e.code==="Space"){e.preventDefault();togglePlay();}
 });
 function reset(){
  closeSettings(false);locked=false;seeking=false;clip=null;previousPaused=null;gestures.reset();
  layer.classList.remove("controls-locked");controls.inert=false;
  for(const id of ["player-back","player-close","player-favorite","cinema-cast","cinema-fullscreen","player-live-reload","player-issue-open"])$(id).inert=false;
  $("cinema-lock").setAttribute("aria-pressed","false");$("cinema-lock").setAttribute("aria-label","Bloquear controles");
  video.playbackRate=1;$("cinema-dimmer").style.opacity="0";$("cinema-brightness").value="100";
  $("cinema-brightness").style.setProperty("--brightness","100%");
 }
 video.addEventListener("ratechange",update);
 return {update,reset,seekBy,keepsControlsVisible:()=>seeking||!settings.hidden};
}
window.NPlayCinema={create,seekRange,seekTarget,bindDoubleTap,clock,parseClock};
})();
