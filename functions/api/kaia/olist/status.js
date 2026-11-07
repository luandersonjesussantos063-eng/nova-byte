import {buyerAdmin} from '../checkout-validacao/_core.js';
import {guardOrigin,credentials,connection,noStoreJson,errorJson,validAccessToken,API_URL} from './_oauth.js';
export async function onRequestGet({request,env}){
 try{
  guardOrigin(request);await buyerAdmin(request,env);
  const configured=!!env.KAIA_OLIST_CLIENT_ID&&!!env.KAIA_OLIST_CLIENT_SECRET;
  if(!configured)return noStoreJson({configured:false,authorized:false,autoSync:false});
  credentials(env);
  const current=await connection(env);
  return noStoreJson({configured:true,authorized:!!current.token_ciphertext,
   authorizedAt:current.last_authorized_at,
   tokenNeedsRenewal:!!current.token_ciphertext&&new Date(current.expires_at).getTime()<Date.now(),
   autoSync:false});
 }catch(e){return errorJson(e);}
}
// Performs exactly one read-only test; never updates stock or creates orders.
export async function onRequestPost({request,env}){
 try{
  guardOrigin(request);
  const origin=request.headers.get('origin');
  if(origin!=='https://usekaiaglow.com.br'&&origin!=='https://www.usekaiaglow.com.br')
   return noStoreJson({code:'ORIGEM_INVALIDA'},403);
  await buyerAdmin(request,env);
  const token=await validAccessToken(env);
  let r;
  try{
   r=await fetch(API_URL+'/produtos?limit=1',{
    method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    // Never forward the bearer token to a redirected endpoint.
    redirect:'manual',signal:AbortSignal.timeout(10000)
   });
  }catch(e){
   const code=e?.name==='TimeoutError'||e?.name==='AbortError'?
    'OLIST_CONSULTA_TIMEOUT':'OLIST_CONSULTA_FALHA_REDE';
   return noStoreJson({ok:false,code,autoSync:false},502);
  }
  if(r.status>=300&&r.status<400)
   return noStoreJson({ok:false,code:'OLIST_API_REDIRECIONAMENTO',autoSync:false},502);
  if(!r.ok){
   const code=r.status===401||r.status===403?'OLIST_ACESSO_PRODUTOS_NEGADO':
    r.status===404?'OLIST_ROTA_PRODUTOS_INVALIDA':
    r.status===429?'OLIST_LIMITE_CONSULTAS':
    r.status>=500?'OLIST_API_ERRO_SERVIDOR':'OLIST_API_ERRO_REQUISICAO';
   return noStoreJson({ok:false,code,httpStatus:r.status,autoSync:false},r.status===401||r.status===403?403:502);
  }
  // HTTP 200 alone does not mean products were returned; avoid a false
  // positive if a login page or other unexpected payload is served.
  let payload;
  try{payload=await r.json();}catch{
   return noStoreJson({ok:false,code:'OLIST_PRODUTOS_RESPOSTA_INVALIDA',autoSync:false},502);
  }
  if(!payload||!Array.isArray(payload.itens))
   return noStoreJson({ok:false,code:'OLIST_PRODUTOS_FORMATO_INESPERADO',autoSync:false},502);
  return noStoreJson({ok:true,operation:'products_read_only',
   returnedProducts:payload.itens.length,autoSync:false});
 }catch(e){return errorJson(e);}
}
