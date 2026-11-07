// Expire an unpaid checkout when the buyer next checks their order or cart.
// MP's state is authoritative: never return stock on a timer alone.
import {database,provider,reconcile} from './_core.js';
export const PAYMENT_GRACE_MS=60_000;
export const expirationTimestamp=row=>new Date(row.created_at).getTime()+PAYMENT_GRACE_MS;
export async function synchronizeAndExpire(env,row){
 if(!row?.provider_order_id||!['created','pending','review_required'].includes(row.status))
  return {row,autoCancelled:false};
 const remote=await provider(env,'/v1/orders/'+encodeURIComponent(row.provider_order_id));
 await reconcile(env,remote,row);
 const current=(await database(env,'kaia_commercial_payments?id=eq.'+encodeURIComponent(row.id)+'&select=*'))[0];
 if(!current||!['created','pending'].includes(current.status)||
    Date.now()<expirationTimestamp(current)||
    !['created','action_required'].includes(remote.status))
  return {row:current||row,autoCancelled:false};
 // Cancels ONLY a still-unpaid and MP-cancelable order.
 let response;
 try{
  response=await fetch('https://api.mercadopago.com/v1/orders/'+encodeURIComponent(current.provider_order_id)+'/cancel',{
   method:'POST',headers:{Authorization:'Bearer '+env.KAIA_MP_PROD_ACCESS_TOKEN,
    'X-Idempotency-Key':current.id,Accept:'application/json'},
   signal:AbortSignal.timeout(9000)});
 }catch{return {row:current,autoCancelled:false};}
 // On 409 (e.g. a payment has just started), don't release inventory.
 if(!response.ok)return {row:current,autoCancelled:false};
 // Confirm final provider state BEFORE returning even a single unit to stock.
 const final=await provider(env,'/v1/orders/'+encodeURIComponent(current.provider_order_id));
 await reconcile(env,final,current);
 const latest=(await database(env,'kaia_commercial_payments?id=eq.'+encodeURIComponent(row.id)+'&select=*'))[0];
 return {row:latest,autoCancelled:latest?.status==='cancelled'};
}
