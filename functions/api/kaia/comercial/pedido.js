import {CheckoutError,json,fail,gate,identity,accountAddress,parseItems,verifiedInventory,quote,database,provider,orderRow,reconcile,checkoutLink,money} from './_core.js';
import {synchronizeAndExpire,expirationTimestamp} from './_expiry.js';
const ORIGIN='https://usekaiaglow.com.br';
function itemsWithShipping(row){
 return [...row.items.map(i=>({title:i.name.slice(0,110),quantity:i.quantity,unit_price:money(i.unit_cents)})),
  {title:'Entrega - SuperFrete',quantity:1,unit_price:money(row.shipping_cents)}];
}
export async function onRequestPost({request,env}){
 try{
  gate(request,env);
  const url=new URL(request.url);
  if(request.headers.get('Origin')!==url.origin||
    !request.headers.get('content-type')?.startsWith('application/json')||
    Number(request.headers.get('content-length')||'0')>12000)throw new CheckoutError('REQUISICAO_INVALIDA',403);
  const user=await identity(request);
  const raw=await request.text();if(raw.length>12000)throw new CheckoutError('DADOS_EXCESSIVOS',413);
  let input;try{input=JSON.parse(raw);}catch{throw new CheckoutError('JSON_INVALIDO',422);}
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/.test(input?.requestKey||''))throw new CheckoutError('CHAVE_PEDIDO_INVALIDA',422);
  const items=parseItems(input);
  const {postalCode}=await accountAddress(env,user.id);
  if(!/^[0-9]{8}$/.test(String(input.postalCode||''))||input.postalCode!==postalCode)
   throw new CheckoutError('CEP_DIFERENTE_DO_CADASTRO',422);
  const serviceId=String(input.serviceId||'');
  // An existing request is never repriced or re-reserved. Reuse its immutable snapshot.
  let records=await database(env,'kaia_commercial_payments?user_id=eq.'+user.id+'&request_key=eq.'+input.requestKey+'&select=*');
  let row=records[0];
  if(!row){
   const verified=await verifiedInventory(env,items);
   const shipping=await quote(env,verified,postalCode,serviceId);
   const reserved=await database(env,'rpc/kaia_commercial_reserve',{method:'POST',body:{
    p_user_id:user.id,p_request_key:input.requestKey,p_items:items,
    p_shipping_cents:shipping.cents,p_shipping_service:shipping.serviceId,p_postal_code:postalCode
   }});
   row=await orderRow(env,reserved.id);
   // Keep the carrier's estimate alongside the immutable order snapshot for
   // confirmation emails. Failure to save optional ETA must not create a second
   // payment attempt or invalidate stock already reserved by the RPC.
   if(shipping.estimatedDays!==null){
    try{
     const saved=await database(env,'kaia_commercial_payments?id=eq.'+row.id+
      '&status=eq.created&shipping_estimated_days=is.null',{
      method:'PATCH',prefer:'return=representation',body:{
       shipping_estimated_days:shipping.estimatedDays,updated_at:new Date().toISOString()
      }
     });
     if(Array.isArray(saved)&&saved.length===1)row=saved[0];
    }catch{/* ETA is optional; checkout still uses server-verified price and shipping. */}
   }
  }
  if(row.user_id!==user.id)throw new CheckoutError('PEDIDO_NAO_AUTORIZADO',403);
  if(row.shipping_service!==serviceId||row.postal_code!==postalCode||
    row.items.length!==items.length||items.some(i=>!row.items.some(x=>x.sku===i.sku&&x.quantity===i.quantity)))
    throw new CheckoutError('SOLICITACAO_JA_USADA_EM_OUTRA_SACOLA',409);
  if(['approved','refunded','rejected','cancelled','review_required'].includes(row.status))
    throw new CheckoutError('PEDIDO_NAO_REABRIVEL',409);
  if(row.provider_order_id){
   const remote=await provider(env,'/v1/orders/'+encodeURIComponent(row.provider_order_id));
   await reconcile(env,remote,row);
   row=await orderRow(env,row.id);
   if(row.status!=='pending')throw new CheckoutError('PEDIDO_NAO_PENDENTE',409);
   return json({checkoutUrl:checkoutLink(row.checkout_url),id:row.id,totalCents:row.total_cents});
  }
  const returnPage=ORIGIN+'/pedido.html?pedido='+encodeURIComponent(row.id);
  const remote=await provider(env,'/v1/orders',{key:row.request_key,payload:{
   type:'online',processing_mode:'manual',expiration_time:'P1D',total_amount:money(row.total_cents),
   // Allow the buyer to choose an independent Mercado Pago account or checkout as guest.
   // Binding the store login email to a Mercado Pago collaborator can block checkout.
   external_reference:row.id,
   items:itemsWithShipping(row),
   config:{online:{success_url:returnPage+'&retorno=sucesso',
    failure_url:returnPage+'&retorno=falha',
    pending_url:returnPage+'&retorno=pendente',auto_return:'all'}}
  }});
  if(remote?.external_reference!==row.id||remote?.currency!=='BRL'||remote?.live_mode===false||
    remote?.total_amount!==money(row.total_cents)||!/^ORD[A-Z0-9]+$/i.test(remote.id||''))
    throw new CheckoutError('ORDER_PROVEDOR_DIVERGENTE',409);
  const link=checkoutLink(remote.checkout_url);
  const changed=await database(env,'kaia_commercial_payments?id=eq.'+row.id+'&provider_order_id=is.null',{
   method:'PATCH',prefer:'return=representation',body:{
    provider_order_id:remote.id,checkout_url:link,status:'pending',updated_at:new Date().toISOString()
   }});
  if(!changed.length){
   const fresh=await orderRow(env,row.id);
   if(fresh.provider_order_id!==remote.id)throw new CheckoutError('OUTRA_ORDER_CRIADA',409);
  }
  return json({checkoutUrl:link,id:row.id,totalCents:row.total_cents});
 }catch(e){return fail(e);}
}
export async function onRequestGet({request,env}){
 try{
  gate(request,env);
  const user=await identity(request);
  const id=new URL(request.url).searchParams.get('id');
  let row=await orderRow(env,id);
  if(row.user_id!==user.id)throw new CheckoutError('PEDIDO_NAO_AUTORIZADO',403);
  let autoCancelled=false;
  if(row.provider_order_id){
   const synced=await synchronizeAndExpire(env,row);
   row=synced.row;autoCancelled=synced.autoCancelled;
  }
  return json({id:row.id,status:row.status,productsCents:row.products_cents,shippingCents:row.shipping_cents,totalCents:row.total_cents,
    expiresAt:new Date(expirationTimestamp(row)).toISOString(),expired: autoCancelled,
    items:row.items.map(i=>({name:i.name,quantity:i.quantity,unitCents:i.unit_cents}))});
 }catch(e){return fail(e);}
}
