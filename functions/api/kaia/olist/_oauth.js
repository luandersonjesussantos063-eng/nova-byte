// Server-only helpers for Olist ERP API V3 OAuth2.
// No automatic stock/order writes. Tokens are encrypted at rest and only
// accessible through service_role in a RLS-protected Supabase table.
import {db,PaymentError,HOSTS} from '../checkout-validacao/_core.js';
export const CALLBACK='https://usekaiaglow.com.br/api/kaia/olist/callback';
export const AUTH_URL='https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth';
export const TOKEN_URL='https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';
export const API_URL='https://api.tiny.com.br/public-api/v3';
const encoder=new TextEncoder();
export function guardOrigin(request){
 const url=new URL(request.url);
 if(url.protocol!=='https:'||!HOSTS.includes(url.hostname))
  throw new PaymentError('DOMINIO_INVALIDO',403);
}
export function credentials(env){
 if(!env.KAIA_OLIST_CLIENT_ID||!env.KAIA_OLIST_CLIENT_SECRET||!env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY)
  throw new PaymentError('CREDENCIAIS_OLIST_AUSENTES',503);
}
export function noStoreJson(value,status=200){
 return new Response(JSON.stringify(value),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow',
  'referrer-policy':'no-referrer'
 }});
}
export function errorJson(e){
 return noStoreJson({code:e instanceof PaymentError?e.code:'OLIST_INDISPONIVEL'},
  e instanceof PaymentError?e.status:503);
}
const bytesToHex=b=>Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');
export const randomState=()=>bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
export async function hashState(state){
 return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(state))));
}
async function encryptionKey(env){
 const keyMaterial=await crypto.subtle.importKey('raw',encoder.encode(env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY),
  'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',
  salt:encoder.encode('kaia-glow-olist-tokens-v1'),
  info:encoder.encode('production-olist-oauth-token-vault')},keyMaterial,
  {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s);}
