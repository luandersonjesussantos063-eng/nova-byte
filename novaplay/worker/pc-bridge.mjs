import {seal,unseal} from './hls-relay.mjs';
const configId='nplay-pc-bridge-v1';
export function bridgeUrl(raw){
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||!/^[-a-z0-9]+\.trycloudflare\.com$/.test(url.hostname))throw Error('INVALID_PC_BRIDGE_URL');
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
export async function bridgeUpstream(config,validateUrl){
 return async(raw,signal,range,options={})=>{
  validateUrl(raw);
  let r;const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000);
  try{r=await fetch(config.url+'/fetch',{method:'POST',headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:JSON.stringify({url:raw,range,xtream:options.xtream===true}),signal:AbortSignal.any([signal||new AbortController().signal,timeout.signal]),redirect:'manual'});}catch{const error=Error('PC bridge unavailable');error.code='PC_BRIDGE_OFFLINE';throw error;}finally{clearTimeout(timer);}
  if(r.status>=300&&r.status<400){await r.body?.cancel();const error=Error('PC bridge redirect refused');error.code='PC_BRIDGE_OFFLINE';throw error;}
  if(!r.ok&&!r.headers.has('X-NPlay-Upstream-Url')){
   const reasons={UPSTREAM_TLS:'PC_SOURCE_TLS',UPSTREAM_RESET:'PC_SOURCE_RESET',UPSTREAM_DNS:'PC_SOURCE_DNS',UPSTREAM_TIMEOUT:'PC_SOURCE_TIMEOUT',UPSTREAM_DESTINATION:'PC_SOURCE_UNAVAILABLE',UPSTREAM_CONNECTION:'PC_SOURCE_UNAVAILABLE'};
   let reason=r.headers.get('X-NPlay-Bridge-Error');
   if(!reason&&r.status===502){
    try{const payload=await r.clone().json();reason=payload?.reason;}catch{}
   }
   const code=reasons[reason]||(r.status===502?'PC_SOURCE_UNAVAILABLE':r.status===401?'PC_BRIDGE_AUTH':'PC_BRIDGE_OFFLINE');
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
 PC_BRIDGE_OFFLINE:'A TV pelo PC está desconectada. Mantenha o Docker ligado e confira o endereço no ADM.',
 PC_BRIDGE_AUTH:'A conexão da TV pelo PC perdeu a autorização. Reconecte o arquivo CONEXAO-ADM.txt no ADM.',
 PC_SOURCE_TLS:'O servidor de vídeo apresentou um certificado HTTPS não confiável. O fornecedor precisa corrigir o certificado ou indicar um endereço com certificado válido.',
 PC_SOURCE_RESET:'A conexão com o servidor de vídeo foi encerrada antes de receber o sinal. Confira a fonte e a conexão de internet do PC.',
 PC_SOURCE_DNS:'O PC não conseguiu localizar o servidor de vídeo pelo DNS.',
 PC_SOURCE_TIMEOUT:'O servidor de vídeo não respondeu ao PC dentro do tempo limite.',
 PC_SOURCE_UNAVAILABLE:'O PC está conectado, mas não conseguiu receber o sinal do fornecedor. Atualize a ponte TV-PC para identificar a causa.'
};
