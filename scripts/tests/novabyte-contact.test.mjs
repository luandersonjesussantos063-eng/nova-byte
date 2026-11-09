import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {onRequestPost,onRequestOptions} from '../../functions/api/novabyte/contact.js';
globalThis.crypto??=webcrypto;
const origin='https://novabytesolucoes.com.br';
const env={NOVABYTE_TURNSTILE_SECRET:'test-turnstile-secret',NOVABYTE_CONTACT_RESEND_KEY:'test-email-key',KAIA_MP_PROD_SUPABASE_SERVICE_KEY:'test-service-key'};
const input={captchaToken:'one-use-token-12345',honeypot:'',requestKey:'ad35220d-9d4b-489c-a4f6-1780e0cdef5b',fields:{name:'Cliente teste',email:'test@example.com',phone:'',service:'Site',message:'Mensagem de teste do formulário'}};
const request=(data=input,source=origin)=>new Request('https://kaia-glow.pages.dev/api/novabyte/contact',{method:'POST',headers:{Origin:source,'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.123'},body:JSON.stringify(data)});
async function withFetch(fn,run){const original=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=original;}}
const json=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
test('unknown origins, absent tokens and honeypots cannot trigger outbound operations',async()=>{
 await withFetch(()=>{throw Error('must not fetch');},async()=>{
  assert.equal((await onRequestPost({env,request:request(input,'https://evil.example')})).status,403);
  assert.equal((await onRequestPost({env,request:request({...input,captchaToken:''})})).status,403);
  assert.equal((await onRequestPost({env,request:request({...input,honeypot:'bot'})})).status,403);
 });
});
test('invalid, expired, replayed, mismatched-host and wrong-action tokens fail closed before quota or email',async()=>{
 for(const verified of [{success:false,'error-codes':['timeout-or-duplicate']},{success:true,action:'contact',hostname:'evil.example'},{success:true,action:'login',hostname:'novabytesolucoes.com.br'}]){
  let calls=0;await withFetch(async url=>{calls++;assert(url.includes('siteverify'));return json(verified);},async()=>{
   assert.equal((await onRequestPost({env,request:request()})).status,403);assert.equal(calls,1);
  });
 }
});
test('successful validation sends once to a fixed recipient with a restricted sender and idempotency',async()=>{
 const urls=[];
 await withFetch(async(url,options)=>{
  urls.push(url);
  if(url.includes('siteverify')){assert(!options.body.toString().includes('test-email-key'));return json({success:true,hostname:'novabytesolucoes.com.br',action:'contact'});}
  const body=JSON.parse(options.body);
  if(url.includes('nb_security_reserve')){assert.match(body.p_identity,/^[a-f0-9]{64}$/);assert(!options.body.includes('203.0.113.123'));assert.equal(body.p_scope,'contact');return json(true);}
  assert.equal(url,'https://api.resend.com/emails');assert.deepEqual(body.to,['novabytesolucoes@gmail.com']);assert.equal(body.reply_to,'test@example.com');assert(body.from.includes('@auth.novabytesolucoes.com.br'));assert.equal(options.headers['Idempotency-Key'],'nb-contact:'+input.requestKey);return json({id:'test-id'});
 },async()=>{const r=await onRequestPost({env,request:request({...input,to:'evil@example.com'})});assert.equal(r.status,200);assert.deepEqual(await r.json(),{success:true});assert.equal(r.headers.get('access-control-allow-origin'),origin);});
 assert.equal(urls.length,3);
});
test('quota failure, exceeded quota and provider failure never report a sent message',async()=>{
 for(const mode of ['quota-offline','quota-exceeded','email-error']){
  let emails=0;await withFetch(async url=>{
   if(url.includes('siteverify'))return json({success:true,hostname:'novabytesolucoes.com.br',action:'contact'});
   if(url.includes('nb_security_reserve'))return mode==='quota-offline'?new Response('',{status:503}):json(mode!=='quota-exceeded');
   emails++;return new Response('',{status:503});
  },async()=>{const r=await onRequestPost({env,request:request()});assert.equal(r.status,mode==='quota-exceeded'?429:503);assert.equal((await r.json()).success,false);assert.equal(emails,mode==='email-error'?1:0);});
 }
});
test('preflight only permits the actual storefront origins',async()=>{
 assert.equal((await onRequestOptions({request:new Request('https://kaia-glow.pages.dev/api/novabyte/contact',{headers:{Origin:origin}})})).status,204);
 assert.equal((await onRequestOptions({request:new Request('https://kaia-glow.pages.dev/api/novabyte/contact',{headers:{Origin:'https://evil.example'}})})).status,403);
});
