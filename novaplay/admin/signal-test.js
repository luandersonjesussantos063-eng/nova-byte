(()=>{
function signalError(message,code,sharedFailure=false){const error=Error(message);error.code=code;error.sharedFailure=sharedFailure;return error;}
const protectedSource=url=>{try{const u=new URL(url);return u.origin==='https://nplay-live-gateway.luandersonjesussantos063.workers.dev'&&/^\/live\/[0-9a-f-]{36}\/(?:stream\.ts|index\.m3u8)$/i.test(u.pathname);}catch{return false;}};
async function checkProtectedSource(url,signal){
 const control=new AbortController(),abort=()=>control.abort();signal?.addEventListener('abort',abort,{once:true});
 if(signal?.aborted)control.abort();const timer=setTimeout(abort,12000);
 try{
  const response=await fetch(url,{method:'HEAD',signal:control.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  const status=response.status;
  const diagnostic=response.headers.get('X-NPlay-Error');
  if(diagnostic==='PC_BRIDGE_OFFLINE')throw signalError('A TV pelo PC está desconectada. Confira Docker e o endereço em TV pelo PC no ADM.','PC_BRIDGE_OFFLINE',true);
  if(diagnostic==='UPSTREAM_IP_HOSTNAME_REQUIRED')throw signalError('O fornecedor redireciona o vídeo para IP direto, incompatível com o servidor NPlay. Solicite ao fornecedor HLS com domínio DNS nos manifestos e segmentos. O lote foi pausado.','UPSTREAM_IP_HOSTNAME_REQUIRED',true);
  if(diagnostic==='GATEWAY_INTERNAL')throw signalError('Falha interna no servidor NPlay ao preparar o sinal. O lote foi pausado para diagnóstico.','GATEWAY_INTERNAL',true);
  if(diagnostic==='UPSTREAM_HTTP')throw signalError('O fornecedor recusou o sinal (HTTP '+(response.headers.get('X-NPlay-Upstream-Status')||'indisponível')+').','SOURCE_UNAVAILABLE');

  if(status===401)throw signalError('Sessão recusada pelo servidor protegido (HTTP 401). Entre novamente no ADM antes de testar.', 'GATEWAY_SESSION',true);
  if(status===403)throw signalError('Acesso recusado pelo servidor protegido (HTTP 403). Pode ser bloqueio de segurança ou falta de permissão; a lista não foi validada.','GATEWAY_ACCESS',true);
  if(status===429||status>=503)throw signalError('Servidor protegido indisponível ou limitando requisições (HTTP '+status+'). Aguarde antes de testar novamente.','GATEWAY_UNAVAILABLE',true);
  if(!response.ok)throw signalError(status===502?'O servidor protegido respondeu, mas não conseguiu receber o vídeo do fornecedor (HTTP 502).':'Não foi possível consultar este canal (HTTP '+status+').','SOURCE_UNAVAILABLE');
  if(!/^(video\/mp2t|application\/(?:octet-stream|vnd\.apple\.mpegurl|x-mpegurl))(?:;|$)/i.test(response.headers.get('Content-Type')||''))throw signalError('O servidor protegido retornou uma resposta que não é um sinal de vídeo compatível.','GATEWAY_RESPONSE',true);
 }catch(error){
  if(signal?.aborted)throw new DOMException('Teste interrompido.','AbortError');
  if(Object.prototype.hasOwnProperty.call(error,'sharedFailure'))throw error;
  throw signalError('Não foi possível alcançar o servidor protegido: '+(control.signal.aborted?'tempo limite excedido.':'falha de rede ou CORS.')+' O lote foi pausado; isso não confirma que os canais estejam fora do ar.','GATEWAY_CONNECTION',true);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
function testSignal(video,url,{signal,timeout=25000,seconds=2,audioOnly=false}={}){
 return new Promise((resolve,reject)=>{
  let hls=null,tsPlayer=null,done=false,started=null,ticks=0;
  const timer=setTimeout(()=>finish(Error('Nenhum vídeo contínuo confirmado em '+Math.round(timeout/1000)+' segundos. Pode ser falha da fonte, conexão, CORS ou bloqueio do navegador.')),timeout);
  function finish(error){
   if(done)return;done=true;clearTimeout(timer);
   video.removeEventListener('timeupdate',progress);video.removeEventListener('error',mediaError);signal?.removeEventListener('abort',abort);
   const info={width:video.videoWidth,height:video.videoHeight,seconds:started===null?0:Math.max(0,video.currentTime-started),audioOnly:audioOnly&&video.videoWidth<1};
   video.pause();if(hls)hls.destroy();if(tsPlayer)tsPlayer.destroy();video.removeAttribute('src');video.load();
   if(error)reject(error);else resolve(info);
  }
  function abort(){const error=Error('Teste interrompido.');error.name='AbortError';finish(error);}
  function mediaError(){finish(Error('O navegador não conseguiu reproduzir este endereço. Confira o sinal e a compatibilidade.'));}
  function progress(){
   if(video.readyState<2||(!audioOnly&&video.videoWidth<1)||video.paused)return;
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
    if(!globalThis.mpegts?.isSupported())throw signalError('Reprodução MPEG-TS não suportada neste navegador. Atualize o navegador antes de testar a lista.','BROWSER_UNSUPPORTED',true);
    tsPlayer=mpegts.createPlayer({type:'mpegts',isLive:true,url:url});
    tsPlayer.on(mpegts.Events.ERROR,(_type,detail)=>finish(signalError(/codec|unsupported|format/i.test(String(detail))?'Formato de áudio ou vídeo não compatível com este navegador.':'O sinal TS não iniciou depois da conexão. Pode haver interrupção do fornecedor ou incompatibilidade de áudio/vídeo.','TS_PLAYBACK')));
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
   try{
    let playback=url;
    if(protectedSource(url)){
     if(!globalThis.NPlayLiveAuth)throw signalError('O módulo de acesso está desatualizado. Reabra o ADM e confirme a versão 0.49.26.','ADMIN_UPDATE_REQUIRED',true);
     try{playback=await NPlayLiveAuth.authorize(url);}catch{throw signalError('Sua sessão não está disponível. Entre novamente no ADM antes de testar.','GATEWAY_SESSION',true);}
     await checkProtectedSource(playback,signal);
    }else playback=await globalThis.NPlayLiveAuth?.authorize(url)||url;
    return {...await testSignal(video,playback,{...options,signal}),playbackUrl:url};
   }
   catch(error){if(error.name==='AbortError'||error.sharedFailure)throw error;failures.push({protocol:new URL(url).protocol==='https:'?'HTTPS':'HTTP',message:error.message});}
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
