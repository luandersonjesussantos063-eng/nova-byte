/* NPlay 0.51.6 — the final excerpt from the user's actual audio recording.
   No synthesizer, imitation, added impacts or replacement melody.
   Uses the hosted AAC recording; browser autoplay rules still apply. */
(()=>{
"use strict";
const storageKey="nplay-opening-audio-enabled-v1";
const audioPath="./assets/nplay-opening-original-final.m4a?v=0.51.6";
let audio=null,lastPlayedAt=-Infinity;
function enabled(){
 try{return localStorage.getItem(storageKey)!=="off"}catch{return true}
}
function getAudio(){
 if(audio)return audio;
 if(typeof Audio!=="function")return null;
 audio=new Audio(new URL(audioPath,document.baseURI).href);
 audio.preload="auto";
 audio.volume=.82;
 return audio;
}
async function play({preview=false}={}){
 if(!preview&&!enabled())return false;
 if(!preview&&document.hidden)return false;
 if(!preview&&window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return false;
 if(!preview&&performance.now()-lastPlayedAt<4000)return false;
 if(!preview){
  if(document.documentElement.dataset.nplayAccess!=="approved")return false;
  const opening=document.getElementById("nplay-soft-opening");
  if(!opening||opening.hidden||opening.classList.contains("is-leaving"))return false;
 }
 try{
  const media=getAudio();
  if(!media)return false;
  // Start inside the user's gesture for the Preview button; don't await fetch first.
  media.pause();
  try{media.currentTime=0}catch{}
  lastPlayedAt=performance.now();
  const started=media.play();
  if(started&&typeof started.then==="function")await started;
  return true;
 }catch{
  // A silent browser autoplay denial must never block entry to NPlay.
  return false;
 }
}
function setEnabled(value){
 try{localStorage.setItem(storageKey,value?"on":"off")}catch{}
 window.dispatchEvent(new CustomEvent("nplay-opening-sound-change",{detail:{enabled:!!value}}));
 return enabled();
}
window.NPlayIntroAudio=Object.freeze({enabled,setEnabled,play,preview:()=>play({preview:true}),assetPath:audioPath});
})();