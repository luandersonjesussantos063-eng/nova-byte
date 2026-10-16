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
  await response.body?.cancel();
  if(status>=300&&status<400)return fail('PC_TUNNEL_REDIRECT','O túnel redirecionou a conexão (HTTP '+status+'). Confira o endereço HTTPS atual do PC.',status);
  if(status===401)return fail('PC_KEY_REJECTED','O PC respondeu, mas recusou a chave. Copie novamente a chave do arquivo CONEXAO-ADM.txt atual.',status);
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
 return async(raw,signal,range)=>{
  validateUrl(raw);
  let r;const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000);
  try{r=await fetch(config.url+'/fetch',{method:'POST',headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:JSON.stringify({url:raw,range}),signal:AbortSignal.any([signal||new AbortController().signal,timeout.signal]),redirect:'manual'});}catch{const error=Error('PC bridge unavailable');error.code='PC_BRIDGE_OFFLINE';throw error;}finally{clearTimeout(timer);}
  if(r.status>=300&&r.status<400){await r.body?.cancel();const error=Error('PC bridge redirect refused');error.code='PC_BRIDGE_OFFLINE';throw error;}
  const final=r.headers.get('X-NPlay-Upstream-Url');
  if(!final){await r.body?.cancel();const error=Error('PC bridge unavailable');error.code='PC_BRIDGE_OFFLINE';throw error;}
  validateUrl(final);
  Object.defineProperty(r,'url',{value:final});return r;
 };
}
