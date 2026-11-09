import test from 'node:test';
import assert from 'node:assert/strict';
import {sendContactEmail} from '../../contact-email.js';
const fields={name:'Teste técnico',email:'teste@example.invalid',service:'Sites',message:'Mensagem de teste sem envio real.'};
test('a missing form key never sends visitor data',async()=>{
 let calls=0;
 await assert.rejects(sendContactEmail({accessKey:'',fields,captchaToken:'mock-token',fetchImpl:async()=>{calls++}}));
 assert.equal(calls,0);
});
test('provider failure, invalid response and a network error cannot report success',async()=>{
 for(const fetchImpl of [async()=>({ok:false,json:async()=>({success:false})}),async()=>({ok:true,json:async()=>({success:false})}),async()=>({ok:true,json:async()=>{throw new Error('invalid JSON')}}),async()=>{throw new Error('network unavailable')}]){
  await assert.rejects(sendContactEmail({accessKey:'test-alias',fields,captchaToken:'mock-token',fetchImpl}));
 }
});
test('only a confirmed API success accepts the explicit email request',async()=>{
 const original=structuredClone(fields);
 const result=await sendContactEmail({accessKey:'test-alias',fields,captchaToken:'mock-token',fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.web3forms.com/submit');assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);assert.equal(body.email,fields.email);assert.equal(body.message,fields.message);assert.equal(body.access_key,'test-alias');assert(!('redirect' in body));
  return {ok:true,json:async()=>({success:true})};
 }});
 assert.equal(result,true);assert.deepEqual(fields,original);
});

test('missing CAPTCHA and populated honeypot cannot send email',async()=>{let calls=0;for(const options of [{},{captchaToken:'',honeypot:''},{captchaToken:'token',honeypot:'bot'}])await assert.rejects(()=>sendContactEmail({accessKey:'test',fields,...options,fetchImpl:async()=>{calls++}}));assert.equal(calls,0);});
