/* NPlay 0.51.3 — original cinematic audio logo, synthesized locally.
   Four ascending notes (G3-E4-B4-E5) + a soft air sweep. No Netflix samples.
   Playback is non-blocking and respects browser autoplay policies. */
(()=>{
 "use strict";
 const storageKey="nplay-opening-audio-enabled-v1";
 let context=null,lastPlayedAt=-Infinity;
 function enabled(){
  try{return localStorage.getItem(storageKey)!=="off"}catch{return true}
 }
 function getContext(){
  if(context)return context;
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return null;
  context=new Audio({latencyHint:"interactive"});
  return context;
 }
 function synth(ctx){
  const start=ctx.currentTime+.025;
  const master=ctx.createGain();
  master.gain.value=.74;
  const compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-18;
  compressor.knee.value=18;
  compressor.ratio.value=4;
  compressor.attack.value=.004;
  compressor.release.value=.18;
  master.connect(compressor).connect(ctx.destination);
  const notes=[
   {freq:196.00,at:0,len:.46,volume:.13},
   {freq:329.63,at:.18,len:.51,volume:.105},
   {freq:493.88,at:.40,len:.54,volume:.105},
   {freq:659.25,at:.65,len:.47,volume:.075}
  ];
  for(const note of notes){
   const gain=ctx.createGain(),first=ctx.createOscillator(),second=ctx.createOscillator();
   const t=start+note.at,peak=t+.028;
   first.type="triangle";first.frequency.setValueAtTime(note.freq,t);
   second.type="sine";second.frequency.setValueAtTime(note.freq/2,t);
   gain.gain.setValueAtTime(.0001,t);
   gain.gain.exponentialRampToValueAtTime(note.volume,peak);
   gain.gain.exponentialRampToValueAtTime(.0001,t+note.len);
   first.connect(gain);second.connect(gain);gain.connect(master);
   first.start(t);second.start(t);
   first.stop(t+note.len+.02);second.stop(t+note.len+.02);
  }
  // Light whoosh: short, deterministic in-memory noise, not a downloaded track.
  const size=Math.round(ctx.sampleRate*.43),buffer=ctx.createBuffer(1,size,ctx.sampleRate),samples=buffer.getChannelData(0);
  let seed=17321;
  for(let i=0;i<size;i++){seed=(seed*1664525+1013904223)>>>0;samples[i]=(seed/2147483648-1)*.3}
  const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),air=ctx.createGain();
  noise.buffer=buffer;filter.type="bandpass";filter.frequency.value=930;filter.Q.value=.58;
  air.gain.setValueAtTime(.0001,start);
  air.gain.exponentialRampToValueAtTime(.037,start+.14);
  air.gain.exponentialRampToValueAtTime(.0001,start+.42);
  noise.connect(filter).connect(air).connect(master);
  noise.start(start);noise.stop(start+.43);
  // Disconnect processing nodes after the tail so they do not accumulate.
  const finish=()=>{try{master.disconnect();compressor.disconnect()}catch{}};
  window.setTimeout(finish,1700);
 }
 async function play({preview=false}={}){
  if(!preview&&!enabled())return false;
  if(!preview&&document.hidden)return false;
  if(!preview&&window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return false;
  if(!preview&&performance.now()-lastPlayedAt<4000)return false;
  const deadline=performance.now()+(preview?5000:500);
  let ctx;
  try{
   ctx=getContext();
   if(!ctx)return false;
   if(ctx.state==="suspended")await ctx.resume();
   if(ctx.state!=="running"||performance.now()>deadline)return false;
   if(!preview){
    if(document.hidden||document.documentElement.dataset.nplayAccess!=="approved")return false;
    const opening=document.getElementById("nplay-soft-opening");
    if(!opening||opening.hidden||opening.classList.contains("is-leaving"))return false;
   }
   lastPlayedAt=performance.now();
   synth(ctx);
   return true;
  }catch{
   // Mobile browsers may suppress Web Audio until an explicit user gesture.
   return false;
  }
 }
 function setEnabled(value){
  try{localStorage.setItem(storageKey,value?"on":"off")}catch{}
  window.dispatchEvent(new CustomEvent("nplay-opening-sound-change",{detail:{enabled:!!value}}));
  return enabled();
 }
 window.NPlayIntroAudio=Object.freeze({enabled,setEnabled,play,preview:()=>play({preview:true})});
})();