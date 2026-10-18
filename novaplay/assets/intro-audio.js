/* NPlay 0.51.4 — original sci-fi energy-clash sound logo.
   Two short synthesized energy-blade impacts, moving air, a low electrical
   hum and a brief metallic tail. No film audio, sound samples or downloads.
   Browser autoplay restrictions are respected; preview needs a user tap. */
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
 const t=ctx.currentTime+.025;
 const master=ctx.createGain(),limiter=ctx.createDynamicsCompressor();
 master.gain.value=.58;
 limiter.threshold.value=-22;limiter.knee.value=20;
 limiter.ratio.value=5;limiter.attack.value=.003;limiter.release.value=.22;
 master.connect(limiter).connect(ctx.destination);
 const echo=ctx.createDelay(.4),echoVolume=ctx.createGain();
 echo.delayTime.value=.125;echoVolume.gain.value=.14;
 echo.connect(echoVolume).connect(master);
 const send=ctx.createGain();send.gain.value=.6;send.connect(echo);
 const bus=ctx.createGain();bus.gain.value=1;
 bus.connect(master);bus.connect(send);

 // Low, pulsing current as the two energy blades approach.
 const hum=ctx.createOscillator(),humSub=ctx.createOscillator();
 const humFilter=ctx.createBiquadFilter(),humVolume=ctx.createGain();
 hum.type="sawtooth";humSub.type="sine";
 hum.frequency.setValueAtTime(84,t);hum.frequency.exponentialRampToValueAtTime(119,t+.80);
 hum.frequency.exponentialRampToValueAtTime(72,t+1.30);
 humSub.frequency.value=44;
 humFilter.type="lowpass";
 humFilter.frequency.setValueAtTime(240,t);
 humFilter.frequency.exponentialRampToValueAtTime(570,t+.72);
 humFilter.frequency.exponentialRampToValueAtTime(190,t+1.28);
 humVolume.gain.setValueAtTime(.0001,t);
 humVolume.gain.exponentialRampToValueAtTime(.055,t+.10);
 humVolume.gain.setValueAtTime(.055,t+.90);
 humVolume.gain.exponentialRampToValueAtTime(.0001,t+1.35);
 hum.connect(humFilter);humSub.connect(humFilter);
 humFilter.connect(humVolume).connect(bus);
 hum.start(t);humSub.start(t);
 hum.stop(t+1.38);humSub.stop(t+1.38);

 // A reusable in-memory noise buffer supplies two original airy blade sweeps.
 const sampleCount=Math.round(ctx.sampleRate*1.50);
 const noiseBuffer=ctx.createBuffer(1,sampleCount,ctx.sampleRate);
 const samples=noiseBuffer.getChannelData(0);
 let seed=236817;
 for(let i=0;i<sampleCount;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  samples[i]=(seed/2147483648-1)*.34;
 }
 function swoosh(at,peak,startHz,endHz){
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),level=ctx.createGain();
  const st=t+at;
  source.buffer=noiseBuffer;
  filter.type="bandpass";filter.Q.value=.62;
  filter.frequency.setValueAtTime(startHz,st);
  filter.frequency.exponentialRampToValueAtTime(endHz,st+.24);
  level.gain.setValueAtTime(.0001,st);
  level.gain.exponentialRampToValueAtTime(peak,st+.15);
  level.gain.exponentialRampToValueAtTime(.0001,st+.30);
  source.connect(filter).connect(level).connect(bus);
  source.start(st,0,.32);source.stop(st+.32);
 }
 function clash(at,volume,base){
  const st=t+at;
  // Close-spaced inharmonic partials produce a distinct electric-metal collision.
  const partials=[
   {ratio:1,amplitude:1,type:"triangle"},
   {ratio:1.61,amplitude:.44,type:"sine"},
   {ratio:2.42,amplitude:.23,type:"sine"},
   {ratio:3.73,amplitude:.12,type:"sine"}
  ];
  for(const p of partials){
   const oscillator=ctx.createOscillator(),amp=ctx.createGain();
   const freq=base*p.ratio;
   oscillator.type=p.type;
   oscillator.frequency.setValueAtTime(freq*1.45,st);
   oscillator.frequency.exponentialRampToValueAtTime(freq,st+.065);
   oscillator.frequency.exponentialRampToValueAtTime(freq*.82,st+.34);
   amp.gain.setValueAtTime(.0001,st);
   amp.gain.exponentialRampToValueAtTime(volume*p.amplitude,st+.008);
   amp.gain.exponentialRampToValueAtTime(volume*p.amplitude*.22,st+.12);
   amp.gain.exponentialRampToValueAtTime(.0001,st+.42);
   oscillator.connect(amp).connect(bus);
   oscillator.start(st);oscillator.stop(st+.44);
  }
  // Bright crackle at the exact collision, not a long harsh blast.
  const spark=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
  spark.buffer=noiseBuffer;
  filter.type="highpass";filter.frequency.value=2200;
  gain.gain.setValueAtTime(.0001,st);
  gain.gain.exponentialRampToValueAtTime(volume*.33,st+.004);
  gain.gain.exponentialRampToValueAtTime(.0001,st+.075);
  spark.connect(filter).connect(gain).connect(bus);
  spark.start(st,0,.08);spark.stop(st+.08);
 }
 swoosh(.02,.115,280,1700);
 clash(.29,.18,405);
 swoosh(.48,.13,420,2550);
 clash(.80,.235,318);
 // Soft electronic tail: short enough to end with the 1.6-second logo.
 const tail=ctx.createOscillator(),tailGain=ctx.createGain();
 tail.type="sine";tail.frequency.setValueAtTime(225,t+.93);
 tail.frequency.exponentialRampToValueAtTime(110,t+1.47);
 tailGain.gain.setValueAtTime(.0001,t+.93);
 tailGain.gain.exponentialRampToValueAtTime(.044,t+1.01);
 tailGain.gain.exponentialRampToValueAtTime(.0001,t+1.48);
 tail.connect(tailGain).connect(bus);
 tail.start(t+.93);tail.stop(t+1.50);
 window.setTimeout(()=>{
  try{bus.disconnect();send.disconnect();echo.disconnect();echoVolume.disconnect();master.disconnect();limiter.disconnect()}catch{}
 },2200);
}
async function play({preview=false}={}){
 if(!preview&&!enabled())return false;
 if(!preview&&document.hidden)return false;
 if(!preview&&window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return false;
 if(!preview&&performance.now()-lastPlayedAt<4000)return false;
 const deadline=performance.now()+(preview?5000:500);
 try{
  const ctx=getContext();if(!ctx)return false;
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
  // A browser can block automatic audio until the first user interaction.
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