function fromBase64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function sealTokens(env,tokens){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await encryptionKey(env);
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(tokens)));
 return {token_iv:toBase64(iv),token_ciphertext:toBase64(new Uint8Array(cipher))};
}
async function openTokens(env,row){
 if(!row?.token_ciphertext||!row?.token_iv)throw new PaymentError('OLIST_NAO_AUTORIZADA',409);
 try{
  const key=await encryptionKey(env);
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(row.token_iv)},key,fromBase64(row.token_ciphertext));
  return JSON.parse(new TextDecoder().decode(data));
 }catch{throw new PaymentError('OLIST_TOKEN_INDISPONIVEL',503);}
}
export async function connection(env){
 const rows=await db(env,'kaia_olist_connection?slot=eq.1&select=*');
 if(!Array.isArray(rows)||rows.length!==1)throw new PaymentError('OLIST_NAO_PREPARADA',503);
 return rows[0];
}
export async function tokenRequest(env,params){
 credentials(env);
 const body=new URLSearchParams({
  client_id:env.KAIA_OLIST_CLIENT_ID,client_secret:env.KAIA_OLIST_CLIENT_SECRET,...params
 });
 let response;
 try{
  response=await fetch(TOKEN_URL,{method:'POST',headers:{
   'content-type':'application/x-www-form-urlencoded',accept:'application/json'
  },body:body.toString(),redirect:'manual',signal:AbortSignal.timeout(10000)});
 }catch(e){
  // Do not include raw exceptions, URL, client credentials or OAuth code
  // in diagnostics. Only expose a static, non-sensitive error category.
  const kind=e?.name==='TimeoutError'||e?.name==='AbortError'?
   'OLIST_TEMPO_ESGOTADO':'OLIST_FALHA_REDE';
  throw new PaymentError(kind,502);
 }
 // Never automatically resend client secrets or authorization codes to a
 // redirected host. Unlike redirect:'error', manual mode preserves the HTTP
 // response and prevents a redirect from masquerading as a network failure.
 if(response.status>=300&&response.status<400)
  throw new PaymentError('OLIST_TOKEN_REDIRECIONADO',502);
 // Only use OAuth standard error enums. Never return/log token endpoint body,
 // client_id, client_secret, authorization code, access or refresh tokens.
 if(!response.ok){
  let kind='';
  try{
   const data=await response.json();
   if(typeof data?.error==='string')kind=data.error;
  }catch{}
  const known={
   invalid_client:'OLIST_CLIENTE_INVALIDO',
   invalid_grant:'OLIST_CODIGO_RECUSADO',
   unauthorized_client:'OLIST_APLICATIVO_NAO_AUTORIZADO',
   invalid_request:'OLIST_SOLICITACAO_INVALIDA',
   unsupported_grant_type:'OLIST_TIPO_AUTORIZACAO_INVALIDO'
  };
  throw new PaymentError(known[kind]||
   (response.status===401||response.status===403?'OLIST_CREDENCIAIS_RECUSADAS':
    response.status===429?'OLIST_LIMITE_DE_REQUISICOES':'OLIST_SERVICO_RECUSOU_TOKEN'),502);
 }
 let result;
 try{result=await response.json();}catch{throw new PaymentError('OLIST_RESPOSTA_TOKEN_INVALIDA',502);}
 if(typeof result.access_token!=='string'||!result.access_token||
    typeof result.refresh_token!=='string'||!result.refresh_token)
  throw new PaymentError('OLIST_TOKEN_INCOMPLETO',502);
 return {
  access_token:result.access_token,refresh_token:result.refresh_token,
  expires_at:Date.now()+Math.max(60,Number(result.expires_in)||300)*1000,
  refresh_expires_at:Number(result.refresh_expires_in)>0
   ?Date.now()+Number(result.refresh_expires_in)*1000:null
 };
}
export async function persistTokens(env,tokens,adminId,refreshed=false){
 let encrypted;
 try{encrypted=await sealTokens(env,tokens);}
 catch{throw new PaymentError('OLIST_CRIPTOGRAFIA_INDISPONIVEL',503);}
 const update={
  ...encrypted,expires_at:new Date(tokens.expires_at).toISOString(),
  updated_at:new Date().toISOString(),
  ...(refreshed?{last_refreshed_at:new Date().toISOString()}:{
   last_authorized_at:new Date().toISOString(),authorized_by:adminId
  })
 };
 const result=await db(env,'kaia_olist_connection?slot=eq.1','PATCH',update);
 if(!Array.isArray(result)||result.length!==1)throw new PaymentError('OLIST_GRAVACAO_INDISPONIVEL',503);
}
export async function validAccessToken(env){
 credentials(env);
 const record=await connection(env);
 let tokens=await openTokens(env,record);
 if(tokens.expires_at>Date.now()+90*1000)return tokens.access_token;
 if(!tokens.refresh_token)throw new PaymentError('OLIST_REAUTORIZACAO_NECESSARIA',401);
 const renewed=await tokenRequest(env,{grant_type:'refresh_token',refresh_token:tokens.refresh_token});
 await persistTokens(env,renewed,null,true);
 return renewed.access_token;
}
export const successPage=(title,message,status=200)=>new Response(`<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title} · Kaia Glow</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f8f4f5;font:15px system-ui,sans-serif;color:#342b31}
main{box-sizing:border-box;max-width:510px;margin:18px;padding:28px;border-radius:14px;background:white;border:1px solid #e4d9dd}
small{color:#825b6b;font-weight:700;letter-spacing:.1em}h1{font-size:24px}p{line-height:1.7;color:#65585f}
a{color:#54283d;font-weight:650;text-decoration:underline}</style></head><body><main>
<small>KAIA GLOW · OLIST ERP</small><h1>${title}</h1><p>${message}</p>
<a href="https://usekaiaglow.com.br/admin.html#marketplaces">Voltar ao painel de integração</a>
</main></body></html>`,{status,headers:{
 'content-type':'text/html; charset=utf-8','cache-control':'private, no-store, max-age=0',
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY',
 'x-robots-tag':'noindex, nofollow',
 'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
}});
