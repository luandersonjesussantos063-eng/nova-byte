#!/usr/bin/env node
// NPlay lab read-only viewer capacity simulator.
// NEVER calls the upstream IPTV provider. Uses completed on-disk HLS blocks.
// Restricted to a dedicated staging host or local loopback.
import {performance} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';

const argv=process.argv.slice(2);
function arg(name, fallback){
 const i=argv.indexOf(name);
 if(i===-1)return fallback;
 if(i+1>=argv.length || argv[i+1].startsWith('--'))throw Error('Missing value for '+name);
 return argv[i+1];
}
function positiveInteger(v,name,min,max){
 const n=Number(v);
 if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(name+' must be an integer from '+min+' to '+max);
 return n;
}
const baseArg=arg('--base','http://127.0.0.1:8800/');
const seconds=positiveInteger(arg('--seconds','60'),'--seconds',20,300);
const stages=arg('--stages','2,5,10,25,50').split(',').map(n=>positiveInteger(n,'--stages',1,50));
const run=argv.includes('--run');
const base=new URL(baseArg);
const hostname=base.hostname.toLowerCase();
if(!['http:','https:'].includes(base.protocol))throw Error('Only HTTP(S) permitted');
if(!['localhost','127.0.0.1','::1'].includes(hostname)&&!hostname.includes('nplay-capacity-lab')){
 throw Error('Refusing non-staging host. Use a dedicated nplay-capacity-lab service or localhost.');
}
if(new Set(stages).size!==stages.length)throw Error('Duplicate concurrency stages');
if(!run){
 console.log(JSON.stringify({dryRun:true,host:hostname,stages,secondsPerStage:seconds,estimatedMinutes:Math.ceil(stages.length*seconds/60),note:'Nothing sent. Pass --run and NPLAY_LAB_PIN to start.'},null,2));
 process.exit(0);
}
const pin=process.env.NPLAY_LAB_PIN;
if(!pin)throw Error('NPLAY_LAB_PIN is required (do not put passwords in the command line)');
if(base.pathname!=='/')throw Error('--base must point to a service origin');
let cookie='';
async function login(){
 const response=await fetch(new URL('/login',base),{
  method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({pin}),redirect:'manual',signal:AbortSignal.timeout(12000)
 });
 if(response.status!==303)throw Error('Staging login rejected; HTTP '+response.status);
 const raw=response.headers.get('set-cookie')||'';
 const found=/^nplay_lab_auth=[0-9a-f]+/i.exec(raw);
 if(!found)throw Error('No staging auth cookie received');
 cookie=found[0];
}
const state={total:0,ok:0,failed:0,bytes:0,expired:0,networkErrors:0,times:[],status:{}};
function record(result,ms){
 state.total++;
 state.status[String(result)]=(state.status[String(result)]||0)+1;
 if(result===200)state.ok++;else{
  state.failed++;if(result===410)state.expired++;
  if(result==='network')state.networkErrors++;
 }
 if(Number.isFinite(ms))state.times.push(ms);
}
async function request(path,kind='buffer'){
 const start=performance.now();
 try{
  const target=new URL(path,base);
  if(target.origin!==base.origin)throw Error('Cross-origin HLS reference rejected');
  const res=await fetch(target,{
   headers:{Cookie:cookie,Accept:kind==='text'?'application/vnd.apple.mpegurl,application/json':'video/mp2t'},
   cache:'no-store',signal:AbortSignal.timeout(15000)
  });
  const duration=performance.now()-start;
  record(res.status,duration);
  if(!res.ok){await res.body?.cancel();return null;}
  if(kind==='text')return await res.text();
  const arr=await res.arrayBuffer();
  state.bytes+=arr.byteLength;
  return arr.byteLength;
 }catch{
  record('network',performance.now()-start);
  return null;
 }
}
async function latest(channel){
 const txt=await request('/status','text');
 if(!txt)return null;
 let parsed;try{parsed=JSON.parse(txt);}catch{return null;}
 const blocks=parsed.blocks?.[channel];
 if(!Array.isArray(blocks)||blocks.length===0)return null;
 return blocks.at(-1).id;
}
function segments(manifest){
 return manifest.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')&&/\.ts(?:\?.*)?$/.test(x));
}
async function viewer(index,until){
 const channel=index%2===0?'a':'b';
 let seenBlock=-1, queue=[],position=0;
 await sleep(index*75); // smooth out initial request burst
 while(Date.now()<until){
  if(position>=queue.length){
   const id=await latest(channel);
   if(!Number.isSafeInteger(id)){await sleep(2500);continue;}
   // Re-read the latest completed block if no new one exists; this is a
   // delivery-throughput benchmark, not a viewer continuity simulation.
   seenBlock=id;
   const path='/channels/'+channel+'/blocks/'+id+'.m3u8';
   const manifest=await request(path,'text');
   if(!manifest){await sleep(2500);continue;}
   queue=segments(manifest).map(x=>new URL(x,new URL(path,base)).href);
   position=0;
   if(!queue.length){await sleep(2500);continue;}
  }
  // Read one complete segment every ~2 seconds, approximating a viewer.
  const t=performance.now();
  await request(queue[position++]);
  await sleep(Math.max(0,2000-(performance.now()-t)));
 }
}
function percentile(arr,p){
 if(!arr.length)return null;
 const s=arr.slice().sort((a,b)=>a-b);
 return Math.round(s[Math.max(0,Math.ceil(s.length*p)-1)]);
}
function summarize(viewers){
 return {viewers,seconds,requests:state.total,ok:state.ok,
  failures:state.failed,expired:state.expired,networkErrors:state.networkErrors,
  successPct:state.total?Number((100*state.ok/state.total).toFixed(2)):0,
  p50Ms:percentile(state.times,.50),p95Ms:percentile(state.times,.95),
  transferMB:Number((state.bytes/1048576).toFixed(2)),
  httpStatus:{...state.status}};
}
await login();
for(const n of stages){
 Object.assign(state,{total:0,ok:0,failed:0,bytes:0,expired:0,networkErrors:0,times:[],status:{}});
 const until=Date.now()+seconds*1000;
 await Promise.all(Array.from({length:n},(_,i)=>viewer(i,until)));
 const result=summarize(n);
 console.log(JSON.stringify({event:'capacity_stage',...result}));
 if(result.successPct<98||result.networkErrors>0){
  console.log(JSON.stringify({event:'capacity_stopped',reason:'Errors exceeded guardrail; later stages skipped'}));
  break;
 }
}
