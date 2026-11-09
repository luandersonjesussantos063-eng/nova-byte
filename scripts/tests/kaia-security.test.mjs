import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {onRequest} from '../../functions/_middleware.js';
import {verifyMpWebhook} from '../../functions/api/kaia/mercado-pago-webhook.js';
globalThis.crypto??=webcrypto;
test('streamed excessive bodies are rejected before any endpoint runs',async()=>{
 let called=false;
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(20000));c.enqueue(new Uint8Array(20000));c.close();}});
 const request=new Request('https://usekaiaglow.com.br/api/kaia/comercial/pedido',{method:'POST',body,duplex:'half'});
 const r=await onRequest({request,next:()=>{called=true;throw Error('must not run');}});
 assert.equal(r.status,413);assert.equal(called,false);
});
test('security middleware preserves signed payload bytes and response headers',async()=>{
 const payload='{"data":{"id":"ORD123"}}';
 const request=new Request('https://usekaiaglow.com.br/api/kaia/comercial/webhook',{method:'POST',body:payload,headers:{'x-signature':'signature'}});
 const r=await onRequest({request,next:async forwarded=>{
  assert.equal(await forwarded.text(),payload);assert.equal(forwarded.headers.get('x-signature'),'signature');
  return new Response('ok',{status:202,headers:{'x-endpoint':'preserved'}});
 }});
 assert.equal(r.status,202);assert.equal(await r.text(),'ok');assert.equal(r.headers.get('x-endpoint'),'preserved');
 assert.equal(r.headers.get('cache-control'),'no-store');assert(r.headers.get('content-security-policy').includes("frame-ancestors 'self'"));
 assert(r.headers.get('strict-transport-security').includes('15552000'));
});
test('published CSP permits shipped executable inline scripts and rejects arbitrary inline scripts',()=>{
 const headers=readFileSync('dist/kaia-glow/_headers','utf8');
 assert(headers.split('\n').every(l=>l.length<=2000));assert(!headers.includes("script-src 'self' 'unsafe-inline'"));assert(!headers.includes("'unsafe-eval'"));
 for(const page of ['pedido.html','liberacao-vendas.html','compra-validacao.html']){
  const html=readFileSync('dist/kaia-glow/'+page,'utf8');
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   if(/\bsrc=|application\/ld\+json/i.test(m[1]))continue;
   assert(headers.includes("'sha256-"+createHash('sha256').update(m[2]).digest('base64')+"'"),page);
  }
 }
 assert(!headers.includes(createHash('sha256').update('alert(document.cookie)').digest('base64')));
});
test('Mercado Pago signature rejects forged and modified notifications',async()=>{
 const secret='test-secret-only',id='ord123',rid='test-request',ts='1794220000000';
 const text=`id:${id};request-id:${rid};ts:${ts};`;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))).toString('hex');
 const headers={'x-request-id':rid,'x-signature':`ts=${ts},v1=${hash}`};
 assert.equal(await verifyMpWebhook(new Request('https://usekaiaglow.com.br/api/kaia/comercial/webhook?data.id=ORD123',{headers}),secret),true);
 assert.equal(await verifyMpWebhook(new Request('https://usekaiaglow.com.br/api/kaia/comercial/webhook?data.id=ORD456',{headers}),secret),false);
 assert.equal(await verifyMpWebhook(new Request('https://usekaiaglow.com.br/api/kaia/comercial/webhook?data.id=ORD123'),secret),false);
});
