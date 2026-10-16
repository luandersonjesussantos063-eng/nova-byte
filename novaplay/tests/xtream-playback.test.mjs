import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {xtreamCandidates,fetchXtream,createBridge} from '../pc-tv/bridge.mjs';
import worker from '../worker/live-gateway.mjs';
import {xtreamTsSource} from '../worker/hls-relay.mjs';
const root='http://provider.example/user/pass/42.m3u8';
const media=statusCode=>({url:root,response:Object.assign(Readable.from([Buffer.from([71,0,1,2])]),{statusCode,headers:{'content-type':'video/mp2t'}})});
test('Xtream canonical route is restricted to live roots; assets, signed URLs and VOD remain unchanged',()=>{
 assert.deepEqual(xtreamCandidates(root),['http://provider.example/live/user/pass/42.m3u8',root]);
 for(const url of ['http://provider.example/live/user/pass/42.m3u8',root+'?token=signed','http://provider.example/movie/user/pass/42.mp4','http://provider.example/base/42.ts','http://provider.example/key.bin'])assert.deepEqual(xtreamCandidates(url),[url]);
 assert.equal(xtreamTsSource(root),'http://provider.example/user/pass/42.ts');
 assert.equal(xtreamTsSource(root+'?token=signed'),null);
});
test('Xtream fallback closes a 404 before the original route; resets retry once, denial and TLS never retry',async()=>{
 let calls=[],first;
 const result=await fetchXtream(root,null,new AbortController().signal,async url=>{calls.push(url);if(calls.length===1){first=media(404);return first;}assert.equal(first.response.destroyed,true);return media(200);});
 assert.equal(result.response.statusCode,200);assert.deepEqual(calls,xtreamCandidates(root));
 for(const code of ['ECONNRESET','DEPTH_ZERO_SELF_SIGNED_CERT','ENOTFOUND']){
  calls=[];const run=()=>fetchXtream(root,null,new AbortController().signal,async url=>{calls.push(url);if(calls.length===1)throw Object.assign(Error('private'),{code});return media(200);});
  if(code==='ECONNRESET'){assert.equal((await run()).response.statusCode,200);assert.equal(calls.length,2);}else{await assert.rejects(run(),{code});assert.equal(calls.length,1);}
 }
 for(const status of [401,403]){calls=[];assert.equal((await fetchXtream(root,null,new AbortController().signal,async url=>{calls.push(url);return media(status);})).response.statusCode,status);assert.equal(calls.length,1);}
});
test('bridge uses Xtream routing only when the authenticated gateway explicitly requests a root',async()=>{
 const secret='a'.repeat(64);let roots=0,assets=0;
 const server=createBridge({secret,fetchRoot:async()=>{roots++;return media(200);},fetchUpstream:async()=>{assets++;return media(200);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const xtream of [true,false]){const r=await fetch('http://127.0.0.1:'+server.address().port+'/fetch',{method:'POST',headers:{Authorization:'Bearer '+secret},body:JSON.stringify({url:root,xtream})});assert.equal(r.status,200);await r.arrayBuffer();}assert.equal(roots,1);assert.equal(assets,1);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('MPEG-TS alternative keeps RLS gating and uses the same private HLS catalog without changing rows',async()=>{
 const saved=globalThis.fetch,id='11111111-1111-5111-8111-111111111111',origin='https://nplay-live-gateway.luandersonjesussantos063.workers.dev';
 let permitted=true,provider=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(String(url).includes('novaplay_live_embeds'))return Response.json(permitted?[{embed_url:origin+'/live/'+id+'/index.m3u8'}]:[]);
   if(String(url).includes('novaplay_featured'))return Response.json([{pc_bridge_config:null}]);
   provider++;assert.equal(url,'http://provider.example/user/pass/42.ts');assert.equal(options.headers.has('Authorization'),false);return new Response(new Uint8Array([71,0,1,2]),{headers:{'Content-Type':'video/mp2t','X-NPlay-Upstream-Url':root}});
  };
  const env={LIVE_SOURCES:{get:async()=>({url:root})}};
  const r=await worker.fetch(new Request(origin+'/live/'+id+'/stream.ts?access_token=viewer'),env);assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,4);assert.equal(r.headers.has('X-NPlay-Upstream-Url'),false);
  permitted=false;const denied=await worker.fetch(new Request(origin+'/live/'+id+'/stream.ts?access_token=viewer'),env);assert.equal(denied.status,403);assert.equal(provider,1);
 }finally{globalThis.fetch=saved;}
});
test('format fallback releases HLS, preserves viewer token, runs once, and is cancelled by closing playback',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');const code=app.slice(app.indexOf(' function tryMpegts(){'),app.indexOf(' const fail=msg=>',app.indexOf(' function tryMpegts(){')));
 let destroyed=0,starts=0,scheduled=[];
 const context=vm.createContext({seq:1,attempt:1,formatFallbackUsed:false,switchingFormat:false,playbackMode:'hls',item:{kind:'tv'},window:{NPlayLiveAuth:{protectedUrl:()=>true},mpegts:{isSupported:()=>true}},src:'https://nplay-live-gateway.luandersonjesussantos063.workers.dev/live/11111111-1111-5111-8111-111111111111/index.m3u8?access_token=viewer',URL,hls:{destroy:()=>destroyed++},v:{onerror:()=>{},pause(){},removeAttribute(){},load(){}},timer:1,clearTimeout:()=>{},setTimeout:fn=>{scheduled.push(fn);return scheduled.length;},hasFailed:false,playerStatus:()=>{},startSource:()=>starts++,fail:()=>{}});
 vm.runInContext(code,context);assert.equal(context.tryMpegts(),true);assert.equal(context.tryMpegts(),false);assert.equal(destroyed,1);assert.equal(new URL(context.src).searchParams.get('access_token'),'viewer');assert.match(context.src,/stream\.ts/);
 context.attempt=2;scheduled[0]();assert.equal(starts,0);
});
