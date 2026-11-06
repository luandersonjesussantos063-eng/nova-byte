import {verifyMpWebhook} from '../mercado-pago-webhook.js';
import {CheckoutError,json,fail,gate,database,provider,reconcile} from './_core.js';
export async function onRequestPost({request,env}){
 try{
  gate(request,env,{webhook:true});
  if(!await verifyMpWebhook(request,env.KAIA_MP_PROD_WEBHOOK_SECRET))
    throw new CheckoutError('ASSINATURA_INVALIDA',401);
  if(Number(request.headers.get('content-length')||0)>16000)
    throw new CheckoutError('EVENTO_EXCESSIVO',413);
  const text=await request.text();
  if(text.length>16000)throw new CheckoutError('EVENTO_EXCESSIVO',413);
  let event;try{event=JSON.parse(text);}catch{throw new CheckoutError('JSON_INVALIDO',400);}
  const id=new URL(request.url).searchParams.get('data.id')||new URL(request.url).searchParams.get('data_id');
  if(!/^ORD[A-Z0-9]+$/i.test(id||'')||event?.live_mode===false||
   !['order','orders_v2'].includes(event.type)||event.data?.id!==id)
   throw new CheckoutError('EVENTO_INVALIDO',400);
  const match=await database(env,'kaia_commercial_payments?provider_order_id=eq.'+encodeURIComponent(id)+'&select=*');
  if(match.length!==1)throw new CheckoutError('PEDIDO_PROVEDOR_DESCONHECIDO',409);
  const row=match[0];
  const remote=await provider(env,'/v1/orders/'+encodeURIComponent(id));
  // Never trust status/amounts provided in the webhook itself.
  const rawEventId=event.id!=null?String(event.id):null;
  const headerRequestId=request.headers.get('x-request-id');
  const key=(rawEventId&&/^[a-zA-Z0-9_-]{1,80}$/.test(rawEventId)?'mp:'+rawEventId:
    headerRequestId&&/^[a-zA-Z0-9_-]{8,100}$/.test(headerRequestId)?'req:'+headerRequestId:null);
  if(!key)throw new CheckoutError('EVENTO_SEM_IDENTIFICADOR',400);
  const result=await reconcile(env,remote,row,key);
  return json({received:true,status:result.status});
 }catch(e){return fail(e);}
}
