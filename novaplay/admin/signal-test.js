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
   if(new URL(url).pathname.toLowerCase().endsWith('.ts')){
    if(!globalThis.mpegts?.isSupported())throw Error('Reprodução MPEG-TS não suportada neste navegador.');
    tsPlayer=mpegts.createPlayer({type:'mpegts',isLive:true,url:url});
    tsPlayer.on(mpegts.Events.ERROR,()=>finish(Error('Sinal TS não confirmado: rede, CORS ou fonte indisponível.')));
    tsPlayer.attachMediaElement(video);
    tsPlayer.load();play();
   }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;play();}
   else if(globalThis.Hls?.isSupported()){
    hls=new Hls({enableWorker:true,startLevel:0,maxBufferLength:5,maxBufferSize:8*1024*1024,backBufferLength:0});
    hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)finish(Error(data.response?.code?'Servidor retornou HTTP '+data.response.code+'.':'Sinal não confirmado: '+data.details+'. Pode haver erro na fonte, rede ou permissão CORS.'));});
    hls.on(Hls.Events.MANIFEST_PARSED,play);hls.attachMedia(video);hls.loadSource(url);
   }else finish(Error('Suporte HLS indisponível. Recarregue a página ou use um navegador compatível.'));
  }catch(error){finish(error);}
 });
}
async function testSource(video,source,{signal,onAttempt=()=>{},...options}={}){
 const core=globalThis.NPlayM3u,attempted=new Set(),failures=[];
 source=core.url(source);
 if(core.isPlaylist(source))throw Error('Este endereço baixa uma lista M3U, não transmite um canal. Baixe o arquivo da sua lista e use Abrir arquivo M3U ou cole o conteúdo no teste em lote.');
 if(/(^|\.)paste\.sh$/i.test(new URL(source).hostname))throw Error('Este link é uma página de texto do paste.sh, não um sinal de vídeo. Abra a página e cole a lista M3U ou os endereços dos canais no testador.');
 const attempt=async urls=>{
  for(const url of urls){
   if(signal?.aborted)throw new DOMException('Teste interrompido.','AbortError');
   if(attempted.has(url))continue;attempted.add(url);onAttempt(url);
   try{return {...await testSignal(video,await globalThis.NPlayLiveAuth?.authorize(url)||url,{...options,signal}),playbackUrl:url};}
   catch(error){if(error.name==='AbortError')throw error;failures.push({protocol:new URL(url).protocol==='https:'?'HTTPS':'HTTP',message:error.message});}
  }
 };
 let result=await attempt(core.candidates(source));
 if(result)return result;
 let gatewayCount=0;
 if(new URL(source).protocol==='http:'){
  onAttempt(null);
  const gateways=await core.gateways(source,{signal});gatewayCount=gateways.length;
  result=await attempt(gateways);
  if(result)return result;
 }
 const http=new URL(source).protocol==='http:';
 const details=failures.map(failure=>failure.protocol+': '+failure.message).join(' ');
 const error=Error(http?'Não foi possível confirmar vídeo para este canal. '+details+' '+(gatewayCount?'Nenhum gateway encontrado confirmou reprodução.':'Nenhum gateway autorizado disponível para esta fonte.')+' Em páginas HTTPS, o HTTP direto é bloqueado pelo navegador; isso não comprova que o canal esteja fora do ar.':details||'Nenhum vídeo confirmado.');
 error.code=http?'HTTP_UNRESOLVED':'SIGNAL_UNCONFIRMED';throw error;
}
globalThis.NPlaySignal={testSignal,testSource};
})();
