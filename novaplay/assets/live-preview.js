/* Visible live previews, bounded per shelf. Every new preview starts muted. */
(()=>{
"use strict";
const mutedIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m17 9 5 6m0-6-5 6"/></svg>';
const soundIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/></svg>';
function create(root,options={}){
 const limit=Math.max(1,Math.min(4,Number(options.maxParallel)||1));
 let entries=[],active=new Map(),pinned=null,timer=null,observer=null;
 const blocked=()=>document.hidden||!!root.closest('[hidden]')||document.body.classList.contains('modal-open')||document.getElementById('nplay-profile-gate')?.hidden===false||document.getElementById('nplay-access-wall')?.hidden===false;
 function soundButton(entry,enabled){
  entry.sound.innerHTML=enabled?soundIcon:mutedIcon;
  entry.sound.setAttribute('aria-pressed',String(enabled));
  entry.sound.setAttribute('aria-label',enabled?'Silenciar prévia de '+entry.title:'Ativar áudio da prévia de '+entry.title);
  entry.sound.title=enabled?'Silenciar prévia':'Ativar áudio';
 }
 function stopState(previous){
  active.delete(previous.entry);clearTimeout(previous.timeout);
  previous.video.muted=true;previous.video.pause();
  previous.hls?.destroy();
  previous.video.removeAttribute('src');previous.video.load();previous.video.remove();
  previous.entry.card.classList.remove('nplay-live-preview-playing');
  previous.entry.sound.hidden=true;soundButton(previous.entry,false);
 }
 function stop(){
  clearTimeout(timer);timer=null;
  for(const state of [...active.values()])stopState(state);
 }
 function fail(state,reason="unavailable"){
  if(active.get(state.entry)!==state)return;
  state.entry.card.setAttribute("data-preview-status",String(reason).slice(0,80));
  state.entry.failed=true;stopState(state);schedule();
 }
 function start(entry){
  if(blocked()||!entry||entry.failed||active.has(entry))return;
  if(limit===1)stop();
  const video=document.createElement('video');
  video.className='nplay-live-preview';video.muted=true;video.defaultMuted=true;video.autoplay=true;video.playsInline=true;video.preload='none';
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.tabIndex=-1;
  const state={entry,video,hls:null,timeout:null,recoveries:0};active.set(entry,state);
  soundButton(entry,false);entry.cover.append(video);
  const play=()=>{
   if(active.get(entry)!==state)return;
   try{Promise.resolve(video.play()).catch(error=>fail(state,error?.name||"playback"))}catch{fail(state)}
  };
  video.addEventListener('playing',()=>{
   if(active.get(entry)!==state)return;
   clearTimeout(state.timeout);entry.card.classList.add('nplay-live-preview-playing');entry.sound.hidden=false;
  });
  video.addEventListener('error',()=>fail(state,'media-'+(video.error?.code||0)));
  state.timeout=setTimeout(()=>fail(state,"timeout"),22000);
  try{
   if(window.Hls?.isSupported()){
    state.hls=new window.Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:20,maxMaxBufferLength:40,maxBufferSize:8*1024*1024,backBufferLength:0,startLevel:0,capLevelToPlayerSize:true});
    state.hls.on(window.Hls.Events.MANIFEST_PARSED,play);
    state.hls.on(window.Hls.Events.ERROR,(_,data)=>{
     if(active.get(entry)!==state||!data.fatal)return;
     if(data.type===window.Hls.ErrorTypes?.NETWORK_ERROR&&data.type&&state.recoveries++<1){state.hls.startLoad();return;}
     fail(state,data.details||data.type||"hls");
    });
    state.hls.attachMedia(video);state.hls.loadSource(entry.url);
   }else if(video.canPlayType('application/vnd.apple.mpegurl')){
    video.src=entry.url;play();
   }else fail(state);
  }catch{fail(state)}
 }
 function visible(entry){
  const r=entry.card.getBoundingClientRect(),h=window.innerHeight,w=window.innerWidth;
  const area=Math.max(0,Math.min(r.bottom,h)-Math.max(r.top,80))*Math.max(0,Math.min(r.right,w)-Math.max(r.left,0));
  return r.width>0&&r.height>0&&area/(r.width*r.height)>.55;
 }
 function choose(){
  timer=null;
  if(blocked()){stop();return}
  const focused=entries.find(e=>e.card.contains(document.activeElement));
  const ranked=entries.filter(e=>!e.failed&&visible(e)).sort((a,b)=>{
   const score=e=>{const r=e.card.getBoundingClientRect();return Math.abs((r.top+r.bottom)/2-window.innerHeight*.45)+Math.abs((r.left+r.right)/2-window.innerWidth/2)*.15};
   return score(a)-score(b);
  });
  const candidates=[...new Set([focused,pinned,...ranked].filter(e=>e&&!e.failed&&visible(e)))].slice(0,limit);
  for(const state of [...active.values()])if(!candidates.includes(state.entry))stopState(state);
  for(const entry of candidates)start(entry);
 }
 function schedule(){
  for(const state of [...active.values()])if(!visible(state.entry)||blocked())stopState(state);
  clearTimeout(timer);timer=setTimeout(choose,180);
 }
 function register(entry){
  entries.push(entry);soundButton(entry,false);entry.sound.hidden=true;
  entry.sound.addEventListener('click',event=>{
   event.preventDefault();event.stopPropagation();
   const state=active.get(entry);if(!state)return;
   const enabled=state.video.muted;
   if(enabled)for(const other of active.values())if(other!==state){other.video.muted=true;soundButton(other.entry,false);}
   state.video.muted=!enabled;if(enabled)state.video.volume=1;soundButton(entry,enabled);
   try{Promise.resolve(state.video.play()).catch(()=>{
    if(active.get(entry)!==state)return;
    state.video.muted=true;soundButton(entry,false);
   })}catch{state.video.muted=true;soundButton(entry,false)}
  });
  entry.card.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){pinned=entry;schedule()}});
  entry.card.addEventListener('pointerleave',()=>{if(pinned===entry){pinned=null;schedule()}});
  entry.card.addEventListener('focusin',schedule);entry.card.addEventListener('focusout',schedule);
  observer?.observe(entry.card);schedule();
 }
 function reset(){stop();observer?.disconnect();entries=[];pinned=null}
 if('IntersectionObserver' in window)observer=new IntersectionObserver(schedule,{threshold:[0,.55,.8,1]});
 window.addEventListener('scroll',schedule,{passive:true,capture:true});window.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('visibilitychange',schedule);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',schedule);
 const mutation=new MutationObserver(schedule);
 mutation.observe(document.body,{attributes:true,attributeFilter:['class']});
 for(const element of [root.parentElement,document.getElementById('nplay-profile-gate'),document.getElementById('player-layer'),document.getElementById('nplay-access-wall')]){
  if(element)mutation.observe(element,{attributes:true,attributeFilter:['hidden']});
 }
 return {register,reset,stop};
}
window.NPlayLivePreviews={create};
})();
