/* NPlay: visible app time; no playback claims, no background accumulation. */
(()=>{
'use strict';
const tab=crypto.randomUUID();let previous=null,running=false,pending=false,leaving=false;
function current(){
 const profile=window.NPlayProfiles?.current();
 const allowed=document.getElementById('nplay-access-wall')?.hidden===true;
 const selected=document.getElementById('nplay-profile-gate')?.hidden===true;
 return !leaving&&navigator.onLine!==false&&document.visibilityState==='visible'&&allowed&&selected?profile:null;
}
async function send(profile,visible){
 const db=window.NPlayAccessClient;if(!db)return false;
 const {data}=await db.auth.getSession();if(!data?.session)return false;
 const {error}=await db.rpc('novaplay_profile_heartbeat',{p_profile:profile.id,p_name:profile.name,p_tab:tab,p_visible:visible});
 return !error;
}
async function pulse(){
 pending=true;if(running)return;running=true;
 try{while(pending){
  pending=false;const profile=current();
  if(previous&&(!profile||previous.id!==profile.id)){await send(previous,false);previous=null;}
  if(profile&&await send(profile,true))previous=profile;
 }}catch{/* Offline or expired sessions must never block the app. */}finally{running=false;}
}
document.addEventListener('visibilitychange',pulse);
window.addEventListener('online',pulse);window.addEventListener('offline',pulse);
window.addEventListener('nplay-profile-change',pulse);
window.addEventListener('pagehide',()=>{leaving=true;pulse()});
window.addEventListener('pageshow',()=>{leaving=false;pulse()});
const observer=new MutationObserver(pulse);
for(const id of ['nplay-access-wall','nplay-profile-gate']){const el=document.getElementById(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['hidden']});}
setInterval(pulse,30000);pulse();
})();
