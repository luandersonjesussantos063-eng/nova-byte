import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../stream-worker/worker.mjs';
const id='11111111-1111-4111-8111-111111111111';
const key='22222222-2222-4222-8222-222222222222/'+id+'-import-'+id+'.mp4';
const origin='https://novabytesolucoes.com.br';
const env={CAST_TICKET_KEY:'5c'.repeat(32),VIDEOS:{head:async()=>({etag:'abc',size:1000}),get:async(name,options={})=>{assert.equal(name,key);return {size:1000,range:options.range,body:'video'};}}};
const issue=()=>new Request('https://video.test/cast/'+id,{method:'POST',headers:{Origin:origin,Authorization:'Bearer viewer-session'}});
function mockCatalog(overrides={}){
 globalThis.fetch=async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer viewer-session');return new Response(JSON.stringify([{r2_object_key:key,is_published:true,licensed_rights_confirmed:true,rights_reviewed:true,catalog_only:false,...overrides}]));};
}
test('TV receives a scoped opaque grant, never the account session; byte ranges and HEAD support receiver origins',async()=>{
 mockCatalog();const response=await worker.fetch(issue(),env);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 const grant=await response.json();assert.equal(grant.content_type,'video/mp4');assert(!grant.url.includes('viewer-session'));assert(!grant.url.includes('access_token'));
 globalThis.fetch=()=>{throw Error('A TV must not need a viewer bearer');};
 const partial=await worker.fetch(new Request(grant.url,{headers:{Origin:'https://www.gstatic.com',Range:'bytes=20-29'}}),env);
 assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 20-29/1000');assert.equal(partial.headers.get('access-control-allow-origin'),'*');
 const head=await worker.fetch(new Request(grant.url,{method:'HEAD'}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),'1000');
 const preflight=await worker.fetch(new Request(grant.url,{method:'OPTIONS'}),env);assert.equal(preflight.headers.get('access-control-allow-origin'),'*');
});
test('TV grants reject tampering, another film, expiration and use as an account session',async()=>{
 mockCatalog();const grant=await(await worker.fetch(issue(),env)).json();const url=new URL(grant.url);
 const wrong=new URL(url);wrong.pathname=wrong.pathname.replace(id,'33333333-3333-4333-8333-333333333333');assert.equal((await worker.fetch(new Request(wrong),env)).status,401);
 const corrupt=new URL(url);corrupt.searchParams.set('ticket','A'+url.searchParams.get('ticket').slice(1));assert.equal((await worker.fetch(new Request(corrupt),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://video.test/watch/'+id+'?ticket='+url.searchParams.get('ticket')),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://video.test/uploads/start?ticket='+url.searchParams.get('ticket'),{method:'POST',headers:{Origin:origin}}),env)).status,401);
 const now=Date.now;try{Date.now=()=>now()+4*60*60*1000+1000;assert.equal((await worker.fetch(new Request(url),env)).status,401);}finally{Date.now=now;}
});
test('issuing a TV grant requires approved catalog access, publication, reviewed rights and the NPlay origin',async()=>{
 for(const flag of [{is_published:false},{licensed_rights_confirmed:false},{rights_reviewed:false},{catalog_only:true}]){mockCatalog(flag);assert.equal((await worker.fetch(issue(),env)).status,404);}
 globalThis.fetch=async()=>new Response('[]');assert.equal((await worker.fetch(issue(),env)).status,404);
 assert.equal((await worker.fetch(new Request('https://video.test/cast/'+id,{method:'POST',headers:{Origin:origin}}),env)).status,401);
 assert.equal((await worker.fetch(new Request('https://video.test/cast/'+id,{method:'POST',headers:{Origin:'https://other.test',Authorization:'Bearer viewer-session'}}),env)).status,403);
 mockCatalog();assert.equal((await worker.fetch(issue(),{...env,CAST_TICKET_KEY:undefined})).status,503);
});
