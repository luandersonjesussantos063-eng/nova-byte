/* Use the domain owner's existing AdSense publisher. Approval and Auto ads
   settings live in AdSense; this file cannot approve a site or promise revenue. */
(()=>{
 'use strict';
 let loaded=false;
 function eligible(){
  if(document.visibilityState==='hidden')return false;
  const access=document.getElementById('nplay-access-wall');
  const profiles=document.getElementById('nplay-profile-gate');
  if(access&&document.documentElement.dataset.nplayAccess!=='approved')return false;
  if((access&&!access.hidden)||(profiles&&!profiles.hidden))return false;
  if(window.NPlayProfiles?.current?.()?.kids===true)return false;
  return true;
 }
 function load(){
  if(loaded||!eligible())return;
  if(document.querySelector('script[data-nplay-adsense]')){loaded=true;return;}
  const script=document.createElement('script');
  script.async=true;script.crossOrigin='anonymous';script.dataset.nplayAdsense='true';
  script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2466231259507657';
  document.head.append(script);loaded=true;
 }
 function start(){
  // Wait for access/profile initialization; never advertise on the access wall.
  const observer=new MutationObserver(load);
  for(const id of ['nplay-access-wall','nplay-profile-gate']){
   const node=document.getElementById(id);if(node)observer.observe(node,{attributes:true,attributeFilter:['hidden']});
  }
  document.addEventListener('visibilitychange',load);
  window.addEventListener('nplay-profile-change',load);
  window.addEventListener('nplay-access-state',load);
  load();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
