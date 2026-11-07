import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parseIntent,verifiedRows,paymentState,validateOrder,testConfig,cents,quote} from '../../kaia-glow/backend/mp-test-core.js';
import {onRequestPost as createOrder} from '../../functions/api/kaia/mp-test/orders.js';
import {onRequestPost as webhook} from '../../functions/api/kaia/mp-test/webhook.js';
import {onRequestPost as publicCheckout,} from '../../functions/api/kaia/checkout.js';
import {verifyMpWebhook} from '../../functions/api/kaia/mercado-pago-webhook.js';
const user='00000000-0000-4000-8000-000000000001';
const row={sku:'KG-TEST-ONE',display_name:'Fixture — not a sale price',sale_price_cents:10001,available_units:3,
 weight_grams:300,length_cm:17,width_cm:11,height_cm:4,price_verified_at:'2026-11-06',stock_verified_at:'2026-11-06',package_verified_at:'2026-11-06'};
const intent={items:[{sku:row.sku,quantity:1}],destinoCep:'01001000',serviceId:'1',coupon:''};
const env={KAIA_MP_TEST_ENABLED:'true',KAIA_MP_TEST_HOST:'test.example.com',KAIA_MP_TEST_SUPABASE_URL:'https://isolatedtest.supabase.co',
 KAIA_MP_TEST_SUPABASE_SERVICE_ROLE_KEY:'fixture-not-a-secret',KAIA_MP_TEST_DATABASE_ID:'fixture-database',KAIA_MP_TEST_ACCESS_TOKEN:'TEST-fixture',
 KAIA_MP_TEST_WEBHOOK_SECRET:'fixture-signing-key',KAIA_MP_TEST_USER_IDS:user};
const request=()=>new Request('https://test.example.com/api/kaia/mp-test/orders',{method:'POST'});
const remote=(id,status='created',detail='created')=>({id:'ORDTSTLOCAL1',external_reference:id,type:'online',currency:'BRL',
 status,status_detail:detail,total_amount:'110.01',total_paid_amount:status==='processed'?'110.01':'0.00',
 checkout_url:'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORDTSTLOCAL1'});
