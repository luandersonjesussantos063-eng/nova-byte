// One unsettled order per buyer protects central stock against over-reservation.
// Only its owner can view/resume/cancel it. Never release reserved stock before provider cancellation.
import {CheckoutError,json,fail,gate,identity,database,provider,reconcile,checkoutLink} from './_core.js';
async function activeOrder(env,userId){
  const rows=await database(env,'kaia_commercial_payments?user_id=eq.'+encodeURIComponent(userId)+
   '&status=in.(created,pending,review_required)&select=*&order=created_at.desc&limit=1');
  return rows[0]||null;
}
async function remoteSync(env,row){
 if(!row.provider_order_id)return row;
 const remote=await provider(env,'/v1/orders/'+encodeURIComponent(row.provider_order_id));
 await reconcile(env,remote,row);
 const rows=await database(env,'kaia_commercial_payments?id=eq.'+encodeURIComponent(row.id)+'&select=*');
 return rows[0];
}
function summary(row){
 if(!row||!['created','pending','review_required'].includes(row.status))
  return {hasPending:false};
 let link=null;
 if(row.checkout_url){try{link=checkoutLink(row.checkout_url);}catch{}}
 return {hasPending:true,id:row.id,status:row.status,items:row.items.map(x=>({name:x.name,quantity:x.quantity})),
   totalCents:row.total_cents,createdAt:row.created_at,postalCode:row.postal_code,
   checkoutUrl:link,cancelable:row.status==='pending'&&!!row.provider_order_id};
}
export async function onRequestGet({request,env}){
 try{
  gate(request,env);const user=await identity(request);
  let row=await activeOrder(env,user.id);
  if(row)row=await remoteSync(env,row);
  const details=await database(env,'kaia_customer_details?user_id=eq.'+encodeURIComponent(user.id)+'&select=postal_code');
  return json({...summary(row),registeredPostalCode:String(details[0]?.postal_code||'').replace(/\\D/g,'')});
 }catch(e){return fail(e);}
}
export async function onRequestPost({request,env}){
 try{
  gate(request,env);
  if(request.headers.get('Origin')!==new URL(request.url).origin)
   throw new CheckoutError('ORIGEM_INVALIDA',403);
  const user=await identity(request);
  const row=await activeOrder(env,user.id);
  if(!row) return json({cancelled:true,alreadyCleared:true});
  if(!row.provider_order_id)throw new CheckoutError('PEDIDO_SEM_ORDER_SUPORTE',409);
  const remote=await provider(env,'/v1/orders/'+encodeURIComponent(row.provider_order_id));
  const synced=await reconcile(env,remote,row);
  if(synced?.status==='cancelled')return json({cancelled:true});
  if(synced?.status==='approved')throw new CheckoutError('PEDIDO_JA_PAGO',409);
  if(!['created','action_required'].includes(remote.status))
   throw new CheckoutError('PEDIDO_AGUARDANDO_PROVEDOR',409);
  let response;
  try{
   response=await fetch('https://api.mercadopago.com/v1/orders/'+encodeURIComponent(row.provider_order_id)+'/cancel',{
    method:'POST',headers:{Authorization:'Bearer '+env.KAIA_MP_PROD_ACCESS_TOKEN,
      'X-Idempotency-Key':row.id,Accept:'application/json'},
    signal:AbortSignal.timeout(9000)
   });
  }catch{throw new CheckoutError('CANCELAMENTO_SEM_CONFIRMACAO',503);}
  if(!response.ok)throw new CheckoutError('CANCELAMENTO_RECUSADO_PELO_MERCADO_PAGO',409);
  // Only a fresh provider lookup may justify returning the stock to inventory.
  const final=await provider(env,'/v1/orders/'+encodeURIComponent(row.provider_order_id));
  const result=await reconcile(env,final,row);
  if(result?.status!=='cancelled')throw new CheckoutError('CANCELAMENTO_AGUARDANDO_CONFIRMACAO',409);
  return json({cancelled:true,stockReleased:true});
 }catch(e){return fail(e);}
}
