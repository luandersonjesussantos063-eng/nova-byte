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
export async function bridgeUpstream(config,validateUrl){
 return async(raw,signal,range)=>{
  validateUrl(raw);
  let r;const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000);
  try{r=await fetch(config.url+'/fetch',{method:'POST',headers:{Authorization:'Bearer '+config.secret,'Content-Type':'application/json'},body:JSON.stringify({url:raw,range}),signal:AbortSignal.any([signal||new AbortController().signal,timeout.signal]),redirect:'error'});}catch{const error=Error('PC bridge unavailable');error.code='PC_BRIDGE_OFFLINE';throw error;}finally{clearTimeout(timer);}
  const final=r.headers.get('X-NPlay-Upstream-Url');
  if(!final){await r.body?.cancel();const error=Error('PC bridge unavailable');error.code='PC_BRIDGE_OFFLINE';throw error;}
  validateUrl(final);
  Object.defineProperty(r,'url',{value:final});return r;
 };
}
