/* NPlay ADMIN ONLY telemetry: the active playback title, never media URLs,
   browsing history, search terms, DRM credentials or viewing frames.
   An iframe means "player aberto" only; no claim its video actually started. */
(()=>{
'use strict';
const INTERVAL=15000;
const ids=/^[a-zA-Z0-9_-]{1,110}$/;
const states=new Set(['open','playing','paused','buffering']);
const kinds=new Set(['film','series','tv','youtube','radio','other']);
const tab=window.NPlayPresence?.tabId;
if(!tab)return;
let activity=null,owner=null,sessionToken=null,sending=false,again=false,closing=false;
let lastError=0;
const player=()=>document.getElementById('player-layer');
const video=()=>document.getElementById('video');
function activeProfile(){
 const profile=window.NPlayProfiles?.current?.();
 return !closing&&navigator.onLine!==false&&document.visibilityState==='visible'&&
  document.getElementById('nplay-access-wall')?.hidden===true&&
  document.getElementById('nplay-profile-gate')?.hidden===true&&
  profile?.id?profile:null;
}
function payload(state,media){
 const normalized=states.has(state)?state:'stopped';
 if(normalized==='stopped')return {p_content_id:null,p_title:null,p_kind:null,p_state:'stopped'};
 return {p_content_id:media?.id,p_title:media?.title,p_kind:media?.kind,p_state:normalized};
}
async function post(profile,media,state){
 const db=window.NPlayAccessClient;
 if(!db||!profile?.id)return false;
 try{
  const {data}=await db.auth.getSession();
  if(!data?.session?.access_token)return false;
  sessionToken=data.session.access_token;
  const {data:accepted,error}=await db.rpc('novaplay_set_now_watching',{
   p_profile:profile.id,p_tab:tab,...payload(state,media)
  });
  if(error)throw error;
  return accepted===true;
 }catch(error){
  if(Date.now()-lastError>60000){
   lastError=Date.now();
   console.warn('NPlay: estado de reprodução ainda não sincronizado',error?.code||'CONNECTION');
  }
  return false;
 }
}
async function flush(){
 again=true;if(sending)return;
 sending=true;
 try{
  while(again){
   again=false;
   const profile=activeProfile(),canReport=!!profile&&!!activity&&!player()?.hidden;
   if(owner&&(!profile||owner.id!==profile.id||!canReport)){
    await post(owner,null,'stopped');
    owner=null;
   }
   if(canReport){
    // A fresh presence record from this same tab is required server-side.
    await window.NPlayPresence?.pulse?.();
    if(await post(profile,activity,activity.state))owner={id:profile.id,name:profile.name};
   }
  }
 }finally{sending=false}
}
function setActivity(next){
 if(!next){activity=null;void flush();return}
 const id=String(next.id||'').trim(),title=String(next.title||'').trim().slice(0,160);
 const kind=kinds.has(next.kind)?next.kind:'other';
 if(!ids.test(id)||!title)return;
 activity={id,title,kind,state:states.has(next.state)?next.state:'open'};
 void flush();
}
function playbackStatus(state){
 if(!activity||!states.has(state)||document.hidden)return;
 if(player()?.hidden||video()?.hidden)return;
 if(activity.state===state)return;
 activity={...activity,state};
 void flush();
}
window.addEventListener('nplay:watch',event=>setActivity(event.detail));
video()?.addEventListener('playing',()=>playbackStatus('playing'));
video()?.addEventListener('pause',()=>playbackStatus('paused'));
video()?.addEventListener('waiting',()=>playbackStatus('buffering'));
video()?.addEventListener('ended',()=>setActivity(null));
video()?.addEventListener('error',()=>setActivity(null));
document.addEventListener('visibilitychange',()=>{void flush()});
window.addEventListener('online',()=>{void flush()});
window.addEventListener('offline',()=>{void flush()});
window.addEventListener('nplay-profile-change',()=>{activity=null;void flush()});
window.addEventListener('pageshow',()=>{closing=false;void flush()});
window.addEventListener('pagehide',()=>{
 closing=true;
 const db=window.NPlayAccessClient;
 if(owner&&sessionToken&&db?.supabaseUrl&&db?.supabaseKey&&typeof fetch==='function'){
  try{
   void fetch(db.supabaseUrl+'/rest/v1/rpc/novaplay_set_now_watching',{
    method:'POST',mode:'cors',keepalive:true,
    headers:{'content-type':'application/json',apikey:db.supabaseKey,authorization:'Bearer '+sessionToken},
    body:JSON.stringify({p_profile:owner.id,p_tab:tab,...payload('stopped',null)})
   }).catch(()=>{});
  }catch{}
 }
 activity=null;void flush();
});
setInterval(()=>{if(activity||owner)void flush()},INTERVAL);
window.NPlayWatching=Object.freeze({get:()=>activity?{...activity}:null});
})();
