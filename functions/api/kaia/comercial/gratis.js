import {CheckoutError,json,fail,gate,identity,accountAddress,parseItems,verifiedInventory,quote,database} from './_core.js';
export async function onRequestPost({request,env}){
 try{
  gate(request,env);
  const url=new URL(request.url);
  if(request.headers.get('Origin')!==url.origin||
     !request.headers.get('content-type')?.startsWith('application/json')||
     Number(request.headers.get('content-length')||0)>12000)
   throw new CheckoutError('REQUISICAO_INVALIDA',403);
  const user=await identity(request);
  const raw=await request.text();
  if(raw.length>12000)throw new CheckoutError('DADOS_EXCESSIVOS',413);
  let data;try{data=JSON.parse(raw)}catch{throw new CheckoutError('JSON_INVALIDO',422)}
  const code=String(data?.coupon||'').trim().toUpperCase();
  if(!/^[A-Z0-9_-]{3,24}$/.test(code)||
    !/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/.test(data?.requestKey||''))
   throw new CheckoutError('CUPOM_OU_SOLICITACAO_INVALIDA',422);
  const items=parseItems({items:data.items});
  const {postalCode}=await accountAddress(env,user.id);
  if(data.postalCode!==postalCode)throw new CheckoutError('CEP_DIFERENTE_DO_CADASTRO',422);
  // Price, stock and carrier cost are re-read on the server, never trusted from the browser.
  const verified=await verifiedInventory(env,items);
  const shipping=await quote(env,verified,postalCode,String(data.serviceId||''));
  const response=await database(env,'rpc/kaia_commercial_redeem_free_coupon',{
   method:'POST',
   body:{p_user_id:user.id,p_request_key:data.requestKey,p_items:items,
     p_coupon_code:code,p_shipping_service:shipping.serviceId,
     p_list_shipping_cents:shipping.cents,p_postal_code:postalCode,
     p_shipping_estimated_days:shipping.estimatedDays}
  });
  if(!response?.id||response.status!=='approved')throw new CheckoutError('PEDIDO_NAO_CONFIRMADO',503);
  return json({id:response.id,status:'approved',freeOrder:true,totalCents:0,
    code:code,alreadyConfirmed:!!response.existing});
 }catch(e){return fail(e)}
}
