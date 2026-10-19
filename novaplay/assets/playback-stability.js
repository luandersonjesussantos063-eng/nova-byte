/* Buffer and bounded recovery shared by the main video player. */
(()=>{
 'use strict';
 function hlsConfig({live=false,protectedSource=false,ios=false}={}){
  const retry=()=>({maxNumRetry:2,retryDelayMs:1000,maxRetryDelayMs:4000});
  return {enableWorker:true,lowLatencyMode:false,maxBufferLength:live?40:60,
   maxMaxBufferLength:live?60:120,maxBufferSize:(live?32:48)*1024*1024,backBufferLength:live?10:30,
   startLevel:0,capLevelToPlayerSize:true,abrEwmaDefaultEstimate:400000,startOnSegmentBoundary:true,
   ...(live?{liveSyncDurationCount:4,liveMaxLatencyDurationCount:Infinity,maxLiveSyncPlaybackRate:1}:{}),
   ...(protectedSource?{manifestLoadPolicy:{default:{maxTimeToFirstByteMs:40000,maxLoadTimeMs:45000,timeoutRetry:retry(),errorRetry:retry()}}}:{}),
   // Only on iOS, when Safari's native HLS must fall back to hls.js.
   ...(ios?{enableWorker:false,maxBufferLength:live?16:25,maxMaxBufferLength:live?28:40,
      maxBufferSize:16*1024*1024,backBufferLength:live?4:8,
      abrEwmaDefaultEstimate:450000,...(live?{liveSyncDurationCount:5}:{})}:{}),
  };
 }
 function mpegtsConfig(){return {enableWorker:true,lazyLoad:false,enableStashBuffer:true,stashInitialSize:512*1024,
  liveBufferLatencyChasing:false,liveSync:false,autoCleanupSourceBuffer:true,autoCleanupMaxBackwardDuration:30,autoCleanupMinBackwardDuration:15};}
 function bufferedEnd(video){
  try{for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=video.currentTime+.1&&video.buffered.end(i)>=video.currentTime)return video.buffered.end(i);}catch{}
  return Number(video.currentTime)||0;
 }
 function retryable(data={}){
  const status=Number(data.status||data.response?.code||data.networkDetails?.status)||0;
  return !status||[408,425,429].includes(status)||status>=500;
 }
 function create({video,getEngine,isActive=()=>true,onStatus=()=>{},onExhausted=()=>{},reloadNative=()=>false,autoplay=()=>{},
  now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout,repeat=setInterval,stopRepeat=clearInterval}){
  let disposed=false,pending=null,exhausted=false,networkAttempts=0,mediaAttempts=0;
  let lastTime=Number(video.currentTime)||0,lastEnd=bufferedEnd(video),lastMove=now(),lastGrowth=now(),stableSince=null,hasPlayed=false;
  const active=()=>!disposed&&isActive();
  function retry(kind,data){
   if(!active()||kind==='network'&&!retryable(data))return false;
   if(pending!==null)return true;
   const count=kind==='media'?mediaAttempts:networkAttempts,limit=kind==='media'?2:3;
   if(count>=limit)return false;
   if(kind==='media')mediaAttempts++;else networkAttempts++;
   onStatus(kind==='media'?'Recuperando a imagem do vídeo…':'Reconectando o vídeo…');
   pending=schedule(()=>{
    pending=null;if(!active())return;
    const engine=getEngine(),position=Number(video.currentTime)>0?video.currentTime:-1,wasPlaying=!video.paused;
    try{
     if(engine.hls){
      if(kind==='media')engine.hls.recoverMediaError();
      else if(engine.manifestReady===false)engine.hls.loadSource(engine.source);
      else{if(engine.hls.autoLevelEnabled!==false)engine.hls.nextAutoLevel=0;engine.hls.startLoad(position,true);}
     }else if(engine.ts){engine.ts.unload();engine.ts.load();if(wasPlaying)autoplay();}
     else if(!reloadNative())throw Error('No recovery available');
    }catch{if(active()&&!exhausted){exhausted=true;onExhausted();}}
    lastMove=now();lastGrowth=now();stableSince=null;
   },kind==='media'?500:Math.min(4000,1000*2**count));
   return true;
  }
  function tick(){
   if(!active())return;
   const time=now(),position=Number(video.currentTime)||0,end=bufferedEnd(video);
   if(video.paused||video.seeking||video.ended){lastTime=position;lastEnd=end;lastMove=time;lastGrowth=time;stableSince=null;return;}
   if(Math.abs(position-lastTime)>.05){
    hasPlayed=true;lastMove=time;stableSince??=time;
    if(time-stableSince>=20000){networkAttempts=0;mediaAttempts=0;exhausted=false;}
   }else stableSince=null;
   if(end>lastEnd+.1)lastGrowth=time;
   lastTime=position;lastEnd=end;
   if(!hasPlayed||time-lastMove<12000||pending!==null)return;
   const ahead=end-position;
   // Let an active download finish; do not abort a slow fragment every few seconds.
   if(ahead<2&&time-lastGrowth<30000)return;
   if(!retry(ahead>=2?'media':'network')&&!exhausted){exhausted=true;onExhausted();}
  }
  const interval=repeat(tick,1000);
  return Object.freeze({network:data=>retry('network',data),media:()=>retry('media'),tick,
   destroy(){if(disposed)return;disposed=true;if(pending!==null)cancel(pending);pending=null;stopRepeat(interval);}});
 }
 window.NPlayPlayback=Object.freeze({hlsConfig,mpegtsConfig,create,retryable});
})();
