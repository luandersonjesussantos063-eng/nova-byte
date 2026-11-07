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
  const r=await fetch(API_URL+'/produtos?limit=1',{
   method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!r.ok)return noStoreJson({ok:false,code:r.status===401||r.status===403?'OLIST_ACESSO_PRODUTOS_NEGADO':'OLIST_LEITURA_INDISPONIVEL'},r.status===401||r.status===403?403:502);
  return noStoreJson({ok:true,operation:'products_read_only',autoSync:false});
 }catch(e){return errorJson(e);}
}