async function signedEvent(id,body={type:'order',live_mode:false,data:{id}}){
 const ts=String(Date.now()),reqId='fixture-request';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.KAIA_MP_TEST_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`id:${id.toLowerCase()};request-id:${reqId};ts:${ts};`));
 const hex=Buffer.from(hash).toString('hex');
 return new Request('https://test.example.com/api/kaia/mp-test/webhook?data.id='+id,{method:'POST',headers:{
 'x-request-id':reqId,'x-signature':`ts=${ts},v1=${hex}`},body:JSON.stringify(body)});
}
async function dbSetup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key);
 create table public.kaia_sale_inventory(sku text primary key,display_name text,sale_price_cents integer,available_units integer,
 weight_grams integer,length_cm numeric,width_cm numeric,height_cm numeric,price_verified_at timestamptz,
 stock_verified_at timestamptz,package_verified_at timestamptz,updated_at timestamptz default now());
 create table public.kaia_admin_coupons(code text primary key,discount_type text,discount_value integer,min_order_cents integer,
 starts_at date,ends_at date,active boolean);`);
 const schema=await readFile(new URL('../../kaia-glow/backend/mp-test/supabase/migrations/20261106164208_kaia_mp_test_orders.sql',import.meta.url),'utf8');
 await assert.rejects(db.exec(schema),/acknowledgement/);await db.exec('rollback');
 await db.exec(`set kaia.test_database='true'`);await db.exec(schema);
 await db.query('insert into auth.users values($1)',[user]);
 await db.query(`insert into public.kaia_sale_inventory(sku,display_name,sale_price_cents,available_units,weight_grams,
 length_cm,width_cm,height_cm,price_verified_at,stock_verified_at,package_verified_at)
 values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,Object.values(row));
 return db;
}
async function prepare(db,{key=crypto.randomUUID(),coupon='',quantity=1,hash='a'.repeat(64),snapshot=[row]}={}){
 return (await db.query('select public.kaia_mp_test_prepare($1,$2,$3,$4,$5,$6,$7) as o',[
 key,user,hash,JSON.stringify({...intent,coupon,items:[{sku:row.sku,quantity}]}),JSON.stringify(snapshot),1000,'fixture@example.com'])).rows[0].o;
}
test('public checkout and test environment fail closed',async()=>{
 assert.equal(publicCheckout().status,503);
 assert.throws(()=>testConfig(request(),{}),/TESTE_DESABILITADO/);
 assert.throws(()=>testConfig(request(),{...env,KAIA_MP_TEST_SUPABASE_URL:'https://vajlhodqxskozuxxlujv.supabase.co'}),/SEGREDOS/);
 assert.throws(()=>testConfig(request(),{...env,KAIA_MP_TEST_ACCESS_TOKEN:'APP_USR-fixture'}),/SEGREDOS/);
 assert.equal((await createOrder({request:request(),env:{}})).status,503);
 assert.equal((await createOrder({request:request(),env})).status,401);
});
test('browser amounts are discarded; absent verified prices never fall back',()=>{
 assert.deepEqual(parseIntent({...intent,price:1,total:1,shipping:0,status:'aprovado'}),intent);
 assert.throws(()=>parseIntent({...intent,items:[...intent.items,...intent.items]}),/QUANTIDADE/);
 assert.throws(()=>verifiedRows(intent.items,[{...row,sale_price_cents:null,reference_price_cents:1}]),/PENDENTE/);
 assert.throws(()=>verifiedRows(intent.items,[{...row,package_verified_at:null}]),/PENDENTE/);
 assert.equal(cents('110.01'),11001);assert.throws(()=>cents('1e2'));
});
test('Orders status mapping validates full payment and test resource identity',()=>{
 assert.equal(paymentState(remote(user,'processed','accredited')),'aprovado');
 for(const status of ['created','processing','action_required'])assert.equal(paymentState(remote(user,status)),'pendente');
 assert.equal(paymentState(remote(user,'failed')),'recusado');assert.equal(paymentState(remote(user,'canceled')),'cancelado');
 assert.throws(()=>paymentState(remote(user,'refunded','refunded')),/REVISAO/);
 assert.throws(()=>paymentState({...remote(user,'processed','accredited'),total_paid_amount:'1.00'}),/REVISAO/);
 assert.throws(()=>validateOrder({...remote(user),id:'ORDLIVE1'}),/INVALIDA/);
 assert.throws(()=>validateOrder({...remote(user),currency:'USD'}),/INVALIDA/);
});
test('shipping calls sandbox only and selects server quote',async()=>{
 const quoteEnv={...env,KAIA_MP_TEST_SF_MODE:'sandbox',KAIA_MP_TEST_SF_ACCESS_TOKEN:'fixture',
 KAIA_SHIP_FROM_CEP:'01550000',KAIA_SHIPPING_TECH_CONTACT:'fixture@example.com',KAIA_MP_TEST_SF_SERVICES:'1'};
 const q=await quote(quoteEnv,intent,[{...row,quantity:1}],async(url,options)=>{
 assert.equal(url,'https://sandbox.superfrete.com/api/v0/calculator');
 const body=JSON.parse(options.body);assert.equal(body.products[0].weight,0.3);
 return Response.json([{id:1,price:'17.77',has_error:false}]);});
 assert.equal(q.amount,1777);
 await assert.rejects(quote({...quoteEnv,KAIA_MP_TEST_SF_MODE:'production'},intent,[row]),/FRETE_TESTE_PENDENTE/);
});
test('HMAC accepts signed request and rejects altered signature/body IDs',async()=>{
 const req=await signedEvent('ORDTSTLOCAL1');assert.equal(await verifyMpWebhook(req,env.KAIA_MP_TEST_WEBHOOK_SECRET),true);
 const invalid=await signedEvent('ORDTSTLOCAL1');invalid.headers.set('x-signature','ts=1234567890,v1='+'0'.repeat(64));
 assert.equal((await webhook({request:invalid,env})).status,401);
 const mismatched=await signedEvent('ORDTSTLOCAL1',{type:'order',live_mode:false,data:{id:'ORDTSTOTHER'}});
 assert.equal((await webhook({request:mismatched,env})).status,400);
 const live=await signedEvent('ORDTSTLOCAL1',{type:'order',live_mode:true,data:{id:'ORDTSTLOCAL1'}});
 assert.equal((await webhook({request:live,env})).status,400);
});
test('transactional reservation, coupons, idempotency and exactly-once stock',async()=>{
 const db=await dbSetup();
 try{
  const key=crypto.randomUUID(),o=await prepare(db,{key,quantity:2});
  assert.equal(o.total_cents,21002);assert.equal(o.status,'pendente');
  assert.equal((await prepare(db,{key,quantity:2})).id,o.id);
  await assert.rejects(prepare(db,{key,hash:'b'.repeat(64)}),/CONFLICT/);
  await assert.rejects(prepare(db,{quantity:2}),/OUT_OF_STOCK/);
  const approve=()=>db.query('select public.kaia_mp_test_reconcile($1,$2,$3,$4) as o',[o.id,'ORDTSTLOCAL1',o.total_cents,'aprovado']);
  await assert.rejects(db.query('select public.kaia_mp_test_reconcile($1,$2,$3,$4)',[o.id,'ORDTSTLOCAL1',1,'aprovado']),/MISMATCH/);
  await approve();await approve();
  assert.equal((await db.query('select available_units from public.kaia_sale_inventory')).rows[0].available_units,1);
  await db.query('select public.kaia_mp_test_reconcile($1,$2,$3,$4)',[o.id,'ORDTSTLOCAL1',o.total_cents,'pendente']);
  assert.equal((await db.query('select status from public.kaia_mp_test_orders where id=$1',[o.id])).rows[0].status,'aprovado');
  await db.exec("insert into public.kaia_admin_coupons values('TEST10','percent',10,1000,null,null,true)");
  const discounted=await prepare(db,{coupon:'TEST10'});assert.equal(discounted.discount_cents,1000);assert.equal(discounted.total_cents,10001);
  await db.query('select public.kaia_mp_test_reconcile($1,$2,$3,$4)',[discounted.id,'ORDTSTLOCAL2',discounted.total_cents,'recusado']);
  const cancelled=await prepare(db);await db.query('select public.kaia_mp_test_reconcile($1,$2,$3,$4)',[cancelled.id,'ORDTSTLOCAL3',cancelled.total_cents,'cancelado']);
  assert.equal((await db.query('select available_units from public.kaia_sale_inventory')).rows[0].available_units,1);
  await assert.rejects(prepare(db,{snapshot:[{...row,weight_grams:1}]}),/SNAPSHOT/);
  await assert.rejects(prepare(db,{coupon:'MISSING'}),/COUPON/);
  await db.exec('update public.kaia_sale_inventory set sale_price_cents=null');
  await assert.rejects(prepare(db),/UNVERIFIED/);
  await db.exec('set role anon');await assert.rejects(db.query('select * from public.kaia_mp_test_orders'),/permission denied/);
  await assert.rejects(db.query('select public.kaia_mp_test_find($1,$2,$3)',[key,user,'a'.repeat(64)]),/permission denied/);
 }finally{await db.close();}
});
test('routes recover provider timeout with same key; authenticated lookup overrides event and duplicates',async()=>{
 const db=await dbSetup(),originalFetch=globalThis.fetch;
 const databaseId=(await db.query('select database_id from public.kaia_mp_test_config')).rows[0].database_id;
 const testEnv={...env,KAIA_MP_TEST_DATABASE_ID:databaseId,KAIA_MP_TEST_SF_MODE:'sandbox',
 KAIA_MP_TEST_SF_ACCESS_TOKEN:'fixture',KAIA_SHIP_FROM_CEP:'01550000',
 KAIA_SHIPPING_TECH_CONTACT:'fixture@example.com',KAIA_MP_TEST_SF_SERVICES:'1'};
 const key=crypto.randomUUID(),providerRequests=[];let currentOrder=null;let timeout=true;
 let authoritativeStatus='created',authoritativeDetail='created';let getCalls=0;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url),body=options.body?JSON.parse(options.body):null;
  if(u.pathname==='/auth/v1/user')return Response.json({id:user,email:'fixture@example.com',email_confirmed_at:'2026-11-06'});
  if(u.pathname==='/rest/v1/kaia_mp_test_config')return Response.json([{database_id:databaseId}]);
  if(u.pathname==='/rest/v1/kaia_sale_inventory')return Response.json((await db.query('select * from public.kaia_sale_inventory')).rows);
  if(u.pathname.startsWith('/rest/v1/rpc/')){
   const name=u.pathname.split('/').at(-1),names=Object.keys(body);
   try{return Response.json((await db.query('select public.'+name+'('+names.map((n,i)=>n+'=> $'+(i+1)).join(',')+') as o',
     Object.values(body).map(v=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].o);}
   catch{return Response.json({code:'fixture-database-error'}, {status:409});}
  }
  if(u.hostname==='sandbox.superfrete.com')return Response.json([{id:1,price:'10.00'}]);
  if(u.hostname==='api.mercadopago.com'&&options.method==='POST'){
   providerRequests.push({key:options.headers['X-Idempotency-Key'],body});
   currentOrder=remote(body.external_reference);
   if(timeout){timeout=false;throw new Error('Simulated lost response AFTER provider created order');}
   return Response.json(currentOrder);
  }
  if(u.hostname==='api.mercadopago.com'&&options.method==='GET'){
   getCalls++;return Response.json(remote(currentOrder.external_reference,authoritativeStatus,authoritativeDetail));
  }
  throw Error('Unexpected fixture request');
 };
 const checkoutRequest=()=>new Request('https://test.example.com/api/kaia/mp-test/orders',{method:'POST',headers:{
  authorization:'Bearer fixture-session','x-idempotency-key':key,'content-type':'application/json'},
  body:JSON.stringify({...intent,total:1,price:1,frete:0})});
 try{
  assert.equal((await createOrder({request:checkoutRequest(),env:testEnv})).status,503);
  assert.equal((await createOrder({request:checkoutRequest(),env:testEnv})).status,201);
  assert.equal(providerRequests.length,2);assert.deepEqual(providerRequests[0],providerRequests[1]);
  assert.equal(providerRequests[0].key,key);assert.equal(providerRequests[0].body.total_amount,'110.01');
  assert.equal(providerRequests[0].body.processing_mode,'manual');
  assert.equal((await db.query('select count(*)::int as n from public.kaia_mp_test_orders')).rows[0].n,1);
  // An event claiming approval must remain pending while GET still returns created.
  const claimed={type:'order',live_mode:false,data:{id:currentOrder.id,status:'processed',status_detail:'accredited',total_amount:'0.01'}};
  assert.equal((await webhook({request:await signedEvent(currentOrder.id,claimed),env:testEnv})).status,200);
  assert.equal((await db.query('select status from public.kaia_mp_test_orders')).rows[0].status,'pendente');
  authoritativeStatus='processed';authoritativeDetail='accredited';
  assert.equal((await webhook({request:await signedEvent(currentOrder.id),env:testEnv})).status,200);
  assert.equal((await webhook({request:await signedEvent(currentOrder.id),env:testEnv})).status,200);
  assert.equal(getCalls,3);
  assert.equal((await db.query('select available_units from public.kaia_sale_inventory')).rows[0].available_units,2);
  assert.equal((await db.query('select status from public.kaia_mp_test_orders')).rows[0].status,'aprovado');
 }finally{globalThis.fetch=originalFetch;await db.close();}
});
test('SECURITY INVOKER RPCs work with service_role and coupon read-only grant',async()=>{
 const db=await dbSetup();
 try{
  await db.exec("insert into public.kaia_admin_coupons values('READONLY','fixed',500,0,null,null,true)");
  await db.exec('grant usage on schema public to service_role; set role service_role');
  const o=await prepare(db,{coupon:'READONLY'});assert.equal(o.discount_cents,500);
  await db.query('select public.kaia_mp_test_reconcile($1,$2,$3,$4)',[o.id,'ORDTSTROLE1',o.total_cents,'aprovado']);
  assert.equal((await db.query('select available_units from public.kaia_sale_inventory')).rows[0].available_units,2);
  await assert.rejects(db.exec("update public.kaia_admin_coupons set active=false"),/permission denied/);
 }finally{await db.close();}
});
