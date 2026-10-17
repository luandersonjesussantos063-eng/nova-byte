/* NPlay 0.51 — short original, silent intro after device approval.
   Never appears on top of the access-request form or network errors. */
(()=>{
 "use strict";
 const root=document.getElementById("nplay-soft-opening");
 const access=document.getElementById("nplay-access-wall");
 if(!root||!access)return;
 let started=false,finished=false,observer=null,leaveTimer=null;
 const seenKey="nplay-soft-opening-v0.51";
 const reduced=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches||false;
 const end=()=>{
  if(finished)return;finished=true;
  root.classList.add("is-leaving");
  window.setTimeout(()=>{root.hidden=true;root.classList.remove("is-leaving");},reduced()?0:460);
 };
 const maybePlay=()=>{
  if(started||!access.hidden||document.hidden)return;
  let seen=false;
  try{seen=sessionStorage.getItem(seenKey)==="1"}catch{}
  if(seen||reduced()){root.hidden=true;started=true;observer?.disconnect();return}
  started=true;observer?.disconnect();
  try{sessionStorage.setItem(seenKey,"1")}catch{}
  // Wait for the profile chooser / main app to settle, avoiding a rough transition.
  window.setTimeout(()=>{
    if(!access.hidden){root.hidden=true;return;}
    root.hidden=false;root.classList.remove("is-leaving");
    leaveTimer=window.setTimeout(end,1550);
  },180);
 };
 observer=new MutationObserver(maybePlay);
 observer.observe(access,{attributes:true,attributeFilter:["hidden"]});
 window.addEventListener("pageshow",maybePlay,{once:true});
 document.addEventListener("visibilitychange",maybePlay);
 maybePlay();
 window.addEventListener("pagehide",()=>{observer?.disconnect();if(leaveTimer)clearTimeout(leaveTimer)},{once:true});
})();
