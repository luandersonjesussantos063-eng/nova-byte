import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const code=read('assets/intro-audio.js').toString('utf8');
const html=read('index.html').toString('utf8');
const profiles=read('profiles.js').toString('utf8');
const sample=read('assets/nplay-opening-original-final.m4a');

function harness(withAudio=false){
 const values=new Map(),events=[],played=[];
 const localStorage={
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,value)
 };
 class MockAudio{
  constructor(url){this.url=url;this.currentTime=24;played.push(this)}
  pause(){this.paused=true}
  play(){this.timesPlayed=(this.timesPlayed||0)+1;return Promise.resolve()}
 }
 const window={matchMedia:()=>({matches:false}),dispatchEvent:e=>events.push(e),setTimeout:()=>1};
 const opening={hidden:false,classList:{contains:()=>false}};
 const document={
  baseURI:'https://example.com/novaplay/',
  hidden:false,documentElement:{dataset:{nplayAccess:'approved'}},
  getElementById:id=>id==='nplay-soft-opening'?opening:null
 };
 const scope={window,localStorage,document,URL,Audio:withAudio?MockAudio:undefined,
  performance:{now:()=>100},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail}}};
 vm.runInNewContext(code,scope);
 return {audio:window.NPlayIntroAudio,values,events,window,document,played};
}

test('opening plays a genuine recorded M4A excerpt, not a recreated synthesizer',()=>{
 assert.match(html,/intro-audio\.js\?v=0\.51\.6/);
 assert.match(profiles,/Som da abertura/);
 assert.match(code,/nplay-opening-original-final\.m4a/);
 assert.doesNotMatch(code,/createOscillator|createBufferSource|function synth|const frequencies=/);
 assert.equal(sample.subarray(4,8).toString(),'ftyp');
 const sha=createHash('sha1').update(Buffer.from('blob '+sample.length+'\0')).update(sample).digest('hex');
 assert.equal(sha,'bc9220571039de99161e6a82de728d1c90f61172');
});
test('opening and bell preview play the same hosted recording from its beginning',async()=>{
 const s=harness(true);
 assert.equal(await s.audio.play(),true);
 assert.equal(s.played.length,1);
 assert.equal(s.played[0].timesPlayed,1);
 assert.equal(s.played[0].currentTime,0);
 assert.equal(s.played[0].url,'https://example.com/novaplay/assets/nplay-opening-original-final.m4a?v=0.51.6');
 assert.equal(await s.audio.preview(),true);
 assert.equal(s.played.length,1);
 assert.equal(s.played[0].timesPlayed,2);
});
test('sound setting persists and missing audio support never blocks app',async()=>{
 const s=harness();
 assert.equal(s.audio.enabled(),true);
 assert.equal(await s.audio.play(),false);
 assert.equal(s.audio.setEnabled(false),false);
 assert.equal(s.values.get('nplay-opening-audio-enabled-v1'),'off');
 assert.equal(s.audio.enabled(),false);
 assert.equal(await s.audio.play(),false);
 assert.equal(s.audio.setEnabled(true),true);
 assert.equal(s.events.length,2);
});
test('unapproved device and hidden tab cannot autoplay the recording',async()=>{
 const s=harness(true);
 s.document.documentElement.dataset.nplayAccess='pending';
 assert.equal(await s.audio.play(),false);
 s.document.documentElement.dataset.nplayAccess='approved';
 s.document.hidden=true;
 assert.equal(await s.audio.play(),false);
 assert.equal(s.played.length,0);
});
