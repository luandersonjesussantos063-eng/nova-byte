import {KAIA_AUTH} from '../../../../kaia-glow/auth-config.js';
// Kaia Glow, one-off production-only R$ 5.00 checkout. Server-side only.
// Checkout remains disabled unless KAIA_MP_REAL_R5_ENABLED === 'true'.
// Requires KAIA_MP_PROD_SUPABASE_SERVICE_KEY in Cloudflare Production.
// No secrets may be returned, logged or bundled in browser assets.
export const HOSTS=['usekaiaglow.com.br','www.usekaiaglow.com.br'];
export const PROJECT='https://vajlhodqxskozuxxlujv.supabase.co';
export const PRICE='5.00';
export const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}});
export class PaymentError extends Error{constructor(code,status=503){super(code);this.code=code;this.status=status;}}
export const fail=e=>response({code:e instanceof PaymentError?e.code:'PAGAMENTO_INDISPONIVEL'},e instanceof PaymentError?e.status:503);
export function assertConfig(request,env) {
 const u=new URL(request.url);
 if(u.protocol!=='https:'||!HOSTS.includes(u.hostname)||env.KAIA_MP_REAL_R5_ENABLED!=='true')
  throw new PaymentError('COMPRA_DESATIVADA');
 if(!env.KAIA_MP_PROD_ACCESS_TOKEN||!env.KAIA_MP_PROD_WEBHOOK_SECRET||!env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY)
  throw new PaymentError('CREDENCIAIS_PENDENTES');
}
export async function buyerAdmin(request,env) {
 const token=/^Bearer (.+)$/.exec(request.headers.get('Authorization')||'')?.[1];
 if(!token||token.length>4000)throw new PaymentError('ENTRE_COM_CONTA_ADMINISTRADORA',401);
 const config=await fetch(PROJECT+'/auth/v1/user',{headers:{apikey:KAIA_AUTH.publishableKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(6000)});
 if(!config.ok)throw new PaymentError('SESSAO_INVALIDA',401);
 const user=await config.json();
 if(!user.id||!user.email_confirmed_at)throw new PaymentError('EMAIL_NAO_CONFIRMADO',403);
 const check=await fetch(PROJECT+'/rest/v1/rpc/kaia_is_store_admin',{method:'POST',headers:{apikey:KAIA_AUTH.publishableKey,Authorization:'Bearer '+token,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(6000)});
 if(!check.ok||await check.json()!==true)throw new PaymentError('NAO_AUTORIZADO',403);
 return user.id;
}
export async function db(env,path,method='GET',payload) {
 const r=await fetch(PROJECT+'/rest/v1/'+path,{method,headers:{apikey:env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY,...(env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY.startsWith('eyJ')?{Authorization:'Bearer '+env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY}:{}),Accept:'application/json','content-type':'application/json',Prefer:'return=representation'},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(6000)});
 if(!r.ok)throw new PaymentError('REGISTRO_INDISPONIVEL');
 return r.json();
}
export async function row(env){
 const values=await db(env,'kaia_mp_live_pilot_orders?slot=eq.1&select=*');
 if(!Array.isArray(values)||values.length!==1)throw new PaymentError('COMPRA_NAO_PREPARADA');return values[0];
}
export async function mp(env,path,options={}){
 const r=await fetch('https://api.mercadopago.com'+path,{method:options.body?'POST':'GET',headers:{
 Authorization:'Bearer '+env.KAIA_MP_PROD_ACCESS_TOKEN,Accept:'application/json',
 ...(options.body?{'content-type':'application/json','X-Idempotency-Key':options.key}: {})},
 body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new PaymentError('MERCADO_PAGO_INDISPONIVEL',503);
 return r.json();
}
export function requireOrder(remote,record) {
 if(!remote||!/^ORD[A-Z0-9]+$/i.test(remote.id||'')||remote.live_mode!==true||
 remote.external_reference!==record.id||remote.type!=='online'||remote.currency!=='BRL'||
 String(remote.total_amount)!==PRICE)throw new PaymentError('ORDER_INCONSISTENTE',409);
 return remote;
}
export function paymentState(remote){
 if(remote.status==='processed'&&remote.status_detail==='accredited'&&Number(remote.total_paid_amount)===5)return 'approved';
 if(['created','processing','action_required'].includes(remote.status))return 'pending';
 if(remote.status==='failed')return 'rejected';
 if(remote.status==='canceled')return 'cancelled';
 return 'review_required';
}
export async function reconcile(env,remote,record){
 requireOrder(remote,record);
 if(record.provider_order_id&&remote.id!==record.provider_order_id)throw new PaymentError('ORDER_INCONSISTENTE',409);
 const state=paymentState(remote);
 if(record.status==='approved'&&state!=='approved')return {state:'review_required'};
 const existing=await row(env);
 if(existing.provider_order_id&&existing.provider_order_id!==remote.id)throw new PaymentError('ORDER_DIVERGENTE',409);
 const updated=await db(env,'kaia_mp_live_pilot_orders?slot=eq.1&status=neq.refunded','PATCH',{
  provider_order_id:remote.id,status:state,provider_status:String(remote.status||'').slice(0,60),
  provider_status_detail:String(remote.status_detail||'').slice(0,100),
  paid_amount_cents:Number(remote.total_paid_amount)==5?500:0,updated_at:new Date().toISOString()
 });
 if(!updated.length)throw new PaymentError('FALHA_PERSISTENCIA');
 return {state};
}
