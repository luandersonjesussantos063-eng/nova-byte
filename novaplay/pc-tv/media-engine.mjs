import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {XtreamClient,xtreamIdentity} from './xtream-client.mjs';
export const ENGINE_ORIGIN='https://nplay-media.invalid';
export const ENGINE_CODES=new Set(['XTREAM_ROOT_INVALID','XTREAM_CATALOG_INVALID','XTREAM_LOGIN_RESET','XTREAM_LOGIN_TIMEOUT','XTREAM_LOGIN_CONNECTION','XTREAM_LOGIN_INVALID','XTREAM_LOGIN_DENIED','XTREAM_TS_UNAVAILABLE','XTREAM_CONNECTION_LIMIT','ENGINE_SOURCE_HTTP','ENGINE_SOURCE_INVALID','ENGINE_SOURCE_RESET','ENGINE_SOURCE_CONNECTION','ENGINE_BUSY','ENGINE_START_TIMEOUT','ENGINE_PROCESS_FAILED','ENGINE_NOT_INSTALLED','ENGINE_ASSET_GONE']);
export const isEngineUrl=raw=>{try{return new URL(raw).origin===ENGINE_ORIGIN;}catch{return false;}};
const failure=code=>Object.assign(Error(code),{code});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
export class MediaEngine{
 constructor({client=new XtreamClient(),ffmpeg='ffmpeg',mode='compatible',idleMs=90000,readyMs=14000,root=tmpdir()}={}){
  this.client=client;this.ffmpeg=ffmpeg;this.mode=mode==='copy'?'copy':'compatible';this.idleMs=idleMs;this.readyMs=readyMs;this.root=root;this.current=null;this.last={stage:'idle',code:null};this.lock=Promise.resolve();
  this.sweep=setInterval(()=>{const s=this.current;if(s&&Date.now()-s.touched>this.idleMs)void this.stop(s).catch(()=>{});},2000);this.sweep.unref();
 }
 status(){const s=this.current;return {engine:'nplay-xtream-ffmpeg',version:'0.50.2',mode:this.mode,stage:s?.stage||this.last.stage,code:(s?s.error:this.last.code)||null,bytes_received:s?.bytes||0,started_at:s?.startedAt||null,account:s?.account||null,video_codec:this.mode==='copy'?'original':'h264',audio_codec:'aac',channels_receiving:s?1:0};}
 async stop(s=this.current){
  if(!s)return;
  s.stopping=true;
  if(this.current===s)this.current=null;
  s.controller.abort();s.input?.destroy();s.child?.stdin.destroy();
  if(s.child&&s.child.exitCode===null){s.child.kill('SIGTERM');await Promise.race([s.closed,wait(1200)]);if(s.child.exitCode===null){s.child.kill('SIGKILL');await s.closed;}}
  if(s.dir)await rm(s.dir,{recursive:true,force:true});
  if(!s.error)this.last={stage:'idle',code:null};
 }
 async close(){clearInterval(this.sweep);await this.stop();}
 async start(raw,owner='default'){
  const identity=xtreamIdentity(raw),sourceKey=createHash('sha256').update(JSON.stringify([identity.origin,identity.user,identity.password,identity.id])).digest('hex');
  let release;const previous=this.lock;this.lock=new Promise(resolve=>{release=resolve;});await previous;
  let s;
  try{
  s=this.current;
  console.info(JSON.stringify({event:'media_engine_request',existing:!!s,same_source:!!s&&s.key===sourceKey,stage:s?.stage||'idle',failed:!!s?.error}));
  if(s&&(s.key!==sourceKey||s.error||s.controller.signal.aborted)){
   if(s.owner!==owner&&Date.now()-s.touched<8000&&!s.error)throw failure('ENGINE_BUSY');
   await this.stop(s);s=null;
  }
  if(!s){
   console.info(JSON.stringify({event:'media_engine_new_session'}));
   s={key:sourceKey,owner,id:randomBytes(16).toString('hex'),controller:new AbortController(),touched:Date.now(),startedAt:new Date().toISOString(),stage:'login',bytes:0,error:null,identity};
   this.current=s;
   // Each PC has one bounded receiver. Startup remains shared across HLS retries.
   s.ready=this.prepare(s,raw).catch(async error=>{
    if(s.stopping){await this.stop(s);throw failure('ENGINE_ASSET_GONE');}
    s.error=ENGINE_CODES.has(error.code)?error.code:'ENGINE_PROCESS_FAILED';s.stage='failed';this.last={stage:'failed',code:s.error};
    s.controller.abort();s.input?.destroy();s.child?.stdin.destroy();s.child?.kill('SIGTERM');
    console.error(JSON.stringify({event:'media_engine_failed',stage:s.stage,code:s.error}));await this.stop(s);throw failure(s.error);
   });
  }
  s.touched=Date.now();
  }finally{release();}
  await s.ready;
  if(s.error)throw failure(s.error);
  const manifest=await readFile(join(s.dir,'index.m3u8'),'utf8');
  if(manifest.length>64000||!manifest.startsWith('#EXTM3U'))throw failure('ENGINE_PROCESS_FAILED');
  return {ok:true,manifest,base:ENGINE_ORIGIN+'/session/'+s.id+'/index.m3u8'};
 }
 async prepare(s,raw){
  const signal=s.controller.signal;
  const login=await this.client.login(raw,AbortSignal.any([signal,AbortSignal.timeout(8000)]));s.account=login.account;s.stage='receiving';s.touched=Date.now();if(signal.aborted)throw failure('ENGINE_START_TIMEOUT');
  const media=await this.client.openTs(login,signal);
  s.input=media.response;if(signal.aborted){s.input.destroy();throw failure('ENGINE_START_TIMEOUT');}
  s.dir=await mkdtemp(join(this.root,'nplay-media-'));s.stage='processing';s.touched=Date.now();if(signal.aborted)throw failure('ENGINE_START_TIMEOUT');
  const video=this.mode==='copy'?['-c:v','copy']:['-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-threads','2','-vf','scale=w=min(1280\\,iw):h=-2','-r','25','-g','50','-keyint_min','50','-sc_threshold','0','-b:v','2000k','-maxrate','2500k','-bufsize','5000k','-pix_fmt','yuv420p'];
  const args=['-hide_banner','-loglevel','error','-nostdin','-fflags','+genpts+discardcorrupt','-probesize','2000000','-analyzeduration','2000000','-protocol_whitelist','pipe','-threads','2','-filter_threads','1','-f','mpegts','-i','pipe:0','-map','0:v:0?','-map','0:a:0?',...video,'-c:a','aac','-b:a','128k','-ac','2','-sn','-dn','-f','hls','-hls_time','2','-hls_list_size','30','-hls_delete_threshold','15','-hls_flags','delete_segments+temp_file+omit_endlist','-hls_segment_filename',join(s.dir,'seg%09d.ts'),join(s.dir,'index.m3u8')];
  s.child=spawn(this.ffmpeg,args,{stdio:['pipe','ignore','pipe'],windowsHide:true});
  // Discard raw FFmpeg diagnostics: they may contain input metadata. Only safe
  // stage/code values enter logs, status responses and the public player.
  s.child.stderr.resume();s.child.stdin.on('error',()=>{});
  s.closed=new Promise(resolve=>s.child.once('close',resolve));
  s.child.on('error',error=>{s.error=error.code==='ENOENT'?'ENGINE_NOT_INSTALLED':'ENGINE_PROCESS_FAILED';});
  s.child.on('close',()=>{if(!signal.aborted){s.error||='ENGINE_PROCESS_FAILED';s.stage='failed';s.controller.abort();s.input.destroy();this.last={stage:'failed',code:s.error};}});
  s.input.on('data',chunk=>{s.bytes+=chunk.length;});
  s.feed=pipeline(s.input,s.child.stdin,{signal}).catch(()=>{if(!signal.aborted){s.error||='ENGINE_SOURCE_CONNECTION';s.stage='failed';this.last={stage:'failed',code:s.error};s.controller.abort();s.child.kill('SIGTERM');}});
  const deadline=Date.now()+this.readyMs;
  while(Date.now()<deadline){
   if(s.error)throw failure(s.error);
   if(signal.aborted)throw failure('ENGINE_START_TIMEOUT');
   try{const manifest=await readFile(join(s.dir,'index.m3u8'),'utf8');if(manifest.includes('#EXTINF:')&&/seg\d+\.ts/.test(manifest)){s.stage='playing';return;}}catch{}
   await wait(100);
  }
  throw failure('ENGINE_START_TIMEOUT');
 }
 // Both browser transports consume the same bounded upstream receiver. A TS
 // fallback must never create an independent provider connection per viewer.
 async stream(raw,signal,owner='default'){
  const ready=await this.start(raw,owner),s=this.current;
  if(!s||!ready.base.includes('/'+s.id+'/'))throw failure('ENGINE_ASSET_GONE');
  const engine=this;
  async function* segments(){
   let next=null;
   while(!signal?.aborted&&engine.current===s&&!s.error){
    s.touched=Date.now();
    const manifest=await readFile(join(s.dir,'index.m3u8'),'utf8');
    const files=manifest.split('\n').filter(x=>/^seg\d{9}\.ts$/.test(x));
    if(next===null&&files.length)next=Number(files[Math.max(0,files.length-3)].slice(3,-3));
    for(const file of files){
     const sequence=Number(file.slice(3,-3));
     if(sequence<next)continue;
     if(signal?.aborted||engine.current!==s||s.error)return;
     let bytes;try{bytes=await readFile(join(s.dir,file));}catch(error){if(error.code==='ENOENT')continue;throw error;}
     if(bytes.length>24000000)throw failure('ENGINE_PROCESS_FAILED');
     s.touched=Date.now();next=sequence+1;yield bytes;
    }
    await wait(200);
   }
  }
  const response=Readable.from(segments());response.statusCode=200;response.headers={'content-type':'video/mp2t'};
  return {response,url:ENGINE_ORIGIN+'/session/'+s.id+'/stream.ts'};
 }
 async asset(raw){
  const u=new URL(raw),m=/^\/session\/([a-f0-9]{32})\/(index\.m3u8|seg\d{9}\.ts)$/.exec(u.pathname),s=this.current;
  if(u.origin!==ENGINE_ORIGIN||u.search||u.hash||!m||!s||m[1]!==s.id||s.error)throw failure('ENGINE_ASSET_GONE');
  s.touched=Date.now();
  await s.ready;
  const path=join(s.dir,m[2]);let info;
  try{info=await stat(path);}catch{throw failure('ENGINE_ASSET_GONE');}
  if(info.size>24000000)throw failure('ENGINE_PROCESS_FAILED');
  const response=createReadStream(path);response.statusCode=200;response.headers={'content-type':m[2]==='index.m3u8'?'application/vnd.apple.mpegurl':'video/mp2t','content-length':String(info.size)};return {response,url:u.href};
 }
}
