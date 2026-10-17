/* Canal publicado no banner principal; áudio sempre começa desativado. */
(()=>{
"use strict";
const el=id=>document.getElementById(id);
let channels=[],selected=0,active=null,paused=false,failures=0;
const launchNumber=(()=>{try{const n=(Number(sessionStorage.getItem('nplay-feature-launch'))||0)+1;sessionStorage.setItem('nplay-feature-launch',String(n));return n}catch{return Date.now()}})();
const movieLaunch=launchNumber%2===0;
const liveFeatured=()=>!movieLaunch;
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function eligible(item){
 try{const url=new URL(item.embed_url);return url.protocol==='https:'&&!url.username&&!url.password&&(item.stream_type==='hls'||/\.m3u8?(?:\?|$)/i.test(url.href))}catch{return false}
}
function allowed(){
 const hero=el('hero');
 return !!hero&&!document.hidden&&!el('view-home').hidden&&!document.body.classList.contains('modal-open')&&el('nplay-profile-gate')?.hidden!==false&&window.scrollY<hero.clientHeight*.5;
}
function controls(){
 const sound=el('hero-live-sound'),toggle=el('hero-live-toggle');if(!sound||!toggle)return;
 const audible=!!active&&!active.video.muted;
 sound.textContent=audible?'🔊':'🔇';sound.setAttribute('aria-pressed',String(audible));sound.setAttribute('aria-label',audible?'Silenciar canal no banner':'Ativar áudio do canal no banner');
 sound.disabled=!active?.playing;
 toggle.textContent=paused?'▶':'Ⅱ';toggle.setAttribute('aria-label',paused?'Retomar transmissão no banner':'Pausar transmissão no banner');
 toggle.setAttribute('aria-pressed',String(paused));
}
function status(message){const node=el('hero-live-status');if(node)node.textContent=message}
function stop(){
 const state=active;active=null;
 if(state){clearTimeout(state.timeout);state.video.muted=true;state.video.pause();state.hls?.destroy();state.video.removeAttribute('src');state.video.load();state.video.remove()}
 el('hero')?.classList.remove('hero-live-playing');controls();
}
function fail(state){
 if(active!==state)return;stop();failures++;
 if(failures<Math.min(channels.length,3)){
  selected=(selected+1)%channels.length;el('hero-live-channel').value=channels[selected].id;show();
 }else status('Sinal indisponível neste momento. Escolha outro canal.');
}
function describe(item){
 window.NovaPlayHeroScenes?.stop?.();
 el('hero').classList.add('hero-live-mode');
 el('hero-title').textContent=item.title;
 el('hero-genre').textContent='TV AO VIVO · EM PORTUGUÊS';
 el('hero-description').textContent='Acompanhe o que está passando agora. Ative o som ou escolha outro canal para continuar assistindo.';
 const metadata=el('hero-metadata');metadata.replaceChildren();
 for(const text of ['Ao vivo',item.category||'TV', 'Som desativado ao iniciar']){const span=document.createElement('span');span.textContent=text;metadata.append(span)}
 el('hero-art').style.backgroundImage='radial-gradient(ellipse at 75% 30%,#204477,#0b172b 60%,#070b13)';
 el('hero-dots').hidden=true;el('hero-preview-open').hidden=true;
 const info=el('hero-info');info.textContent='Ver TV ao vivo';info.onclick=()=>document.querySelector('[data-nav="tv"]')?.click();
 el('hero-play').onclick=()=>{stop();window.NovaPlayPlayer?.openHls(item.embed_url,item.title)};
}
function show(){
 if(!channels.length)return;
 const item=channels[selected];describe(item);
 if(!allowed()||paused){stop();if(paused)status('Transmissão pausada no banner.');return}
 if(active?.item.id===item.id)return;
 stop();
 const video=document.createElement('video');video.className='hero-live-video';
 video.autoplay=true;video.muted=false;video.defaultMuted=false;video.playsInline=true;video.preload='none';
 video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.tabIndex=-1;
 const state={item,video,hls:null,playing:false,timeout:null};active=state;el('hero-live-media').append(video);
 status('Conectando ao sinal ao vivo…');controls();
 const play=()=>{if(active!==state)return;try{Promise.resolve(video.play()).catch(()=>{if(active!==state)return;video.muted=true;controls();Promise.resolve(video.play()).catch(()=>fail(state))})}catch{video.muted=true;Promise.resolve(video.play()).catch(()=>fail(state))}};
 video.addEventListener('playing',()=>{if(active!==state)return;clearTimeout(state.timeout);state.playing=true;failures=0;el('hero').classList.add('hero-live-playing');status('● Ao vivo agora');controls()});
 video.addEventListener('error',()=>fail(state));state.timeout=setTimeout(()=>fail(state),12000);
 try{
  if(window.Hls?.isSupported()){
   state.hls=new window.Hls({enableWorker:true,maxBufferLength:8,maxMaxBufferLength:16,backBufferLength:0,startLevel:0,capLevelToPlayerSize:true});
   state.hls.on(window.Hls.Events.MANIFEST_PARSED,play);state.hls.on(window.Hls.Events.ERROR,(_,data)=>{if(data.fatal)fail(state)});
   state.hls.attachMedia(video);state.hls.loadSource(item.embed_url);
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=item.embed_url;play()}
  else fail(state);
 }catch{fail(state)}
}
function setChannels(items){
 const previous=channels[selected]?.id;
 channels=(items||[]).filter(eligible);
 const preferred=['recordtv mt','sbt interior sp','tv brasil web','rede minas'];
 channels.sort((a,b)=>{const rank=x=>{const i=preferred.indexOf(normalize(x.title));return i<0?100:i};return rank(a)-rank(b)||a.title.localeCompare(b.title,'pt-BR')});
 selected=channels.length?Math.abs(launchNumber-1)%channels.length:0;
 const select=el('hero-live-channel');select.replaceChildren();
 for(const item of channels){const option=document.createElement('option');option.value=item.id;option.textContent=item.title;select.append(option)}
 if(!channels.length||!liveFeatured()){stop();el('hero-live-controls').hidden=true;if(!channels.length)status('Nenhum canal com sinal direto disponível.');window.NPlayShowFeaturedMovie?.();return}
 select.value=channels[selected].id;el('hero-live-controls').hidden=false;el('hero-live-channel').closest('label').hidden=true;el('hero-live-status').hidden=true;failures=0;show();
}
function sync(){if(!liveFeatured())return;if(!allowed())stop();else if(!active&&!paused&&channels.length&&failures<Math.min(channels.length,3))show()}
function init(){
 el('hero-live-channel').addEventListener('change',event=>{selected=Math.max(0,channels.findIndex(x=>x.id===event.target.value));failures=0;paused=false;show()});
 el('hero-live-toggle').addEventListener('click',()=>{paused=!paused;if(paused){stop();status('Transmissão pausada no banner.')}else{failures=0;show()}controls()});
 el('hero-live-sound').addEventListener('click',()=>{
  if(!active?.playing)return;const state=active;state.video.muted=!state.video.muted;if(!state.video.muted)state.video.volume=1;controls();
  try{Promise.resolve(state.video.play()).catch(()=>{if(active===state){state.video.muted=true;controls()}})}catch{state.video.muted=true;controls()}
 });
 window.addEventListener('scroll',sync,{passive:true});document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',sync);
 const observer=new MutationObserver(sync);
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
 for(const node of [el('view-home'),el('nplay-profile-gate')])if(node)observer.observe(node,{attributes:true,attributeFilter:['hidden']});
}
window.NPlayHeroLive={setChannels,show,sync,stop,isLiveFeatured:liveFeatured};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
