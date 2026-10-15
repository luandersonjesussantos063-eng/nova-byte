import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/casting.js',import.meta.url),'utf8');
function lab({fail=false,airplay=false}={}){
 const nodes=new Map(),requests=[],commands=[];let controller,config;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,hidden:false,disabled:false,textContent:'',open:false,handlers:{},classList:{toggle(){}},setAttribute(){},addEventListener(e,fn){this.handlers[e]=fn;},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
 const video=Object.assign(node('video'),{currentTime:300,duration:1800,currentSrc:'https://video.test/local.mp4',paused:false,pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}});
 if(airplay)video.webkitShowPlaybackTargetPicker=()=>commands.push('airplay');
 const session={async loadMedia(request){requests.push(request);if(fail)throw Error('unsupported');remote.isConnected=true;remote.currentTime=request.currentTime;},endSession(){commands.push('end');remote.isConnected=false;}};
 const context={setOptions(options){config=options;},addEventListener(){},async requestSession(){commands.push('request');},getCurrentSession:()=>session};
 const remote={isConnected:false,isPaused:false,currentTime:0,duration:1800,volumeLevel:1,isMuted:false,canSeek:true};
 class Controller{constructor(){controller=this;}addEventListener(){}playOrPause(){commands.push('pause');remote.isPaused=!remote.isPaused;}seek(){commands.push('seek');}muteOrUnmute(){remote.isMuted=!remote.isMuted;}setVolumeLevel(){commands.push('volume');}}
 class MediaInfo{constructor(url,type){this.contentId=url;this.contentType=type;}}
 class Request{constructor(info){this.media=info;}}
 const window={cast:{framework:{CastContext:{getInstance:()=>context},RemotePlayer:function(){return remote;},RemotePlayerController:Controller,RemotePlayerEventType:{ANY_CHANGE:'change'},CastContextEventType:{SESSION_STATE_CHANGED:'session'},SessionState:{SESSION_ENDED:'ended'}}},chrome:{cast:{AutoJoinPolicy:{ORIGIN_SCOPED:'origin'},media:{DEFAULT_MEDIA_RECEIVER_APP_ID:'default',MediaInfo,GenericMediaMetadata:class{},LoadRequest:Request,StreamType:{LIVE:'LIVE',BUFFERED:'BUFFERED'}}}}};
 vm.runInNewContext(source,{document:{getElementById:node},window,URL,setTimeout,clearTimeout});
 const media={title:'Filme teste',live:false,getSource:async()=>({url:'https://video.test/cast-media/id?ticket=scoped',content_type:'video/mp4'}),setNativeSource:url=>{video.currentSrc=url;commands.push('source');},onChange(){},onProgress(){}};
 window.NPlayCasting.configure(media);
 return {api:window.NPlayCasting,node,video,media,commands,requests,remote,get config(){return config;},click:id=>node(id).handlers.click()};
}
test('Google Cast sends scoped media at the current position and controls the remote receiver',async()=>{
 const l=lab();await l.click('cinema-cast');assert.equal(l.node('tv-google').disabled,false);assert.equal(l.config.resumeSavedSession,false);
 await l.click('tv-google');assert.equal(l.requests[0].currentTime,300);assert.equal(l.requests[0].media.contentType,'video/mp4');assert.equal(l.requests[0].media.metadata.title,'Filme teste');assert.equal(l.video.paused,true);assert.equal(l.api.state().currentTime,300);
 assert(l.api.command('seek',900));assert.equal(l.remote.currentTime,900);assert(l.api.command('toggle'));assert.equal(l.api.state().paused,true);assert(l.api.command('volume',.4));assert.equal(l.remote.volumeLevel,.4);
 l.api.reset();assert.equal(l.api.state(),null);assert(l.commands.includes('end'));assert(l.node('cinema-cast').hidden);
});
test('a failed TV load never pauses local playback or claims a connection',async()=>{
 const l=lab({fail:true});await l.click('cinema-cast');await l.click('tv-google');assert.equal(l.video.paused,false);assert.equal(l.api.state(),null);assert.match(l.node('tv-feedback').textContent,/Não foi possível transmitir/);
});
test('AirPlay uses the prepared HTTPS media source and its picker requires a direct second click',async()=>{
 const l=lab({airplay:true});await l.click('cinema-cast');assert(!l.commands.includes('airplay'));l.click('tv-airplay');assert.deepEqual(l.commands,['source','airplay']);
});
test('account bearer URLs and stale media are never sent to a TV',async()=>{
 const l=lab();l.media.getSource=async()=>({url:'https://video.test/watch/id?access_token=account-secret'});await l.click('cinema-cast');assert(l.node('tv-google').disabled);assert.match(l.node('tv-feedback').textContent,/compatível/);assert.equal(l.requests.length,0);
 let release;const m=lab();m.media.getSource=()=>new Promise(resolve=>release=resolve);const opening=m.click('cinema-cast');m.api.reset();release({url:'https://video.test/cast-media/old?ticket=scoped'});await opening;assert.equal(m.requests.length,0);assert(m.node('cinema-cast').hidden);
});
