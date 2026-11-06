import {CheckoutError,reply,fail,boundedJson,testConfig,databaseGuard,tester,parseIntent,
 fingerprint,dbCall,verifiedRows,quote,mpCall,validateOrder,money,verifyTestSeller} from '../../../../kaia-glow/backend/mp-test-core.js';
export async function onRequestPost({request,env,data}){
 try{
  testConfig(request,env);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)throw new CheckoutError('ORIGEM_INVALIDA',403);
  const user=tester(data,env);await databaseGuard(env);
  const key=request.headers.get('x-idempotency-key')||'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw new CheckoutError('CHAVE_IDEMPOTENCIA_INVALIDA',422);
  const intent=parseIntent(await boundedJson(request)),hash=await fingerprint(intent);
  let order=await dbCall(env,'kaia_qa_find',{p_key:key,p_owner:user.id,p_hash:hash});
  if(!order){
   const inventory=await dbCall(env,'kaia_qa_catalog',{p_skus:intent.items.map(i=>i.sku)});
   const rows=verifiedRows(intent.items,inventory),shipping=await quote(env,intent,rows);
   order=await dbCall(env,'kaia_qa_prepare',{p_key:key,p_owner:user.id,p_hash:hash,
    p_items:intent.items.map(i=>({sku:i.sku,qty:i.quantity})),p_snapshot:rows,
    p_shipping:shipping.amount,p_coupon:intent.coupon,p_email:env.KAIA_MP_TEST_BUYER_EMAIL});
  }
  if(order.provider_order_id)return reply({id:order.id,status:order.payment_status,checkout_url:order.checkout_url,test:true});
  // Never risk recreating an old ambiguous attempt after provider idempotency retention.
  if(Date.now()-Date.parse(order.created_at)>3600000)throw new CheckoutError('TENTATIVA_REQUER_RECONCILIACAO');
  // All values and the payer email come from the frozen, server-authorized record.
  const items=[{title:'Kaia Glow — produtos do pedido de teste',quantity:1,unit_price:money(order.subtotal_cents-order.discount_cents)}];
  items.push({title:'Frete SuperFrete — homologação',quantity:1,unit_price:money(order.shipping_cents)});
  await verifyTestSeller(env);
  const back='https://'+env.KAIA_MP_TEST_HOST+'/?local_order='+encodeURIComponent(order.id);
  const payload=await dbCall(env,'kaia_qa_freeze_payload',{p_id:order.id,p_owner:user.id,
   p_payload:{type:'online',processing_mode:'manual',total_amount:money(order.total_cents),
    external_reference:order.id,payer:{email:order.payer_email},items,
    config:{online:{success_url:back,failure_url:back,pending_url:back,auto_return:'all'}}}});
  const remote=validateOrder(await mpCall(env,'',payload,order.idempotency_key));
  if(remote.external_reference!==order.id||remote.total_amount!==money(order.total_cents))throw new CheckoutError('ORDER_DIVERGENTE');
  const checkout=new URL(remote.checkout_url);
  if(checkout.origin!=='https://www.mercadopago.com.br'||checkout.pathname!=='/checkout/v1/redirect'||
   checkout.searchParams.get('order_id')!==remote.id)throw new CheckoutError('REDIRECIONAMENTO_INVALIDO');
  const stored=await dbCall(env,'kaia_qa_bind',{p_id:order.id,p_provider:remote.id,p_url:checkout.href});
  return reply({id:stored.id,status:stored.payment_status,checkout_url:stored.checkout_url,test:true},201);
 }catch(error){return fail(error);}
}
