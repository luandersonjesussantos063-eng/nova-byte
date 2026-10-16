import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../presence.js',import.meta.url),'utf8');
const flush=()=>new Promise(r=>setImmediate(r));
function setup(){
 const handlers={},calls=[],gates={'nplay-access-wall':{hidden:true},'nplay-profile-gate':{hidden:true}};let profile={id:'profile-a',name:'A'},timer;
 const document={visibilityState:'visible',getElementById:id=>gates[id],addEventListener:(k,f)=>handlers[k]=f};
 const window={NPlayProfiles:{current:()=>profile},NPlayAccessClient:{auth:{getSession:async()=>({data:{session:{}}})},rpc:async(_,args)=>{calls.push(args);return {error:null}}},addEventListener:(k,f)=>handlers[k]=f};
 vm.runInNewContext(source,{window,document,navigator:{onLine:true},crypto:{randomUUID:()=> 'tab'},MutationObserver:class{observe(){}},setInterval:f=>timer=f});
 return {calls,gates,document,handlers,tick:()=>timer(),setProfile:p=>profile=p};
}
test('records selected visible profile and stops on background',async()=>{const h=setup();await flush();assert.equal(h.calls[0].p_visible,true);h.document.visibilityState='hidden';await h.handlers.visibilitychange();assert.equal(h.calls.at(-1).p_visible,false);const n=h.calls.length;await h.tick();assert.equal(h.calls.length,n);});
test('profile change closes old session before recording new profile',async()=>{const h=setup();await flush();h.setProfile({id:'profile-b',name:'B'});await h.handlers['nplay-profile-change']();assert.deepEqual(h.calls.slice(-2).map(x=>[x.p_profile,x.p_visible]),[['profile-a',false],['profile-b',true]]);});
test('access and profile gates stop time collection',async()=>{const h=setup();await flush();h.gates['nplay-access-wall'].hidden=false;await h.tick();assert.equal(h.calls.at(-1).p_visible,false);const n=h.calls.length;await h.tick();assert.equal(h.calls.length,n);h.gates['nplay-access-wall'].hidden=true;h.gates['nplay-profile-gate'].hidden=false;await h.tick();assert.equal(h.calls.length,n);});
