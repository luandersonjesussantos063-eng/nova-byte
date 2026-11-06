import {verifyMpWebhook} from '../mercado-pago-webhook.js';
import {CheckoutError,reply,fail,boundedJson,testConfig,databaseGuard,mpCall,validateOrder,reconcile} from '../../../../kaia-glow/backend/mp-test-core.js';
export async function onRequestPost({request,env}){
 try{
  testConfig(request,env);
  if(!env.KAIA_MP_TEST_WEBHOOK_SECRET)throw new CheckoutError('WEBHOOK_TESTE_PENDENTE',503);
  if(!await verifyMpWebhook(request,env.KAIA_MP_TEST_WEBHOOK_SECRET))throw new CheckoutError('ASSINATURA_INVALIDA',401);
  const event=await boundedJson(request),id=new URL(request.url).searchParams.get('data.id')||new URL(request.url).searchParams.get('data_id');
  if(event.live_mode!==false||!['order','orders_v2'].includes(event.type)||event.data?.id!==id||
   !/^ORDTST[A-Z0-9]+$/.test(id||''))throw new CheckoutError('EVENTO_TESTE_INVALIDO',400);
  await databaseGuard(env);
  // Never trust event.data.status, amounts or external_reference; use authenticated GET.
  const remote=validateOrder(await mpCall(env,'/'+encodeURIComponent(id)),id);
  await reconcile(env,remote);
  return reply({received:true,test:true});
 }catch(error){return fail(error);}
}
