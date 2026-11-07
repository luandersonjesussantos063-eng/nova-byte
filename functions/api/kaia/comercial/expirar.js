// Cron-only scheduled sweep. Auth uses a hash of a secret stored in Supabase Vault.
// Never release stock merely because the clock has elapsed.
import {gate,json,fail,database,CheckoutError} from './_core.js';
import {synchronizeAndExpire} from './_expiry.js';
const SCHEDULE_KEY_SHA256='675b3806647ad3c91cd34fd9462643df28faf1832af657cb1a9e707da8aa459a';
async function authorize(request){
 const key=request.headers.get('X-Kaia-Cron-Key')||'';
 if(key.length!==64)throw new CheckoutError('NAO_AUTORIZADO',401);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
 const computed=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
 let diff=0;for(let i=0;i<computed.length;i++)diff|=computed.charCodeAt(i)^SCHEDULE_KEY_SHA256.charCodeAt(i);
 if(diff!==0)throw new CheckoutError('NAO_AUTORIZADO',401);
}
export async function onRequestPost({request,env}){
 try{
  gate(request,env);
  await authorize(request);
  const cutoff=new Date(Date.now()-60_000).toISOString();
  const candidates=await database(env,'kaia_commercial_payments?status=in.(created,pending)&created_at=lt.'+
   encodeURIComponent(cutoff)+'&select=*&order=created_at.asc&limit=12');
  let cancelled=0,held=0;
  for(const row of candidates){
   if(!row.provider_order_id){held++;continue;} // Never guess if MP order creation failed mid-flight.
   try{
    const outcome=await synchronizeAndExpire(env,row);
    if(outcome.autoCancelled)cancelled++;else held++;
   }catch{held++;} // Retry on the next scheduled run; keep stock reserved.
  }
  return json({checked:candidates.length,cancelled,held});
 }catch(e){return fail(e);}
}
