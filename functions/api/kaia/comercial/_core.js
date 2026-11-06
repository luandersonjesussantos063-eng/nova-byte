// Kaia Glow — commercial checkout. Production-only, off by default.
// Never trust customer-supplied prices, addresses, shipping prices or order statuses.
import {KAIA_AUTH} from '../../../../kaia-glow/auth-config.js';
export const PROJECT='https://vajlhodqxskozuxxlujv.supabase.co';
export class CheckoutError extends Error{constructor(code,status=409){super(code);this.code=code;this.status=status;}}
export const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow'}});
export const fail=e=>json({code:e instanceof CheckoutError?e.code:'CHECKOUT_INDISPONIVEL'},e instanceof CheckoutError?e.status:503);
export const money=n=>(n/100).toFixed(2);
export function gate(request,env,{webhook=false}={}){
 const u=new URL(request.url);
 if(u.protocol!=='https:'||!['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(u.hostname))throw new CheckoutError('AMBIENTE_INVALIDO',403);
 if(env.KAIA_MP_COMMERCIAL_ENABLED!=='true')throw new CheckoutError('CHECKOUT_NAO_LIBERADO',503);
 if(!env.KAIA_MP_PROD_ACCESS_TOKEN||!env.KAIA_MP_PROD_WEBHOOK_SECRET||!env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY)throw new CheckoutError('CREDENCIAIS_INCOMPLETAS',503);
}
function serviceHeaders(env){
 const key=env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY;
 if(!key)throw new CheckoutError('BANCO_INDISPONIVEL',503);
 return {apikey:key,...(key.startsWith('eyJ')?{Authorization:'Bearer '+key}:{}),'content-type':'application/json',Accept:'application/json'};
}
export async function database(env,path,{body,method='GET',prefer}={}){
 let r;try{r=await fetch(PROJECT+'/rest/v1/'+path,{method,headers:{...serviceHeaders(env),...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(7000)});}catch{throw new CheckoutError('BANCO_SEM_RESPOSTA',503);}
 if(!r.ok)throw new CheckoutError('BANCO_NAO_CONCLUIU_OPERACAO',503);
 return r.json();
}
export async function identity(request){
 const token=/^Bearer (.+)$/.exec(request.headers.get('Authorization')||'')?.[1];
 if(!token||token.length>4096)throw new CheckoutError('ENTRE_NA_CONTA',401);
 const r=await fetch(PROJECT+'/auth/v1/user',{headers:{apikey:KAIA_AUTH.publishableKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw new CheckoutError('SESSAO_INVALIDA',401);
 const u=await r.json();
 if(!u?.id||!u.email_confirmed_at||!u.email)throw new CheckoutError('CONFIRME_O_EMAIL',403);
 return {id:u.id,email:u.email};
}
export async function accountAddress(env,userId){
 const rows=await database(env,'kaia_customer_details?user_id=eq.'+encodeURIComponent(userId)+'&select=postal_code,street,street_number,complement,neighborhood,city,state');
 const d=rows?.[0];
 if(!d||!/^[0-9]{8}$/.test(String(d.postal_code).replace(/\D/g,''))||!d.street||!d.street_number||!d.city||!d.state)
  throw new CheckoutError('COMPLETE_SEU_ENDERECO',422);
 return {postalCode:String(d.postal_code).replace(/\D/g,''),address:d};
}
export function parseItems(data){
 if(!data||!Array.isArray(data.items)||data.items.length<1||data.items.length>12||data.coupon)
  throw new CheckoutError('SACOLA_INVALIDA',422);
 const seen=new Set();let total=0;
 const rows=data.items.map(r=>{
  const sku=r?.sku,quantity=r?.quantity;
  if(!/^KG-[A-Z0-9-]{4,90}$/.test(sku||'')||!Number.isSafeInteger(quantity)||quantity<1||quantity>10||seen.has(sku))
   throw new CheckoutError('ITEM_INVALIDO',422);
  seen.add(sku);total+=quantity;return {sku,quantity};
 });
 if(total>24)throw new CheckoutError('SACOLA_EXCEDE_LIMITE',422);
 return rows.sort((a,b)=>a.sku.localeCompare(b.sku));
}
export async function verifiedInventory(env,items){
 const skus=items.map(x=>'"'+x.sku+'"').join(',');
 const rows=await database(env,'kaia_sale_inventory?sku=in.('+encodeURIComponent(skus)+')&select=sku,display_name,sale_price_cents,available_units,price_verified_at,stock_verified_at,package_verified_at,weight_grams,length_cm,width_cm,height_cm');
 const cohort=await database(env,'kaia_sales_launch_cohort?sku=in.('+encodeURIComponent(skus)+')&select=sku,is_enabled');
 const enabled=new Set(cohort.filter(x=>x.is_enabled===true).map(x=>x.sku));
 return items.map(i=>{
  const p=rows.find(x=>x.sku===i.sku);
  if(!p||!enabled.has(i.sku)||!Number.isInteger(p.sale_price_cents)||p.sale_price_cents<100||
   !p.price_verified_at||!p.stock_verified_at||!p.package_verified_at||p.available_units<i.quantity||
   !['weight_grams','length_cm','width_cm','height_cm'].every(k=>Number(p[k])>0))
   throw new CheckoutError('PRODUTO_SEM_LIBERACAO_OU_ESTOQUE',409);
  return {...p,quantity:i.quantity};
 });
}
export async function quote(env,items,postalCode,serviceId){
 if(env.KAIA_SHIPPING_PROVIDER!=='superfrete'||env.KAIA_SF_MODE!=='production'||!env.KAIA_SF_ACCESS_TOKEN||
  !/^\d{8}$/.test(env.KAIA_SHIP_FROM_CEP||'')||!env.KAIA_SHIPPING_TECH_CONTACT)
  throw new CheckoutError('FRETE_NAO_CONFIGURADO',503);
 const services=(env.KAIA_SF_SERVICES||'').split(',').map(s=>s.trim());
 if(!services.includes(serviceId))throw new CheckoutError('SERVICO_FRETE_INVALIDO',422);
 const packages=items.map(i=>({quantity:i.quantity,weight:Math.max(0.01,Number(i.weight_grams)/1000),
   length:Math.max(13,Number(i.length_cm)),width:Math.max(8,Number(i.width_cm)),
   height:Math.max(1,Number(i.height_cm))}));
 const payload={from:{postal_code:env.KAIA_SHIP_FROM_CEP},to:{postal_code:postalCode},
   services:serviceId,products:packages,
   options:{receipt:false,own_hand:false,use_insurance_value:false,insurance_value:0}};
 let r;try{r=await fetch('https://api.superfrete.com/api/v0/calculator',{method:'POST',headers:{
  Authorization:'Bearer '+env.KAIA_SF_ACCESS_TOKEN,'content-type':'application/json',
  Accept:'application/json','User-Agent':'KaiaGlow/1.0 ('+env.KAIA_SHIPPING_TECH_CONTACT+')'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});}catch{throw new CheckoutError('FRETE_INDISPONIVEL',503);}
 if(!r.ok)throw new CheckoutError('COTACAO_RECUSADA',503);
 const offers=await r.json();const selected=Array.isArray(offers)?offers.find(x=>String(x.id)===serviceId&&x.has_error!==true):null;
 const cents=Math.round(Number(selected?.price)*100);
 if(!Number.isSafeInteger(cents)||cents<=0||cents>1000000)throw new CheckoutError('SEM_FRETE_VALIDO',422);
 return {cents,serviceId};
}
export async function provider(env,path,{payload,key}={}){
 let r;try{r=await fetch('https://api.mercadopago.com'+path,{method:payload?'POST':'GET',
 headers:{Authorization:'Bearer '+env.KAIA_MP_PROD_ACCESS_TOKEN,Accept:'application/json',
 ...(payload?{'content-type':'application/json','X-Idempotency-Key':key}:{})},
 body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(9000)});}catch{throw new CheckoutError('MERCADO_PAGO_SEM_RESPOSTA',503);}
 if(!r.ok)throw new CheckoutError('MERCADO_PAGO_INDISPONIVEL',503);
 return r.json();
}
export async function orderRow(env,id){
 if(!/^[0-9a-f-]{36}$/.test(id||''))throw new CheckoutError('PEDIDO_INVALIDO',400);
 const rows=await database(env,'kaia_commercial_payments?id=eq.'+encodeURIComponent(id)+'&select=*');
 if(rows.length!==1)throw new CheckoutError('PEDIDO_NAO_ENCONTRADO',404);
 return rows[0];
}
function parseMoney(s){if(typeof s!=='string'||!/^\d+(\.\d{1,2})?$/.test(s))throw new CheckoutError('VALOR_INVALIDO',409);const [a,b='']=s.split('.');return Number(a)*100+Number(b.padEnd(2,'0'));}
export async function reconcile(env,remote,row,eventKey){
 if(!remote||!/^ORD[A-Z0-9]+$/i.test(remote.id||'')||remote.live_mode===false||
   remote.type!=='online'||remote.external_reference!==row.id||remote.currency!=='BRL')
    throw new CheckoutError('ORDER_DIVERGENTE',409);
 const cents=parseMoney(remote.total_amount),paid=parseMoney(remote.total_paid_amount||'0.00');
 if(cents!==row.total_cents||paid>cents)throw new CheckoutError('VALOR_DIVERGENTE',409);
 let status;
 if(remote.status==='processed'&&remote.status_detail==='accredited'&&paid===cents)status='approved';
 else if(['created','processing','action_required'].includes(remote.status))status='pending';
 else if(remote.status==='failed')status='rejected';
 else if(remote.status==='canceled')status='cancelled';
 else status='review_required';
 return database(env,'rpc/kaia_commercial_reconcile',{method:'POST',body:{
  p_id:row.id,p_provider_order_id:remote.id,p_total:cents,p_paid:paid,p_new_status:status,
  p_provider_status:String(remote.status||''),p_detail:String(remote.status_detail||''),p_event_key:eventKey||null
 }});
}
export const checkoutLink=raw=>{const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='www.mercadopago.com.br'||!u.pathname.startsWith('/checkout/'))throw new CheckoutError('URL_CHECKOUT_INVALIDA',503);return u.toString();};
