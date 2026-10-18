/* NPlay 0.51.2 — every fresh launch starts with the NPlay logo.
   The access form is shown only after auth confirms a new/pending/denied device
   or a connection problem. Returning users stay behind this intro until verified.
   The overlay is not authentication and never unlocks protected content. */
(()=>{
 "use strict";
 const root=document.getElementById("nplay-soft-opening");
 if(!root)return;
 const start=performance.now();
 const minimum=1650;
 const fade=450;
 let settled=false,hideTimer=null,audioRequested=false;
 const prefersReduced=()=>!!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 function stop(){
  if(settled)return;
  settled=true;
  if(hideTimer!==null)window.clearTimeout(hideTimer);
  root.hidden=true;
  root.classList.remove("is-leaving");
 }
 function approve(){
  if(settled)return;
  if(!audioRequested){
   audioRequested=true;
   // Web Audio may be blocked until the user interacts with the browser.
   // Never make the intro wait for a promise that can remain suspended.
   try{void window.NPlayIntroAudio?.play?.()}catch{}
  }
  // Keep a little visual time after a slow approval so the signature
  // does not begin as the logo is already fading out.
  const delay=prefersReduced()?0:Math.max(1000,minimum-(performance.now()-start));
  if(hideTimer!==null)window.clearTimeout(hideTimer);
  hideTimer=window.setTimeout(()=>{
   if(settled)return;
   if(document.documentElement.dataset.nplayAccess!=="approved")return;
   root.classList.add("is-leaving");
   hideTimer=window.setTimeout(stop,prefersReduced()?0:fade);
  },delay);
 }
 function onAccess(state){
  if(!state||settled)return;
  if(state==="approved")approve();
  else stop();
 }
 window.addEventListener("nplay-access-state",event=>onAccess(event.detail?.state));
 // Handles the unlikely case that authorization resolved before this script ran.
 onAccess(document.documentElement.dataset.nplayAccess);
 window.addEventListener("pagehide",()=>{
  if(hideTimer!==null)window.clearTimeout(hideTimer);
 },{once:true});
})();
