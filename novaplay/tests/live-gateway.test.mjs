import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import worker from '../worker/live-gateway.mjs';
const origin='https://nplay-live-gateway.luandersonjesussantos063.workers.dev';
const id='11111111-1111-5111-8111-111111111111';
const safe=origin+'/live/'+id+'/stream.ts';
const request=(jwt,method='GET')=>new Request(safe,{method,headers:jwt?{Authorization:'Bearer '+jwt}:{}});
async function withFetch(fn,run){const old=globalThis.fetch;globalThis.fetch=fn;try{await run();}finally{globalThis.fetch=old;}}
test('live delivery rejects missing session before accessing private sources',async()=>{
 let reads=0;const r=await worker.fetch(request(),{LIVE_SOURCES:{get(){reads++;}}});assert.equal(r.status,401);assert.equal(reads,0);
});
test('RLS denial prevents provider requests, including draft channels',async()=>{
 let reads=0;await withFetch(async(url,options)=>{assert.match(url,/novaplay_live_embeds/);assert.equal(options.headers.Authorization,'Bearer denied');return Response.json([]);},async()=>{const r=await worker.fetch(request('denied'),{LIVE_SOURCES:{get(){reads++;}}});assert.equal(r.status,403);assert.equal(reads,0);});
});
test('an authorized draft test streams bytes without forwarding viewer authorization or leaking provider URL',async()=>{
 const upstream='http://provider.example/private-user/private-password/42';let providerCalls=0;
 await withFetch(async(url,options)=>{if(String(url).includes('supabase.co')){assert.ok(!String(url).includes('is_published=eq.true'));return Response.json([{embed_url:safe}]);}providerCalls++;assert.equal(url,upstream);assert.equal(options.headers.get('Authorization'),null);return new Response(new Uint8Array([71,0,0,0]),{headers:{'Content-Type':'video/mp2t','X-Provider-Secret':'hidden'}});},async()=>{const r=await worker.fetch(request('valid-admin'),{LIVE_SOURCES:{get:async()=>({url:upstream})}});assert.equal(r.status,200);assert.equal(r.headers.get('X-Provider-Secret'),null);assert.equal(r.headers.get('Location'),null);assert.equal((await r.arrayBuffer()).byteLength,4);assert.equal(providerCalls,1);});
});
test('provider error bodies and private source credentials never reach the viewer',async()=>{
 await withFetch(async(url)=>String(url).includes('supabase.co')?Response.json([{embed_url:safe}]):new Response('secret provider response',{status:403}),async()=>{const r=await worker.fetch(request('valid'),{LIVE_SOURCES:{get:async()=>({url:'http://provider.example/private/password/42'})}});assert.equal(r.status,502);const body=await r.text();assert.ok(!body.includes('secret provider'));assert.ok(!body.includes('password'));});
});
test('foreign origins cannot request a protected stream',async()=>{
 const r=await worker.fetch(new Request(safe,{headers:{Origin:'https://foreign.example',Authorization:'Bearer valid'}}),{});assert.equal(r.status,403);
});
test('viewer tokens are attached only to the owned gateway, never arbitrary providers',async()=>{
 let sessions=0;const window={NPlayAccessClient:{auth:{getSession:async()=>{sessions++;return {data:{session:{access_token:'viewer-secret',expires_at:Date.now()/1000+3600}}}}}}};vm.runInNewContext(readFileSync(new URL('../assets/live-auth.js',import.meta.url),'utf8'),{window,URL,Date,Error,Object});
 assert.equal(await window.NPlayLiveAuth.authorize('https://provider.example/live.ts'),'https://provider.example/live.ts');assert.equal(sessions,0);
 const protectedUrl=await window.NPlayLiveAuth.authorize(safe);assert.equal(new URL(protectedUrl).searchParams.get('access_token'),'viewer-secret');assert.equal(sessions,1);
});
