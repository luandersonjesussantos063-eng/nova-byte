import {verifyMpWebhook} from '../mercado-pago-webhook.js';
import {response,PaymentError,fail,assertConfig,row,mp,requireOrder,reconcile} from './_core.js';
export async function onRequestPost({request,env}){
 try{
  assertConfig(request,env);
  if(!(await verifyMpWebhook(request,env.KAIA_MP_PROD_WEBHOOK_SECRET)))throw new PaymentError('ASSINATURA_INVALIDA',401);
  if(Number(request.headers.get('content-length')||0)>16000)throw new PaymentError('EVENTO_EXCESSIVO',413);
  const raw=await request.text();
  if(raw.length>16000)throw new PaymentError('EVENTO_EXCESSIVO',413);
  let event;try{event=JSON.parse(raw);}catch{throw new PaymentError('EVENTO_INVALIDO',400);}
  const id=new URL(request.url).searchParams.get('data.id')||new URL(request.url).searchParams.get('data_id');
  if(event?.live_mode!==true||!['order','orders_v2'].includes(event.type)||
   String(event.data?.id)!==id||!/^ORD[A-Z0-9]+$/i.test(id||''))throw new PaymentError('EVENTO_INVALIDO',400);
  const record=await row(env);
  if(!record.provider_order_id||record.provider_order_id!==id)throw new PaymentError('ORDER_DESCONHECIDA',409);
  const remote=requireOrder(await mp(env,'/v1/orders/'+encodeURIComponent(id)),record);
  const result=await reconcile(env,remote,record);
  return response({received:true,state:result.state});
 }catch(e){return fail(e);}
}
