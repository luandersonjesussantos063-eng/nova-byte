import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/authorized-ts-gateway.js';
function setup(protocol='https:'){
 const context=vm.createContext({URL,AbortController,DOMException,setTimeout,clearTimeout,location:{protocol}});
 for(const file of ['m3u-core','signal-test'])vm.runInContext(readFileSync(new URL('../admin/'+file+'.js',import.meta.url),'utf8'),context);
 return context;
}
class Video extends EventTarget{
 readyState=3;videoWidth=640;videoHeight=360;currentTime=0;paused=true;attempts=[];
 constructor(accept){super();this.accept=accept;}
 canPlayType(){return 'maybe';}
 play(){
  this.paused=false;this.attempts.push(this.src);
  queueMicrotask(()=>{
   if(!this.accept(this.src)){this.dispatchEvent(new Event('error'));return;}
   for(const time of [10,11,12.1]){this.currentTime=time;this.dispatchEvent(new Event('timeupdate'));}
  });
  return Promise.resolve();
 }
 pause(){this.paused=true;}
 removeAttribute(){delete this.src;}
 load(){}
}
test('HTTP tries matching HTTPS with path, port and query intact and requires moving video',async()=>{
 const c=setup(),video=new Video(()=>true);
 const result=await c.NPlaySignal.testSource(video,'http://stream.example:8081/live.m3u8?token=a');
 assert.equal(result.playbackUrl,'https://stream.example:8081/live.m3u8?token=a');
 assert.ok(result.seconds>=2);assert.deepEqual(video.attempts,[result.playbackUrl]);
});
test('failed HTTPS discovers a configured gateway and actually tests its video',async()=>{
 const c=setup();c.NPLAY_GATEWAY_URLS=['https://gateway.example'];let calls=0;
 c.fetch=async(endpoint,options)=>{
  calls++;assert.equal(endpoint.searchParams.get('source'),'http://stream.example/live.m3u8');
  assert.equal(options.credentials,'omit');return Response.json({url:'https://gateway.example/stream/channel'});
 };
 const video=new Video(url=>url==='https://gateway.example/stream/channel');
 const result=await c.NPlaySignal.testSource(video,'http://stream.example/live.m3u8');
 assert.equal(calls,1);assert.equal(result.playbackUrl,'https://gateway.example/stream/channel');assert.equal(video.attempts.length,2);
});
test('HTTP direct works on HTTP pages; HTTPS pages never request mixed content',async()=>{
 const c=setup('http:'),video=new Video(url=>url.startsWith('http:'));
 assert.equal((await c.NPlaySignal.testSource(video,'http://stream.example/live')).playbackUrl,'http://stream.example/live');
 const secure=setup(),failed=new Video(()=>false);
 await assert.rejects(secure.NPlaySignal.testSource(failed,'http://stream.example/live'),{code:'HTTP_UNRESOLVED'});
 assert.deepEqual(failed.attempts,['https://stream.example/live']);
});
test('failure retains the actual error and identifies absence of gateways',async()=>{
 const c=setup(),video=new Video(()=>false);
 await assert.rejects(c.NPlaySignal.testSource(video,'http://stream.example/live'),error=>{
  assert.equal(error.code,'HTTP_UNRESOLVED');assert.match(error.message,/HTTPS: O navegador não conseguiu/);assert.match(error.message,/Nenhum gateway autorizado disponível/);return true;
 });
});
test('paste pages are diagnosed before trying playback',async()=>{
 const c=setup(),video=new Video(()=>true);
 await assert.rejects(c.NPlaySignal.testSource(video,'https://paste.sh/example#key'),/página de texto/);
 assert.equal(video.attempts.length,0);
});
test('Xtream download URLs are classified as lists and never sent to the video player',async()=>{
 const c=setup(),source='http://provider.example/get.php?username=demo&password=example&type=m3u_plus',video=new Video(()=>true);
 assert.equal(c.NPlayM3u.parseList(source).entries[0].isPlaylist,true);
 assert.match(c.NPlayM3u.displayUrl(source),/username=oculto&password=oculto/);
 await assert.rejects(c.NPlaySignal.testSource(video,source),/baixa uma lista M3U/);assert.equal(video.attempts.length,0);
 assert.equal(c.NPlayM3u.isPlaylist('https://provider.example/live.m3u8'),false);
});
test('known gateway is tried after failed upgrade and preserves the query',async()=>{
 const c=setup(),video=new Video(url=>url.includes('workers.dev'));
 const result=await c.NPlaySignal.testSource(video,'http://95.211.149.215:8081/look/sptv/playlist.m3u8?token=a');
 assert.match(result.playbackUrl,/workers\.dev\/look\/sptv\/playlist\.m3u8\?token=a$/);
});
test('cancellation stops before attempts and gateway lookup',async()=>{
 const c=setup(),control=new AbortController(),video=new Video(()=>true);control.abort();
 await assert.rejects(c.NPlaySignal.testSource(video,'http://stream.example/live',{signal:control.signal}),{name:'AbortError'});
 assert.equal(video.attempts.length,0);
});
test('discovery rejects foreign-origin results and continues after gateway failure',async()=>{
 const c=setup();c.NPLAY_GATEWAY_URLS=['https://gateway.example','https://other.example'];let count=0;
 c.fetch=async()=>{if(++count===1)throw Error('offline');return Response.json({url:'https://untrusted.example/stream'});};
 assert.equal((await c.NPlayM3u.gateways('http://stream.example/live')).length,0);assert.equal(count,2);
});
test('gateway resolves only allowlisted TS sources without fetching user destinations',async()=>{
 const env={ALLOWED_STREAMS:JSON.stringify({channel:'http://stream.example/live.ts'})};
 const resolve=source=>worker.fetch(new Request('https://gateway.example/resolve?source='+encodeURIComponent(source)),env);
 const result=await resolve('http://stream.example/live.ts');assert.equal(result.status,200);
 assert.equal((await result.json()).url,'https://gateway.example/stream/channel.ts');
 assert.equal((await resolve('http://127.0.0.1/private.ts')).status,404);
 assert.equal((await resolve('http://stream.example/live.ts?other=1')).status,404);
 assert.equal((await worker.fetch(new Request('https://gateway.example/resolve',{headers:{Origin:'https://foreign.example'}}),env)).status,403);
});
test('authorized TS stream forwards configured source only, with TLS verification intact',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(url,'http://stream.example/live.ts');assert.equal(options.redirect,'error');return new Response('video');};
  const result=await worker.fetch(new Request('https://gateway.example/stream/channel'),{ALLOWED_STREAMS:JSON.stringify({channel:'http://stream.example/live.ts'})});
  assert.equal(result.status,200);assert.equal(result.headers.get('content-type'),'video/mp2t');assert.equal(await result.text(),'video');
 }finally{globalThis.fetch=original;}
});
