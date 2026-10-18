/* TV discovery: one audible feature, up to two visible muted previews. */
(()=>{
'use strict';
const root=document.getElementById('tv-spotlight');if(!root)return;
const el=id=>document.getElementById(id),rail=el('tv-spotlight-rail'),frame=el('tv-spotlight-frame');
const lastKey='nplay-tv-last-feature',states=new Map(),cards=new Map(),failed=new Set();
let channels=[],selected=null,entered=false,soundWanted=true,blockedByPlayer=false,timer=null,epoch=0,featureFailures=0;
function pool(items,selection){
 const urls=new Set();
 const byId=new Map((items||[]).map(item=>[item.id,item]));
 const ordered=[...new Set(Array.isArray(selection)?selection:[])].map(id=>byId.get(id)).filter(Boolean);
 return ordered.filter(item=>{
  try{
   const u=new URL(item.embed_url);
   if(u.protocol!=='https:'||u.username||u.password||!(item.stream_type==='hls'||/\.m3u8?(?:\?|$)/i.test(u.href))||urls.has(u.href))return false;
   urls.add(u.href);return true;
  }catch{return false;}
 }).slice(0,24);
}
function status(text){el('tv-spotlight-status').textContent=text;}
function soundControl(){
 const state=states.get(selected?.id),audible=!!state?.playing&&!state.video.muted;
 const b=el('tv-spotlight-sound');b.disabled=!state?.playing;b.textContent=audible?'🔊 Som ligado':'🔇 Ativar som';
 b.setAttribute('aria-pressed',String(audible));b.setAttribute('aria-label',audible?'Silenciar canal em destaque':'Ativar som do canal em destaque');
}
function favoriteControl(){
 const saved=selected&&window.NPlayLiveCatalog?.isFavorite('channel-'+selected.id),b=el('tv-spotlight-favorite');
 b.textContent=saved?'♥':'♡';b.setAttribute('aria-pressed',String(!!saved));b.setAttribute('aria-label',(saved?'Remover dos favoritos: ':'Favoritar canal: ')+(selected?.title||''));
}
function allowed(){return entered&&!document.hidden&&!el('view-category')?.hidden&&!document.body.classList.contains('modal-open')&&!blockedByPlayer&&el('nplay-profile-gate')?.hidden!==false&&el('nplay-access-wall')?.hidden!==false;}
function visible(node,clip){
 if(node.hidden)return false;
 const r=node.getBoundingClientRect(),c=clip?clip.getBoundingClientRect():{left:0,top:0,right:innerWidth,bottom:innerHeight};
 const width=Math.max(0,Math.min(r.right,c.right,innerWidth)-Math.max(r.left,c.left,0));
 const height=Math.max(0,Math.min(r.bottom,c.bottom,innerHeight)-Math.max(r.top,c.top,0));
 return r.width>0&&r.height>0&&width*height/(r.width*r.height)>.45;
}
function dispose(state){
 if(states.get(state.item.id)!==state)return;
 states.delete(state.item.id);clearTimeout(state.timeout);clearTimeout(state.motionTimer);state.video.muted=true;state.video.pause();state.hls?.destroy();
 state.video.removeAttribute('src');state.video.load();state.video.remove();
 window.NPlayLiveAuth?.release(state.url);
 const card=cards.get(state.item.id);if(card)card.node.classList.remove('is-playing');
 if(state.item.id===selected?.id){root.classList.remove('is-playing');soundControl();}
}
function stop(){clearTimeout(timer);timer=null;for(const state of [...states.values()])dispose(state);}
function describe(){
 el('tv-spotlight-title').textContent=selected?.title||'TV ao vivo';
 el('tv-spotlight-category').textContent=selected?.category||'Escolha um canal';
 for(const [id,card] of cards){card.node.hidden=id===selected?.id||failed.has(id);card.node.setAttribute('aria-pressed',String(id===selected?.id));}
 el('tv-spotlight-watch').disabled=!selected;el('tv-spotlight-favorite').disabled=!selected;el('tv-spotlight-next').disabled=channels.length<2;
 favoriteControl();soundControl();
}
function remember(){try{sessionStorage.setItem(lastKey,selected.id);}catch{}}
function choose(item){
 if(!item||!entered)return;
 for(const state of states.values())state.video.muted=true;
 selected=item;soundWanted=true;remember();root.hidden=!states.get(item.id)?.confirmed;root.classList.remove('is-playing');describe();status('Conectando ao sinal ao vivo…');sync();
}
function fail(state){
 if(states.get(state.item.id)!==state)return;
 const main=state.item.id===selected?.id;failed.add(state.item.id);dispose(state);
 const card=cards.get(state.item.id);if(card){card.node.hidden=true;card.note.textContent='';}
 if(main){
  featureFailures++;
  const next=channels.find(item=>!failed.has(item.id)&&states.get(item.id)?.confirmed)||channels.find(item=>!failed.has(item.id));
  if(next&&(states.get(next.id)?.confirmed||featureFailures<3)){choose(next);return;}
  root.hidden=true;selected=null;stop();return;
 }
 schedule();
}
function play(state){
 if(states.get(state.item.id)!==state)return;
 const main=state.item.id===selected?.id;state.video.muted=!main||!soundWanted||!state.confirmed;state.video.volume=1;
 try{Promise.resolve(state.video.play()).catch(error=>{
  if(states.get(state.item.id)!==state)return;
  if(error?.name==='NotAllowedError'&&!state.video.muted){
   soundWanted=false;state.video.muted=true;soundControl();
   Promise.resolve(state.video.play()).catch(()=>fail(state));
  }else fail(state);
 });}catch{fail(state);}
}
function mount(state){
 const main=state.item.id===selected?.id,target=main?frame:cards.get(state.item.id)?.media;
 const moved=!!target&&state.video.parentElement!==target;
 if(moved)target.append(state.video);
 state.video.muted=!main||!soundWanted||!state.confirmed;
 if(main&&state.confirmed){root.classList.add('is-playing');status('● Ao vivo agora');}
 if(moved&&state.url&&state.playing)play(state);
 soundControl();
}
async function start(item){
 if(states.has(item.id)||failed.has(item.id)||!allowed())return;
 const video=document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=item.id!==selected?.id||!soundWanted;video.defaultMuted=video.muted;video.preload='metadata';video.tabIndex=-1;video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');
 const state={item,video,url:null,hls:null,timeout:null,playing:false,confirmed:false,started:null,ticks:0,epoch};states.set(item.id,state);mount(state);if(item.id===selected?.id)status('Conectando ao sinal ao vivo…');
 state.timeout=setTimeout(()=>fail(state),25000);
 video.addEventListener('playing',()=>{
  if(states.get(item.id)!==state)return;
  state.playing=true;mount(state);
 });
 video.addEventListener('timeupdate',()=>{
  if(states.get(item.id)!==state||video.readyState<2||video.videoWidth<1||video.paused)return;
  if(state.confirmed){
   if(video.currentTime>state.lastPosition){state.lastPosition=video.currentTime;clearTimeout(state.motionTimer);state.motionTimer=setTimeout(()=>fail(state),15000);}
   return;
  }
  if(item.id===selected?.id&&root.hidden&&window.scrollY>240){dispose(state);return;}
  if(state.started===null)state.started=video.currentTime;
  state.ticks++;
  if(state.ticks<3||video.currentTime-state.started<2)return;
  state.confirmed=true;state.lastPosition=video.currentTime;clearTimeout(state.timeout);state.motionTimer=setTimeout(()=>fail(state),15000);
  const card=cards.get(item.id);if(card){card.node.style.visibility='';card.node.classList.add('is-playing');card.note.textContent='● Ao vivo';}
  if(item.id===selected?.id){root.hidden=false;mount(state);play(state);}
  schedule();
 });
 video.addEventListener('error',()=>fail(state));
 try{
  await window.NPlayLiveAuth?.waitForRelease?.();
  if(states.get(item.id)!==state||state.epoch!==epoch||!allowed()){dispose(state);return;}
  const url=await window.NPlayLiveAuth?.authorize(item.embed_url)||item.embed_url;
  if(states.get(item.id)!==state||state.epoch!==epoch||!allowed()){window.NPlayLiveAuth?.release(url);dispose(state);return;}
  state.url=url;
  if(window.Hls?.isSupported()){
   state.hls=new window.Hls({enableWorker:true,maxBufferLength:6,maxMaxBufferLength:12,maxBufferSize:6*1024*1024,backBufferLength:0,startLevel:0,capLevelToPlayerSize:true});
   state.hls.on(window.Hls.Events.MANIFEST_PARSED,()=>play(state));
   state.hls.on(window.Hls.Events.ERROR,(_,data)=>{if(data.fatal)fail(state);});
   state.hls.attachMedia(video);state.hls.loadSource(url);
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;play(state);}
  else fail(state);
 }catch{fail(state);}
}
function sync(){
 clearTimeout(timer);timer=null;
 if(!allowed()||(root.hidden&&window.scrollY>240)){stop();return;}
 const wanted=[];
 if(selected&&!failed.has(selected.id)&&(root.hidden||visible(frame)))wanted.push(selected);
 for(const item of channels){
  if(root.hidden||wanted.length>=3)break;
  if(item.id===selected?.id||failed.has(item.id))continue;
  const card=cards.get(item.id);if(card&&visible(card.node,rail))wanted.push(item);
 }
 // Never start more than two thumbnail previews, even when the feature is offscreen.
 const limited=wanted.filter((item,index)=>item.id===selected?.id||index-(wanted[0]?.id===selected?.id?1:0)<2);
 for(const state of [...states.values()])if(!limited.some(item=>item.id===state.item.id))dispose(state);
 for(const item of limited){const state=states.get(item.id);if(state)mount(state);else void start(item);}
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,140);}
function renderRail(){
 cards.clear();rail.replaceChildren();
 for(const item of channels){
  const node=document.createElement('button');node.type='button';node.className='tv-spotlight-card';node.style.visibility='hidden';node.setAttribute('aria-label','Destacar '+item.title);
  const media=document.createElement('span');media.className='tv-spotlight-thumb';
  if(item.logo_url){try{const u=new URL(item.logo_url,location.href);if(u.protocol==='https:'){const img=document.createElement('img');img.src=u.href;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();media.append(img);}}catch{}}
  const name=document.createElement('strong');name.textContent=item.title;
  const note=document.createElement('small');note.textContent='Ver o que está passando';node.append(media,name,note);node.onclick=()=>{featureFailures=0;failed.delete(item.id);choose(item);};
  cards.set(item.id,{node,media,note});rail.append(node);
 }
}
function selectForEntry(){
 if(!channels.length)return;
 let previous='';try{previous=sessionStorage.getItem(lastKey)||'';}catch{}
 const index=channels.findIndex(item=>item.id===previous);selected=channels[(index+1)%channels.length];
 remember();describe();status('Conectando ao sinal ao vivo…');
}
function enter(){
 if(entered)return;
 entered=true;epoch++;soundWanted=true;featureFailures=0;failed.clear();root.hidden=true;for(const card of cards.values())card.node.style.visibility='hidden';
 selectForEntry();schedule();
}
function leave(){entered=false;epoch++;stop();root.hidden=true;}
function setChannels(items,selection=[]){
 const next=pool(items,selection),signature=next.map(item=>item.id+'|'+item.embed_url).join('\n');
 if(signature===channels.map(item=>item.id+'|'+item.embed_url).join('\n')){if(!channels.length){root.hidden=true;describe();status('Nenhum sinal de prévia disponível neste momento. Explore a grade abaixo.');}schedule();return;}
 stop();root.hidden=true;channels=next;renderRail();
 if(!channels.length){root.hidden=true;selected=null;describe();status('Nenhum sinal de prévia disponível neste momento. Explore a grade abaixo.');return;}
 const refreshed=channels.find(item=>item.id===selected?.id);selected=refreshed||null;
 if(entered){if(!selected)selectForEntry();else describe();schedule();}
}
el('tv-spotlight-sound').onclick=()=>{const state=states.get(selected?.id);if(!state)return;soundWanted=state.video.muted;play(state);soundControl();};
el('tv-spotlight-next').onclick=()=>{featureFailures=0;const i=channels.findIndex(item=>item.id===selected?.id);const next=channels[(i+1)%channels.length];if(next){failed.delete(next.id);choose(next);}};
el('tv-spotlight-watch').onclick=()=>{if(!selected)return;stop();window.dispatchEvent(new CustomEvent('nplay:channel-play',{detail:selected}));};
el('tv-spotlight-favorite').onclick=()=>{if(selected)window.NPlayLiveCatalog?.toggleFavorite('channel-'+selected.id);favoriteControl();};
window.addEventListener('nplay:navigate',event=>{if(event.detail.page==='tv')enter();else leave();});
window.addEventListener('nplay:favorites-change',favoriteControl);
window.addEventListener('nplay:watch',event=>{if(event.detail.state==='open'){blockedByPlayer=true;stop();}else if(event.detail.state==='stopped'){blockedByPlayer=false;schedule();}});
rail.addEventListener('scroll',schedule,{passive:true});window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else schedule();});window.addEventListener('pagehide',stop);window.addEventListener('pageshow',schedule);
const observer=new MutationObserver(schedule);
for(const node of [document.body,el('view-category'),el('nplay-profile-gate'),el('nplay-access-wall'),el('player-layer')])if(node)observer.observe(node,{attributes:true,attributeFilter:['hidden','class']});
window.NPlayTvSpotlight={setChannels,enter,leave,stop,sync};
if(location.hash==='#tv')enter();
})();
