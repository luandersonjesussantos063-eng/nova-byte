import {verifyMpWebhook} from '../mercado-pago-webhook.js';
import {response,PaymentError,fail,assertConfig,row,mp,requireOrder,reconcile,db} from './_core.js';

// Note: this is the single R$5 validation order webhook, not the future
// inventory/fulfilment webhook for regular retail orders.
async function logAuthenticatedEvent(env,event,id,state,request) {
  const eventId=event?.id==null?'':String(event.id);
  const reqId=request.headers.get('x-request-id')||'';
  if(!/^[0-9]{1,30}$/.test(eventId) && !/^[a-z0-9-]{8,100}$/i.test(reqId))
    throw new PaymentError('EVENTO_SEM_IDENTIFICADOR',400);
  const key=(eventId?'mp:'+eventId:'req:'+reqId).slice(0,120);
  const url='kaia_mp_live_pilot_events?on_conflict=provider_event_key';
  const r=await fetch('https://vajlhodqxskozuxxlujv.supabase.co/rest/v1/'+url,{
    method:'POST',
    headers:{
      apikey:env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY,
      ...(env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY.startsWith('eyJ')?{Authorization:'Bearer '+env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY}:{}),
      'content-type':'application/json',Accept:'application/json',
      Prefer:'resolution=ignore-duplicates,return=representation'
    },
    body:JSON.stringify({provider_event_key:key,provider_order_id:id,event_state:state}),
    signal:AbortSignal.timeout(6000)
  });
  if(!r.ok)throw new PaymentError('AUDITORIA_WEBHOOK_PENDENTE');
}
export async function onRequestPost({request,env}){
 try{
  assertConfig(request,env);
  if(!(await verifyMpWebhook(request,env.KAIA_MP_PROD_WEBHOOK_SECRET)))
    throw new PaymentError('ASSINATURA_INVALIDA',401);
  if(Number(request.headers.get('content-length')||0)>16000)
    throw new PaymentError('EVENTO_EXCESSIVO',413);
  const raw=await request.text();
  if(raw.length>16000)throw new PaymentError('EVENTO_EXCESSIVO',413);
  let event;
  try{event=JSON.parse(raw);}catch{throw new PaymentError('EVENTO_INVALIDO',400);}
  const id=new URL(request.url).searchParams.get('data.id')||new URL(request.url).searchParams.get('data_id');
  if(event?.live_mode===false||!['order','orders_v2'].includes(event.type)||
    String(event.data?.id)!==id||!/^ORD[A-Z0-9]+$/i.test(id||''))
    throw new PaymentError('EVENTO_INVALIDO',400);
  const record=await row(env);
  if(!record.provider_order_id||record.provider_order_id!==id)
    throw new PaymentError('ORDER_DESCONHECIDA',409);
  // The signed event alone never asserts a payment status. Read the provider.
  const remote=requireOrder(await mp(env,'/v1/orders/'+encodeURIComponent(id)),record);
  const result=await reconcile(env,remote,record);
  // 200 only after persisted reconciliation AND deduplicated event log.
  await logAuthenticatedEvent(env,event,id,result.state,request);
  return response({received:true,state:result.state});
 }catch(e){return fail(e);}
}
