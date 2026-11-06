import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {onRequest as middleware} from '../../functions/_middleware.js';
import {onRequestPost as orders} from '../../functions/api/kaia/mp-test/orders.js';
import {onRequestPost as webhook} from '../../functions/api/kaia/mp-test/webhook.js';
import {onRequestGet as orderStatus,onRequestPost as cancelOrder} from '../../functions/api/kaia/mp-test/order.js';
import {parseIntent,testConfig,verifiedRows,verifyTestSeller,paymentState,boundedJson,quote} from '../../kaia-glow/backend/mp-test-core.js';
const env={KAIA_MP_TEST_ENABLED:'true',KAIA_MP_TEST_HOST:'qa.example.com',KAIA_TEST_SUPABASE_URL:'https://isolatedqa.supabase.co',
 KAIA_TEST_SUPABASE_SERVICE_KEY:'fixture-not-a-secret',KAIA_MP_TEST_DATABASE_ID:'fixture-database',KAIA_MP_TEST_ACCESS_TOKEN:'APP_USR-fixture',
 KAIA_MP_TEST_SELLER_ID:'123',KAIA_MP_TEST_BUYER_EMAIL:'buyer@testuser.com',KAIA_MP_WEBHOOK_SECRET:'fixture-hmac',
 KAIA_TEST_EMAIL_ALLOWLIST:'tester@example.com',KAIA_TEST_ACCESS_ISSUER:'https://fixture.cloudflareaccess.com',KAIA_TEST_ACCESS_AUD:'fixture-aud',
 KAIA_SF_MODE:'sandbox',KAIA_SF_SANDBOX_CONFIRMED:'true',KAIA_SF_SANDBOX_TOKEN:'fixture-sf',KAIA_MP_TEST_SF_SERVICES:'1',
 KAIA_SHIP_FROM_CEP:'01550000',KAIA_SHIPPING_TECH_CONTACT:'tester@example.com'};
