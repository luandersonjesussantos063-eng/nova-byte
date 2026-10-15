import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

function setup({native=false}={}){
 const timers=new Map(),instances=[];let next=0,intersection;
 class Element extends EventTarget{
  hidden=false;muted=false;attributes={};children=[];rect={top:140,bottom:340,left:50,right:350,width:300,height:200};
  classes=new Set();classList={contains:n=>this.classes.has(n),add:n=>this.classes.add(n),remove:n=>this.classes.delete(n)};
  setAttribute(k,v){this.attributes[k]=v}removeAttribute(k){delete this.attributes[k];if(k==='src')delete this.src}
  append(v){this.children.push(v);v.parentElement=this}remove(){this.removed=true}
  pause(){this.paused=true}load(){this.released=true}canPlayType(){return native?'maybe':''}
  play(){this.playMuted=this.muted;this.dispatchEvent(new Event('playing'));return Promise.resolve()}
  getBoundingClientRect(){return this.rect}contains(el){return this===el||this.children.includes(el)}closest(){return root.parentElement.hidden?root.parentElement:null}
 }
 const root=new Element();root.parentElement=new Element();
 const gate=new Element();gate.hidden=true;const player=new Element();player.hidden=true;
 const document=new EventTarget();document.body=new Element();document.hidden=false;document.activeElement=null;
 document.getElementById=id=>id==='nplay-profile-gate'?gate:player;document.createElement=()=>new Element();
 const window=new EventTarget();window.innerHeight=800;window.innerWidth=1000;
 window.IntersectionObserver=class{constructor(fn){intersection=fn}observe(){}disconnect(){}};
 class Hls{
  static isSupported=()=>!native;static Events={MANIFEST_PARSED:'manifest',ERROR:'error'};
  constructor(config){this.config=config;this.handlers={};instances.push(this)}
  on(e,fn){this.handlers[e]=fn}attachMedia(video){this.video=video}
  loadSource(url){this.url=url;this.handlers.manifest()}destroy(){this.destroyed=true}
 }
 window.Hls=Hls;
 const context=vm.createContext({window,document,MutationObserver:class{observe(){}},IntersectionObserver:window.IntersectionObserver,setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(readFileSync(new URL('../assets/live-preview.js',import.meta.url),'utf8'),context);
 const manager=window.NPlayLivePreviews.create(root);
 const flush=()=>{for(const [id,timer] of [...timers])if(timer.ms===180){timers.delete(id);timer.fn()}};
 const add=(title,left)=>{const entry={card:new Element(),cover:new Element(),sound:new Element(),url:'https://example.org/'+title+'.m3u8',title};entry.card.append(entry.sound);if(left!==undefined)entry.card.rect={...entry.card.rect,left,right:left+300};manager.register(entry);return entry};
 return {manager,add,flush,instances,document,window,root,gate,intersection:()=>intersection(),video:entry=>entry.cover.children.at(-1)};
}
test('live previews start muted, toggle sound on the card, and reset sound when switching',()=>{
 const s=setup(),a=s.add('A'),b=s.add('B',400);s.flush();
 const first=s.instances[0],entry=first.url.includes('/A.')?a:b,other=entry===a?b:a;
 assert.equal(first.video.playMuted,true);assert.equal(first.video.defaultMuted,true);assert.equal(entry.sound.hidden,false);
 entry.sound.dispatchEvent(new Event('click'));assert.equal(first.video.muted,false);assert.equal(entry.sound.attributes['aria-pressed'],'true');
 const enter=new Event('pointerenter');enter.pointerType='mouse';other.card.dispatchEvent(enter);s.flush();
 assert.equal(first.destroyed,true);assert.equal(first.video.muted,true);assert.equal(first.video.released,true);assert.equal(first.video.removed,true);
 assert.equal(entry.sound.hidden,true);assert.equal(s.instances.at(-1).video.playMuted,true);assert.equal(other.sound.attributes['aria-pressed'],'false');
 s.manager.reset();assert.equal(s.instances.at(-1).destroyed,true);
});
test('leaving the viewport, opening a modal, and hiding the document release playback',()=>{
 const s=setup(),entry=s.add('A');s.flush();const first=s.instances[0];
 entry.card.rect.top=900;entry.card.rect.bottom=1100;s.intersection();assert.equal(first.destroyed,true);
 entry.card.rect.top=140;entry.card.rect.bottom=340;s.intersection();s.flush();assert.equal(s.instances.length,2);
 s.document.body.classes.add('modal-open');s.window.dispatchEvent(new Event('scroll'));assert.equal(s.instances[1].destroyed,true);s.flush();assert.equal(s.instances.length,2);
 s.document.body.classes.clear();s.window.dispatchEvent(new Event('scroll'));s.flush();s.document.hidden=true;s.document.dispatchEvent(new Event('visibilitychange'));assert.equal(s.instances[2].destroyed,true);
});
test('fatal stream errors retain the cover and release HLS resources',()=>{
 const s=setup(),entry=s.add('A');s.flush();const first=s.instances[0];
 first.handlers.error(null,{fatal:true});assert.equal(first.destroyed,true);assert.equal(entry.sound.hidden,true);assert.equal(entry.card.classes.has('nplay-live-preview-playing'),false);
 s.intersection();s.flush();assert.equal(s.instances.length,1);
});
test('native HLS starts muted and stops when the grade is hidden',()=>{
 const s=setup({native:true}),entry=s.add('A');s.flush();const video=s.video(entry);
 assert.equal(video.src,entry.url);assert.equal(video.playMuted,true);assert.equal(s.instances.length,0);
 s.root.parentElement.hidden=true;s.window.dispatchEvent(new Event('scroll'));assert.equal(video.removed,true);assert.equal(video.muted,true);
});
