import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../assets/intro-audio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const profiles=readFileSync(new URL('../profiles.js',import.meta.url),'utf8');
function harness(){
 const values=new Map(),events=[];
 const localStorage={
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,value)
 };
 const window={matchMedia:()=>({matches:false}),dispatchEvent:e=>events.push(e),setTimeout:()=>1};
 const document={hidden:false,documentElement:{dataset:{nplayAccess:'approved'}}};
 const scope={window,localStorage,document,performance:{now:()=>100},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}}};
 vm.runInNewContext(code,scope);
 return {audio:window.NPlayIntroAudio,values,events,window,document};
}
test('NPlay intro uses a unique local signature without external audio or Netflix assets',()=>{
 assert.match(html,/intro-audio\.js\?v=0\.51\.4/);
 assert.match(profiles,/Som da abertura/);
 assert.doesNotMatch(code,/https?:\/\/|\.mp3|\.wav|fetch\(/i);
 assert.match(code,/clash\(/);
 assert.match(code,/swoosh\(/);
 assert.match(code,/createDynamicsCompressor/);
});
test('sound is enabled initially, persists opt-out, and never blocks a browser without audio support',async()=>{
 const s=harness();
 assert.equal(s.audio.enabled(),true);
 assert.equal(await s.audio.play(),false);
 assert.equal(s.audio.setEnabled(false),false);
 assert.equal(s.values.get('nplay-opening-audio-enabled-v1'),'off');
 assert.equal(s.audio.enabled(),false);
 assert.equal(await s.audio.play(),false);
 assert.equal(s.audio.setEnabled(true),true);
 assert.equal(s.audio.enabled(),true);
 assert.equal(s.events.length,2);
});
test('no autoplay audio plays for unauthorized clients or hidden tabs',async()=>{
 const s=harness();
 s.document.documentElement.dataset.nplayAccess='pending';
 assert.equal(await s.audio.play(),false);
 s.document.hidden=true;
 assert.equal(await s.audio.play(),false);
});
