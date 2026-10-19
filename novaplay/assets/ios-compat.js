/* NPlay v0.51.28: iOS-only layout and update recovery. */
(()=>{
 "use strict";
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
 if(!ios)return;
 document.documentElement.classList.add("nplay-ios");
 const standalone=window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true;
 if(standalone)document.documentElement.classList.add("nplay-ios-standalone");
 let artRequest=0;
 function verifyHeroArtwork(backdrop,cover){
  const token=++artRequest;
  const art=document.getElementById("hero-art");
  if(!art)return;
  const sources=[backdrop,cover,"./assets/profile-hero-wide-v04515.webp"];
  const seen=new Set();
  const images=sources.map(source=>{
   try{
    const url=new URL(String(source||""),location.href);
    if(!["https:","http:"].includes(url.protocol)||seen.has(url.href))return null;
    seen.add(url.href);return url.href;
   }catch{return null;}
  }).filter(Boolean);
  let index=0;
  function next(){
   if(token!==artRequest||index>=images.length)return;
   const url=images[index++],img=new Image();
   let settled=false;
   const timeout=setTimeout(()=>{
    if(settled)return;
    settled=true;img.onload=null;img.onerror=null;next();
   },6500);
   img.onload=()=>{
    if(settled)return;
    settled=true;clearTimeout(timeout);
    if(token!==artRequest||document.getElementById("hero")?.classList.contains("hero-live-mode"))return;
    if(img.naturalWidth>0)art.style.backgroundImage="url("+JSON.stringify(url)+")";
    else next();
   };
   img.onerror=()=>{
    if(settled)return;
    settled=true;clearTimeout(timeout);next();
   };
   img.src=url;
  }
  next();
 }
 window.NPlayIOS=Object.freeze({verifyHeroArtwork});

 const current=document.querySelector('meta[name="nplay-version"]')?.content||"";
 let lastCheck=0,checking=false,pending="";
 const activePlayer=()=>{
  const layer=document.getElementById("player-layer");
  return layer&&!layer.hidden;
 };
 const safeToRestart=()=>{
  if(document.hidden||activePlayer())return false;
  if(document.querySelector(".nplay-profile-dialog[open]"))return false;
  return !document.querySelector(".nplay-settings:not([hidden])");
 };
 function restartIfReady(){
  if(!pending||!safeToRestart())return;
  try{
   const key="nplay-ios-refresh-"+pending;
   const previous=Number(sessionStorage.getItem(key)||0);
   // Avoid a reload loop if a CDN still serves an older index.html.
   if(Date.now()-previous<10*60*1000)return;
   sessionStorage.setItem(key,String(Date.now()));
  }catch{}
  const destination=new URL(location.href);
  destination.searchParams.set("nplay-release",pending);
  destination.searchParams.set("reload",String(Date.now()));
  location.replace(destination.href);
 }
 async function checkUpdate(){
  if(checking||document.hidden||Date.now()-lastCheck<60000)return;
  checking=true;lastCheck=Date.now();
  try{
   const url=new URL("./version.json",location.href);
   url.searchParams.set("t",String(Date.now()));
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),8000);
   try{
    const response=await fetch(url.href,{cache:"no-store",signal:controller.signal});
    if(response.ok){
     const data=await response.json();
     const latest=typeof data.version==="string"?data.version.trim():"";
     if(/^\d+\.\d+\.\d+$/.test(latest)&&latest!==current){pending=latest;restartIfReady();}
    }
   }finally{clearTimeout(timeout);}
   // Ask WebKit to pick up a new SW, even in a Home Screen app.
   navigator.serviceWorker?.getRegistration?.().then(registration=>registration?.update()).catch(()=>{});
  }catch{}
  finally{checking=false;}
 }
 window.addEventListener("pageshow",()=>{restartIfReady();void checkUpdate();});
 window.addEventListener("focus",()=>{restartIfReady();void checkUpdate();});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden){restartIfReady();void checkUpdate();}});
 window.addEventListener("nplay:watch",()=>{if(pending)setTimeout(restartIfReady,800);});
 // A delayed first check prevents competing with the video/catalog startup.
 setTimeout(()=>void checkUpdate(),4500);
})();
