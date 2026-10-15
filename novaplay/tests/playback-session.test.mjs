import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('autoplay fallback only handles autoplay denial, never disguises a media failure',async()=>{
 const source=app.slice(app.indexOf('function startAutoplay('),app.indexOf('function setResume('));
 let status=[],calls=0;const context=vm.createContext({attempt:1,playerClosing:false,$:()=>({hidden:false}),showCinemaUi:()=>{},playerStatus:s=>status.push(s)});vm.runInContext(source,context);
 const bad={muted:false,play:()=>{calls++;return Promise.reject({name:'NotSupportedError'});}};context.startAutoplay(bad,1);await new Promise(setImmediate);assert.equal(calls,1);assert.equal(status.length,0);assert.equal(bad.muted,false);
 calls=0;const blocked={muted:false,play:()=>{calls++;return calls===1?Promise.reject({name:'NotAllowedError'}):Promise.resolve();}};context.startAutoplay(blocked,1);await new Promise(setImmediate);assert.equal(calls,2);assert.equal(blocked.muted,true);
});
function lab(response){
 const id='11111111-1111-4111-8111-111111111111',token='viewer-session';let request,failed;
 const session={access_token:token,expires_at:Math.floor(Date.now()/1000)+3600};
 const context=vm.createContext({seq:1,attempt:1,r2Refreshing:false,r2ExpiresAt:0,hasFailed:false,episode:null,item:{id:'upload-'+id},v:{currentTime:0},window:{NPlayAccessClient:{auth:{getSession:async()=>({data:{session}})}}},remoteDb:null,URL,Date,AbortController,setTimeout,clearTimeout,hls:null,src:null,startSource:()=>{},playerStatus:()=>{},fail:e=>failed=e,fetch:async(url,options)=>{request={url,options};return response||{ok:true,json:async()=>({url:'https://nplay-r2-api.luandersonjesussantos063.workers.dev/watch/'+id})};}});
 const start=app.indexOf(' async function loadR2('),end=app.indexOf(' if(media.youtube_id){',start);vm.runInContext(app.slice(start,end),context);
 return {context,token,get request(){return request;},get failed(){return failed;}};
}
test('R2 discovery uses viewer session and native media gets the same scoped delivery origin',async()=>{
 const l=lab();await l.context.loadR2();assert.equal(l.request.options.headers.Authorization,'Bearer '+l.token);const url=new URL(l.context.src);assert.equal(url.origin,'https://nplay-r2-api.luandersonjesussantos063.workers.dev');assert.equal(url.searchParams.get('access_token'),l.token);assert.equal(l.failed,undefined);
});
test('R2 rejection stops before assigning a blind watch fallback',async()=>{
 const l=lab({ok:false,status:404,json:async()=>({error:'not authorized'})});await l.context.loadR2();assert.equal(l.context.src,null);assert.match(l.failed,/acesso ao vídeo/);
});
test('R2 never forwards viewer credentials to a different media origin',async()=>{
 const l=lab({ok:true,json:async()=>({url:'https://other.example/watch/id'})});await l.context.loadR2();assert.equal(l.context.src,null);assert.match(l.failed,/endereço de vídeo inválido/);
});
