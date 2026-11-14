import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const ctx={crypto:webcrypto,setTimeout,clearTimeout,setInterval,clearInterval,AbortSignal,navigator:{onLine:true},console};vm.createContext(ctx);vm.runInContext(readFileSync('questoes/sync.js','utf8'),ctx);const S=ctx.MFSync;
const clone=v=>JSON.parse(JSON.stringify(v));
const empty=()=>({version:3,progress:{},events:[],sessions:[],topics:{},essay:'',essayWeek:'',settings:{goal:5,timer:'off'},session:null});
function server(){const rows=new Map();let writes=0,offline=false,hold=null;return {rows,get writes(){return writes;},set offline(v){offline=v;},set hold(v){hold=v;},fetch:async(url,request)=>{
 if(offline)throw Error('offline');const body=JSON.parse(request.body),code=request.headers.Authorization;
 if(hold){const h=hold;hold=null;await h;}
 const row=rows.get(code);const response=(status,data)=>({status,ok:status===200,json:async()=>clone(data)});
 if(body.action==='pull')return row?response(200,row):response(404,{});
 if((row?.revision||0)!==body.revision)return response(409,{});
 rows.set(code,{profile:body.profile,state:body.state,revision:body.revision+1});writes++;return response(200,{revision:body.revision+1});
}};}
function device(server){let state=S.touch(empty(),empty()),label='';const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};const client=S.create({fetch:server.fetch,storage,crypto:webcrypto,read:()=>state,apply:s=>{state=clone(s);},status:s=>{label=s;}});return {client,storage,get label(){return label;},get state(){return state;},edit(fn){const before=clone(state);fn(state);S.touch(state,before);},start(p='luanderson'){client.start(p);},stop(){client.stop();}};}
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setTimeout(r,2));};
test('Two devices pair once and exchange offline attempts, notes, topics and settings without duplicates',async()=>{
 const api=server(),a=device(api),b=device(api);try{
 a.start();b.start();await settle();await b.client.connect(a.client.getCode());await settle();
 api.offline=true;
 a.edit(s=>{s.essay='Redação de estudo';s.events.push({id:'q1',at:1,answer:'A'});s.topics['Português|0']=true;});
 b.edit(s=>{s.settings.goal=10;s.events.push({id:'q2',at:2,answer:'B'});});
 await a.client.pump();assert.match(a.label,/Pendente/);assert.equal(a.state.essay,'Redação de estudo');
 api.offline=false;await a.client.pump();await b.client.pump();await a.client.pump();
 assert.equal(a.state.events.length,2);assert.equal(b.state.events.length,2);assert.equal(b.state.essay,'Redação de estudo');assert.equal(a.state.settings.goal,10);assert.equal(b.state.topics['Português|0'],true);
 const writes=api.writes;await a.client.pump();await b.client.pump();assert.equal(api.writes,writes);
 }finally{a.stop();b.stop();}
});
test('Connecting rejects the other person code and invalid or nonexistent codes',async()=>{
 const api=server(),a=device(api),j=device(api);try{a.start();j.start('jackeline');await settle();await assert.rejects(j.client.connect(a.client.getCode()),/mesmo perfil/);await assert.rejects(a.client.connect('Luanderson'),/mesmo perfil/);await assert.rejects(a.client.connect(S.makeCode('luanderson',webcrypto)),/não encontrado/);assert.notEqual(a.client.getCode(),j.client.getCode());}finally{a.stop();j.stop();}
});
test('An in-flight old profile response cannot modify the newly selected profile',async()=>{
 const api=server(),a=device(api);try{a.start();await settle();let release;api.hold=new Promise(r=>{release=r;});const pending=a.client.pump();a.stop();a.edit(s=>{s.essay='Jackeline';});a.start('jackeline');release();await pending;await settle();assert.equal(a.state.essay,'Jackeline');assert.ok(a.client.getCode().startsWith('MF1-J-'));}finally{a.stop();}
});
test('Concurrent revisions retry without losing either device attempt',async()=>{
 const api=server(),a=device(api),b=device(api);try{a.start();b.start();await settle();await b.client.connect(a.client.getCode());await settle();a.edit(s=>s.events.push({id:'q1',at:1,answer:'A'}));b.edit(s=>s.events.push({id:'q2',at:2,answer:'B'}));await Promise.all([a.client.pump(),b.client.pump()]);await a.client.pump();await b.client.pump();await a.client.pump();assert.equal(a.state.events.length,2);assert.equal(b.state.events.length,2);}finally{a.stop();b.stop();}
});
test('Merge preserves separate completed sessions and explicit unchecked topics',()=>{
 const a=empty(),b=empty();a.sessions=[{at:1,exam:'pmmg2024',kind:'daily'}];b.sessions=[{at:2,exam:'pmmg2024',kind:'daily'}];a.topics.x=true;b.topics.x=false;a._sync={maps:{topics:{x:1}}};b._sync={maps:{topics:{x:2}}};const merged=S.merge(a,b);assert.equal(merged.sessions.length,2);assert.equal(merged.topics.x,false);assert.deepEqual(clone(S.merge(merged,merged)),clone(merged));
});
test('JSONB property order does not trigger writes on every poll',async()=>{
 const api=server(),a=device(api);try{a.start();await settle();const row=api.rows.get('Bearer '+a.client.getCode());row.state=Object.fromEntries(Object.entries(row.state).reverse());const writes=api.writes;await a.client.pump();assert.equal(api.writes,writes);}finally{a.stop();}
});
