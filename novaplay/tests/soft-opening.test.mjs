import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../assets/soft-opening.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const access=readFileSync(new URL('../access.js',import.meta.url),'utf8');

function scene(){
 let now=0,id=0,soundCount=0;
 const queue=new Map(),callbacks=new Map(),classes=new Set();
 const root={hidden:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};
 const document={getElementById:n=>n==='nplay-soft-opening'?root:null,documentElement:{dataset:{}}};
 const window={
   matchMedia:()=>({matches:false}),
   NPlayIntroAudio:{play:()=>{soundCount++}},
   addEventListener:(name,cb)=>callbacks.set(name,cb),
   setTimeout:(fn,delay)=>{const key=++id;queue.set(key,{at:now+delay,fn});return key},
   clearTimeout:key=>queue.delete(key)
 };
 vm.runInNewContext(script,{document,window,performance:{now:()=>now}});
 function step(ms){
  const until=now+ms;
  while(true){
   const match=[...queue.entries()].filter(([,x])=>x.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!match)break;
   const [key,timer]=match;queue.delete(key);now=timer.at;timer.fn();
  }
  now=until;
 }
 function emit(state){document.documentElement.dataset.nplayAccess=state;callbacks.get('nplay-access-state')({detail:{state}})}
 return {root,classes,step,emit,callbacks,document,soundCount:()=>soundCount};
}

test('approved returning device sees the intro, never the access wall',()=>{
 assert.match(html,/id="nplay-access-wall" data-state="loading" hidden/);
 assert.match(html,/id="nplay-soft-opening" aria-hidden="true"/);
 assert.match(access,/broadcastAccess\("approved"\)/);
 const s=scene();
 s.step(100);s.emit('approved');
 s.step(2199);
 assert.equal(s.root.hidden,false);
 assert.equal(s.classes.has('is-leaving'),false);
 s.step(1);
 assert.equal(s.classes.has('is-leaving'),true);
 assert.equal(s.root.hidden,false);
 s.step(450);
 assert.equal(s.root.hidden,true);
});

test('new, pending or denied devices see the access form, not a repeated intro',()=>{
 for(const status of ['new','pending','denied','revoked','connection']){
  const s=scene();s.step(40);s.emit(status);
  assert.equal(s.root.hidden,true,status);
  assert.equal(s.classes.has('is-leaving'),false,status);
 }
});
test('intro never unlocks app without verified approval',()=>{
 const s=scene();s.step(20000);assert.equal(s.root.hidden,false);
 assert.equal(s.document.documentElement.dataset.nplayAccess,undefined);
});

test('late authorization keeps the cover on until verified',()=>{
 const s=scene();s.step(3200);
 assert.equal(s.root.hidden,false);
 s.emit('approved');s.step(0);
 assert.equal(s.soundCount(),1);
 assert.equal(s.classes.has('is-leaving'),false);
 s.step(2200);assert.equal(s.classes.has('is-leaving'),true);
 s.step(450);assert.equal(s.root.hidden,true);
});

test('audio begins only once after verified approval, not during onboarding',()=>{
 const a=scene();
 a.emit('pending');assert.equal(a.soundCount(),0);
 const b=scene();
 b.emit('approved');b.emit('approved');
 assert.equal(b.soundCount(),1);
 const c=scene();
 c.step(2000);assert.equal(c.soundCount(),0);
 c.emit('connection');assert.equal(c.soundCount(),0);
});
