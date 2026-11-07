import {CheckoutError,json,fail,gate,identity,accountAddress,parseItems,verifiedInventory,quote,database,provider,orderRow,reconcile,checkoutLink,money} from './_core.js';
const ORIGIN='https://usekaiaglow.com.br';
function itemsWithShipping(row){
 // With coupons, MP must receive the exact discounted total. The immutable
 // cart details and per-item original prices remain in the server-side order.
 if(row.coupon_code){
  const items=[];
  if(row.products_cents>0)items.push({title:'Produtos Kaia Glow - desconto aplicado',
   quantity:1,unit_price:money(row.products_cents)});
  if(row.shipping_cents>0)items.push({title:'Entrega - SuperFrete',
   quantity:1,unit_price:money(row.shipping_cents)});
  return items;
 }
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
  const couponCode=String(input.coupon||'').trim().toUpperCase();
  if(couponCode&&!/^[A-Z0-9_-]{3,24}$/.test(couponCode))
   throw new CheckoutError('CUPOM_INVALIDO',422);
  // An existing request is never repriced or re-reserved. Reuse its immutable snapshot.
  let records=await database(env,'kaia_commercial_payments?user_id=eq.'+user.id+'&request_key=eq.'+input.requestKey+'&select=*');
  let row=records[0];
  if(!row){
   const verified=await verifiedInventory(env,items);
   const shipping=await quote(env,verified,postalCode,serviceId);
   const endpoint=couponCode?'rpc/kaia_commercial_reserve_discounted':'rpc/kaia_commercial_reserve';
   const body={
    p_user_id:user.id,p_request_key:input.requestKey,p_items:items,
    p_shipping_cents:shipping.cents,p_shipping_service:shipping.serviceId,p_postal_code:postalCode
   };
   if(couponCode){body.p_coupon_code=couponCode;body.p_delivery_days=shipping.deliveryDays;}
   const reserved=await database(env,endpoint,{method:'POST',body});
   row=await orderRow(env,reserved.id);
   // ETA is advisory. Missing carrier estimate must never mark shipping as
   // scheduled; the delivery email will say "to be confirmed".
   if(!couponCode&&shipping.deliveryDays){
    await database(env,'kaia_commercial_payments?id=eq.'+row.id+
     '&shipping_estimated_days=is.null',{method:'PATCH',body:{
      shipping_estimated_days:shipping.deliveryDays
     }});
    row.shipping_estimated_days=shipping.deliveryDays;
   }
  }
  if(row.user_id!==user.id)throw new CheckoutError('PEDIDO_NAO_AUTORIZADO',403);
  if((row.coupon_code||'')!==couponCode)
   throw new CheckoutError('CUPOM_DIFERENTE_DA_SOLICITACAO',409);
  if(row.shipping_service!==serviceId||row.postal_code!==postalCode||
    row.items.length!==items.length||items.some(i=>!row.items.some(x=>x.sku===i.sku&&x.quantity===i.quantity)))
    throw new CheckoutError('SOLICITACAO_JA_USADA_EM_OUTRA_SACOLA',409);
  if(row.status==='approved'&&row.total_cents===0&&
    row.coupon_code===couponCode&&row.provider_order_id===null)
   return json({id:row.id,totalCents:0,complimentary:true,
    status:'approved',checkoutUrl:null});
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
  if(row.provider_order_id){
   const remote=await provider(env,'/v1/orders/'+encodeURIComponent(row.provider_order_id));
   await reconcile(env,remote,row);
   row=await orderRow(env,id);
  }
  return json({id:row.id,status:row.status,productsCents:row.products_cents,shippingCents:row.shipping_cents,totalCents:row.total_cents,
    couponCode:row.coupon_code||null,discountCents:row.discount_cents||0,
    complimentary:row.total_cents===0&&row.status==='approved',
    deliveryBusinessDays:row.shipping_estimated_days||null,
    items:row.items.map(i=>({name:i.name,quantity:i.quantity,unitCents:i.unit_cents}))});
 }catch(e){return fail(e);}
}
