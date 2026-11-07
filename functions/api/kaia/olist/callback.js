// One-time Olist OAuth callback, issued after Kaia Glow admin-initiated consent.
// Authorization codes, access tokens and refresh tokens are never reflected
// in the response, browser, query log, static assets, or public database.
import {db,PaymentError} from '../checkout-validacao/_core.js';
import {credentials,guardOrigin,hashState,CALLBACK,tokenRequest,persistTokens,successPage} from './_oauth.js';
export async function onRequestGet({request,env}){
 try{
  guardOrigin(request);credentials(env);
  const url=new URL(request.url);
  if(url.pathname!=='/api/kaia/olist/callback')
   throw new PaymentError('ROTA_INVALIDA',404);
  if(url.searchParams.has('error'))
   return successPage('Autorização não concluída',
    'A Olist não autorizou o acesso. O estoque e os pedidos permaneceram inalterados.',400);
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');
  if(!state&&!code)return successPage('Endereço preparado',
   'A URL de retorno da Olist está ativa. Abra o painel da Kaia Glow e use Conectar Olist para autorizar o acesso.');
  if(!state||!/^[a-f0-9]{64}$/.test(state)||!code||code.length>4000)
   throw new PaymentError('AUTORIZACAO_INVALIDA',403);
  const digest=await hashState(state);
  const expire=new Date().toISOString();
  // Atomic one-time consumption; no database match means replay/expired state.
  const claimed=await db(env,'kaia_olist_oauth_state?state_hash=eq.'+digest+
   '&consumed_at=is.null&expires_at=gt.'+encodeURIComponent(expire),'PATCH',{
   consumed_at:expire
  });
  if(!Array.isArray(claimed)||claimed.length!==1)
   throw new PaymentError('AUTORIZACAO_EXPIRADA',403);
  const tokens=await tokenRequest(env,{grant_type:'authorization_code',code,redirect_uri:CALLBACK});
  await persistTokens(env,tokens,claimed[0].admin_id);
  return successPage('Olist autorizada com sucesso',
   'A conexão foi autorizada e as credenciais foram guardadas de forma protegida. Nenhum produto, quantidade ou pedido foi enviado ou alterado. Volte ao painel para testar uma consulta de produtos.');
 }catch(e){
  return successPage('Não foi possível concluir a conexão',
   'A autorização não foi armazenada. Volte ao painel e inicie uma nova autorização. Se o problema continuar, verifique as permissões e o endereço de redirecionamento.',
   e instanceof PaymentError&&e.status>=400&&e.status<500?403:503);
 }
}
