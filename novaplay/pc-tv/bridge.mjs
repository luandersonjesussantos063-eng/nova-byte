import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import {isIP} from 'node:net';
import {timingSafeEqual} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';

// Only the authenticated gateway knows this key. No provider URLs are logged.
export function publicIP(host){
 if(isIP(host)!==4)return false;
 const [a,b,c]=host.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&(c===0||c===2))||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113)||host==='168.63.129.16');
}
export async function destination(raw,lookup=dns.lookup){
 const url=new URL(raw),host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.href.length>4096||!host.includes('.')||host.includes(':')||/\.(local|internal|localhost|home\.arpa)$/.test(host))throw Error('INVALID_DESTINATION');
 const addresses=isIP(host)?[{address:host,family:4}]:await lookup(host,{all:true,verbatim:true,family:4});
 if(!addresses.length||addresses.some(x=>!publicIP(x.address)))throw Error('INVALID_DESTINATION');
 return {url,address:addresses[0].address};
}
export async function fetchMedia(raw,range,signal){
 for(let hop=0;hop<5;hop++){
  const {url,address}=await destination(raw);
  const response=await new Promise((resolve,reject)=>{
   const headers={'Accept-Encoding':'identity','Accept':'*/*','User-Agent':'NPlay-TV-PC/0.49.29','Connection':'close'};if(range)headers.Range=range;
   const request=(url.protocol==='https:'?https:http).request(url,{method:'GET',headers,signal,lookup:(_host,options,callback)=>callback(null,options.all?[{address,family:4}]:address,4)},resolve);
   request.on('error',error=>{const failure=Error('UPSTREAM_CONNECTION');failure.code=error.code;reject(failure);});
   request.setTimeout(20000,()=>request.destroy(Object.assign(Error('UPSTREAM_TIMEOUT'),{code:'ETIMEDOUT'})));request.end();
  });
  if([301,302,303,307,308].includes(response.statusCode)){
   const location=response.headers.location;response.destroy();if(!location)throw Error('UPSTREAM_REDIRECT');raw=new URL(location,url).href;continue;
  }
  return {response,url:url.href};
 }
 throw Error('UPSTREAM_REDIRECT_LIMIT');
}
// Only roots explicitly selected by the gateway use Xtream routes. Never rewrite
// segment, key, movie, series or signed CDN requests.
export function xtreamCandidates(raw){
 const u=new URL(raw);
 if(u.search||u.hash||!/^\/(?:live\/)?[^/]+\/[^/]+\/\d+\.(?:m3u8|ts)$/.test(u.pathname))return [u.href];
 const canonical=new URL(u);if(!canonical.pathname.startsWith('/live/'))canonical.pathname='/live'+canonical.pathname;
 return [...new Set([canonical.href,u.href])];
}
export async function fetchXtream(raw,range,signal,fetcher=fetchMedia){
 const candidates=xtreamCandidates(raw);
 for(let i=0;i<candidates.length;i++){
  try{
   const media=await fetcher(candidates[i],range,signal);
   if(media.response.statusCode===404&&i<candidates.length-1){media.response.destroy();continue;}
   return media;
  }catch(error){
   if(signal?.aborted||error.code!=='ECONNRESET'||i===candidates.length-1)throw error;
  }
 }
}
function authorized(value,secret){
 const a=Buffer.from(value||''),b=Buffer.from('Bearer '+secret);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function upstreamReason(error){
 if(['DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID'].includes(error?.code))return 'UPSTREAM_TLS';
 if(error?.code==='ECONNRESET')return 'UPSTREAM_RESET';
 if(['EAI_AGAIN','ENOTFOUND'].includes(error?.code))return 'UPSTREAM_DNS';
 if(error?.code==='ETIMEDOUT')return 'UPSTREAM_TIMEOUT';
 if(error?.message==='INVALID_DESTINATION')return 'UPSTREAM_DESTINATION';
 return 'UPSTREAM_CONNECTION';
}
export function createBridge({secret,fetchUpstream=fetchMedia,fetchRoot=fetchXtream}){
 if(!/^[a-f0-9]{64}$/.test(secret||''))throw Error('NPLAY_BRIDGE_KEY must contain 64 hex characters');
 return http.createServer(async(req,res)=>{
  const json=(status,data)=>{if(res.headersSent||res.destroyed)return;const headers={'Content-Type':'application/json','Cache-Control':'no-store'};if(data.reason)headers['X-NPlay-Bridge-Error']=data.reason;res.writeHead(status,headers);res.end(JSON.stringify(data));};
  if(!authorized(req.headers.authorization,secret)){req.resume();json(401,{error:'AUTH_REQUIRED'});return;}
  if(req.url==='/health'&&req.method==='GET'){json(200,{service:'nplay-pc-tv',version:'0.49.29'});return;}
  if(req.url!=='/fetch'||req.method!=='POST'){req.resume();json(404,{error:'NOT_FOUND'});return;}
  const controller=new AbortController();req.on('aborted',()=>controller.abort());
  res.on('close',()=>{if(!res.writableFinished)controller.abort();});
  let media;
  try{
   let length=0;const chunks=[];
   for await(const chunk of req){length+=chunk.length;if(length>8192){json(413,{error:'REQUEST_TOO_LARGE'});req.destroy();return;}chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString());
   if(typeof input.url!=='string'||(input.range&&!/^bytes=\d*-\d*$/.test(input.range))){json(400,{error:'INVALID_REQUEST'});return;}
   if(input.xtream!==undefined&&typeof input.xtream!=='boolean'){json(400,{error:'INVALID_REQUEST'});return;}
   media=await (input.xtream?fetchRoot:fetchUpstream)(input.url,input.range,controller.signal);
   const {response,url}=media;
   const headers={'Cache-Control':'no-store','X-NPlay-Upstream-Url':url};
   for(const name of ['content-type','content-length','content-range','accept-ranges'])if(response.headers[name])headers[name]=response.headers[name];
   res.writeHead(response.statusCode,headers);await pipeline(response,res,{signal:controller.signal});
  }catch(error){
   media?.response.destroy();if(controller.signal.aborted)return;
   const reason=upstreamReason(error);console.error(JSON.stringify({event:'upstream_failed',code:reason}));
   json(502,{error:'UPSTREAM_UNAVAILABLE',reason});
   if(res.headersSent&&!res.writableEnded)res.destroy();
  }
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const server=createBridge({secret:process.env.NPLAY_BRIDGE_KEY});
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=30;
 server.listen(8788,'0.0.0.0',()=>console.log('NPlay TV-PC pronta na porta 8788.'));
}
