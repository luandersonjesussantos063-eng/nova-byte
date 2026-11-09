import test from 'node:test';
import assert from 'node:assert/strict';
import {sendContactEmail} from '../../contact-email.js';
const endpoint='https://kaia-glow.pages.dev/api/novabyte/contact';
const fields={name:'Teste técnico',email:'teste@example.invalid',service:'Sites',message:'Mensagem de teste sem envio real.'};
test('an invalid endpoint never sends visitor data',async()=>{
 let calls=0;
 await assert.rejects(sendContactEmail({endpoint:'',fields,captchaToken:'mock-token',fetchImpl:async()=>{calls++}}));
 assert.equal(calls,0);
});
test('provider failure, invalid response and a network error cannot report success',async()=>{
 for(const fetchImpl of [async()=>({ok:false,json:async()=>({success:false})}),async()=>({ok:true,json:async()=>({success:false})}),async()=>({ok:true,json:async()=>{throw new Error('invalid JSON')}}),async()=>{throw new Error('network unavailable')}]){
  await assert.rejects(sendContactEmail({endpoint,fields,captchaToken:'mock-token',fetchImpl}));
 }
});
test('only a confirmed API success accepts the explicit email request',async()=>{
 const original=structuredClone(fields);
 const result=await sendContactEmail({endpoint,fields,captchaToken:'mock-token',fetchImpl:async(url,options)=>{
  assert.equal(url,endpoint);assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);assert.equal(body.fields.email,fields.email);assert.equal(body.fields.message,fields.message);assert.equal(body.captchaToken,'mock-token');assert(!('access_key' in body));assert(!('redirect' in body));
  return {ok:true,json:async()=>({success:true})};
 }});
 assert.equal(result,true);assert.deepEqual(fields,original);
});

test('missing CAPTCHA and populated honeypot cannot send email',async()=>{let calls=0;for(const options of [{},{captchaToken:'',honeypot:''},{captchaToken:'token',honeypot:'bot'}])await assert.rejects(()=>sendContactEmail({endpoint,fields,...options,fetchImpl:async()=>{calls++}}));assert.equal(calls,0);});
