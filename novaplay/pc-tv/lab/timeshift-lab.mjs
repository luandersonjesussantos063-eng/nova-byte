// Isolated NPlay time-shift lab. No IPTV credentials, no production endpoints.
// node novaplay/pc-tv/lab/timeshift-lab.mjs
// Test: curl http://127.0.0.1:8799/status ; curl http://127.0.0.1:8799/channels/a/index.m3u8
import http from 'node:http';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';

const PORT=Number(process.env.TIMESHIFT_LAB_PORT||8799);
const ROTATE_MS=Math.max(1000,Number(process.env.TIMESHIFT_ROTATE_MS||30000));
const SEGMENT_MS=Math.max(250,Number(process.env.TIMESHIFT_SEGMENT_MS||2000));
const MAX_SEGMENTS=Math.max(4,Number(process.env.TIMESHIFT_MAX_SEGMENTS||900));
const channels=['a','b'];
const recordings=new Map(channels.map(c=>[c,[]]));
const root=await mkdtemp(join(tmpdir(),'nplay-timeshift-'));
let active=0,seq=0,closed=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(event,fields={})=>console.log(JSON.stringify({event,...fields}));

// A synthetic source is used deliberately. Replace only with independently
// authorized recordable source in a separate lab deployment.
async function recorder(){
 while(!closed){
  const channel=channels[active];
  const until=Date.now()+ROTATE_MS;
  log('recording_started',{channel});
  while(!closed&&Date.now()<until){
   const number=++seq,filename='seg'+String(number).padStart(9,'0')+'.ts';
   // Synthetic bytes demonstrate isolation/storage, not playable TV footage.
   const payload=Buffer.from('NPLAY_LAB_'+channel+'_'+number+'_'+randomBytes(64).toString('hex'));
   await writeFile(join(root,filename),payload);
   const list=recordings.get(channel);
   list.push({number,filename,createdAt:Date.now()});
   if(list.length>MAX_SEGMENTS){const expired=list.shift();await rm(join(root,expired.filename),{force:true});}
   await sleep(SEGMENT_MS);
  }
  log('recording_stopped',{channel,stored:recordings.get(channel).length});
  active=(active+1)%channels.length;
 }
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/status'){
   res.setHeader('Content-Type','application/json');
   res.end(JSON.stringify({mode:'isolated-synthetic',recording:channels[active],channels:Object.fromEntries(channels.map(c=>[c,{segments:recordings.get(c).length}])),rotationMs:ROTATE_MS,segmentMs:SEGMENT_MS}));
   return;
  }
  const match=/^\/channels\/(a|b)\/(index\.m3u8|seg\d{9}\.ts)$/.exec(url.pathname);
  if(!match){res.writeHead(404);res.end();return;}
  const [,channel,name]=match;
  if(name==='index.m3u8'){
   const list=recordings.get(channel);
   res.setHeader('Content-Type','application/vnd.apple.mpegurl');
   res.setHeader('Cache-Control','no-store');
   res.end(['#EXTM3U','#EXT-X-VERSION:3','#EXT-X-TARGETDURATION:'+Math.ceil(SEGMENT_MS/1000),'#EXT-X-PLAYLIST-TYPE:EVENT','#EXT-X-MEDIA-SEQUENCE:0',...list.flatMap(x=>['#EXTINF:'+(SEGMENT_MS/1000).toFixed(3)+',',x.filename])].join('\n')+'\n');
   return;
  }
  if(!recordings.get(channel).some(x=>x.filename===name)){res.writeHead(404);res.end();return;}
  const bytes=await readFile(join(root,name));
  res.setHeader('Content-Type','video/mp2t');
  res.setHeader('Cache-Control','private, max-age=60');
  res.end(bytes);
 }catch{res.writeHead(500);res.end();}
});
server.listen(PORT,'127.0.0.1',()=>log('lab_listening',{port:PORT,synthetic:true}));
void recorder().catch(error=>{log('lab_failed',{code:String(error.code||'UNKNOWN')});process.exitCode=1;server.close();});
async function shutdown(){closed=true;server.close();await rm(root,{recursive:true,force:true});}
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
