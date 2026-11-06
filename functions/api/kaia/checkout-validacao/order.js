import {response,PaymentError,fail,assertConfig,buyerAdmin,mp,row,db,requireOrder,reconcile} from './_core.js';
const validUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'&&u.hostname==='www.mercadopago.com.br';}catch{return false;}};
export async function onRequestPost({request,env}){
 try{
  assertConfig(request,env);
  if(!env.KAIA_MP_PUBLIC_ANON_KEY)throw new PaymentError('CHAVE_PUBLICA_PENDENTE');
  if(request.headers.get('Origin')!==new URL(request.url).origin)throw new PaymentError('ORIGEM_INVALIDA',403);
  await buyerAdmin(request,env);
  let record=await row(env);
  if(record.status==='approved'||record.status==='refunded')throw new PaymentError('VALIDACAO_JA_CONCLUIDA',409);
  if(record.provider_order_id){
   const remote=requireOrder(await mp(env,'/v1/orders/'+encodeURIComponent(record.provider_order_id)),record);
   await reconcile(env,remote,record);
   if(!validUrl(record.checkout_url))throw new PaymentError('CHECKOUT_INDISPONIVEL');
   return response({checkoutUrl:record.checkout_url,orderId:record.id});
  }
  // A single immutable idempotency UUID is stored in the database, not supplied by the browser.
  const checkoutPage='https://usekaiaglow.com.br/compra-validacao.html';
  const remote=requireOrder(await mp(env,'/v1/orders',{key:record.payment_key,body:{
   type:'online',processing_mode:'manual',total_amount:'5.00',external_reference:record.id,
   items:[{title:'Kaia Glow - validacao tecnica de pagamento',unit_price:'5.00',quantity:1}],
   config:{online:{
    success_url:checkoutPage+'?retorno=sucesso',
    failure_url:checkoutPage+'?retorno=falha',
    pending_url:checkoutPage+'?retorno=pendente',
    auto_return:'all'
   }}
  }}),record);
  if(!validUrl(remote.checkout_url))throw new PaymentError('CHECKOUT_INDISPONIVEL');
  const updated=await db(env,'kaia_mp_live_pilot_orders?slot=eq.1','PATCH',{
   provider_order_id:remote.id,checkout_url:remote.checkout_url,status:'pending',
   provider_status:String(remote.status||'created').slice(0,60),updated_at:new Date().toISOString()
  });
  if(!updated.length)throw new PaymentError('FALHA_PERSISTENCIA');
  return response({checkoutUrl:remote.checkout_url,orderId:record.id});
 }catch(e){return fail(e);}
}
export async function onRequestGet({request,env}){
 try{
  assertConfig(request,env);
  if(!env.KAIA_MP_PUBLIC_ANON_KEY)throw new PaymentError('CHAVE_PUBLICA_PENDENTE');
  await buyerAdmin(request,env);
  const record=await row(env);
  if(record.provider_order_id)await reconcile(env,requireOrder(await mp(env,'/v1/orders/'+encodeURIComponent(record.provider_order_id)),record),record);
  const current=await row(env);
  return response({status:current.status,totalCents:500,checkoutAvailable:current.status==='created'||current.status==='pending'});
 }catch(e){return fail(e);}
}