const identity={kaiaTestIdentity:{sub:'tester-subject',email:'tester@example.com'}};
const intent={items:[{sku:'TEST-KAIA-BUNDLE',quantity:1}],destinoCep:'01001000',serviceId:'1',coupon:''};
function request(path='/api/kaia/mp-test/orders'){return new Request('https://qa.example.com'+path,{method:'POST'});}
async function signedWebhook(body){
 const id=body.data.id,ts=String(Date.now()),requestId='fixture-request';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.KAIA_MP_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`));
 return new Request('https://qa.example.com/api/kaia/mp-test/webhook?data.id='+id,{method:'POST',headers:{
 'x-request-id':requestId,'x-signature':`ts=${ts},v1=${Buffer.from(hash).toString('hex')}`},body:JSON.stringify(body)});
}
test('preview denies missing/forged JWT, production hosts and original production API routes',async()=>{
 const next=()=>{throw Error('Unexpected route execution');};
 assert.equal((await middleware({request:request('/'),env:{},data:{},next})).status,503);
 assert.equal((await middleware({request:request('/'),env,data:{},next})).status,403);
 assert.equal((await middleware({request:new Request('https://usekaiaglow.com.br/'),env,data:{},next})).status,503);
 assert.equal((await middleware({request:request('/api/kaia/frete'),env,data:{},next})).status,404);
 assert.equal((await middleware({request:request('/api/kaia/mp-test/webhook'),env,data:{},next})).status,401);
});
test('Access signature, expiry, audience and allowlist are validated with Web Crypto',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='fixture';
 const payload={iss:env.KAIA_TEST_ACCESS_ISSUER,aud:[env.KAIA_TEST_ACCESS_AUD],email:'tester@example.com',sub:'test-sub',exp:Date.now()/1000+60};
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 async function req(changes={},forged=false){
  const prefix=encode({alg:'RS256',kid:'fixture'})+'.'+encode({...payload,...changes});
  const sig=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(prefix))).toString('base64url');
  return new Request('https://qa.example.com/',{headers:{'cf-access-jwt-assertion':prefix+'.'+(forged?'AAAA':sig)}});
 }
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});
 try{
  const data={};const response=await middleware({request:await req(),env,data,next:()=>new Response('private lab')});
  assert.equal(response.status,200);assert.equal(data.kaiaTestIdentity.sub,'test-sub');assert.match(response.headers.get('cache-control'),/no-store/);
  for(const changes of [{aud:['wrong']},{email:'other@example.com'},{exp:0}])assert.equal((await middleware({request:await req(changes),env,data:{},next:()=>new Response('bad')})).status,403);
  assert.equal((await middleware({request:await req({},true),env,data:{},next:()=>new Response('bad')})).status,403);
 }finally{globalThis.fetch=original;}
});
test('real SKUs, browser amounts, missing verified prices and production DB are blocked',()=>{
 assert.throws(()=>parseIntent({...intent,items:[{sku:'KG-MED-ZEROPAD2-70P',quantity:1}]}),/ITEM_INVALIDO/);
 assert.deepEqual(parseIntent({...intent,total:1,discount:10000,shipping:0}),intent);
 assert.throws(()=>verifiedRows(intent.items,[{sku:intent.items[0].sku,price_cents:null}]),/PENDENTE/);
 assert.throws(()=>testConfig(request(),{...env,KAIA_TEST_SUPABASE_URL:'https://vajlhodqxskozuxxlujv.supabase.co'}),/SEGREDOS/);
});
test('APP_USR prefix alone cannot authorize a production seller',async()=>{
 await assert.rejects(verifyTestSeller(env,async()=>Response.json({id:123,tags:[]})),/CONTA_TESTE/);
 await verifyTestSeller(env,async()=>Response.json({id:123,tags:['test_user']}));
});
test('body limits and HMAC reject malformed or unsigned webhooks before database access',async()=>{
 await assert.rejects(boundedJson(new Request('https://qa.example.com',{method:'POST',body:'x'.repeat(17000)})),/EXCESSIVOS/);
 assert.equal((await webhook({request:request('/api/kaia/mp-test/webhook'),env})).status,401);
 const live=await signedWebhook({type:'order',live_mode:true,data:{id:'ORDTSTLOCAL1'}});
 assert.equal((await webhook({request:live,env})).status,400);
});
test('states require full accredited payment and shipping never falls back to production',async()=>{
 assert.equal(paymentState({status:'processed',status_detail:'accredited',total_paid_amount:'12.00',total_amount:'12.00'}),'approved');
 for(const status of ['created','processing','action_required'])assert.equal(paymentState({status}),'pending');
 assert.equal(paymentState({status:'failed'}),'rejected');assert.equal(paymentState({status:'canceled'}),'cancelled');
 assert.throws(()=>paymentState({status:'refunded'}),/REVISAO/);
 await assert.rejects(quote({...env,KAIA_SF_MODE:'production'},intent,[]),/FRETE_TESTE/);
 await assert.rejects(quote({...env,KAIA_SF_SANDBOX_CONFIRMED:'false'},intent,[]),/FRETE_TESTE/);
});
test('build requires explicit QA flag and generated assets contain no production integrations',async()=>{
 assert.throws(()=>execFileSync(process.execPath,['scripts/build-kaia-site.mjs'],{cwd:new URL('../../',import.meta.url),env:{PATH:process.env.PATH},stdio:'pipe'}));
 execFileSync(process.execPath,['scripts/build-kaia-site.mjs'],{cwd:new URL('../../',import.meta.url),env:{PATH:process.env.PATH,KAIA_MP_PREVIEW_BUILD:'true'},stdio:'pipe'});
 for(const file of ['index.html','lab.js','robots.txt','_headers','_worker.js']){
  const content=await readFile(new URL('../../dist/kaia-glow/'+file,import.meta.url),'utf8');
  if(file!=='_worker.js')assert.doesNotMatch(content,/vajlhodqxskozuxxlujv|fermfbmhwlafwopwndoj/);
  assert.doesNotMatch(content,/eyJhbGci|https:\/\/api\.superfrete\.com|https:\/\/vajlhodqxskozuxxlujv/);
 }
 assert.deepEqual(JSON.parse(await readFile(new URL('../../dist/kaia-glow/_routes.json',import.meta.url))),{version:1,include:['/*'],exclude:[]});
});
test('HTTP flow + real local PostgreSQL: timeout recovery, server totals, coupon, authentic GET and duplicate webhook',{skip:!process.env.KAIA_TEST_DATABASE_URL},async()=>{
 const dsn=new URL(process.env.KAIA_TEST_DATABASE_URL);
 assert.equal(dsn.hostname,'127.0.0.1');assert.equal(dsn.port,'55432');assert.equal(dsn.pathname,'/kaia_mp_qa');
 const client=new pg.Client({connectionString:dsn.href});await client.connect();
 const original=globalThis.fetch;
 try{
  for(const role of ['anon','authenticated','service_role']){
   const exists=(await client.query('select 1 from pg_roles where rolname=$1',[role])).rowCount;
   if(!exists)await client.query('create role '+role+(role==='service_role'?' bypassrls':''));
  }
  await client.query(await readFile(new URL('../../supabase/kaia-mp-test/001_isolated_test_database.sql',import.meta.url),'utf8'));
  await client.query(await readFile(new URL('../../supabase/kaia-mp-test/002_synthetic_test_fixtures.sql',import.meta.url),'utf8'));
  if(!(await client.query("select to_regclass('kaia_mp_test.environment') as t")).rows[0].t)
   await client.query(await readFile(new URL('../../supabase/kaia-mp-test/migrations/20261106171915_kaia_homologacao_checkout.sql',import.meta.url),'utf8'));
  if(!(await client.query("select to_regprocedure('public.kaia_qa_owned(uuid,text)') as t")).rows[0].t)
   await client.query(await readFile(new URL('../../supabase/kaia-mp-test/migrations/20261106174850_kaia_qa_owned_order.sql',import.meta.url),'utf8'));
  const marker=(await client.query('select database_id from kaia_mp_test.environment')).rows[0].database_id;
  const e={...env,KAIA_MP_TEST_DATABASE_ID:marker},key=crypto.randomUUID();
  const starting=(await client.query("select total_units from kaia_mp_test.test_catalog where sku='TEST-KAIA-BUNDLE'")).rows[0].total_units;
  let lostResponse=true,remote=null,status='created',detail='created',gets=0;const posts=[],cancelKeys=[];
  globalThis.fetch=async(url,options={})=>{
   const u=new URL(url),body=options.body?JSON.parse(options.body):{};
   if(u.pathname.startsWith('/rest/v1/rpc/')){
    const name=u.pathname.split('/').at(-1),names=Object.keys(body);
    assert.match(name,/^kaia_qa_[a-z_]+$/);
    await client.query('set role service_role');
    try{
     const q=await client.query('select public.'+name+'('+names.map((n,i)=>n+'=> $'+(i+1)).join(',')+') as result',Object.entries(body).map(([n,v])=>n==='p_skus'?v:v&&typeof v==='object'?JSON.stringify(v):v));
     return Response.json(q.rows[0].result);
    }catch{return Response.json({error:'fixture-db-rejected'}, {status:409});}
    finally{await client.query('reset role');}
   }
   if(u.pathname==='/users/me')return Response.json({id:123,tags:['test_user']});
   if(u.hostname==='sandbox.superfrete.com')return Response.json([{id:1,price:'10.00'}]);
   if(u.hostname==='api.mercadopago.com'&&u.pathname.endsWith('/cancel')){
    cancelKeys.push(options.headers['X-Idempotency-Key']);status='canceled';detail='canceled';
    throw Error('lost cancel response after provider cancellation');
   }
   if(u.hostname==='api.mercadopago.com'&&options.method==='POST'){
    posts.push({key:options.headers['X-Idempotency-Key'],body});
    remote={id:remote?.id||'ORDTST'+crypto.randomUUID().replaceAll('-','').toUpperCase(),external_reference:body.external_reference,
     currency:'BRL',type:'online',total_amount:body.total_amount,checkout_url:''};
    remote.checkout_url='https://www.mercadopago.com.br/checkout/v1/redirect?order_id='+remote.id;
    if(lostResponse){lostResponse=false;throw Error('lost provider response');}
    return Response.json(remote);
   }
   if(u.hostname==='api.mercadopago.com'&&options.method==='GET'){
    gets++;return Response.json({...remote,status,status_detail:detail,total_paid_amount:status==='processed'?remote.total_amount:'0.00'});
   }
   throw Error('Unexpected HTTP fixture call');
  };
  const checkout=()=>new Request('https://qa.example.com/api/kaia/mp-test/orders',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':key},
   body:JSON.stringify({...intent,coupon:'TEST-TEN',total:1})});
  assert.equal((await orders({request:checkout(),env:e,data:identity})).status,503);
  const retried=await orders({request:checkout(),env:e,data:identity});assert.equal(retried.status,201);
  assert.deepEqual(posts[0],posts[1]);assert.equal(posts[0].body.total_amount,'32.50');
  assert.match(posts[0].body.config.online.success_url,/^https:\/\/qa.example.com\/\?local_order=/);
  assert.equal(posts[0].body.config.online.auto_return,'all');
  const ownRequest=()=>new Request('https://qa.example.com/api/kaia/mp-test/order?id='+remote.external_reference+'&status=approved');
  assert.equal((await orderStatus({request:ownRequest(),env:e,data:{kaiaTestIdentity:{sub:'other',email:'tester@example.com'}}})).status,404);
  const browserReturn=await orderStatus({request:ownRequest(),env:e,data:identity});
  assert.equal((await browserReturn.json()).status,'pending');
  const event=()=>signedWebhook({type:'order',live_mode:false,data:{id:remote.id,status:'processed',total_amount:'0.01'}});
  assert.equal((await webhook({request:await event(),env:e})).status,200);
  assert.equal((await client.query('select payment_status from kaia_mp_test.checkout_orders where idempotency_key=$1',[key])).rows[0].payment_status,'pending');
  status='processed';detail='accredited';
  const approvedReturn=await orderStatus({request:ownRequest(),env:e,data:identity});
  const returnState=await approvedReturn.json();assert.equal(returnState.status,'pending');assert.equal(returnState.providerStatus,'approved');assert.equal(returnState.awaitingWebhook,true);
  assert.equal((await client.query("select total_units from kaia_mp_test.test_catalog where sku='TEST-KAIA-BUNDLE'")).rows[0].total_units,starting);
  assert.equal((await webhook({request:await event(),env:e})).status,200);
  assert.equal((await webhook({request:await event(),env:e})).status,200);
  assert.equal(gets,5);
  assert.equal((await client.query("select total_units from kaia_mp_test.test_catalog where sku='TEST-KAIA-BUNDLE'")).rows[0].total_units,starting-1);
  // A paid order cannot be canceled through the unpaid-order API.
  assert.equal((await cancelOrder({request:new Request(ownRequest(),{method:'POST'}),env:e,data:identity})).status,409);
  const cancelKey=crypto.randomUUID();remote=null;status='created';detail='created';
  const cancellable=await orders({request:new Request('https://qa.example.com/api/kaia/mp-test/orders',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':cancelKey},body:JSON.stringify(intent)}),env:e,data:identity});
  assert.equal(cancellable.status,201);
  const cancelRequest=()=>new Request('https://qa.example.com/api/kaia/mp-test/order?id='+remote.external_reference,{method:'POST'});
  assert.equal((await cancelOrder({request:cancelRequest(),env:e,data:identity})).status,503);
  const cancelled=await cancelOrder({request:cancelRequest(),env:e,data:identity});assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).status,'cancelled');
  assert.equal((await cancelOrder({request:cancelRequest(),env:e,data:identity})).status,200);
  assert.equal(cancelKeys.length,1);assert.notEqual(cancelKeys[0],cancelKey);
  const finalStock=(await client.query("select total_units,reserved_units from kaia_mp_test.test_catalog where sku='TEST-KAIA-BUNDLE'")).rows[0];
  assert.equal(finalStock.total_units,starting-1);assert.equal(finalStock.reserved_units,0);
  await client.query('set role anon');await assert.rejects(client.query('select public.kaia_qa_environment()'),/permission denied/);
  await client.query('reset role');
 }finally{globalThis.fetch=original;await client.end();}
});
