// Test-only integration. No production credential fallback or public checkout wiring.
export class CheckoutError extends Error {
 constructor(code,status=409){super(code);this.code=code;this.status=status;}
}
export const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}});
export function fail(error){return reply({code:error instanceof CheckoutError?error.code:'TESTE_INDISPONIVEL'},error instanceof CheckoutError?error.status:503);}
export async function boundedJson(source,max=16000){
 if(!source.body)throw new CheckoutError('JSON_INVALIDO',400);
 const reader=source.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
 if(size>max){await reader.cancel();throw new CheckoutError('DADOS_EXCESSIVOS',413);}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new CheckoutError('JSON_INVALIDO',400);}
}
export function testConfig(request,env){
 const url=new URL(request.url);
 if(env.KAIA_MP_TEST_ENABLED!=='true'||url.protocol!=='https:'||
 !env.KAIA_MP_TEST_HOST||url.hostname!==env.KAIA_MP_TEST_HOST||
 ['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(url.hostname))throw new CheckoutError('TESTE_DESABILITADO',503);
 const db=new URL(env.KAIA_TEST_SUPABASE_URL||'https://invalid');
 if(db.protocol!=='https:'||!/^([a-z0-9]+)\.supabase\.co$/.test(db.hostname)||
 ['vajlhodqxskozuxxlujv.supabase.co','fermfbmhwlafwopwndoj.supabase.co'].includes(db.hostname)||db.pathname!=='/'||db.search||db.username||db.password||
 !env.KAIA_TEST_SUPABASE_SERVICE_KEY||!env.KAIA_MP_TEST_DATABASE_ID||
 !env.KAIA_MP_TEST_ACCESS_TOKEN||!/^\d+$/.test(env.KAIA_MP_TEST_SELLER_ID||'')||!/@testuser\.com$/.test(env.KAIA_MP_TEST_BUYER_EMAIL||''))throw new CheckoutError('SEGREDOS_TESTE_PENDENTES',503);
 return db.origin;
}
export async function dbCall(env,path,body,fetcher=fetch){
 const response=await fetcher(env.KAIA_TEST_SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/rpc/'+path,{
 method:'POST',headers:{apikey:env.KAIA_TEST_SUPABASE_SERVICE_KEY,
 Authorization:'Bearer '+env.KAIA_TEST_SUPABASE_SERVICE_KEY,'content-type':'application/json'},
 body:JSON.stringify(body||{}),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new CheckoutError('BANCO_RECUSOU_OPERACAO',409);
 return boundedJson(response,128000);
}
export async function databaseGuard(env,fetcher=fetch){
 const config=await dbCall(env,'kaia_qa_environment',{},fetcher);
 if(config?.purpose!=='kaia-homologacao-only'||config.database_id!==env.KAIA_MP_TEST_DATABASE_ID)
 throw new CheckoutError('BANCO_TESTE_NAO_CONFIRMADO',503);
}
export function tester(data,env){
 const identity=data?.kaiaTestIdentity;
 if(!identity?.sub||!identity.email||!(env.KAIA_TEST_EMAIL_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).includes(identity.email.toLowerCase()))
 throw new CheckoutError('USUARIO_TESTE_NAO_AUTORIZADO',403);
 return {id:identity.sub};
}
export async function verifyTestSeller(env,fetcher=fetch){
 const r=await fetcher('https://api.mercadopago.com/users/me',{headers:{Authorization:'Bearer '+env.KAIA_MP_TEST_ACCESS_TOKEN},signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw new CheckoutError('CONTA_TESTE_NAO_CONFIRMADA',503);
 const seller=await boundedJson(r);
 if(String(seller.id)!==env.KAIA_MP_TEST_SELLER_ID||!Array.isArray(seller.tags)||!seller.tags.includes('test_user'))
 throw new CheckoutError('CONTA_TESTE_NAO_CONFIRMADA',503);
}
export function parseIntent(data){
 if(!data||!Array.isArray(data.items)||!data.items.length||data.items.length>24||
 !/^\d{8}$/.test(data.destinoCep||'')||!/^\d{1,3}$/.test(data.serviceId||''))throw new CheckoutError('DADOS_INVALIDOS',422);
 const items=data.items.map(i=>{
 if(!/^TEST-KAIA-[A-Z0-9-]{2,45}$/.test(i.sku||'')||!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>24)
 throw new CheckoutError('ITEM_INVALIDO',422);
 return {sku:i.sku,quantity:i.quantity};}).sort((a,b)=>a.sku.localeCompare(b.sku));
 if(new Set(items.map(i=>i.sku)).size!==items.length||items.reduce((s,i)=>s+i.quantity,0)>24)
 throw new CheckoutError('QUANTIDADE_INVALIDA',422);
 const coupon=String(data.coupon||'').trim().toUpperCase();
 if(!/^[A-Z0-9_-]{0,40}$/.test(coupon))throw new CheckoutError('CUPOM_INVALIDO',422);
 // Deliberately discard browser prices, discounts, shipping amounts, email and status.
 return {items,destinoCep:data.destinoCep,serviceId:data.serviceId,coupon};
}
export async function fingerprint(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function cents(value){
 if(typeof value!=='string'||!/^\d+(\.\d{1,2})?$/.test(value))throw new CheckoutError('VALOR_PROVEDOR_INVALIDO');
 const [whole,decimal='']=value.split('.');const n=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n>100000000)throw new CheckoutError('VALOR_PROVEDOR_INVALIDO');return n;
}
export const money=n=>(n/100).toFixed(2);
export function verifiedRows(items,rows){
 return items.map(i=>{const p=rows.find(p=>p.sku===i.sku);
 if(!p||!p.price_verified||!p.package_verified||
 !Number.isSafeInteger(p.price_cents)||p.price_cents<=0||
 !Number.isSafeInteger((p.total_units-p.reserved_units))||(p.total_units-p.reserved_units)<i.quantity||
 !['weight_grams','length_cm','width_cm','height_cm'].every(k=>Number(p[k])>0))
 throw new CheckoutError('CADASTRO_OU_ESTOQUE_PENDENTE');return {...p,quantity:i.quantity};});
}
export async function quote(env,intent,rows,fetcher=fetch){
 if(env.KAIA_SF_SANDBOX_CONFIRMED!=='true'||env.KAIA_SF_MODE!=='sandbox'||!env.KAIA_SF_SANDBOX_TOKEN||
 !/^\d{8}$/.test(env.KAIA_SHIP_FROM_CEP||'')||!env.KAIA_SHIPPING_TECH_CONTACT||
 !(env.KAIA_MP_TEST_SF_SERVICES||'').split(',').includes(intent.serviceId))throw new CheckoutError('FRETE_TESTE_PENDENTE',503);
 const r=await fetcher('https://sandbox.superfrete.com/api/v0/calculator',{method:'POST',headers:{
 Authorization:'Bearer '+env.KAIA_SF_SANDBOX_TOKEN,'content-type':'application/json',
 'User-Agent':'KaiaGlowTest/1.0 ('+env.KAIA_SHIPPING_TECH_CONTACT+')'},
 body:JSON.stringify({from:{postal_code:env.KAIA_SHIP_FROM_CEP},to:{postal_code:intent.destinoCep},
 services:intent.serviceId,products:rows.map(p=>({quantity:p.quantity,weight:p.weight_grams/1000,
 length:Number(p.length_cm),width:Number(p.width_cm),height:Number(p.height_cm)})),
 options:{receipt:false,own_hand:false,use_insurance_value:false,insurance_value:0}}),signal:AbortSignal.timeout(6000)});
 if(!r.ok)throw new CheckoutError('FRETE_TESTE_INDISPONIVEL',503);
 const options=await boundedJson(r,64000);
 const q=Array.isArray(options)&&options.find(q=>String(q.id)===intent.serviceId&&q.has_error!==true);
 if(!q)throw new CheckoutError('FRETE_SEM_MODALIDADE');
 const amount=cents(String(q.price));if(amount<=0)throw new CheckoutError('FRETE_INVALIDO');
 return {amount,serviceId:intent.serviceId,quotedAt:new Date().toISOString()};
}
export async function mpCall(env,path,body,key,fetcher=fetch){
 const r=await fetcher('https://api.mercadopago.com/v1/orders'+path,{
 method:body?'POST':'GET',headers:{Authorization:'Bearer '+env.KAIA_MP_TEST_ACCESS_TOKEN,
 'content-type':'application/json',...(key?{'X-Idempotency-Key':key}:{})},
 body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(6000)});
 if(!r.ok)throw new CheckoutError('MERCADO_PAGO_TESTE_INDISPONIVEL',503);
 return boundedJson(r,128000);
}
export function validateOrder(order,expectedId){
 if(!order||!/^ORDTST[A-Z0-9]+$/.test(order.id||'')||(expectedId&&order.id!==expectedId)||
 order.live_mode===true||order.currency!=='BRL'||order.type!=='online'||
 !/^[0-9a-f-]{36}$/.test(order.external_reference||''))throw new CheckoutError('ORDER_TESTE_INVALIDA');
 cents(order.total_amount);return order;
}
export function paymentState(order){
 if(order.status==='processed'&&order.status_detail==='accredited'&&cents(order.total_paid_amount)===cents(order.total_amount))return 'approved';
 if(['created','processing','action_required'].includes(order.status))return 'pending';
 if(order.status==='failed')return 'rejected';
 if(order.status==='canceled')return 'cancelled';
 // Refunds/partial refunds need a separate audited workflow; never restock automatically.
 throw new CheckoutError('ESTADO_REQUER_REVISAO',409);
}
export async function reconcile(env,order,fetcher=fetch){
 validateOrder(order);
 const state=paymentState(order);
 return dbCall(env,'kaia_qa_reconcile',{p_id:order.external_reference,p_provider:order.id,
 p_total:cents(order.total_amount),p_state:state,p_event:order.id+':'+state},fetcher);
}
