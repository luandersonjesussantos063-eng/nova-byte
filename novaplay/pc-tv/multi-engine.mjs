import {createHash} from 'node:crypto';
import {MediaEngine,ENGINE_ORIGIN} from './media-engine.mjs';
import {xtreamIdentity} from './xtream-client.mjs';

const fail=code=>Object.assign(Error(code),{code});
function sourceKey(raw){
 const i=xtreamIdentity(raw);
 return createHash('sha256').update(JSON.stringify([i.origin,i.user,i.password,i.id])).digest('hex');
}

// Two independent upstream channel sessions; viewers of the same channel reuse one.
export class MultiEngine {
 constructor({capacity=2}={}){
  this.slots=Array.from({length:capacity},()=>({key:null,engine:new MediaEngine()}));
  this.client=this.slots[0].engine.client;
 }
 choose(raw){
  const key=sourceKey(raw);
  let slot=this.slots.find(s=>s.key===key);
  if(slot)return slot.engine;
  slot=this.slots.find(s=>!s.key||!s.engine.current);
  if(!slot)throw fail('ENGINE_BUSY');
  slot.key=key;
  return slot.engine;
 }
 async start(raw,owner='default'){return this.choose(raw).start(raw,owner);}
 async stream(raw,signal,owner='default'){return this.choose(raw).stream(raw,signal,owner);}
 async asset(raw){
  const u=new URL(raw);
  if(u.origin!==ENGINE_ORIGIN)throw fail('ENGINE_ASSET_GONE');
  const id=/^\/session\/([a-f0-9]{32})\//.exec(u.pathname)?.[1];
  const slot=this.slots.find(s=>s.engine.current?.id===id);
  if(!slot)throw fail('ENGINE_ASSET_GONE');
  return slot.engine.asset(raw);
 }
 status(){
  const states=this.slots.map(s=>s.engine.status());
  const active=states.filter(s=>s.channels_receiving>0);
  const failed=states.find(s=>s.stage==='failed');
  return {...(active[0]||failed||states[0]),channels_receiving:active.length,
   channels_capacity:this.slots.length,
   sessions:states.map(s=>({stage:s.stage,code:s.code,bytes_received:s.bytes_received}))};
 }
 async close(){await Promise.all(this.slots.map(s=>s.engine.close()));}
}
