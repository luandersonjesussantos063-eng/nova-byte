import test from 'node:test';
import assert from 'node:assert/strict';
import {MultiEngine} from '../pc-tv/multi-engine.mjs';
import worker from '../worker/live-gateway.mjs';
import {encryptBridge} from '../worker/pc-bridge.mjs';
const url=n=>'http://provider.example/user/pass/'+n+'.m3u8';
const owner=n=>String(n).repeat(64);
function receiver(){return {current:null,client:{},starts:0,stops:0,
 async start(raw){this.starts++;this.current||={id:'a'.repeat(32),controller:new AbortController()};return {ok:true,base:'https://nplay-media.invalid/session/'+this.current.id+'/index.m3u8'};},
 async stop(){this.stops++;this.current=null;},async close(){await this.stop();},async asset(){return {ok:true};},
 status(){return {stage:this.current?.error?'failed':this.current?'playing':'idle',channels_receiving:this.current?1:0};}};}
test('closing one of two viewers preserves the shared channel, and closing the last frees its slot',async()=>{
 const m=new MultiEngine({capacity:3,engineFactory:receiver});
 await m.start(url(1),owner(1));await m.start(url(1),owner(2));await m.start(url(2),owner(3));await m.start(url(3),owner(4));
 await assert.rejects(m.start(url(4),owner(5)),{code:'ENGINE_BUSY'});
 await m.release(url(1),owner(1));assert.equal(m.status().channels_receiving,3);
 await assert.rejects(m.start(url(4),owner(5)),{code:'ENGINE_BUSY'});
 await m.release(url(1),owner(2));await m.start(url(4),owner(5));assert.equal(m.status().channels_receiving,3);
 assert.equal(m.slots[1].engine.stops,0);assert.equal(m.slots[2].engine.stops,0);
 await m.close();
});
test('a late release cannot stop a reopened channel with a new playback identity',async()=>{
 const m=new MultiEngine({capacity:1,engineFactory:receiver});
 await m.start(url(1),owner(1));await m.release(url(1),owner(1));await m.start(url(1),owner(2));await m.release(url(1),owner(1));
 assert.equal(m.status().channels_receiving,1);
 await assert.rejects(m.start(url(1),owner(1)),{code:'ENGINE_ASSET_GONE'});
 await assert.rejects(m.asset('https://nplay-media.invalid/session/'+ 'a'.repeat(32)+'/index.m3u8',owner(1)),{code:'ENGINE_ASSET_GONE'});
 assert.equal((await m.asset('https://nplay-media.invalid/session/'+ 'a'.repeat(32)+'/index.m3u8',owner(2))).ok,true);await m.close();
});
test('release arriving before startup prevents a cancelled request from occupying a receiver',async()=>{
 const m=new MultiEngine({capacity:1,engineFactory:receiver});await m.release(url(1),owner(1));
 await assert.rejects(m.start(url(1),owner(1)),{code:'ENGINE_ASSET_GONE'});assert.equal(m.status().channels_receiving,0);await m.close();
});
test('switch waits for the departing pending startup to finish cleanup without stealing another receiver',async()=>{
 let ready;const gate=new Promise(r=>ready=r);let count=0;
 const m=new MultiEngine({capacity:1,engineFactory:()=>{const e=receiver();const start=e.start;e.start=async function(raw){if(++count===1)await gate;return start.call(this,raw);};return e;}});
 const first=m.start(url(1),owner(1));const release=m.release(url(1),owner(1));const second=m.start(url(2),owner(2));ready();
 await first;await release;assert.equal((await second).ok,true);assert.equal(m.status().channels_receiving,1);await m.close();
});
test('failed receivers are reclaimable without displacing a working channel',async()=>{
 const m=new MultiEngine({capacity:2,engineFactory:receiver});await m.start(url(1),owner(1));await m.start(url(2),owner(2));m.slots[0].engine.current.error='ENGINE_SOURCE_RESET';
 assert.equal(m.status().channels_receiving,1);await m.start(url(3),owner(3));assert.equal(m.slots[1].engine.stops,0);await m.close();
});
test('gateway release checks channel access and binds ownership to both JWT and playback ID',async()=>{
 const real=globalThis.fetch,id='11111111-1111-5111-8111-111111111111',origin='https://gateway.example',safe=origin+'/live/'+id+'/index.m3u8';
 const key=Buffer.alloc(32,7).toString('base64url'),cipher=await encryptBridge({url:'https://test.up.railway.app',secret:'a'.repeat(64)},key),env={HLS_MEDIA_KEY:key,LIVE_SOURCES:{get:async()=>({url:url(1)})}};
 let allowed=true,calls=[];
 try{
 globalThis.fetch=async(raw,options)=>{
  if(String(raw).includes('novaplay_live_embeds'))return Response.json(allowed?[{embed_url:safe}]:[]);
  if(String(raw).includes('novaplay_featured'))return Response.json([{pc_bridge_config:cipher}]);
  assert.equal(raw,'https://test.up.railway.app/engine/release');calls.push(JSON.parse(options.body));return Response.json({ok:true});
 };
 const request=(jwt,viewer)=>new Request(origin+'/live/'+id+'/release?viewer='+viewer,{method:'POST',headers:{Authorization:'Bearer '+jwt}});
 assert.equal((await worker.fetch(request('token-one','1'.repeat(32)),env)).status,200);
 assert.equal((await worker.fetch(request('token-two','1'.repeat(32)),env)).status,200);
 assert.notEqual(calls[0].owner,calls[1].owner);assert.match(calls[0].owner,/^[a-f0-9]{64}$/);
 allowed=false;assert.equal((await worker.fetch(request('token-one','1'.repeat(32)),env)).status,403);assert.equal(calls.length,2);
 assert.equal((await worker.fetch(new Request(origin+'/live/'+id+'/release',{method:'POST'}),env)).status,401);
 }finally{globalThis.fetch=real;}
});
