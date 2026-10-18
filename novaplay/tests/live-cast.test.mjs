import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import worker from '../worker/live-gateway.mjs';
import {mintLiveCast,readLiveCast} from '../worker/live-cast.mjs';
const origin='https://nplay-live-gateway.luandersonjesussantos063.workers.dev',id='11111111-1111-5111-8111-111111111111',id2='22222222-2222-5222-8222-222222222222';
const secret=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),viewer='a'.repeat(32);
const jwt='header.'+Buffer.from(JSON.stringify({sub:'approved-user',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
const env={HLS_MEDIA_KEY:secret,LIVE_SOURCES:{get:async()=>({url:'https://provider.example/private/password/index.m3u8'})}};
const root=origin+'/live/'+id+'/index.m3u8';
async function withFetch(mock,run){const previous=globalThis.fetch;globalThis.fetch=mock;try{await run();}finally{globalThis.fetch=previous;}}
test('encrypted cast tickets expire, preserve viewer identity and cannot authorize another channel',async()=>{
 const now=Date.now(),issued=await mintLiveCast({id,jwt,viewer,secret,now});
 const payload=await readLiveCast(issued.ticket,id,secret,now);assert.equal(payload.jwt,jwt);assert.equal(payload.viewer,viewer);assert(issued.expires_at<=now/1000+3600);
 assert(!issued.ticket.includes(jwt));await assert.rejects(readLiveCast(issued.ticket,id2,secret,now));await assert.rejects(readLiveCast(issued.ticket,id,secret,now+3601e3));
 await assert.rejects(readLiveCast(issued.ticket.slice(0,-8)+'AAAAAAAA',id,secret,now));
});
test('protected live cast returns LIVE HLS with receiver CORS and no account bearer in nested media URLs',async()=>{
 let denied=false,providers=0;
 await withFetch(async(url,options)=>{
  if(String(url).includes('supabase.co')){assert.equal(options.headers.Authorization,'Bearer '+jwt);if(String(url).includes('pc_bridge_config'))return Response.json([]);return Response.json(denied?[]:[{embed_url:root}]);}
  providers++;if(String(url).endsWith('.ts'))return new Response(new Uint8Array([71,1,2,3]),{headers:{'Content-Type':'video/mp2t'}});
  return new Response('#EXTM3U\n#EXTINF:4,\nsegment.ts\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});
 },async()=>{
  const response=await worker.fetch(new Request(origin+'/cast/'+id,{method:'POST',headers:{Authorization:'Bearer '+jwt,Origin:'https://novabytesolucoes.com.br'},body:JSON.stringify({viewer})}),env);
  assert.equal(response.status,200);const source=await response.json();assert(!source.url.includes(jwt));assert(!source.url.includes('access_token'));assert.match(source.content_type,/mpegURL/);
  const receiver=await worker.fetch(new Request(source.url,{headers:{Origin:'https://www.gstatic.com'}}),env);assert.equal(receiver.status,200);assert.equal(receiver.headers.get('Access-Control-Allow-Origin'),'*');
  const manifest=await receiver.text();assert(!manifest.includes('access_token'));assert(!manifest.includes(jwt));assert(!manifest.includes('provider.example'));const segment=manifest.split('\n').find(x=>x.startsWith('https:'));assert(new URL(segment).searchParams.has('cast_ticket'));
  const bytes=await worker.fetch(new Request(segment,{headers:{Origin:'https://www.gstatic.com'}}),env);assert.equal(bytes.status,200);assert.equal((await bytes.arrayBuffer()).byteLength,4);
  const before=providers;denied=true;const revoked=await worker.fetch(new Request(source.url),env);assert.equal(revoked.status,403);assert.equal(providers,before);
  const wrong=await worker.fetch(new Request(source.url.replace(id,id2)),env);assert.equal(wrong.status,401);
  const escalate=await worker.fetch(new Request(origin+'/admin/iptv?cast_ticket='+new URL(source.url).searchParams.get('cast_ticket'),{method:'POST'}),env);assert.equal(escalate.status,403);
 });
});
test('minting requires a permitted session and origin before reading any provider source',async()=>{
 assert.equal((await worker.fetch(new Request(origin+'/cast/'+id,{method:'POST',body:'{}'}),env)).status,401);
 assert.equal((await worker.fetch(new Request(origin+'/cast/'+id,{method:'POST',headers:{Authorization:'Bearer '+jwt,Origin:'https://foreign.example'},body:'{}'}),env)).status,403);
 await withFetch(async()=>Response.json([]),async()=>assert.equal((await worker.fetch(new Request(origin+'/cast/'+id,{method:'POST',headers:{Authorization:'Bearer '+jwt},body:'{}'}),env)).status,403));
});
test('the browser requests a channel-scoped ticket and never returns an account-bearer URL to casting',async()=>{
 let request;const window={};const context={window,URL,Date,Error,Object,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{request={url,options};return Response.json({url:root+'?cast_ticket=opaque',expires_at:Math.floor(Date.now()/1000)+3600,content_type:'application/x-mpegURL'});}};
 vm.runInNewContext(readFileSync(new URL('../assets/live-auth.js',import.meta.url),'utf8'),context);
 const source=await window.NPlayLiveAuth.castSource(root+'?access_token=account-secret&viewer='+viewer);
 assert.equal(source.url,root+'?cast_ticket=opaque');assert.equal(request.options.headers.Authorization,'Bearer account-secret');assert(!request.url.includes('account-secret'));assert.equal(JSON.parse(request.options.body).viewer,viewer);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');assert(app.includes('return window.NPlayLiveAuth.castSource(src)'));assert(!app.includes('&&!window.NPlayLiveAuth?.protectedUrl(media.src))window.NPlayCasting'));
});
