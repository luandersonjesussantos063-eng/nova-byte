import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
function setup({autoPlay=true}={}){
 class Element extends EventTarget{
  hidden=false;disabled=false;clientHeight=760;style={};children=[];attributes={};classes=new Set();
  classList={contains:n=>this.classes.has(n),add:n=>this.classes.add(n),remove:n=>this.classes.delete(n)};
  append(node){this.children.push(node)}replaceChildren(){this.children=[]}setAttribute(n,v){this.attributes[n]=v}removeAttribute(n){delete this.attributes[n];if(n==='src')delete this.src}
  play(){this.mutedAtPlay=this.muted;if(autoPlay)this.dispatchEvent(new Event('playing'));return Promise.resolve()}pause(){this.paused=true}load(){this.released=true}remove(){this.removed=true}focus(){}canPlayType(){return 'maybe'}
 }
 const nodes=new Map(),el=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 el('nplay-profile-gate').hidden=true;
 const document=new EventTarget();document.getElementById=el;document.createElement=()=>new Element();document.body=new Element();document.readyState='complete';document.hidden=false;
 const instances=[],opened=[];const window=new EventTarget();window.scrollY=0;window.NovaPlayHeroScenes={stop(){}};window.NovaPlayPlayer={openHls:(...args)=>opened.push(args)};
 window.Hls=class{
  static isSupported=()=>true;static Events={MANIFEST_PARSED:'manifest',ERROR:'error'};
  constructor(){this.events={};instances.push(this)}on(e,fn){this.events[e]=fn}attachMedia(video){this.video=video}loadSource(url){this.url=url;this.events.manifest()}destroy(){this.destroyed=true}
 };
 let timer=0;const context=vm.createContext({window,document,URL,MutationObserver:class{observe(){}},setTimeout:()=>++timer,clearTimeout(){}});
 vm.runInContext(readFileSync(new URL('../assets/hero-live.js',import.meta.url),'utf8'),context);
 const channels=[{id:'sbt',title:'SBT Interior SP',stream_type:'hls',embed_url:'https://example.org/sbt.m3u8'},{id:'record',title:'RecordTV MT',stream_type:'hls',embed_url:'https://example.org/record.m3u8'},{id:'iframe',title:'Externo',stream_type:'iframe',embed_url:'https://example.org/embed'},{id:'unsafe',title:'Inválido',stream_type:'hls',embed_url:'http://example.org/live.m3u8'}];
 return {api:window.NPlayHeroLive,el,instances,channels,window,document,opened};
}
test('hero uses published direct channels, prioritizes Record MT and starts muted',()=>{
 const s=setup();s.api.setChannels(s.channels);
 assert.equal(s.el('hero-live-channel').children.length,2);assert.equal(s.el('hero-title').textContent,'RecordTV MT');
 assert.equal(s.instances[0].video.mutedAtPlay,true);assert.equal(s.instances[0].video.defaultMuted,true);assert.equal(s.el('hero-live-sound').disabled,false);
 assert.equal(s.el('hero-dots').hidden,true);assert.equal(s.el('hero').classes.has('hero-live-playing'),true);
});
test('switching channels releases the previous video and resets audio',()=>{
 const s=setup();s.api.setChannels(s.channels);const first=s.instances[0];s.el('hero-live-sound').dispatchEvent(new Event('click'));assert.equal(first.video.muted,false);
 s.el('hero-live-channel').value='sbt';s.el('hero-live-channel').dispatchEvent(new Event('change'));
 assert.equal(first.destroyed,true);assert.equal(first.video.released,true);assert.equal(first.video.muted,true);assert.equal(s.instances[1].video.mutedAtPlay,true);assert.equal(s.el('hero-title').textContent,'SBT Interior SP');
});
test('scroll and document visibility stop playback; manual pause persists until resumed',()=>{
 const s=setup();s.api.setChannels(s.channels);s.window.scrollY=500;s.window.dispatchEvent(new Event('scroll'));assert.equal(s.instances[0].destroyed,true);
 s.window.scrollY=0;s.window.dispatchEvent(new Event('scroll'));assert.equal(s.instances.length,2);
 s.el('hero-live-toggle').dispatchEvent(new Event('click'));assert.equal(s.instances[1].destroyed,true);s.api.sync();assert.equal(s.instances.length,2);
 s.el('hero-live-toggle').dispatchEvent(new Event('click'));assert.equal(s.instances.length,3);
 s.document.hidden=true;s.document.dispatchEvent(new Event('visibilitychange'));assert.equal(s.instances[2].destroyed,true);
});
test('opening full player stops the banner and uses the selected live channel',()=>{
 const s=setup();s.api.setChannels(s.channels);s.el('hero-play').onclick();assert.equal(s.instances[0].destroyed,true);assert.equal(s.opened[0][0],'https://example.org/record.m3u8');assert.equal(s.opened[0][1],'RecordTV MT');
});
test('failed signals try another published channel and then show an unavailable status',()=>{
 const s=setup({autoPlay:false});s.api.setChannels(s.channels);s.instances[0].events.error(null,{fatal:true});assert.equal(s.instances[0].destroyed,true);assert.equal(s.instances.length,2);
 s.instances[1].events.error(null,{fatal:true});assert.match(s.el('hero-live-status').textContent,/Sinal indisponível/);s.api.sync();assert.equal(s.instances.length,2);
});
