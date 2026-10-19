import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function boot(){const c=vm.createContext({window:{}});vm.runInContext(read('assets/playback-stability.js'),c);return c.window.NPlayPlayback;}
function lab({manifestReady=true,mode='hls'}={}){
 const core=boot(),calls=[],status=[],tasks=new Map();let time=0,serial=0,active=true,exhausted=0,end=10,interval=null;
 const video={currentTime:0,paused:false,seeking:false,ended:false,buffered:{length:1,start:()=>0,end:()=>end}};
 const hls={autoLevelEnabled:true,startLoad:(...args)=>calls.push(['start',...args]),loadSource:url=>calls.push(['manifest',url]),recoverMediaError:()=>calls.push(['media'])};
 const ts={unload:()=>calls.push(['unload']),load:()=>calls.push(['load'])};
 const engine=mode==='hls'?{hls,source:'https://media.example/live.m3u8',manifestReady}:mode==='mpegts'?{ts}:{};
 const control=core.create({video,getEngine:()=>engine,isActive:()=>active,onStatus:x=>status.push(x),onExhausted:()=>exhausted++,
  reloadNative:()=>{calls.push(['native',video.currentTime]);return true;},autoplay:()=>calls.push(['play']),now:()=>time,
  schedule:(fn,delay)=>{tasks.set(++serial,{fn,at:time+delay});return serial;},cancel:id=>tasks.delete(id),repeat:fn=>{interval=fn;return 1;},stopRepeat:()=>{interval=null;}});
 function advance(ms,{playing=false,growing=false}={}){
  const target=time+ms;
  while(time<target){const step=Math.min(1000,target-time);time+=step;if(playing)video.currentTime+=step/1000;if(growing)end+=step/1000;
   for(const [id,task] of [...tasks])if(task.at<=time){tasks.delete(id);task.fn();}
   interval?.();
  }
 }
 return {core,video,hls,engine,control,calls,status,tasks,advance,setEnd:x=>{end=x},deactivate:()=>{active=false},get exhausted(){return exhausted},get polling(){return !!interval}};
}

