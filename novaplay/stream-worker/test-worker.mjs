import assert from 'node:assert/strict';
import worker from './worker.mjs';

const id='11111111-1111-4111-8111-111111111111';
const key='22222222-2222-4222-8222-222222222222/'+id+'-import-'+id+'.mp4';
let published=true,master=false;
globalThis.fetch=async(url,options)=>{assert.equal(options.headers.Authorization,"Bearer viewer-session");return new Response(JSON.stringify([{
 r2_object_key:key,is_published:published,licensed_rights_confirmed:true,
 rights_reviewed:true,catalog_only:false
}]));};
const env={VIDEOS:{
 head:async name=>name===key?{etag:'abc',size:1000}:master?{size:10}:null,
 get:async(name,options={})=>name.includes('.hls/')?{size:8,body:'#EXTM3U\n0/index.m3u8\n'}:{size:1000,range:options.range,body:'data'}
}};
const req=(path,headers={})=>new Request('https://video.test'+path,{headers:{Origin:'https://novabytesolucoes.com.br',Authorization:'Bearer viewer-session',...headers}});

let response=await worker.fetch(req('/playback/'+id),env);
assert.equal((await response.json()).type,'mp4');
master=true;
response=await worker.fetch(req('/playback/'+id),env);
const info=await response.json();
assert.equal(info.type,'hls');
assert(info.url.includes('/ba7816bf8f01cfea/master.m3u8'));
response=await worker.fetch(new Request(info.url+'?access_token=viewer-session'),env);
assert.equal(response.status,200);
assert.equal(response.headers.get('content-type'),'application/vnd.apple.mpegurl');
assert.match(await response.text(),/0\/index\.m3u8\?access_token=viewer-session/);
response=await worker.fetch(req('/hls/'+id+'/ba7816bf8f01cfea/0/secret.mp4'),env);
assert.equal(response.status,400);

for(const [range,status,expected] of [
 ['bytes=0-99',206,'bytes 0-99/1000'],
 ['bytes=-50',206,'bytes 950-999/1000'],
 ['bytes=990-',206,'bytes 990-999/1000'],
 ['bytes=1000-',416,'bytes */1000']
]){
 response=await worker.fetch(req('/watch/'+id,{Range:range}),env);
 assert.equal(response.status,status);
 assert.equal(response.headers.get('content-range'),expected);
}
response=await worker.fetch(new Request('https://video.test/uploads/start',{method:'POST'}),env);
assert.equal(response.status,403);
published=false;
response=await worker.fetch(req('/playback/'+id),env);
assert.equal(response.status,404);
response=await worker.fetch(req('/hls/'+id+'/ba7816bf8f01cfea/master.m3u8'),env);
assert.equal(response.status,404);
response=await worker.fetch(new Request('https://video.test/playback/'+id),env);assert.equal(response.status,401);
console.log('PASS: discovery, HLS, MP4 fallback, byte ranges, path restrictions and publication guards.');
