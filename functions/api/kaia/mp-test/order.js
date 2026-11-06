import {CheckoutError,reply,fail,testConfig,tester,databaseGuard,dbCall,verifyTestSeller,
 mpCall,validateOrder,paymentState,cents,reconcile} from '../../../../kaia-glow/backend/mp-test-core.js';
async function owned(request,env,data){
 testConfig(request,env);const user=tester(data,env);await databaseGuard(env);
 const id=new URL(request.url).searchParams.get('id')||'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new CheckoutError('PEDIDO_INVALIDO',422);
 const order=await dbCall(env,'kaia_qa_owned',{p_id:id,p_owner:user.id});
 if(!order)throw new CheckoutError('PEDIDO_NAO_ENCONTRADO',404);
 return {order,user};
}
async function authenticatedOrder(env,order){
 await verifyTestSeller(env);
 const remote=validateOrder(await mpCall(env,'/'+encodeURIComponent(order.provider_order_id)),order.provider_order_id);
 if(remote.external_reference!==order.id||cents(remote.total_amount)!==order.total_cents)throw new CheckoutError('ORDER_DIVERGENTE');
 return remote;
}
export async function onRequestGet({request,env,data}){
 try{
  const {order}=await owned(request,env,data);
  let providerStatus=null,providerDetail=null,canCancel=false;
  if(order.provider_order_id){
   const remote=await authenticatedOrder(env,order);providerStatus=paymentState(remote);
   // Expose only a sanitized provider status code, never payer or payment details.
   if(typeof remote.status_detail==='string'&&/^[a-z0-9_:-]{1,100}$/i.test(remote.status_detail))providerDetail=remote.status_detail;
   canCancel=order.stock_status==='reserved'&&['created','action_required'].includes(remote.status);
  }
  // A redirect, URL status or poll never commits stock: wait for the signed webhook.
  return reply({test:true,id:order.id,status:order.payment_status,stock:order.stock_status,
   providerStatus,providerDetail,canCancel,awaitingWebhook:providerStatus!==null&&providerStatus!==order.payment_status});
 }catch(e){return fail(e);}
}
export async function onRequestPost({request,env,data}){
 try{
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)
   throw new CheckoutError('ORIGEM_INVALIDA',403);
  const {order,user}=await owned(request,env,data);
  if(!order.provider_order_id)throw new CheckoutError('TENTATIVA_REQUER_RECONCILIACAO');
  const remote=await authenticatedOrder(env,order);
  if(remote.status!=='canceled'){
   if(!['created','action_required'].includes(remote.status))throw new CheckoutError('ORDER_NAO_CANCELAVEL');
   const response=await fetch('https://api.mercadopago.com/v1/orders/'+encodeURIComponent(remote.id)+'/cancel',{
    method:'POST',headers:{Authorization:'Bearer '+env.KAIA_MP_TEST_ACCESS_TOKEN,
     'content-type':'application/json','X-Idempotency-Key':order.cancel_key},signal:AbortSignal.timeout(6000)});
   if(response.body)await response.body.cancel();
   if(!response.ok&&response.status!==409)throw new CheckoutError('CANCELAMENTO_INDISPONIVEL',503);
  }
  // Never release a reservation on POST response alone, including an ambiguous 409.
  const confirmed=await authenticatedOrder(env,order);
  if(confirmed.status!=='canceled')throw new CheckoutError('CANCELAMENTO_NAO_CONFIRMADO');
  await reconcile(env,confirmed);
  const stored=await dbCall(env,'kaia_qa_owned',{p_id:order.id,p_owner:user.id});
  return reply({test:true,id:stored.id,status:stored.payment_status,stock:stored.stock_status});
 }catch(e){return fail(e);}
}
