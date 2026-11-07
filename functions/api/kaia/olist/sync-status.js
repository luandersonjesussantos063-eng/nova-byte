// Read-only Olist automatic synchronization status for a verified store administrator.
import {buyerAdmin,db,PaymentError} from '../checkout-validacao/_core.js';
import {noStoreJson,errorJson} from './_oauth.js';
export async function onRequestGet({request,env}){
 try{
  const u=new URL(request.url);
  if(u.protocol!=='https:'||!['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(u.hostname))
   throw new PaymentError('AMBIENTE_INVALIDO',403);
  await buyerAdmin(request,env);
  const data=await db(env,'kaia_olist_sync_control?slot=eq.1&select=enabled,interval_minutes,last_run_at,last_success_at,last_changed,last_error,last_source_count');
  if(!Array.isArray(data)||data.length!==1)throw new PaymentError('SINCRONIZACAO_INDISPONIVEL',503);
  return noStoreJson({enabled:data[0].enabled===true,intervalMinutes:data[0].interval_minutes,
   lastRunAt:data[0].last_run_at,lastSuccessAt:data[0].last_success_at,
   lastChanged:data[0].last_changed,lastError:data[0].last_error,
   lastSourceCount:data[0].last_source_count,orderExportEnabled:false});
 }catch(e){return errorJson(e);}
}
