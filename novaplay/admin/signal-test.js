(()=>{
function testSignal(video,url,{signal,timeout=25000,seconds=2}={}){
 return new Promise((resolve,reject)=>{
  let hls=null,tsPlayer=null,done=false,started=null,ticks=0;
  const timer=setTimeout(()=>finish(Error('Nenhum vídeo contínuo confirmado em '+Math.round(timeout/1000)+' segundos. Pode ser falha da fonte, conexão, CORS ou bloqueio do navegador.')),timeout);
  function finish(error){
   if(done)return;done=true;clearTimeout(timer);
   video.removeEventListener('timeupdate',progress);video.removeEventListener('error',mediaError);signal?.removeEventListener('abort',abort);
   const info={width:video.videoWidth,height:video.videoHeight,seconds:started===null?0:Math.max(0,video.currentTime-started)};
   video.pause();if(hls)hls.destroy();if(tsPlayer)tsPlayer.destroy();video.removeAttribute('src');video.load();
   if(error)reject(error);else resolve(info);
  }
  function abort(){const error=Error('Teste interrompido.');error.name='AbortError';finish(error);}
  function mediaError(){finish(Error('O navegador não conseguiu reproduzir este endereço. Confira o sinal e a compatibilidade.'));}
  function progress(){
   if(video.readyState<2||video.videoWidth<1||video.paused)return;
   if(started===null)started=video.currentTime;
   ticks++;
   if(ticks>=3&&video.currentTime-started>=seconds)finish();
  }
  video.muted=true;video.playsInline=true;video.preload='auto';
  video.addEventListener('timeupdate',progress);video.addEventListener('error',mediaError);signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){abort();return;}
  const play=()=>video.play().catch(()=>finish(Error('A reprodução automática foi bloqueada. Clique em Testar novamente neste canal.')));
  try{
   if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;play();}
   else if(globalThis.Hls?.isSupported()){
    hls=new Hls({enableWorker:true,startLevel:0,maxBufferLength:5,maxBufferSize:8*1024*1024,backBufferLength:0});
    hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)finish(Error(data.response?.code?'Servidor retornou HTTP '+data.response.code+'.':'Sinal não confirmado: '+data.details+'. Pode haver erro na fonte, rede ou permissão CORS.'));});
    hls.on(Hls.Events.MANIFEST_PARSED,play);hls.attachMedia(video);hls.loadSource(url);
   }else finish(Error('Suporte HLS indisponível. Recarregue a página ou use um navegador compatível.'));
  }catch(error){finish(error);}
 });
}
globalThis.NPlaySignal={testSignal};
})();