test('live settings increase forward cushion, bound old data and retain retries on protected manifests',()=>{
 const core=boot(),live=core.hlsConfig({live:true,protectedSource:true}),vod=core.hlsConfig();
 assert.equal(live.maxBufferLength,40);assert.equal(live.maxMaxBufferLength,60);assert.equal(live.backBufferLength,10);
 assert.equal(live.liveSyncDurationCount,4);assert.equal(live.maxLiveSyncPlaybackRate,1);assert.equal(live.liveMaxLatencyDurationCount,Infinity);
 assert(live.manifestLoadPolicy.default.timeoutRetry.maxNumRetry>0);assert(live.manifestLoadPolicy.default.errorRetry.maxNumRetry>0);
 assert.equal(vod.maxBufferLength,60);assert.equal(vod.liveSyncDurationCount,undefined);
 const ts=core.mpegtsConfig();assert.equal(ts.enableStashBuffer,true);assert.equal(ts.liveBufferLatencyChasing,false);assert.equal(ts.liveSync,false);
});
test('network retries are delayed, preserve position and lower the next adaptive level without seeking',()=>{
 const l=lab();l.video.currentTime=128;
 assert.equal(l.control.network({status:503}),true);assert.equal(l.calls.length,0);
 l.advance(1000);assert.deepEqual(l.calls,[['start',128,true]]);assert.equal(l.hls.nextAutoLevel,0);assert.equal(l.video.currentTime,128);
});
test('an initial manifest failure reloads the manifest instead of calling startLoad before it exists',()=>{
 const l=lab({manifestReady:false});l.control.network({response:{code:502}});l.advance(1000);
 assert.deepEqual(l.calls,[['manifest','https://media.example/live.m3u8']]);
});
test('authorization denial and missing media are not retried; a temporary reset gets at most three attempts',()=>{
 const l=lab();for(const code of [401,403,404,410])assert.equal(l.control.network({status:code}),false);
 for(const delay of [1000,2000,4000]){assert.equal(l.control.network({status:502}),true);l.advance(delay);}
 assert.equal(l.control.network({status:502}),false);assert.equal(l.calls.length,3);
});
test('repeated error callbacks share a pending retry and decoder recovery has a separate limit',()=>{
 const l=lab();for(let i=0;i<20;i++)assert.equal(l.control.network({status:500}),true);
 assert.equal(l.tasks.size,1);l.advance(1000);assert.equal(l.calls.length,1);
 assert.equal(l.control.media(),true);l.advance(1000);assert.equal(l.control.media(),true);l.advance(1000);
 assert.equal(l.control.media(),false);assert.equal(l.calls.filter(x=>x[0]==='media').length,2);
});
test('a brief playing event does not create infinite retries; twenty seconds of progress restore the budget',()=>{
 const l=lab();for(const delay of [1000,2000,4000]){l.control.network({status:500});l.advance(delay);}
 l.advance(2000,{playing:true});assert.equal(l.control.network({status:500}),false);
 l.advance(21000,{playing:true});assert.equal(l.control.network({status:500}),true);
});
test('persistent frozen image with buffered data triggers decoder recovery and eventually reports exhaustion once',()=>{
 const l=lab();l.advance(1000,{playing:true});l.advance(45000);
 assert.equal(l.calls.filter(x=>x[0]==='media').length,2);assert.equal(l.exhausted,1);
 l.advance(10000);assert.equal(l.exhausted,1);
});
test('a slow download can build buffer without being aborted every few seconds',()=>{
 const l=lab();l.setEnd(0);l.advance(1000,{playing:true});l.advance(20000,{growing:true});
 // Buffer growth while the image is frozen may require decoder recovery, not a new download.
 assert.equal(l.calls.filter(x=>x[0]==='start').length,0);
 const empty=lab();empty.setEnd(0);empty.advance(1000,{playing:true});empty.advance(28000);
 assert.equal(empty.calls.length,0);empty.advance(4000);assert.equal(empty.calls[0][0],'start');
});
test('pause, seek, ended media, inactive sessions and closing the player cancel stall interventions',()=>{
 for(const flag of ['paused','seeking','ended']){
  const l=lab();l.advance(1000,{playing:true});l.video[flag]=true;l.advance(65000);assert.equal(l.calls.length,0,flag);
 }
 const closed=lab();closed.control.network({status:503});closed.control.destroy();closed.advance(20000);
 assert.equal(closed.calls.length,0);assert.equal(closed.tasks.size,0);assert.equal(closed.polling,false);
 const changed=lab();changed.control.network({status:503});changed.deactivate();changed.advance(10000);assert.equal(changed.calls.length,0);
});
test('MPEG-TS releases the previous load before reconnecting and does not resume a user pause',()=>{
 const l=lab({mode:'mpegts'});l.control.network({status:503});l.advance(1000);assert.deepEqual(l.calls,[['unload'],['load'],['play']]);
 const paused=lab({mode:'mpegts'});paused.control.network({status:503});paused.video.paused=true;paused.advance(1000);
 assert.deepEqual(paused.calls,[['unload'],['load']]);
});
test('a native video stall requests a reload at the current position instead of touching another origin',()=>{
 const l=lab({mode:'native'});l.video.currentTime=75;l.control.network({status:503});l.advance(1000);
 assert.deepEqual(l.calls,[['native',75]]);
});
test('the player loads recovery before the app, caches it offline and destroys it before removing the media',()=>{
 const html=read('index.html'),app=read('app.js'),sw=read('sw.js');
 assert(html.indexOf('assets/playback-stability.js')<html.indexOf('src="./app.js'));
 assert(sw.includes('"./assets/playback-stability.js"'));
 const stop=app.slice(app.indexOf('function stopPlayback(){'),app.indexOf('function closePlayer('));
 assert(stop.indexOf('playbackRecovery?.destroy()')<stop.indexOf('hls.destroy()'));
});
