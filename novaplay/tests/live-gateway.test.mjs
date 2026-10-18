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
 let sessions=0;const window={NPlayAccessClient:{auth:{getSession:async()=>{sessions++;return {data:{session:{access_token:'viewer-secret',expires_at:Date.now()/1000+3600}}}}}}};vm.runInNewContext(readFileSync(new URL('../assets/live-auth.js',import.meta.url),'utf8'),{window,URL,Date,Error,Object,crypto});
 assert.equal(await window.NPlayLiveAuth.authorize('https://provider.example/live.ts'),'https://provider.example/live.ts');assert.equal(sessions,0);
 const protectedUrl=await window.NPlayLiveAuth.authorize(safe);assert.equal(new URL(protectedUrl).searchParams.get('access_token'),'viewer-secret');assert.equal(sessions,1);
});
const hlsSafe=origin+'/live/'+id+'/index.m3u8';
const hlsSecret=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const hlsEnv={HLS_MEDIA_KEY:hlsSecret,LIVE_SOURCES:{get:async()=>({url:'http://provider.example/private-user/private-password/index.m3u8'})}};
test('HLS manifests rewrite segments, variants and key URIs as encrypted authenticated locators',async()=>{
 let segmentCalls=0;
 await withFetch(async(url,options)=>{
  if(String(url).includes('supabase.co'))return Response.json([{embed_url:hlsSafe}]);
  assert.equal(options.headers.get('Authorization'),null);
  if(String(url).endsWith('/index.m3u8'))return new Response('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio.m3u8"\n#EXTINF:6,private-user\nsegment.ts\n',{headers:{'Content-Type':'application/x-mpegurl'}});
  segmentCalls++;assert.equal(url,'http://provider.example/private-user/private-password/segment.ts');return new Response(new Uint8Array([71,1,2,3]),{headers:{'Content-Type':'video/mp2t'}});
 },async()=>{
  const r=await worker.fetch(new Request(hlsSafe+'?access_token=viewer-secret'),hlsEnv);assert.equal(r.status,200);const manifest=await r.text();assert.ok(!manifest.includes('provider.example'));assert.ok(!manifest.includes('private-user'));assert.ok(!manifest.includes('private-password'));assert.equal((manifest.match(/\/asset\//g)||[]).length,3);
  const segment=manifest.split('\n').find(x=>x.startsWith('https:'));assert.equal(new URL(segment).searchParams.get('access_token'),'viewer-secret');
  const media=await worker.fetch(new Request(segment),hlsEnv);assert.equal(media.status,200);assert.equal((await media.arrayBuffer()).byteLength,4);assert.equal(segmentCalls,1);
 });
});
test('encrypted HLS locators reject tampering and cannot be reused under another channel ID',async()=>{
 const id2='22222222-2222-5222-8222-222222222222';let mediaCalls=0;
 await withFetch(async url=>{
  if(String(url).includes('supabase.co'))return Response.json([{embed_url:String(url).includes(id2)?hlsSafe.replace(id,id2):hlsSafe}]);
  mediaCalls++;return new Response('#EXTM3U\n#EXTINF:4,\nsegment.ts\n',{headers:{'Content-Type':'application/x-mpegurl'}});
 },async()=>{
  const r=await worker.fetch(new Request(hlsSafe+'?access_token=viewer'),hlsEnv),text=await r.text();const segment=text.split('\n').find(x=>x.startsWith('https:'));
  const wrong=await worker.fetch(new Request(segment.replace(id,id2)),hlsEnv);assert.equal(wrong.status,502);assert.equal(mediaCalls,1);
  const u=new URL(segment);u.pathname=u.pathname.slice(0,-5)+'AAAAA';const altered=await worker.fetch(new Request(u),hlsEnv);assert.equal(altered.status,502);assert.equal(mediaCalls,1);
 });
});
test('HLS resources require a session and RLS access before decrypting or fetching provider media',async()=>{
 const without=await worker.fetch(new Request(hlsSafe),hlsEnv);assert.equal(without.status,401);
 await withFetch(async()=>Response.json([]),async()=>{const r=await worker.fetch(new Request(hlsSafe+'?access_token=denied'),hlsEnv);assert.equal(r.status,403);});
});
test('HLS manifest reads are bounded instead of buffering unlimited input',async()=>{
 await withFetch(async url=>String(url).includes('supabase.co')?Response.json([{embed_url:hlsSafe}]):new Response('#EXTM3U\n'+'a'.repeat(513000)),async()=>{const r=await worker.fetch(new Request(hlsSafe+'?access_token=viewer'),hlsEnv);assert.equal(r.status,502);assert.ok(!(await r.text()).includes('provider.example'));});
});
test('private catalog shards supply HLS sources without relying on the KV daily write quota',async()=>{
 const {gzipSync}=await import('node:zlib');const encoded=gzipSync(JSON.stringify({[id]:'http://provider.example/private-user/private-password/index.m3u8'})).toString('base64');
 const env={HLS_MEDIA_KEY:hlsSecret,PULSE_CATALOG_1_00:encoded.slice(0,80),PULSE_CATALOG_1_01:encoded.slice(80),LIVE_SOURCES:{get:()=>{throw Error('KV must not be needed for this catalog');}}};
 await withFetch(async url=>String(url).includes('supabase.co')?Response.json([{embed_url:hlsSafe}]):new Response('#EXTM3U\n#EXTINF:6,\nsegment.ts\n'),async()=>{const r=await worker.fetch(new Request(hlsSafe+'?access_token=viewer'),env);assert.equal(r.status,200);assert.ok(!(await r.text()).includes('private-password'));});
});
test('HLS accepts public CDN IPv4 redirects while retaining private and metadata address protections',async()=>{
 for(const [host,allowed] of [['93.184.216.34',true],['127.0.0.1',false],['10.0.0.1',false],['169.254.169.254',false],['100.100.100.200',false],['192.168.1.3',false],['172.16.0.1',false],['0.0.0.0',false],['168.63.129.16',false]]){
  let cdnCalls=0;
  await withFetch(async url=>{
   if(String(url).includes('supabase.co'))return Response.json([{embed_url:hlsSafe}]);
   if(String(url).startsWith('http://provider.example/'))return new Response(null,{status:302,headers:{Location:'http://'+host+'/stream/index.m3u8'}});
   cdnCalls++;return new Response('#EXTM3U\n#EXTINF:4,\nsegment.ts\n');
  },async()=>{const r=await worker.fetch(new Request(hlsSafe+'?access_token=viewer'),hlsEnv);assert.equal(r.status,502,host);assert.equal(cdnCalls,0,host);assert.equal(r.headers.get('X-NPlay-Error'),allowed?'UPSTREAM_IP_HOSTNAME_REQUIRED':'GATEWAY_INTERNAL');});
 }
});
