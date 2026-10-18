import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const original=fs.readFileSync(new URL('../admin/presence-admin.js',import.meta.url),'utf8');
// Inject a pure helper only in this test runtime; production code is untouched.
const script=original.replace("document.getElementById('presence-refresh')?.addEventListener", "window.__presenceMath={presenceState,duration};document.getElementById('presence-refresh')?.addEventListener");
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(rows=[]){
 let elapsed=0,rpcCalls=0;
 const handlers={},timers=[],created=[];
 class Node{
  constructor(){this.hidden=false;this.children=[];this.style={};this.parentElement=null;this.textContent='';this.className='';this.title='';this.events={};}
  append(...nodes){for(const node of nodes){this.children.push(node);node.parentElement=this;}}
  replaceChildren(){this.children=[];}
  addEventListener(name,fn){this.events[name]=fn;}
 }
 const items={
  'nplay-presence-admin':new Node(),'presence-list':new Node(),
  'presence-status':new Node(),'dashboard':new Node(),'presence-refresh':new Node()
 };
 const document={
  hidden:false,
  getElementById:id=>items[id]||null,
  createElement:tag=>{const n=new Node();n.tag=tag;created.push(n);return n;},
  addEventListener:(event,callback)=>handlers['document:'+event]=callback
 };
 const window={
  supabase:{createClient:()=>({rpc:async()=>{rpcCalls++;return {data:rows,error:null}}})},
  addEventListener:(event,callback)=>handlers['window:'+event]=callback
 };
 const sandbox={document,window,MutationObserver:class{observe(){}},performance:{now:()=>elapsed},
  setInterval:(callback,period)=>timers.push({callback,period}),console:{warn(){}},Date};
 vm.runInNewContext(script,sandbox);
 const tick=(delta)=>{elapsed+=delta;const t=timers.find(x=>x.period===1000);t.callback();};
 return {items,window,document,tick,flush,intervals:timers,rpcCalls:()=>rpcCalls,handlers};
}
test('admin refreshes every 10 seconds and updates displayed seconds each second',async()=>{
 const serverNow=Date.now(),lastSeen=serverNow-15000;
 const h=harness([{user_id:'12345678-0000-0000-0000-000000000000',profile_id:'p',profile_name:'Perfil de teste',
  is_visible:true,server_now:new Date(serverNow).toISOString(),last_seen:new Date(lastSeen).toISOString(),
  session_seconds:100,today_seconds:220}]);
 await flush();
 assert(h.intervals.some(x=>x.period===10000));
 assert(h.intervals.some(x=>x.period===1000));
 const card=h.items['presence-list'].children[0];
 assert.equal(card.children[1].textContent,'● Online');
 assert.match(card.children[3].textContent,/Sessão atual: 1min 55s/);
 h.tick(2000);
 assert.match(card.children[3].textContent,/1min 57s/);
 assert.match(h.items['presence-status'].textContent,/1 perfil\(is\) online/);
});
test('stale sessions turn offline automatically after 45 seconds without new RPC',async()=>{
 const serverNow=Date.now(),h=harness([{user_id:'12345678',profile_name:'Perfil antigo',
  is_visible:true,server_now:new Date(serverNow).toISOString(),last_seen:new Date(serverNow-30000).toISOString(),
  session_seconds:40,today_seconds:80}]);
 await flush();
 assert.equal(h.items['presence-list'].children[0].children[1].textContent,'● Online');
 const calls=h.rpcCalls();
 h.tick(16000);
 assert.equal(h.items['presence-list'].children[0].children[1].textContent,'Offline');
 assert.equal(h.rpcCalls(),calls);
 assert.match(h.items['presence-status'].textContent,/0 perfil\(is\) online/);
});
test('recent backgrounded profile is not counted as online',async()=>{
 const now=Date.now(),h=harness([{user_id:'12345678',profile_name:'Em segundo plano',
  is_visible:false,server_now:new Date(now).toISOString(),last_seen:new Date(now-8000).toISOString(),
  session_seconds:40,today_seconds:80}]);
 await flush();
 assert.equal(h.items['presence-list'].children[0].children[1].textContent,'Em segundo plano');
 assert.match(h.items['presence-status'].textContent,/0 perfil\(is\) online/);
});
test('closed or hidden administration panel does not trigger unnecessary API calls',async()=>{
 const h=harness([]);await flush();const first=h.rpcCalls();
 h.items['nplay-presence-admin'].hidden=true;
 const refresh=h.intervals.find(x=>x.period===10000).callback;
 await refresh();assert.equal(h.rpcCalls(),first);
});
