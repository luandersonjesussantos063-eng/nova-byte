import {spawn} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createHash} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Readable,PassThrough} from 'node:stream';
import {XtreamClient,xtreamIdentity} from './xtream-client.mjs';
export const ENGINE_ORIGIN='https://nplay-media.invalid';
export const ENGINE_CODES=new Set(['XTREAM_ROOT_INVALID','XTREAM_CATALOG_INVALID','XTREAM_LOGIN_RESET','XTREAM_LOGIN_TIMEOUT','XTREAM_LOGIN_CONNECTION','XTREAM_LOGIN_INVALID','XTREAM_LOGIN_DENIED','XTREAM_TS_UNAVAILABLE','XTREAM_CONNECTION_LIMIT','ENGINE_SOURCE_HTTP','ENGINE_SOURCE_INVALID','ENGINE_SOURCE_RESET','ENGINE_SOURCE_CONNECTION','ENGINE_BUSY','ENGINE_START_TIMEOUT','ENGINE_PROCESS_FAILED','ENGINE_NOT_INSTALLED','ENGINE_ASSET_GONE']);
export const isEngineUrl=raw=>{try{return new URL(raw).origin===ENGINE_ORIGIN;}catch{return false;}};
const failure=code=>Object.assign(Error(code),{code});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// A failed TS handshake holds no live stream. Try the same authorized channel
// using its advertised HLS format, never concurrently with the TS connection.
export async function openMediaInput(client,login,signal,preferHls=false){
 if(preferHls)return {media:await client.openHls(login,signal),hlsMode:true};
 try{return {media:await client.openTs(login,signal),hlsMode:false};}
 catch(error){
  if(signal?.aborted||error?.code!=='ENGINE_SOURCE_RESET')throw error;
  console.warn(JSON.stringify({event:'media_transport_fallback',from:'ts',to:'hls',cause:'ENGINE_SOURCE_RESET'}));
  try{return {media:await client.openHls(login,signal),hlsMode:true};}
  catch(hlsError){
   // Do not initiate more attempts: provider concurrency and geo restrictions
   // are enforced by the upstream. Do not log URLs or credentials.
   console.warn(JSON.stringify({event:'media_transport_fallback_failed',code:String(hlsError?.code||'SOURCE_UNAVAILABLE').slice(0,48)}));
   throw error;
  }
 }
}
// transport.fetchMedia validates each redirect and pins its public DNS result.
// HLS assets belong to the validated final playlist origin, which can be the
// provider's CDN instead of the original account/login hostname.
export function hlsAssetUrl(raw,playlistUrl){
 const base=new URL(playlistUrl),url=new URL(raw,base);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.origin!==base.origin||url.href.length>4096)throw failure('ENGINE_SOURCE_INVALID');
 return url;
}
export class MediaEngine{
 constructor({client=new XtreamClient(),ffmpeg='ffmpeg',mode='compatible',idleMs=90000,readyMs=14000,root=tmpdir()}={}){
  this.client=client;this.ffmpeg=ffmpeg;this.mode=mode==='copy'?'copy':'compatible';this.idleMs=idleMs;this.readyMs=readyMs;this.root=root;this.current=null;this.last={stage:'idle',code:null};this.lock=Promise.resolve();
  this.sweep=setInterval(()=>{const s=this.current;if(s&&Date.now()-s.touched>this.idleMs)void this.stop(s).catch(()=>{});},2000);this.sweep.unref();
 }
 status(){const s=this.current;return {engine:'nplay-xtream-ffmpeg',version:'0.50.3',mode:this.mode,stage:s?.stage||this.last.stage,code:(s?s.error:this.last.code)||null,bytes_received:s?.bytes||0,started_at:s?.startedAt||null,account:s?.account||null,video_codec:this.mode==='copy'?'original':'h264',audio_codec:'aac',channels_receiving:s?1:0};}
 async stop(s=this.current){
  if(!s)return;
  s.stopping=true;
  if(this.current===s)this.current=null;
  if(s.monitor)clearInterval(s.monitor);
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
   s={key:sourceKey,owner,id:randomBytes(16).toString('hex'),controller:new AbortController(),touched:Date.now(),startedAt:new Date().toISOString(),stage:'login',bytes:0,lastInputAt:Date.now(),stallLogged:false,error:null,identity};
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
  // M3U live playback uses the authorized stream URL directly. The upstream server
  // remains responsible for accepting or rejecting concurrent stream requests.
  const identity=xtreamIdentity(raw);
  const login={identity,session:{origin:identity.origin,cookie:''},account:null};
  console.info(JSON.stringify({event:'m3u_direct_stream_attempt'}));
  s.account=null;s.stage='receiving';s.touched=Date.now();if(signal.aborted)throw failure('ENGINE_START_TIMEOUT');
  const {media,hlsMode}=await openMediaInput(this.client,login,signal,process.env.NPLAY_INPUT_FORMAT==='hls');
  s.input=hlsMode?new PassThrough({highWaterMark:1024*1024}):media.response;
  if(hlsMode){s.input.on('error',()=>{});
   const readText=async response=>{
    let total=0;const parts=[];
    for await(const part of response){total+=part.length;if(total>262144)throw failure('ENGINE_SOURCE_INVALID');parts.push(part);}
    return Buffer.concat(parts).toString('utf8');
   };
   const readSegment=async response=>{
    let total=0;const parts=[];
    for await(const part of response){total+=part.length;if(total>16000000)throw failure('ENGINE_SOURCE_INVALID');parts.push(part);}
    return Buffer.concat(parts);
   };
   s.hlsTask=(async()=>{
    let playlistUrl=media.url,playlistRequestUrl=media.requestUrl||raw,initial=media.response,sequence=-1,missing=0;
    while(!signal.aborted){
     const playlist=initial?{response:initial,url:playlistUrl}:await this.client.fetcher(playlistRequestUrl,null,signal,{headerTimeout:8000});
     initial=null;
     if(playlist.response.statusCode!==200){console.warn(JSON.stringify({event:'media_hls_playlist_http',status:playlist.response.statusCode,session:s.id.slice(0,8)}));playlist.response.destroy();throw failure('ENGINE_SOURCE_HTTP');}
     playlistUrl=playlist.url||playlistUrl;
     const body=await readText(playlist.response);
     if(!body.startsWith('#EXTM3U')||/#EXT-X-KEY:|#EXT-X-MAP:/.test(body))throw failure('ENGINE_SOURCE_INVALID');
     const lines=body.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
     const uris=lines.filter(x=>!x.startsWith('#'));
     if(lines.some(x=>x.startsWith('#EXT-X-STREAM-INF:'))){
      if(!uris.length)throw failure('ENGINE_SOURCE_INVALID');
      const child=hlsAssetUrl(uris[0],playlistUrl);
      playlistUrl=child.href;playlistRequestUrl=child.href;continue;
     }
     const base=Number((lines.find(x=>x.startsWith('#EXT-X-MEDIA-SEQUENCE:'))||'').split(':')[1]||0);
     if(!Number.isSafeInteger(base)||base<0)throw failure('ENGINE_SOURCE_INVALID');
     let refresh=false;
     for(let n=0;n<uris.length&&!signal.aborted;n++){
      if(base+n<=sequence)continue;
      const segmentUrl=hlsAssetUrl(uris[n],playlistUrl);
      if(!segmentUrl.pathname.endsWith('.ts'))throw failure('ENGINE_SOURCE_INVALID');
      const segment=await this.client.fetcher(segmentUrl.href,null,signal,{headerTimeout:8000});
      if(segment.response.statusCode===404||segment.response.statusCode===410){
       const status=segment.response.statusCode;segment.response.destroy();
       missing++;
       console.warn(JSON.stringify({event:'media_hls_segment_expired',session:s.id.slice(0,8),status,consecutive:missing}));
       if(missing>5)throw failure('ENGINE_SOURCE_HTTP');
       sequence=base+n;refresh=true;break;
      }
      if(segment.response.statusCode!==200){segment.response.destroy();throw failure('ENGINE_SOURCE_HTTP');}
      const bytes=await readSegment(segment.response);
      if(!s.input.write(bytes))await new Promise((resolve,reject)=>{
       const done=()=>{s.input.off('error',bad);resolve();};
       const bad=error=>{s.input.off('drain',done);reject(error);};
       s.input.once('drain',done);s.input.once('error',bad);
       if(signal.aborted){s.input.off('drain',done);s.input.off('error',bad);resolve();}
      });
      sequence=base+n;missing=0;
     }
     if(lines.includes('#EXT-X-ENDLIST'))break;
     const target=Number((lines.find(x=>x.startsWith('#EXT-X-TARGETDURATION:'))||'').split(':')[1]);
     const refreshMs=Number.isFinite(target)&&target>0?Math.min(10000,Math.max(1000,target*500)):3000;
     await wait(refresh?250:refreshMs);
    }
    s.input.end();
   })().catch(error=>{if(!signal.aborted){console.warn(JSON.stringify({event:'media_hls_failed',session:s.id.slice(0,8),code:String(error.code||'UNKNOWN').slice(0,50)}));s.input.destroy(error);}});
  }
  console.info(JSON.stringify({event:'media_upstream_open',session:s.id.slice(0,8),status:media.response.statusCode,transport:hlsMode?'hls':'ts'}));
  s.input.once('end',()=>console.warn(JSON.stringify({event:'media_upstream_end',session:s.id.slice(0,8),bytes_received:s.bytes,stopping:!!s.stopping})));
  s.input.once('aborted',()=>console.warn(JSON.stringify({event:'media_upstream_aborted',session:s.id.slice(0,8),bytes_received:s.bytes,stopping:!!s.stopping})));
  s.input.once('close',()=>console.warn(JSON.stringify({event:'media_upstream_close',session:s.id.slice(0,8),complete:!!s.input.complete,bytes_received:s.bytes,stopping:!!s.stopping})));
  s.input.once('error',error=>console.warn(JSON.stringify({event:'media_upstream_error',session:s.id.slice(0,8),code:String(error?.code||'UNKNOWN').slice(0,50)})));
  if(signal.aborted){s.input.destroy();throw failure('ENGINE_START_TIMEOUT');}
  s.dir=await mkdtemp(join(this.root,'nplay-media-'));s.stage='processing';s.touched=Date.now();if(signal.aborted)throw failure('ENGINE_START_TIMEOUT');
  const video=this.mode==='copy'?['-c:v','copy']:['-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-threads','2','-vf','scale=w=min(1280\\,iw):h=-2','-r','25','-g','50','-keyint_min','50','-sc_threshold','0','-b:v','2000k','-maxrate','2500k','-bufsize','5000k','-pix_fmt','yuv420p'];
  const args=['-hide_banner','-loglevel','error','-nostdin','-fflags','+genpts+discardcorrupt','-probesize','2000000','-analyzeduration','2000000','-protocol_whitelist','pipe','-threads','2','-filter_threads','1','-f','mpegts','-i','pipe:0','-map','0:v:0?','-map','0:a:0?',...video,'-c:a','aac','-b:a','128k','-ac','2','-sn','-dn','-f','hls','-hls_time','2','-hls_list_size','30','-hls_delete_threshold','15','-hls_flags','delete_segments+temp_file+omit_endlist','-hls_segment_filename',join(s.dir,'seg%09d.ts'),join(s.dir,'index.m3u8')];
  s.child=spawn(this.ffmpeg,args,{stdio:['pipe','ignore','pipe'],windowsHide:true});
  // Discard raw FFmpeg diagnostics: they may contain input metadata. Only safe
  // stage/code values enter logs, status responses and the public player.
  s.child.stderr.resume();s.child.stdin.on('error',()=>{});
  s.closed=new Promise(resolve=>s.child.once('close',resolve));
  s.child.on('error',error=>{s.error=error.code==='ENOENT'?'ENGINE_NOT_INSTALLED':'ENGINE_PROCESS_FAILED';});
  s.child.on('close',(exitCode,exitSignal)=>{console.warn(JSON.stringify({event:'media_ffmpeg_closed',session:s.id.slice(0,8),stopping:!!s.stopping,exit_code:exitCode,exit_signal:exitSignal,bytes_received:s.bytes,input_idle_seconds:Math.floor((Date.now()-s.lastInputAt)/1000)}));if(!signal.aborted){s.error||='ENGINE_PROCESS_FAILED';s.stage='failed';s.controller.abort();s.input.destroy();this.last={stage:'failed',code:s.error};}});
  s.input.on('data',chunk=>{s.bytes+=chunk.length;s.lastInputAt=Date.now();s.stallLogged=false;});
  s.monitor=setInterval(()=>{if(s.stopping||s.error||s.stage!=='playing')return;const stalledMs=Date.now()-s.lastInputAt;if(stalledMs>12000&&!s.stallLogged){s.stallLogged=true;console.warn(JSON.stringify({event:'media_upstream_stalled',stalled_seconds:Math.floor(stalledMs/1000),session:s.id.slice(0,8)}));}},3000);s.monitor.unref();
  s.feed=pipeline(s.input,s.child.stdin,{signal}).catch(error=>{if(!signal.aborted){console.warn(JSON.stringify({event:'media_input_pipeline_failed',session:s.id.slice(0,8),code:String(error?.code||'UNKNOWN').slice(0,50)}));}if(!signal.aborted){s.error||='ENGINE_SOURCE_CONNECTION';s.stage='failed';this.last={stage:'failed',code:s.error};s.controller.abort();s.child.kill('SIGTERM');}});
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
