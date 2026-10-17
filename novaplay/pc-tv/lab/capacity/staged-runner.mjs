// Only for nplay-capacity-lab. Runs the synthetic lab and executes one
// bounded, localhost-only capacity test after the recorder has warmed up.
// Does not contact the upstream IPTV provider.
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
const required=['CAPACITY_AUTO_RUN','TIMESHIFT_VIEW_PIN'];
for(const name of required)if(!process.env[name])throw Error('Missing configuration: '+name);
if(process.env.TIMESHIFT_REAL_M3U_URL)throw Error('Capacity runner refuses real IPTV origins');
if(process.env.TIMESHIFT_DATA_DIR)throw Error('Capacity runner refuses persistent volumes');
const port=Number(process.env.PORT||8800);
if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
const server=spawn(process.execPath,['playable-timeshift.mjs'],{cwd:process.cwd(),env:process.env,stdio:'inherit'});
let exited=false,benchmark=null;
server.on('exit',(code)=>{exited=true;console.log(JSON.stringify({event:'capacity_lab_stopped',code}));benchmark?.kill('SIGTERM');process.exitCode=code||1;});
let stop=false;
async function teardown(){
 if(stop)return;
 stop=true;benchmark?.kill('SIGTERM');server.kill('SIGTERM');
}
process.once('SIGTERM',teardown);
process.once('SIGINT',teardown);
async function test(){
 // Wait until a completed synthetic recording from each source is available.
 // The unprotected /status health check does not expose channel data.
 let cookie;
 const base='http://127.0.0.1:'+port+'/';
 for(let attempt=0;attempt<45&&!stop&&!exited;attempt++){
  await sleep(5000);
  try{
   if(!cookie){
    const auth=await fetch(base+'login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({pin:process.env.TIMESHIFT_VIEW_PIN}),redirect:'manual',signal:AbortSignal.timeout(3000)});
    if(auth.status!==303)continue;
    const c=auth.headers.get('set-cookie')?.match(/^nplay_lab_auth=[0-9a-f]+/);
    if(!c)continue;
    cookie=c[0];
   }
   const response=await fetch(base+'status',{headers:{Cookie:cookie},signal:AbortSignal.timeout(3000)});
   const data=await response.json();
   if(data.blocks?.a?.length>0&&data.blocks?.b?.length>0)break;
  }catch{}
  if(attempt===44)throw Error('Lab did not warm up within 225s');
 }
 if(stop||exited)return;
 const stages=(process.env.CAPACITY_STAGES||'2,5,10,25,50').split(',').map(Number);
 if(stages.length>5||stages.some(n=>![2,5,10,25,50].includes(n)))throw Error('Unsafe capacity stages');
 const seconds=Number(process.env.CAPACITY_SECONDS||40);
 if(!Number.isSafeInteger(seconds)||seconds<20||seconds>60)throw Error('Unsafe benchmark duration');
 console.log(JSON.stringify({event:'capacity_started',stages,seconds,mode:'synthetic-localhost-only'}));
 benchmark=spawn(process.execPath,['capacity/viewer-simulator.mjs','--base',base,
  '--stages',stages.join(','),'--seconds',String(seconds),'--run'],
  {cwd:process.cwd(),env:{...process.env,NPLAY_LAB_PIN:process.env.TIMESHIFT_VIEW_PIN},stdio:'inherit'});
 const code=await new Promise(resolve=>{benchmark.once('error',()=>resolve(-1));benchmark.once('exit',(code)=>resolve(code));});
 benchmark=null;
 console.log(JSON.stringify({event:'capacity_finished',exitCode:code}));
}
if(process.env.CAPACITY_AUTO_RUN==='1')test().catch(e=>console.error(JSON.stringify({event:'capacity_failed',message:String(e?.message||e).slice(0,160)})));
