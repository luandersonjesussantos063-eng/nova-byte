/* NPlay 0.51.5 — original soft sci-fi closing resonance (last-tail reference).
   No original clip is embedded; no hard opening impacts, no downloaded assets.
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
 // Inspired only by the resonant, fading END of the supplied audio reference:
 // a gentle wave of original tones, no preceding impact or blade clashes.
 const t=ctx.currentTime+.024;
 const master=ctx.createGain(),limiter=ctx.createDynamicsCompressor();
 master.gain.value=.50;
 limiter.threshold.value=-24;limiter.knee.value=18;limiter.ratio.value=3;
 limiter.attack.value=.007;limiter.release.value=.24;
 master.connect(limiter).connect(ctx.destination);
 const bus=ctx.createGain();
 bus.gain.value=1;bus.connect(master);
 const frequencies=[
  {frequency:155.56,level:.26,attack:.065,offset:0,end:1.58},
  {frequency:233.08,level:.18,attack:.09,offset:.04,end:1.62},
  {frequency:311.13,level:.115,attack:.14,offset:.10,end:1.58},
  {frequency:622.25,level:.049,attack:.18,offset:.16,end:1.30},
  {frequency:77.78,level:.052,attack:.06,offset:0,end:1.24},
  {frequency:466.16,level:.028,attack:.13,offset:.10,end:1.25}
 ];
 const totalDuration=1.78;
 const delays=[{time:.13,level:.15},{time:.18,level:.12},{time:.30,level:.09}];
 const echoNodes=[];
 for(const item of delays){
  const node=ctx.createDelay(.45),wet=ctx.createGain();
  node.delayTime.value=item.time;wet.gain.value=item.level;
  bus.connect(node);node.connect(wet);wet.connect(master);
  echoNodes.push(node,wet);
 }
 const exp=(automation,at,value)=>automation.exponentialRampToValueAtTime(Math.max(.0001,value),at);
 for(const note of frequencies){
  const start=t+note.offset,stop=t+totalDuration;
  const voice=ctx.createOscillator(),envelope=ctx.createGain();
  voice.type="sine";
  voice.frequency.setValueAtTime(note.frequency,start);
  // Gentle downward pitch movement evokes an airy closing resonance,
  // rather than an energetic clash.
  voice.frequency.exponentialRampToValueAtTime(note.frequency*.968,start+1.65);
  envelope.gain.setValueAtTime(.0001,start);
  exp(envelope.gain,start+note.attack,note.level);
  exp(envelope.gain,start+Math.max(note.attack+.12,note.end-.88),note.level*.88);
  exp(envelope.gain,start+note.end,.0001);
  voice.connect(envelope).connect(bus);
  voice.start(start);voice.stop(Math.min(stop,start+note.end+.06));
 }
 // A discreet, filtered air shimmer adds texture to the quiet resolution.
 const count=Math.floor(ctx.sampleRate*1.25);
 const buffer=ctx.createBuffer(1,count,ctx.sampleRate);
 const data=buffer.getChannelData(0);
 let seed=1815;
 for(let i=0;i<count;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  data[i]=(seed/2147483648-1)*.27;
 }
 const shimmer=ctx.createBufferSource(),band=ctx.createBiquadFilter(),air=ctx.createGain();
 shimmer.buffer=buffer;band.type="bandpass";band.frequency.value=1400;band.Q.value=.75;
 const airStart=t+.12;
 air.gain.setValueAtTime(.0001,airStart);
 exp(air.gain,airStart+.25,.016);
 exp(air.gain,t+1.25,.0001);
 shimmer.connect(band).connect(air).connect(bus);
 shimmer.start(airStart);shimmer.stop(t+1.29);
 window.setTimeout(()=>{
  try{bus.disconnect();master.disconnect();limiter.disconnect();for(const node of echoNodes)node.disconnect()}catch{}
 },2450);
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