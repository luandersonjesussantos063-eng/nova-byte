/* Google Cast, AirPlay and the browser's Remote Playback picker. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),video=$('video'),dialog=$('tv-dialog');
 if(!video||!dialog)return;
 let media=null,generation=0,prepared=null,pending=null,context=null,remote=null,controller=null,owned=false,busy=false,lastPosition=0;
 let sdkPromise=null;
 const notice=text=>{$('tv-feedback').textContent=text;};
 const active=()=>owned&&!!remote?.isConnected;
 function changed(){
  const connected=active()||!!video.webkitCurrentPlaybackTargetIsWireless||video.remote?.state==='connected';
  $('player-layer').classList.toggle('casting-active',connected);
  $('cinema-cast').setAttribute('aria-label',connected?'Controlar transmissão para TV':'Transmitir para TV');
  $('cinema-cast').setAttribute('aria-pressed',String(connected));
  $('tv-connected').hidden=!connected;
  if(active()){
   lastPosition=Number(remote.currentTime)||0;
   media?.onProgress?.(lastPosition,Number(remote.duration)||0);
  }
  media?.onChange?.();
 }
 function sdk(){
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise(resolve=>{
   let settled=false;
   const finish=value=>{if(settled)return;settled=true;clearTimeout(timeout);resolve(value);};
   const timeout=setTimeout(()=>finish(false),12000);
   window.__onGCastApiAvailable=available=>{
    if(!available){finish(false);return;}
    try{
     context=window.cast.framework.CastContext.getInstance();
     context.setOptions({receiverApplicationId:window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,autoJoinPolicy:window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,resumeSavedSession:false});
     remote=new window.cast.framework.RemotePlayer();controller=new window.cast.framework.RemotePlayerController(remote);
     controller.addEventListener(window.cast.framework.RemotePlayerEventType.ANY_CHANGE,changed);
     context.addEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,event=>{
      if(event.sessionState===window.cast.framework.SessionState.SESSION_ENDED){owned=false;changed();notice('Transmissão encerrada. Você pode continuar neste aparelho.');}
     });
     finish(true);
    }catch{finish(false);}
   };
   if(window.cast?.framework&&window.chrome?.cast){window.__onGCastApiAvailable(true);return;}
   const script=document.createElement('script');script.src='https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';script.async=true;script.onerror=()=>finish(false);document.head.append(script);
  });
  return sdkPromise;
 }
 async function prepare(){
  if(prepared&&(!prepared.expires_at||prepared.expires_at*1000>Date.now()+60000))return prepared;
  if(pending)return pending;
  const seq=generation,selected=media;
  pending=(async()=>{
   if(!selected)throw Error('Abra um filme para transmitir.');
   const source=await selected.getSource();
   if(seq!==generation)throw Error('O vídeo foi alterado. Abra a transmissão novamente.');
   const url=new URL(source.url);
   if(url.protocol!=='https:'||url.username||url.password||url.searchParams.has('access_token'))throw Error('Este vídeo não oferece um endereço compatível para a TV.');
   prepared={...source,url:url.href};return prepared;
  })();
  try{return await pending;}finally{if(seq===generation)pending=null;}
 }
 function updateChoices(){
  const ready=!!prepared&&!busy;
  $('tv-google').disabled=!ready||!context;
  $('tv-airplay').hidden=typeof video.webkitShowPlaybackTargetPicker!=='function';
  $('tv-airplay').disabled=!ready;
  $('tv-native').hidden=!video.remote||typeof video.webkitShowPlaybackTargetPicker==='function';
  $('tv-native').disabled=!ready;
  $('tv-stop').hidden=!active();
 }
 async function open(){
  if(!media)return;
  if(!dialog.open)dialog.showModal();
  const seq=generation;
  notice(active()?'Transmitindo na TV. Os controles do filme controlam a televisão.':'Preparando transmissão…');updateChoices();
  // The picker itself is opened by a second, explicit click, preserving user activation.
  const availability=sdk().then(()=>{if(seq===generation)updateChoices();});
  try{await prepare();if(seq===generation){notice(active()?'Transmitindo na TV. Use os controles do filme ou volte para este aparelho.':'Escolha uma opção abaixo. A TV e este aparelho precisam estar na mesma rede Wi-Fi.');updateChoices();}}
  catch(error){if(seq===generation)notice(error.message||'Não foi possível preparar a transmissão.');}
  await availability;
 }
 async function googleCast(){
  if(!prepared||!context||busy)return;
  const seq=generation,selected=media,source=prepared;
  busy=true;updateChoices();notice('Escolha a TV na janela do navegador…');
  try{
   await context.requestSession();
   if(seq!==generation)return;
   const session=context.getCurrentSession();if(!session)throw Error();
   const info=new window.chrome.cast.media.MediaInfo(source.url,source.content_type);
   info.streamType=selected.live?window.chrome.cast.media.StreamType.LIVE:window.chrome.cast.media.StreamType.BUFFERED;
   info.metadata=new window.chrome.cast.media.GenericMediaMetadata();info.metadata.title=selected.title;
   const request=new window.chrome.cast.media.LoadRequest(info);
   request.currentTime=selected.live?0:video.currentTime||0;request.autoplay=true;
   await session.loadMedia(request);
   if(seq!==generation){session.endSession(true);return;}
   owned=true;video.pause();changed();dialog.close();
  }catch(error){
   if(seq===generation)notice(error?.code==='cancel'||error==='cancel'?'Seleção cancelada. O filme continua neste aparelho.':'Não foi possível transmitir. Confira o Wi-Fi, a compatibilidade da TV e o formato do vídeo.');
  }finally{busy=false;updateChoices();}
 }
 function nativePicker(kind){
  if(!prepared||!media)return;
  // A real HTTPS media source is essential: MediaSource/blob URLs cannot be fetched by a TV.
  if(video.currentSrc!==prepared.url)media.setNativeSource(prepared.url);
  try{
   if(kind==='airplay')video.webkitShowPlaybackTargetPicker();
   else video.remote.prompt().catch(error=>{if(error.name!=='NotAllowedError')notice('Nenhuma TV compatível foi encontrada. Confira a rede Wi-Fi e tente novamente.');});
   notice('Selecione uma TV compatível no seletor do aparelho.');
  }catch{notice('Este navegador não conseguiu abrir a seleção de TV. Tente pelo Chrome ou Safari compatível.');}
 }
 function end(continueHere=false){
  const position=active()?Number(remote.currentTime)||lastPosition:lastPosition;
  if(owned){owned=false;context?.getCurrentSession()?.endSession(true);}
  changed();
  if(continueHere&&media){
   if(Number.isFinite(video.duration))video.currentTime=Math.min(position,video.duration);
   video.play().catch(()=>{});dialog.close();
  }
 }
 $('cinema-cast').addEventListener('click',open);
 $('tv-close').addEventListener('click',()=>dialog.close());
 $('tv-google').addEventListener('click',googleCast);
 $('tv-airplay').addEventListener('click',()=>nativePicker('airplay'));
 $('tv-native').addEventListener('click',()=>nativePicker('remote'));
 $('tv-stop').addEventListener('click',()=>end(true));
 for(const event of ['connect','disconnect','connecting'])video.remote?.addEventListener(event,changed);
 video.addEventListener('webkitcurrentplaybacktargetiswirelesschanged',changed);
 window.NPlayCasting={
  configure(config){this.reset();media=config;$('cinema-cast').hidden=!config;},
  reset(){generation++;end();media=null;prepared=null;pending=null;busy=false;lastPosition=0;if(dialog.open)dialog.close();$('cinema-cast').hidden=true;$('tv-connected').hidden=true;},
  state(){return active()?{currentTime:Number(remote.currentTime)||0,duration:Number(remote.duration)||0,paused:remote.isPaused,muted:remote.isMuted,volume:remote.volumeLevel}:null;},
  command(action,value){
   if(!active())return false;
   if(action==='toggle')controller.playOrPause();
   if(action==='seek'&&remote.canSeek){remote.currentTime=Math.max(0,Math.min(Number(remote.duration)||0,value));controller.seek();}
   if(action==='mute')controller.muteOrUnmute();
   if(action==='volume'){remote.volumeLevel=Math.max(0,Math.min(1,value));controller.setVolumeLevel();if(remote.isMuted&&value>0)controller.muteOrUnmute();}
   changed();return true;
  }
 };
})();
