import test from 'node:test';import assert from 'node:assert/strict';
import {onRequestGet} from '../../functions/api/kaia/admin-orders.js';
const origin='https://usekaiaglow.com.br/api/kaia/admin-orders';
const uid='11111111-1111-4111-8111-111111111111',pid='22222222-2222-4222-8222-222222222222';
const env={KAIA_MP_PROD_SUPABASE_SERVICE_KEY:'unit-test-only'};
function context(token,url=origin){return {request:new Request(url,{headers:token?{Authorization:'Bearer '+token}:{}}),env};}
const json=data=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
test('orders reject unauthenticated requests before accessing any records',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected access');};
 try{const res=await onRequestGet(context());assert.equal(res.status,401);assert.equal(res.headers.get('cache-control'),'no-store');}finally{globalThis.fetch=previous;}
});
test('orders reject a verified customer without administrative permission',async()=>{
 const previous=globalThis.fetch;let records=false;
 globalThis.fetch=async url=>{if(String(url).endsWith('/auth/v1/user'))return json({id:uid,email_confirmed_at:'2026-11-01'});if(String(url).endsWith('/rpc/kaia_is_store_admin'))return json(false);records=true;throw Error('Unauthorized record access');};
 try{assert.equal((await onRequestGet(context('customer-token'))).status,403);assert.equal(records,false);}finally{globalThis.fetch=previous;}
});
test('admin order listing is read-only, deduplicates confirmed purchases and limits returned fields',async()=>{
 const previous=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  url=String(url);calls.push([url,options.method||'GET']);
  if(url.endsWith('/auth/v1/user'))return json({id:uid,email_confirmed_at:'2026-11-01'});
  if(url.endsWith('/rpc/kaia_is_store_admin'))return json(true);
  assert.equal(options.method,'GET');
  assert(!url.includes('select=*'));
  if(url.includes('/kaia_commercial_payments?'))return json([{id:pid,user_id:uid,status:'approved',total_cents:10000,paid_amount_cents:10000,items:[{name:'Produto',quantity:2}],created_at:'2026-11-08T10:00:00Z',checkout_url:'never-return-this'}]);
  if(url.includes('/kaia_orders?'))return json([{id:'history',user_id:uid,order_number:'KG-'+pid.replaceAll('-',''),items:[],total_cents:10000,status:'confirmed'}]);
  if(url.includes('/kaia_customers?'))return json([{user_id:uid,full_name:'Cliente de teste',cpf:'never-return-this'}]);
  throw Error('Unexpected request');
 };
 try{const res=await onRequestGet(context('admin-token'));assert.equal(res.status,200);const data=await res.json();assert.equal(data.orders.length,1);assert.equal(data.orders[0].customer,'Cliente de teste');assert.equal(data.orders[0].items[0].quantity,2);assert(!JSON.stringify(data).includes('never-return'));assert(!JSON.stringify(data).includes('unit-test-only'));assert(calls.every(([u,m])=>m==='GET'||u.endsWith('/rpc/kaia_is_store_admin')));}finally{globalThis.fetch=previous;}
});
test('unsupported host is rejected before authentication',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=()=>{throw Error('Unexpected access');};try{assert.equal((await onRequestGet(context('admin','https://example.com/api/kaia/admin-orders'))).status,403);}finally{globalThis.fetch=previous;}
});
test('failed data access returns an explicit error without leaking records or credentials',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async url=>String(url).endsWith('/auth/v1/user')?json({id:uid,email_confirmed_at:'2026-11-01'}):String(url).endsWith('/rpc/kaia_is_store_admin')?json(true):new Response('private-database-details',{status:500});
 try{const res=await onRequestGet(context('admin'));assert.equal(res.status,503);const text=await res.text();assert(!text.includes('private-database'));assert(!text.includes('unit-test-only'));}finally{globalThis.fetch=previous;}
});
test('customer history validates its filter and applies it on both record sources',async()=>{
 const previous=globalThis.fetch;const requests=[];
 globalThis.fetch=async url=>{url=String(url);if(url.endsWith('/auth/v1/user'))return json({id:uid,email_confirmed_at:'2026-11-01'});if(url.endsWith('/rpc/kaia_is_store_admin'))return json(true);requests.push(url);return json([]);};
 try{assert.equal((await onRequestGet(context('admin',origin+'?customer=not-a-uuid'))).status,400);assert.equal(requests.length,0);assert.equal((await onRequestGet(context('admin',origin+'?customer='+uid))).status,200);assert.equal(requests.length,2);assert(requests.every(u=>u.includes('&user_id=eq.'+uid)));}finally{globalThis.fetch=previous;}
});
