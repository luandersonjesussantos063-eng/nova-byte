/* NPlay v0.51.8 — foreground profile activity; not proof of playback.
   One 15s heartbeat per visible tab. A best-effort keepalive closes the
   session on navigation; stale tabs expire in the administrator's view. */
(()=>{
'use strict';
const HEARTBEAT_MS=15000;
const REQUEST_TIMEOUT_MS=10000;
const tab=crypto.randomUUID();
let previous=null,running=false,pending=false,leaving=false,authToken=null;
let lastWarning=0;
function current(){
 const profile=window.NPlayProfiles?.current();
 const allowed=document.getElementById('nplay-access-wall')?.hidden===true;
 const selected=document.getElementById('nplay-profile-gate')?.hidden===true;
 return !leaving&&navigator.onLine!==false&&document.visibilityState==='visible'&&allowed&&selected&&profile?.id?profile:null;
}
function warn(error){
 if(Date.now()-lastWarning<60000)return;
 lastWarning=Date.now();
 console.warn('NPlay: falha temporária ao atualizar perfis online',error?.code||'CONNECTION');
}
async function send(profile,visible){
 const db=window.NPlayAccessClient;
 if(!db||!profile?.id)return false;
 try{
  const {data}=await db.auth.getSession();
  if(!data?.session?.access_token)return false;
  authToken=data.session.access_token;
  const query=db.rpc('novaplay_profile_heartbeat',{p_profile:profile.id,p_name:profile.name,p_tab:tab,p_visible:visible});
  // Abort an unresponsive request rather than freezing the heartbeat queue.
  let timeout=null,controller=null;
  try{
   if(typeof AbortController==='function'&&typeof query?.abortSignal==='function'){
    controller=new AbortController();
    query.abortSignal(controller.signal);
    timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
   }
   const {error}=await query;
   if(error){warn(error);return false}
   return true;
  }finally{if(timeout!==null)clearTimeout(timeout)}
 }catch(e){warn(e);return false}
}
async function pulse(){
 pending=true;
 if(running)return;
 running=true;
 try{
  while(pending){
   pending=false;
   const profile=current();
   if(previous&&(!profile||previous.id!==profile.id)){
    await send(previous,false);
    previous=null;
   }
   if(profile&&await send(profile,true))previous=profile;
  }
 }finally{running=false}
}
// On navigation, ordinary promises may be cancelled; make a best-effort
// authenticated RPC with keepalive. A short stale timeout remains the fallback.
function closeOnUnload(){
 leaving=true;
 const profile=previous;
 const db=window.NPlayAccessClient;
 if(profile&&authToken&&db?.supabaseUrl&&db?.supabaseKey&&typeof fetch==='function'){
  try{
   void fetch(db.supabaseUrl+'/rest/v1/rpc/novaplay_profile_heartbeat',{
    method:'POST',mode:'cors',keepalive:true,
    headers:{'content-type':'application/json',apikey:db.supabaseKey,authorization:'Bearer '+authToken},
    body:JSON.stringify({p_profile:profile.id,p_name:profile.name,p_tab:tab,p_visible:false})
   }).catch(()=>{});
  }catch{}
 }
 void pulse();
}
document.addEventListener('visibilitychange',pulse);
window.addEventListener('online',pulse);
window.addEventListener('offline',pulse);
window.addEventListener('nplay-profile-change',pulse);
window.addEventListener('pagehide',closeOnUnload);
window.addEventListener('pageshow',()=>{leaving=false;pulse()});
const observer=new MutationObserver(pulse);
for(const id of ['nplay-access-wall','nplay-profile-gate']){
 const element=document.getElementById(id);
 if(element)observer.observe(element,{attributes:true,attributeFilter:['hidden']});
}
setInterval(pulse,HEARTBEAT_MS);
pulse();
})();
