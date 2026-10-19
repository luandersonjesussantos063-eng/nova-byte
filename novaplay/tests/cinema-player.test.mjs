import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function boot(){const context={window:{},performance:{now:()=>0}};vm.runInNewContext(read('assets/cinema-player.js'),context);return context.window.NPlayCinema;}
class Node{
 constructor(tag='div'){
  this.tagName=tag.toUpperCase();this.handlers={};this.children=[];this.attributes={};this.hidden=false;this.disabled=false;this.inert=false;this.isConnected=true;this.value='0';this.textContent='';this.style={setProperty(name,value){this[name]=value;}};
  const classes=new Set();this.classList={add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),contains:n=>classes.has(n),toggle(n,value){if(value??!classes.has(n))classes.add(n);else classes.delete(n);}};
 }
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
 removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(x=>x!==fn);}
 emit(type,data={}){const e={target:this,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...data};for(const fn of this.handlers[type]||[])fn(e);return e;}
 setAttribute(name,value){this.attributes[name]=String(value);}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 focus(){if(this.document)this.document.activeElement=this;}
 setPointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:1000,height:500};}
 querySelectorAll(selector){const tags=selector.toUpperCase().split(',');return this.children.flatMap(n=>[...(tags.includes(n.tagName)?[n]:[]),...n.querySelectorAll(selector)]);}
}
function lab({live=false,remote=null,hls=null}={}){
 const nodes=new Map(),commands=[];const document={activeElement:null,createElement:tag=>{const n=new Node(tag);n.document=document;return n;}};
 const get=id=>{if(!nodes.has(id)){const n=document.createElement(id==='cinema-seek'||id==='cinema-brightness'?'input':id==='cinema-settings'||id==='cinema-settings-body'?'div':'button');n.id=id;nodes.set(id,n);}return nodes.get(id);};
 const layer=new Node();layer.querySelector=selector=>get(selector.slice(1));layer.classList.add('native-player');
 const video=Object.assign(new Node('video'),{currentTime:45,duration:200,playbackRate:1,paused:false,seekable:{length:0},textTracks:[],audioTracks:[],play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}});
 get('cinema-settings').hidden=true;
 const context={window:{},performance:{now:()=>0},document};vm.runInNewContext(read('assets/cinema-player.js'),context);
 const player=context.window.NPlayCinema.create({layer,video,getHls:()=>hls,getRemote:()=>remote,command:(...args)=>{commands.push(args);if(args[0]==='seek')remote.currentTime=args[1];return true;},isLive:()=>live});
 const click=id=>get(id).emit('click');
 const choices=()=>get('cinema-settings-body').children.filter(n=>n.tagName==='BUTTON');
 const choose=label=>{const n=choices().find(n=>n.textContent===label);assert(n,'missing option '+label);n.emit('click');};
 return {player,video,layer,get,click,choose,choices,commands,document};
}
function gestures(){
 const core=boot(),video=new Node('video'),seeks=[];let time=0,enabled=true,rotated=false;
 const binding=core.bindDoubleTap(video,{now:()=>time,enabled:()=>enabled,rotated:()=>rotated,onSeek:delta=>seeks.push(delta)});
 const send=(type,x=750,y=200,extra={})=>video.emit(type,{pointerId:1,button:0,isPrimary:true,clientX:x,clientY:y,...extra});
 const tap=(x=750,y=200)=>{send('pointerdown',x,y);time+=30;send('pointerup',x,y);time+=100;};
 return {video,binding,seeks,send,tap,advance:ms=>{time+=ms;},disable:()=>{enabled=false;},rotate:()=>{rotated=true;}};
}
test('two taps seek ten seconds to the matching side; a single tap and opposite halves do not',()=>{
 const g=gestures();g.tap();assert.deepEqual(g.seeks,[]);g.tap();assert.deepEqual(g.seeks,[10]);
 g.tap(200);g.tap(200);assert.deepEqual(g.seeks,[10,-10]);
 g.tap(200);g.tap(750);assert.deepEqual(g.seeks,[10,-10]);
});
test('double taps follow the content horizontal axis when the landscape player is CSS-rotated',()=>{
 const g=gestures();g.rotate();g.tap(100,400);g.tap(100,400);g.tap(800,100);g.tap(800,100);
 assert.deepEqual(g.seeks,[10,-10]);
});
test('drags, slow taps, long presses, right clicks, multi-touch and cancellation cannot seek',()=>{
 const g=gestures();g.tap();g.advance(500);g.tap();assert.deepEqual(g.seeks,[]);
 g.send('pointerdown');g.advance(400);g.send('pointerup');g.tap();assert.deepEqual(g.seeks,[]);
 g.send('pointerdown');g.send('pointermove',900);g.send('pointerup',900);g.tap();assert.deepEqual(g.seeks,[]);
 g.send('pointerdown',750,200,{button:2});g.send('pointerup',750,200,{button:2});g.tap();assert.deepEqual(g.seeks,[]);
 g.send('pointerdown');g.send('pointerdown',760,200,{pointerId:2,isPrimary:false});g.send('pointerup',760,200,{pointerId:2});g.send('pointerup');g.tap();assert.deepEqual(g.seeks,[]);
 g.send('pointercancel');g.tap();assert.deepEqual(g.seeks,[]);
});
test('closing, changing a source, locking and embedded playback discard incomplete double taps',()=>{
 const g=gestures();g.tap();g.binding.reset();g.tap();assert.deepEqual(g.seeks,[]);
 g.video.emit('emptied');g.tap();assert.deepEqual(g.seeks,[]);g.disable();g.tap();assert.deepEqual(g.seeks,[]);
 g.binding.destroy();g.tap();g.tap();assert.deepEqual(g.seeks,[]);
});
test('seek bounds clamp films and the available DVR window instead of seeking beyond the signal',()=>{
 const core=boot();assert.equal(core.seekTarget({currentTime:4,duration:100},-10),0);
 assert.equal(core.seekTarget({currentTime:96,duration:100},10),100);
 const live={currentTime:155,duration:Infinity,seekable:{length:1,start:()=>150,end:()=>180}};
 assert.equal(core.seekTarget(live,-10,{live:true}),150);assert.equal(core.seekTarget(live,10,{live:true}),165);
 assert.equal(core.seekTarget({currentTime:30,duration:Infinity},10,{live:true}),null);
 assert.equal(core.seekTarget({currentTime:30,duration:60},10,{live:true}),null);
 assert.equal(core.seekTarget({currentTime:30,duration:60,canSeek:false},10),null);
});
test('film controls show remaining time, retain pause and seek exactly ten seconds',()=>{
 const l=lab();l.player.update();assert.equal(l.get('cinema-duration').textContent,'2:35');
 assert.equal(l.get('cinema-play').attributes['aria-label'],'Pausar');l.click('cinema-play');assert(l.video.paused);
 l.click('cinema-forward');assert.equal(l.video.currentTime,55);assert(l.video.paused);
 l.click('cinema-rewind');assert.equal(l.video.currentTime,45);l.click('cinema-play');assert(!l.video.paused);
});
test('timeline scrubbing commits the chosen position, remains visible during dragging and respects DVR',()=>{
 const l=lab();l.get('cinema-seek').value='80';l.get('cinema-seek').emit('input');assert(l.player.keepsControlsVisible());
 l.get('cinema-seek').emit('change');assert.equal(l.video.currentTime,160);assert(!l.player.keepsControlsVisible());
 const live=lab({live:true});live.player.update();assert(live.get('cinema-seek').disabled);live.click('cinema-forward');assert.equal(live.video.currentTime,45);
 live.video.currentTime=150;live.video.seekable={length:1,start:()=>100,end:()=>200};live.player.update();assert(!live.get('cinema-seek').disabled);
 live.get('cinema-seek').value='25';live.get('cinema-seek').emit('change');assert.equal(live.video.currentTime,125);assert.equal(live.get('cinema-duration').textContent,'AO VIVO');
});
test('locking blocks touch controls, gestures, seeking, settings and keyboard Escape; unlocking restores them',()=>{
 const l=lab();l.click('cinema-lock');assert(l.layer.classList.contains('controls-locked'));assert(l.get('cinema-controls').inert);
 assert(l.get('player-back').inert);l.click('cinema-play');l.click('cinema-forward');l.click('cinema-speed');
 assert(!l.video.paused);assert.equal(l.video.currentTime,45);assert(l.get('cinema-settings').hidden);
 assert(l.layer.emit('keydown',{key:'Escape'}).stopped);
 const unlockKey=l.layer.emit('keydown',{target:l.get('cinema-lock'),key:'Enter'});assert(!unlockKey.prevented);
 l.click('cinema-lock');l.click('cinema-forward');assert.equal(l.video.currentTime,55);assert(!l.get('player-back').inert);
});
test('brightness affects the picture, speed changes playbackRate, and closing resets both with the lock',()=>{
 const l=lab();l.get('cinema-brightness').value='25';l.get('cinema-brightness').emit('input');assert.equal(l.get('cinema-dimmer').style.opacity,'0.6');
 l.click('cinema-speed');assert(l.player.keepsControlsVisible());l.choose('1.5x');assert.equal(l.video.playbackRate,1.5);assert(l.get('cinema-settings').hidden);
 l.click('cinema-lock');l.player.reset();assert.equal(l.video.playbackRate,1);assert.equal(l.get('cinema-dimmer').style.opacity,'0');assert(!l.get('cinema-controls').inert);
 assert.equal(l.get('cinema-lock').attributes['aria-pressed'],'false');
});
test('a user tap or play button restores audio after muted autoplay without exposing a mute control',()=>{
 const l=lab();l.video.muted=true;l.video.emit('pointerdown');assert.equal(l.video.muted,false);
 l.video.muted=true;l.video.volume=0;l.video.paused=true;l.click('cinema-play');assert.equal(l.video.muted,false);assert.equal(l.video.volume,1);assert(!l.video.paused);
 l.click('cinema-lock');l.video.muted=true;l.video.emit('pointerdown');assert(l.video.muted);
});
test('HLS language and subtitle options use only the tracks supplied by the stream',()=>{
 const hls={audioTracks:[{name:'Português'},{name:'English'}],audioTrack:0,subtitleTracks:[{name:'Português CC'}],subtitleTrack:-1,subtitleDisplay:false};
 const l=lab({hls});l.click('cinema-tracks');l.choose('English');assert.equal(hls.audioTrack,1);
 l.choose('Português CC');assert.equal(hls.subtitleTrack,0);assert(hls.subtitleDisplay);
 l.choose('Desativadas');assert.equal(hls.subtitleTrack,-1);assert(!hls.subtitleDisplay);
});
test('native subtitle selection leaves metadata tracks intact and does not invent audio languages',()=>{
 const l=lab();l.video.textTracks=[{kind:'metadata',mode:'hidden',label:'Metadata'},{kind:'subtitles',mode:'disabled',label:'Português'}];
 l.click('cinema-tracks');assert(!l.choices().some(n=>n.textContent==='Metadata'));l.choose('Português');
 assert.equal(l.video.textTracks[0].mode,'hidden');assert.equal(l.video.textTracks[1].mode,'showing');
 l.choose('Desativadas');assert.equal(l.video.textTracks[1].mode,'disabled');
 assert.equal(l.choices().filter(n=>n.textContent==='English').length,0);
});
test('Recortar validates a non-destructive playback interval, pauses at its end and can restore the full film',()=>{
 const l=lab();l.click('cinema-clip');const inputs=l.get('cinema-settings-body').querySelectorAll('input');
 inputs[0].value='1:10';inputs[1].value='1:00';l.choose('Assistir trecho');assert(!l.get('cinema-settings').hidden);assert.equal(l.video.currentTime,45);
 inputs[1].value='1:30';l.choose('Assistir trecho');assert.equal(l.video.currentTime,70);assert(!l.video.paused);
 l.video.currentTime=90;l.player.update();assert(l.video.paused);l.click('cinema-play');assert.equal(l.video.currentTime,70);
 l.click('cinema-clip');l.choose('Remover recorte');l.player.seekBy(100);assert.equal(l.video.currentTime,170);
});
test('Cast controls act on the remote position and do not change local tracks, speed or crop',()=>{
 const remote={currentTime:80,duration:600,canSeek:true,paused:false};const l=lab({remote});
 l.click('cinema-forward');assert.deepEqual(l.commands,[['seek',90]]);assert.equal(l.video.currentTime,45);
 l.click('cinema-play');assert.equal(l.commands.at(-1)[0],'toggle');l.click('cinema-speed');
 assert.equal(l.choices().length,0);assert.equal(l.video.playbackRate,1);
 remote.canSeek=false;l.player.update();assert(l.get('cinema-seek').disabled);
});
test('settings Escape closes only the menu; returning to embedded playback disables native commands',()=>{
 const l=lab();l.click('cinema-speed');const e=l.layer.emit('keydown',{key:'Escape'});assert(e.stopped);assert(l.get('cinema-settings').hidden);
 l.layer.classList.remove('native-player');l.click('cinema-play');l.click('cinema-forward');l.click('cinema-clip');assert(!l.video.paused);assert.equal(l.video.currentTime,45);assert(l.get('cinema-settings').hidden);
});
test('the native reference layout loads before the app, is cached, preserves TV and favorites and has no volume/mute controls',()=>{
 const html=read('index.html'),app=read('app.js'),sw=read('sw.js');
 for(const id of ['cinema-play','cinema-rewind','cinema-forward','cinema-brightness','cinema-lock','cinema-clip','cinema-speed','cinema-tracks','cinema-cast','player-favorite'])assert.equal(html.split('id="'+id+'"').length-1,1,id);
 for(const id of ['cinema-volume','cinema-volume-level','cinema-mute'])assert(!html.includes('id="'+id+'"'));
 assert(html.indexOf('assets/cinema-player.js')<html.indexOf('src="./app.js'));assert(html.includes('assets/cinema-player.css'));
 assert(sw.includes('./assets/cinema-player.js'));assert(sw.includes('./assets/cinema-player.css'));
 assert(app.includes('cinemaController?.reset()'));assert(app.includes('classList.toggle("native-player",!externalEmbed)'));
});
