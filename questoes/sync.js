/* Offline-first PMMG sync. Codes are private capabilities, never public profile IDs. */
(function(root){
'use strict';
const ENDPOINT='https://vajlhodqxskozuxxlujv.supabase.co/functions/v1/missao-farda-sync';
const clone=x=>JSON.parse(JSON.stringify(x));
function stable(value){if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return "["+value.map(stable).join(",")+"]";return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";}
const same=(a,b)=>stable(a)===stable(b);
const stamp=()=>Date.now();
function touch(next,previous){
 const meta=clone(next._sync||{fields:{},maps:{}});meta.fields=meta.fields||{};meta.maps=meta.maps||{};
 meta.updated=Number(meta.updated)||0;
 const now=Math.max(stamp(),meta.updated+1);let changed=false;
 for(const field of ['essay','essayWeek','session']){meta.fields[field]=meta.fields[field]||0;if(!same(next[field],previous?.[field])){meta.fields[field]=now;changed=true;}}
 for(const field of ['settings','topics','progress']){
  meta.maps[field]=meta.maps[field]||{};
  for(const key of new Set([...Object.keys(next[field]||{}),...Object.keys(previous?.[field]||{})])){
   meta.maps[field][key]=meta.maps[field][key]||0;
   if(!same(next[field]?.[key],previous?.[field]?.[key])){meta.maps[field][key]=now;changed=true;}
  }
 }
 if(!same(next.events,previous?.events)||!same(next.sessions,previous?.sessions))changed=true;
 if(changed)meta.updated=now;
 next._sync=meta;return next;
}
function merge(a,b){
 if(!b)return clone(a);if(!a)return clone(b);
 const out=clone(a),am=a._sync||{},bm=b._sync||{};
 out._sync={fields:{...(am.fields||{})},maps:clone(am.maps||{}),updated:Math.max(am.updated||0,bm.updated||0)};
 for(const field of ['essay','essayWeek','session']){
  const at=am.fields?.[field]||0,bt=bm.fields?.[field]||0;
  if(bt>at||(bt===at&&stable(b[field]??null)>stable(a[field]??null)))out[field]=clone(b[field]??null);
  out._sync.fields[field]=Math.max(at,bt);
 }
 for(const field of ['settings','topics','progress']){
  out[field]={};out._sync.maps[field]={};
  for(const key of new Set([...Object.keys(a[field]||{}),...Object.keys(b[field]||{}),...Object.keys(am.maps?.[field]||{}),...Object.keys(bm.maps?.[field]||{})])){
   if(['__proto__','constructor','prototype'].includes(key))continue;
   const at=am.maps?.[field]?.[key]||0,bt=bm.maps?.[field]?.[key]||0;
   let value=bt>at?b[field]?.[key]:at>bt?a[field]?.[key]:stable(b[field]?.[key]??null)>stable(a[field]?.[key]??null)?b[field]?.[key]:a[field]?.[key];
   if(value!==undefined)out[field][key]=clone(value);
   out._sync.maps[field][key]=Math.max(at,bt);
  }
 }
 const union=(x,y,key,limit)=>[...new Map([...x||[],...y||[]].map(v=>[key(v),v])).values()].sort((x,y)=>(x.at||x.started||0)-(y.at||y.started||0)).slice(-limit);
 out.events=union(a.events,b.events,e=>e.id+'|'+e.at+'|'+e.answer,12000);
 out.sessions=union(a.sessions,b.sessions,s=>(s.at||s.started)+'|'+s.exam+'|'+s.kind,500);
 for(const [id,p] of Object.entries(out.progress))p.attempts=Math.max(p.attempts||0,out.events.filter(e=>e.id===id).length);
 return out;
}
function makeCode(profile,crypto){return 'MF1-'+(profile==='luanderson'?'L':'J')+'-'+Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
function validCode(code,profile){return new RegExp('^MF1-'+(profile==='luanderson'?'L':'J')+'-[a-f0-9]{64}$').test(code);}
function create(options){
 const storage=options.storage||root.localStorage,fetcher=options.fetch||root.fetch?.bind(root),crypto=options.crypto||root.crypto;
 let current=null,timer=null,poll=null,serial=0;
 const status=(ctx,label)=>{if(current===ctx)options.status(label);};
 async function request(ctx,body){
  const r=await fetcher(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ctx.code},body:JSON.stringify({...body,profile:ctx.profile}),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(r.status===404)return null;
  if(r.status===409)throw Object.assign(new Error('conflict'),{conflict:true});
  if(!r.ok)throw new Error('sync');return r.json();
 }
 function schedule(){const ctx=current;if(!ctx)return;clearTimeout(timer);timer=setTimeout(()=>pump(ctx),900);}
 async function pump(ctx=current){
  if(!ctx||ctx!==current)return;
  if(ctx.busy){ctx.again=true;return;}if(root.navigator?.onLine===false){status(ctx,'Offline · alterações salvas neste celular');return;}
  ctx.busy=true;status(ctx,'Sincronizando…');
  try{
   const remote=await request(ctx,{action:'pull'});if(ctx!==current)return;
   let local=options.read(),merged=merge(local,remote?.state),revision=remote?.revision||0;
   // Apply the remote snapshot before the write; subsequent local edits remain dirty.
   if(!same(local,merged)){options.apply(merged);local=options.read();merged=clone(local);}
   const baseline=JSON.stringify(local);
   if(!remote||!same(merged,remote.state))await request(ctx,{action:'push',state:merged,revision});
   if(ctx!==current)return;
   status(ctx,'Sincronizado automaticamente');
   if(JSON.stringify(options.read())!==baseline)ctx.again=true;
  }catch(e){if(e.conflict){ctx.again=true;status(ctx,'Atualizando progresso…');}else status(ctx,'Pendente · salvo aqui, tentaremos novamente');}
  finally{ctx.busy=false;if(ctx===current&&ctx.again){ctx.again=false;schedule();}}
 }
 function stop(){current=null;serial++;clearTimeout(timer);clearInterval(poll);}
 function start(profile){
  stop();const key='missao-farda-pmmg-sync-code-'+profile;
  try{let code=storage.getItem(key);if(!validCode(code||'',profile)){code=makeCode(profile,crypto);storage.setItem(key,code);}
   current={profile,code,key,busy:false,again:false,id:serial};poll=setInterval(()=>pump(),20000);pump();
  }catch{options.status('Sincronização indisponível · use o backup');}
 }
 async function connect(code){
  const old=current;if(!old||!validCode(code,old.profile))throw new Error('Use o código deste mesmo perfil, copiado do outro celular.');
  const candidate={...old,code};const remote=await request(candidate,{action:'pull'});
  if(current!==old)throw new Error('Escolha o perfil novamente.');
  if(!remote)throw new Error('Código não encontrado. Conecte o outro celular à internet primeiro.');
  const merged=merge(options.read(),remote.state);
  storage.setItem(old.key,code);stop();options.apply(merged);start(old.profile);
 }
 return {start,stop,schedule,connect,pump,getCode:()=>current?.code||null};
}
root.MFSync={touch,merge,create,makeCode,validCode};
})(typeof globalThis!=='undefined'?globalThis:this);
