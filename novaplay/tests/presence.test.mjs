import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../presence.js',import.meta.url),'utf8');
const flush=()=>new Promise(r=>setImmediate(r));
function setup(){
 const handlers={},calls=[],transmissions=[],gates={'nplay-access-wall':{hidden:true},'nplay-profile-gate':{hidden:true}};
 let profile={id:'profile-a',name:'A'},interval,online=true,hasSession=true,now=120000;
 const document={
  visibilityState:'visible',
  getElementById:id=>gates[id],
  addEventListener:(k,f)=>handlers[k]=f
 };
 const db={
  supabaseUrl:'https://example.supabase.co',
  supabaseKey:'public-publishable-key',
  auth:{getSession:async()=>({data:{session:hasSession?{access_token:'test-auth-token'}:null}})},
  rpc:async(_,args)=>{calls.push(args);return {error:null}}
 };
 const window={
  NPlayProfiles:{current:()=>profile},NPlayAccessClient:db,
  addEventListener:(k,f)=>handlers[k]=f
 };
 const navigator={get onLine(){return online}};
 const fetch=async(url,options)=>{transmissions.push({url,options});return {ok:true}};
 vm.runInNewContext(source,{window,document,navigator,fetch,Date:class extends Date{static now(){return now}},
  AbortController,crypto:{randomUUID:()=> 'tab-uuid'},
  MutationObserver:class{observe(){}},
  setInterval:(f,ms)=>{interval={f,ms}},
  setTimeout,clearTimeout,console:{warn(){}}});
 return {calls,gates,document,handlers,window,transmissions,
  tick:()=>interval.f(),intervalMs:()=>interval.ms,
  setProfile:p=>profile=p,
  setOnline:value=>online=value,
  setSession:value=>hasSession=value
 };
}
test('15-second heartbeat records only a selected foreground profile',async()=>{
 const h=setup();await flush();
 assert.equal(h.calls[0].p_visible,true);
 assert.equal(h.intervalMs(),15000);
 await h.tick();assert.equal(h.calls.at(-1).p_visible,true);
 h.document.visibilityState='hidden';
 await h.handlers.visibilitychange();assert.equal(h.calls.at(-1).p_visible,false);
 const n=h.calls.length;
 await h.tick();assert.equal(h.calls.length,n);
});
test('profile change closes old session before recording the new one',async()=>{
 const h=setup();await flush();
 h.setProfile({id:'profile-b',name:'B'});
 await h.handlers['nplay-profile-change']();
 assert.deepEqual(h.calls.slice(-2).map(x=>[x.p_profile,x.p_visible]),[['profile-a',false],['profile-b',true]]);
});
test('access and profile gate close sessions and prevent false online',async()=>{
 const h=setup();await flush();
 h.gates['nplay-access-wall'].hidden=false;
 await h.tick();assert.equal(h.calls.at(-1).p_visible,false);
 const n=h.calls.length;
 await h.tick();assert.equal(h.calls.length,n);
 h.gates['nplay-access-wall'].hidden=true;h.gates['nplay-profile-gate'].hidden=false;
 await h.tick();assert.equal(h.calls.length,n);
});
test('pagehide sends an authorized keepalive offline signal immediately',async()=>{
 const h=setup();await flush();
 await h.handlers.pagehide();
 assert.equal(h.transmissions.length,1);
 const req=h.transmissions[0];
 assert.equal(req.url,'https://example.supabase.co/rest/v1/rpc/novaplay_profile_heartbeat');
 assert.equal(req.options.keepalive,true);
 assert.equal(req.options.headers.authorization,'Bearer test-auth-token');
 assert.deepEqual(JSON.parse(req.options.body),{p_profile:'profile-a',p_name:'A',p_tab:'tab-uuid',p_visible:false});
 await flush();
 assert.equal(h.calls.at(-1).p_visible,false);
});
test('offline event closes previous profile, then resumes on reconnect',async()=>{
 const h=setup();await flush();
 h.setOnline(false);await h.handlers.offline();
 assert.equal(h.calls.at(-1).p_visible,false);
 const n=h.calls.length;await h.tick();assert.equal(h.calls.length,n);
 h.setOnline(true);await h.handlers.online();
 assert.equal(h.calls.at(-1).p_visible,true);
});
test('expired or missing authorization never registers a profile online',async()=>{
 const h=setup();await flush();
 h.setSession(false);
 h.setProfile({id:'profile-b',name:'B'});
 await h.handlers['nplay-profile-change']();
 assert.equal(h.calls.at(-1).p_visible,true); // Old tab may close with cached session request.
 assert.equal(h.calls.filter(x=>x.p_profile==='profile-b'&&x.p_visible).length,0);
});
