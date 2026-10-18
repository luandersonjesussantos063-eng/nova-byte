import {createHash} from 'node:crypto';
import {MediaEngine,ENGINE_ORIGIN} from './media-engine.mjs';
import {xtreamIdentity} from './xtream-client.mjs';

const fail=code=>Object.assign(Error(code),{code});
function sourceKey(raw){
 const i=xtreamIdentity(raw);
 return createHash('sha256').update(JSON.stringify([i.origin,i.user,i.password,i.id])).digest('hex');
}

// Bounded independent channel sessions; viewers of the same channel reuse one.
export class MultiEngine {
 constructor({capacity=2,engineFactory=()=>new MediaEngine()}={}){
  this.slots=Array.from({length:capacity},()=>({key:null,pending:0,viewers:new Set(),tasks:new Set(),closing:null,engine:engineFactory()}));
  this.client=this.slots[0].engine.client;this.released=new Map();
 }
 async use(method,raw,args,owner='default'){
  const key=sourceKey(raw);
  for(const [id,expires] of this.released)if(expires<Date.now())this.released.delete(id);
  if(this.released.has(key+owner))throw fail('ENGINE_ASSET_GONE');
  let slot=this.slots.find(s=>s.key===key&&!s.closing);
  if(!slot)slot=this.slots.find(s=>!s.closing&&(!s.key||(!s.engine.current&&!s.pending)||(!s.pending&&(s.engine.current?.error||s.engine.current?.controller?.signal.aborted))));
  if(!slot){
   const closing=this.slots.filter(s=>s.closing).map(s=>s.closing);
   if(closing.length){await Promise.race(closing);return this.use(method,raw,args,owner);}
   throw fail('ENGINE_BUSY');
  }
  if(slot.key!==key||(!slot.engine.current&&!slot.pending))slot.viewers.clear();
  slot.viewers.add(owner);
  slot.key=key;
  slot.pending++;
  const task=slot.engine[method](raw,...args);slot.tasks.add(task);
  try{return await task;}
  catch(error){slot.viewers.delete(owner);throw error;}
  finally{slot.pending--;slot.tasks.delete(task);}
 }
 async start(raw,owner='default'){return this.use('start',raw,[owner],owner);}
 async stream(raw,signal,owner='default'){return this.use('stream',raw,[signal,owner],owner);}
 async release(raw,owner){
  const key=sourceKey(raw);
  this.released.set(key+owner,Date.now()+90000);
  const slot=this.slots.find(s=>s.key===key);
  if(!slot||!slot.viewers.delete(owner)||slot.viewers.size)return {ok:true};
  if(!slot.closing){
   slot.closing=(async()=>{
    await Promise.allSettled([...slot.tasks]);
    await slot.engine.stop();slot.key=null;
   })().finally(()=>{slot.closing=null;});
  }
  await slot.closing;return {ok:true};
 }
 async asset(raw,owner='default'){
  const u=new URL(raw);
  if(u.origin!==ENGINE_ORIGIN)throw fail('ENGINE_ASSET_GONE');
  const id=/^\/session\/([a-f0-9]{32})\//.exec(u.pathname)?.[1];
  const slot=this.slots.find(s=>s.engine.current?.id===id);
  if(!slot||slot.closing||!slot.viewers.has(owner))throw fail('ENGINE_ASSET_GONE');
  return slot.engine.asset(raw);
 }
 status(){
  const states=this.slots.map(s=>s.engine.status());
  const active=states.filter(s=>s.channels_receiving>0&&s.stage!=='failed');
  const failed=states.find(s=>s.stage==='failed');
  return {...(active[0]||failed||states[0]),channels_receiving:active.length,
   channels_capacity:this.slots.length,
   sessions:states.map(s=>({stage:s.stage,code:s.code,bytes_received:s.bytes_received}))};
 }
 async close(){await Promise.all(this.slots.map(s=>s.engine.close()));}
}
