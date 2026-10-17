// Isolated lab adapter: playlist URLs and stream URLs stay server-side.
// Does not open simultaneous upstream video connections.
import {isIP} from 'node:net';

const playlistUrl=process.env.TIMESHIFT_REAL_M3U_URL || '';
const requested={a:process.env.TIMESHIFT_CHANNEL_A_NAME || 'Discovery H&H',b:process.env.TIMESHIFT_CHANNEL_B_NAME || 'RecordTV MT'};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
let cache=null;
function allowedUrl(value) {
  let u;try{u=new URL(value);}catch{throw Error('SOURCE_URL_INVALID');}
  if(!['http:','https:'].includes(u.protocol))throw Error('SOURCE_SCHEME_INVALID');
  const host=u.hostname.toLowerCase();
  if(['localhost','0.0.0.0','::1'].includes(host)||host.endsWith('.local')||host.endsWith('.internal'))throw Error('SOURCE_HOST_BLOCKED');
  if(isIP(host)===4) {
    const oct=host.split('.').map(Number);
    if(oct[0]===10||oct[0]===127||oct[0]===0||oct[0]===169&&oct[1]===254||oct[0]===172&&oct[1]>=16&&oct[1]<=31||oct[0]===192&&oct[1]===168)throw Error('SOURCE_HOST_BLOCKED');
  }
  if(isIP(host)===6 && (host==='::1'||host.startsWith('fc')||host.startsWith('fd')||host.startsWith('fe80')))throw Error('SOURCE_HOST_BLOCKED');
  return u;
}
async function readPlaylist(){
 const u=allowedUrl(playlistUrl);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),30000);
 let reader;
 try{
  const res=await fetch(u,{redirect:'follow',signal:controller.signal,headers:{Accept:'audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain'}});
  if(!res.ok)throw Error('PLAYLIST_HTTP_'+res.status);
  // A large declared Content-Length is fine: stream only until the two channels are found.
  reader=res.body.getReader();
  const dec=new TextDecoder();const records=[];
  let total=0,left='',name='';
  function consume(line){
    line=line.trim();
    if(line.startsWith('#EXTINF:')){name=line.split(',').slice(1).join(',').trim();return;}
    if(!line||line.startsWith('#'))return;
    if(name){
      try{const candidate=allowedUrl(new URL(line,u).href);records.push({name,url:candidate.href});}catch{}
      name='';
    }
  }
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>16_000_000)throw Error('PLAYLIST_TOO_LARGE');
    // The stream may start with a large chunk; classify only after parsing.
    left+=dec.decode(value,{stream:true});
    const lines=left.split(/\r?\n/);left=lines.pop();
    for(const line of lines)consume(line);
    if(total>4096&&records.length===0&&(/^\\s*<!doctype html/i.test(left)||/^\\s*<html/i.test(left)))throw Error('PLAYLIST_HTML');
    // Once both named channels are found there is no need to wait for a slow upstream to close.
    if(['a','b'].every(c=>records.some(item=>norm(item.name).includes(norm(requested[c])))))break;
  }
  if(left)consume(left);
  if(!records.length)throw Error('PLAYLIST_EMPTY');
  return records;
 }catch(err){
  if(controller.signal.aborted)throw Error('PLAYLIST_TIMEOUT');
  throw err;
 }finally{
  clearTimeout(timer);
  try{await reader?.cancel();}catch{}
 }
}
async function readXtreamChannels(){
  const u=allowedUrl(playlistUrl);
  const username=u.searchParams.get('username');
  const password=u.searchParams.get('password');
  if(!username||!password)throw Error('XTREAM_CREDENTIALS_UNAVAILABLE');
  const api=allowedUrl(new URL('/player_api.php',u).href);
  api.searchParams.set('username',username);
  api.searchParams.set('password',password);
  api.searchParams.set('action','get_live_streams');
  let res;
  try{res=await fetch(api,{signal:AbortSignal.timeout(18000),redirect:'error'});}
  catch(e){if(e?.name==='TimeoutError')throw Error('XTREAM_API_TIMEOUT');throw e;}
  if(!res.ok)throw Error('XTREAM_API_HTTP_'+res.status);
  const length=Number(res.headers.get('content-length')||0);
  if(length>12_000_000)throw Error('XTREAM_API_TOO_LARGE');
  const txt=await res.text();
  if(txt.length>12_000_000)throw Error('XTREAM_API_TOO_LARGE');
  let parsed;
  try{parsed=JSON.parse(txt);}catch{throw Error('XTREAM_API_NOT_JSON');}
  if(!Array.isArray(parsed))throw Error('XTREAM_API_NOT_STREAMS');
  const needed={};const taken=new Set();
  for(const c of ['a','b']){
    const name=norm(requested[c]);
    const matches=parsed.filter(i=>Number.isInteger(Number(i.stream_id))&&Number(i.stream_id)>0&&norm(i.name).includes(name)&&!taken.has(i.stream_id));
    // Best effort exact match before accepting a substring, e.g. HD/FHD variants
    const entry=matches.find(i=>norm(i.name)===name)||matches[0];
    if(!entry)throw Error('CHANNEL_'+c.toUpperCase()+'_NOT_FOUND');
    const target=allowedUrl(new URL('/live/'+encodeURIComponent(username)+'/'+encodeURIComponent(password)+'/'+String(entry.stream_id)+'.m3u8',u).href);
    needed[c]={name:String(entry.name).slice(0,100),url:target.href};
    taken.add(entry.stream_id);
  }
  return needed;
}
export async function sourceFor(channel){
 if(!playlistUrl)throw Error('PLAYLIST_NOT_CONFIGURED');
 if(cache&&Date.now()<cache.until)return cache.sources[channel];
 let sources,method='xtream-api',apiFailure='';
 try{sources=await readXtreamChannels();}
 catch(e){
  apiFailure=safeSourceError(e);
  console.log(JSON.stringify({event:'lab_xtream_api_failed',code:apiFailure}));
  method='m3u';
  let all;
  try{all=await readPlaylist();}
  catch(e2){console.error(JSON.stringify({event:'lab_m3u_failed',code:safeSourceError(e2)}));throw e2;}
  sources={};const taken=new Set();
  for(const c of ['a','b']){
    const q=norm(requested[c]);
    const candidate=all.find(item=>norm(item.name).includes(q)&&!taken.has(item.url));
    if(!candidate)throw Error('CHANNEL_'+c.toUpperCase()+'_NOT_FOUND');
    sources[c]=candidate;taken.add(candidate.url);
  }
 }
 cache={sources,until:Date.now()+10*60*1000};
 console.log(JSON.stringify({event:'lab_sources_found',method,apiFailure:apiFailure||undefined,channels:['a','b']}));
 return sources[channel];
}
export function dropSourceCache(){cache=null;}
export function safeSourceError(err){
 const m=String(err?.message || err || 'SOURCE_ERROR');
 if(/^(PLAYLIST_HTTP_\d+|PLAYLIST_TOO_LARGE|PLAYLIST_EMPTY|PLAYLIST_HTML|PLAYLIST_INVALID_FORMAT|PLAYLIST_TIMEOUT|PLAYLIST_NOT_CONFIGURED|SOURCE_(?:URL_INVALID|SCHEME_INVALID|HOST_BLOCKED)|CHANNEL_[AB]_NOT_FOUND|XTREAM_(?:CREDENTIALS_UNAVAILABLE|API_TIMEOUT|API_TOO_LARGE|API_NOT_JSON|API_NOT_STREAMS|API_HTTP_\d+))$/.test(m))return m;
 const cause=String(err?.cause?.code||err?.code||'');
 const allowed=new Set(['ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','ETIMEDOUT','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED']);
 if(allowed.has(cause))return 'SOURCE_'+cause;
 return 'SOURCE_CONNECT_FAILED';
}
