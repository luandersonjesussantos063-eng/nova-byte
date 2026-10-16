import test from 'node:test';import assert from 'node:assert/strict';import worker,{settings,diagnose} from '../worker/portal-test.mjs';
const origin='http://provider.example:8080',allowed=JSON.stringify([origin]);
const input={portal:origin+'/c/',mac:'00:1A:79:AA:BB:CC',sn:'SERIAL123456',dev1:'A'.repeat(64),dev2:'B'.repeat(64),endpoint:'portal'};
test('exact provider allowlist and paths prevent arbitrary destinations',()=>{
 assert.equal(settings(input,allowed).endpoint.href,origin+'/portal.php');
 assert.equal(settings({...input,portal:origin+'/stalker_portal/c/',endpoint:'load'},allowed).endpoint.href,origin+'/stalker_portal/server/load.php');
 for(const portal of ['http://127.0.0.1/c/','http://provider.example:9090/c/','http://provider.example.evil:8080/c/',origin+'/c/?url=http://internal',origin+'/c/#token'])assert.throws(()=>settings({...input,portal},allowed));
 assert.throws(()=>settings({...input,dev1:'bad'},allowed));
});
test('never contacts provider without an NPlay admin session',async()=>{
 const prev=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('unexpected');};
 try{const res=await worker.fetch(new Request('https://test.example/test',{method:'POST',headers:{Origin:'https://novabytesolucoes.com.br'},body:JSON.stringify(input)}),{});assert.equal(res.status,401);assert.equal(calls,0);}finally{globalThis.fetch=prev;}
});
test('handshake alone does not approve authentication',async()=>{
 const prev=globalThis.fetch;let calls=0;globalThis.fetch=async()=>Response.json(++calls===1?{js:{token:'example-portal-token'}}:{js:false});
 try{const result=await diagnose(settings(input,allowed));assert.equal(result.ok,false);assert.equal(result.stage,'profile');assert.equal(calls,2);}finally{globalThis.fetch=prev;}
});
test('confirmed profile returns a sanitized diagnosis without secrets',async()=>{
 const prev=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url),options});return Response.json(calls.length===1?{js:{token:'example-portal-token'}}:{js:{id:'123',mac:input.mac,login:'private-login',token:'private-response'}});};
 try{const result=await diagnose(settings(input,allowed));assert.equal(result.ok,true);const data=JSON.stringify(result);for(const value of ['example-portal-token','private-login','private-response',input.dev1,input.mac])assert.ok(!data.includes(value));assert.equal(calls[1].url.searchParams.get('sn'),input.sn);assert.equal(calls[1].url.searchParams.get('device_id'),input.dev1);assert.equal(calls[1].options.redirect,'error');assert.equal(calls[1].options.headers.Authorization,'Bearer example-portal-token');}finally{globalThis.fetch=prev;}
});
test('provider redirects and HTML responses remain unconfirmed',async()=>{
 const prev=globalThis.fetch;globalThis.fetch=async()=>new Response('<html>login</html>');
 try{await assert.rejects(()=>diagnose(settings(input,allowed)),/não uma resposta/);}finally{globalThis.fetch=prev;}
});
test('signed-in non-admin is rejected before contacting the provider',async()=>{
 const prev=globalThis.fetch;const targets=[];globalThis.fetch=async(url)=>{targets.push(String(url));return Response.json(targets.length===1?{id:'11111111-2222-4333-8444-555555555555'}:[]);};
 try{const result=await worker.fetch(new Request('https://test.example/test',{method:'POST',headers:{Origin:'https://novabytesolucoes.com.br',Authorization:'Bearer '+ 'nplay-user-token'.repeat(4)},body:JSON.stringify(input)}),{ALLOWED_PORTAL_ORIGINS:allowed});assert.equal(result.status,403);assert.equal(targets.length,2);assert.ok(targets.every(x=>x.startsWith('https://vajlhodqxskozuxxlujv.supabase.co/')));}finally{globalThis.fetch=prev;}
});
