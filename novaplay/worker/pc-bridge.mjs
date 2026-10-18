import {seal,unseal} from './hls-relay.mjs';
const configId='nplay-pc-bridge-v1';
export function bridgeUrl(raw){
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||!/^[-a-z0-9]+\.(?:trycloudflare\.com|up\.railway\.app)$/.test(url.hostname))throw Error('INVALID_PC_BRIDGE_URL');
 return url.origin;
}
export async function encryptBridge(config,key){return seal(JSON.stringify(config),configId,key);}
export async function decryptBridge(cipher,key){
 const config=JSON.parse(await unseal(cipher,configId,key));
 bridgeUrl(config.url);if(!/^[a-f0-9]{64}$/.test(config.secret))throw Error('INVALID_PC_BRIDGE_KEY');return config;
}
export async function checkBridge(url,secret,readJson){
 let response;
 const fail=(code,error,status=0)=>({code,error,status});
 try{
  response=await fetch(url+'/health',{headers:{Authorization:'Bearer '+secret},redirect:'manual',signal:AbortSignal.timeout(15000)});
 }catch(error){
  return ['TimeoutError','AbortError'].includes(error?.name)?fail('PC_TUNNEL_TIMEOUT','O túnel demorou mais de 15 segundos para responder ao servidor NPlay.'):fail('PC_TUNNEL_CONNECTION','O servidor NPlay não conseguiu abrir a conexão HTTPS com o túnel do PC.');
 }
 const status=response.status;
 if(!response.ok){
  if(status===401){
   let info;try{info=await readJson(response,2000);}catch{}
   if(info?.error==='AUTH_REQUIRED')return fail('PC_KEY_REJECTED','A ponte Docker respondeu, mas a chave enviada não corresponde à chave dela. Use Carregar CONEXAO-ADM.txt para enviar os dados do arquivo atual sem copiar.',status);
   return fail('PC_TUNNEL_AUTH','A autenticação foi recusada antes de identificar a ponte Docker (HTTP 401). Isso ainda não confirma uma chave incorreta no PC.',status);
  }
  await response.body?.cancel();
  if(status>=300&&status<400)return fail('PC_TUNNEL_REDIRECT','O túnel redirecionou a conexão (HTTP '+status+'). Confira o endereço HTTPS atual do PC.',status);
  if(status===403)return fail('PC_TUNNEL_DENIED','O túnel recusou a conexão do servidor NPlay (HTTP 403). A ponte pode funcionar no PC e ainda recusar o acesso do servidor.',status);
  if(status===502)return fail('PC_LOCAL_UNREACHABLE','O túnel respondeu, mas não conseguiu chegar à ponte Docker (HTTP 502). Confira o serviço bridge.',status);
  if(status===404||status===530)return fail('PC_TUNNEL_ADDRESS','O endereço do túnel não está disponível (HTTP '+status+'). Confira o endereço no arquivo CONEXAO-ADM.txt atual.',status);
  return fail('PC_TUNNEL_HTTP','O túnel respondeu ao NPlay com HTTP '+status+'.',status);
 }
 try{
  const info=await readJson(response,2000);
  if(info.service!=='nplay-pc-tv')return fail('PC_SERVICE_MISMATCH','O endereço respondeu, mas não identificou a ponte NPlay TV-PC.',status);
 }catch{return fail('PC_RESPONSE_INVALID','O endereço respondeu HTTP '+status+', mas não retornou a identificação JSON da ponte TV-PC.',status);}
 return {ok:true,status};
}
async function bridgeJson(response,max=75000){
 const reader=response.body?.getReader();if(!reader)throw Error('Empty bridge response');let bytes=0;const parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max)throw Error('Bridge response too large');parts.push(value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 const out=new Uint8Array(bytes);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(out));
}
const engineCodes={
 XTREAM_CATALOG_INVALID:'PC_XTREAM_CATALOG_INVALID',XTREAM_ROOT_INVALID:'PC_MEDIA_SOURCE_INVALID',XTREAM_LOGIN_RESET:'PC_XTREAM_LOGIN_RESET',XTREAM_LOGIN_TIMEOUT:'PC_XTREAM_LOGIN_TIMEOUT',XTREAM_LOGIN_CONNECTION:'PC_XTREAM_LOGIN_CONNECTION',XTREAM_LOGIN_INVALID:'PC_XTREAM_LOGIN_INVALID',XTREAM_LOGIN_DENIED:'PC_XTREAM_LOGIN_DENIED',XTREAM_TS_UNAVAILABLE:'PC_XTREAM_TS_UNAVAILABLE',XTREAM_CONNECTION_LIMIT:'PC_MEDIA_CONNECTION_LIMIT',ENGINE_SOURCE_HTTP:'PC_MEDIA_SOURCE_HTTP',ENGINE_SOURCE_INVALID:'PC_MEDIA_SOURCE_INVALID',ENGINE_SOURCE_RESET:'PC_MEDIA_SOURCE_RESET',ENGINE_SOURCE_CONNECTION:'PC_MEDIA_SOURCE_CONNECTION',ENGINE_BUSY:'PC_MEDIA_BUSY',ENGINE_START_TIMEOUT:'PC_MEDIA_START_TIMEOUT',ENGINE_PROCESS_FAILED:'PC_MEDIA_PROCESS_FAILED',ENGINE_NOT_INSTALLED:'PC_MEDIA_NOT_INSTALLED',ENGINE_ASSET_GONE:'PC_MEDIA_ASSET_GONE'
};
function bridgeFailure(code){const error=Error('PC media receiver failed');error.code=code;return error;}
export async function bridgeEngineStatus(config){
 const r=await fetch(config.url+'/engine/status',{headers:{Authorization:'Bearer '+config.secret},redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(!r.ok){await r.body?.cancel();throw bridgeFailure(r.status===404?'PC_MEDIA_NOT_INSTALLED':'PC_BRIDGE_OFFLINE');}
 return bridgeJson(r,4000);
}
export async function inspectBridgeXtream(config,url){
 const r=await fetch(config.url+'/xtream/inspect',{method:'POST',headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:JSON.stringify({url}),redirect:'manual',signal:AbortSignal.timeout(30000)});
 if(!r.ok){await r.body?.cancel();throw bridgeFailure(r.status===404?'PC_MEDIA_NOT_INSTALLED':'PC_BRIDGE_OFFLINE');}
 const info=await bridgeJson(r,100000);if(info.ok!==true)throw bridgeFailure(engineCodes[info.code]||'PC_XTREAM_CATALOG_INVALID');return info;
}
export async function releaseBridgeViewer(config,url,owner){
 const r=await fetch(config.url+'/engine/release',{method:'POST',headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:JSON.stringify({url,owner}),redirect:'manual',signal:AbortSignal.timeout(20000)});
 await r.body?.cancel();if(!r.ok)throw bridgeFailure('PC_BRIDGE_OFFLINE');
}
export async function bridgeUpstream(config,validateUrl,owner=''){
 return async(raw,signal,range,options={})=>{
  validateUrl(raw);
  const root=new URL(raw);
  if(options.xtream&&!root.search&&/^\/(?:live\/)?[^/]+\/[^/]+\/\d+\.m3u8$/.test(root.pathname)){
   let control;
   try{control=await fetch(config.url+'/engine/start',{method:'POST',headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:JSON.stringify({url:raw,owner}),redirect:'manual',signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(35000)])});}
   catch{throw bridgeFailure('PC_MEDIA_START_TIMEOUT');}
   if(control.status===404){await control.body?.cancel();} // Older PC bridge; retain its legacy path.
   else{
    if(!control.ok){await control.body?.cancel();throw bridgeFailure(control.status===401?'PC_BRIDGE_AUTH':'PC_BRIDGE_OFFLINE');}
    const data=await bridgeJson(control);
    if(data.ok!==true)throw bridgeFailure(engineCodes[data.code]||'PC_MEDIA_PROCESS_FAILED');
    const base=new URL(data.base);
    if(base.origin!=='https://nplay-media.invalid'||!/^\/session\/[a-f0-9]{32}\/index\.m3u8$/.test(base.pathname)||base.search||base.hash||typeof data.manifest!=='string'||!data.manifest.startsWith('#EXTM3U'))throw bridgeFailure('PC_MEDIA_PROCESS_FAILED');
    const response=new Response(data.manifest,{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
    Object.defineProperty(response,'url',{value:base.href});return response;
   }
  }
  let r;const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000);
  try{r=await fetch(config.url+'/fetch',{method:'POST',headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:JSON.stringify({url:raw,range,xtream:options.xtream===true,owner}),signal:AbortSignal.any([signal||new AbortController().signal,timeout.signal]),redirect:'manual'});}catch{const error=Error('PC bridge unavailable');error.code='PC_BRIDGE_OFFLINE';throw error;}finally{clearTimeout(timer);}
  if(r.status>=300&&r.status<400){await r.body?.cancel();const error=Error('PC bridge redirect refused');error.code='PC_BRIDGE_OFFLINE';throw error;}
  if(!r.ok&&!r.headers.has('X-NPlay-Upstream-Url')){
   const reasons={UPSTREAM_TLS:'PC_SOURCE_TLS',UPSTREAM_RESET:'PC_SOURCE_RESET',UPSTREAM_DNS:'PC_SOURCE_DNS',UPSTREAM_TIMEOUT:'PC_SOURCE_TIMEOUT',UPSTREAM_DESTINATION:'PC_SOURCE_UNAVAILABLE',UPSTREAM_CONNECTION:'PC_SOURCE_UNAVAILABLE'};
   let reason=r.headers.get('X-NPlay-Bridge-Error');
   if(!reason&&r.status===502){
    try{const payload=await bridgeJson(r,4000);reason=payload?.reason;}catch{}
   }
   const code=engineCodes[reason]||reasons[reason]||(r.status===502?'PC_SOURCE_UNAVAILABLE':r.status===401?'PC_BRIDGE_AUTH':'PC_BRIDGE_OFFLINE');
   await r.body?.cancel();const error=Error('PC bridge source failure');error.code=code;throw error;
  }
  // This is private bridge-to-gateway metadata. relayHls builds a fresh response
  // and encrypts every resolved URL; this header never reaches the viewer.
  const finalUrl=r.headers.get('X-NPlay-Upstream-Url');
  if(!finalUrl){await r.body?.cancel();const error=Error('Bridge response missing manifest base');error.code='PC_SOURCE_UNAVAILABLE';throw error;}
  validateUrl(finalUrl);Object.defineProperty(r,'url',{value:finalUrl});return r;
 };
}
export const pcFailureMessages={
 PC_XTREAM_CATALOG_INVALID:'O fornecedor não retornou uma grade Xtream válida para esta conta.',
 PC_XTREAM_LOGIN_RESET:'O servidor encerrou a conexão durante o login Xtream, antes de receber o vídeo. Consulte o receptor no ADM.',
 PC_XTREAM_LOGIN_TIMEOUT:'O login Xtream não respondeu dentro do tempo limite.',
 PC_XTREAM_LOGIN_CONNECTION:'O receptor não conseguiu conectar à API Xtream do fornecedor.',
 PC_XTREAM_LOGIN_INVALID:'A API do fornecedor não retornou um login Xtream válido.',
 PC_XTREAM_LOGIN_DENIED:'O fornecedor não autorizou o login Xtream ou a conta está inativa.',
 PC_XTREAM_TS_UNAVAILABLE:'A conta do fornecedor não oferece MPEG-TS para o receptor.',
 PC_MEDIA_CONNECTION_LIMIT:'Todas as conexões da conta estão em uso. Feche outros players e tente novamente.',
 PC_MEDIA_SOURCE_HTTP:'O login foi aceito, mas o fornecedor recusou o endereço do vídeo.',
 PC_MEDIA_SOURCE_INVALID:'O fornecedor não entregou um sinal de vídeo compatível com o receptor.',
 PC_MEDIA_SOURCE_RESET:'O login Xtream foi aceito, mas a conexão do vídeo foi encerrada pelo caminho até o fornecedor.',
 PC_MEDIA_SOURCE_CONNECTION:'O receptor entrou na conta, mas não conseguiu receber o vídeo.',
 PC_MEDIA_BUSY:'As três vagas de canais simultâneos estão em uso. Feche um canal em outro aparelho e tente novamente.',
 PC_MEDIA_START_TIMEOUT:'O receptor não ficou pronto no tempo limite. Confira o estado no ADM.',
 PC_MEDIA_PROCESS_FAILED:'O receptor recebeu dados, mas não conseguiu gerar o vídeo para o navegador. Confira o ADM.',
 PC_MEDIA_NOT_INSTALLED:'Atualize a TV-PC para instalar o receptor Xtream e FFmpeg.',
 PC_MEDIA_ASSET_GONE:'A sessão deste canal terminou. Abra o canal novamente.',

 PC_BRIDGE_OFFLINE:'A TV pelo PC está desconectada. Mantenha o Docker ligado e confira o endereço no ADM.',
 PC_BRIDGE_AUTH:'A conexão da TV pelo PC perdeu a autorização. Reconecte o arquivo CONEXAO-ADM.txt no ADM.',
 PC_SOURCE_TLS:'O servidor de vídeo apresentou um certificado HTTPS não confiável. O fornecedor precisa corrigir o certificado ou indicar um endereço com certificado válido.',
 PC_SOURCE_RESET:'A conexão com o servidor de vídeo foi encerrada antes de receber o sinal. Confira a fonte e a conexão de internet do PC.',
 PC_SOURCE_DNS:'O PC não conseguiu localizar o servidor de vídeo pelo DNS.',
 PC_SOURCE_TIMEOUT:'O servidor de vídeo não respondeu ao PC dentro do tempo limite.',
 PC_SOURCE_UNAVAILABLE:'O PC está conectado, mas não conseguiu receber o sinal do fornecedor. Atualize a ponte TV-PC para identificar a causa.'
};
