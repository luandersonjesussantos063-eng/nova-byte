import {buyerAdmin,db,PaymentError} from '../checkout-validacao/_core.js';
import {credentials,guardOrigin,randomState,hashState,AUTH_URL,CALLBACK,noStoreJson,errorJson} from './_oauth.js';
// A signed-in Kaia admin must explicitly initiate this one-time authorization.
export async function onRequestPost({request,env}){
 try{
  guardOrigin(request);credentials(env);
  const origin=request.headers.get('origin');
  if(origin!=='https://usekaiaglow.com.br'&&origin!=='https://www.usekaiaglow.com.br')
   throw new PaymentError('ORIGEM_INVALIDA',403);
  const adminId=await buyerAdmin(request,env);
  const state=randomState();
  const hashed=await hashState(state);
  const created=await db(env,'kaia_olist_oauth_state','POST',{
   state_hash:hashed,admin_id:adminId,expires_at:new Date(Date.now()+10*60*1000).toISOString()
  });
  if(!Array.isArray(created)||created.length!==1)throw new PaymentError('AUTORIZACAO_NAO_INICIADA',503);
  const url=new URL(AUTH_URL);
  url.searchParams.set('client_id',env.KAIA_OLIST_CLIENT_ID);
  url.searchParams.set('response_type','code');
  url.searchParams.set('redirect_uri',CALLBACK);
  url.searchParams.set('scope','openid');
  url.searchParams.set('state',state);
  return noStoreJson({authorizationUrl:url.href,expiresInSeconds:600});
 }catch(e){return errorJson(e);}
}
