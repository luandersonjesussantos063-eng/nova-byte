import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import {isIP} from 'node:net';

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
export async function fetchMedia(raw,range,signal,session={}){
 for(let hop=0;hop<5;hop++){
  const {url,address}=await destination(raw);
  const response=await new Promise((resolve,reject)=>{
   const headers={'Accept-Encoding':'identity','Accept':'*/*','User-Agent':'NPlay-TV-PC/0.50.0','Connection':'close'};if(range)headers.Range=range;
   if(session.cookie&&session.origin===url.origin)headers.Cookie=session.cookie;
   const request=(url.protocol==='https:'?https:http).request(url,{method:'GET',headers,signal,lookup:(_host,options,callback)=>callback(null,options.all?[{address,family:4}]:address,4)},resolve);
   const headTimer=setTimeout(()=>request.destroy(Object.assign(Error('UPSTREAM_TIMEOUT'),{code:'ETIMEDOUT'})),session.headerTimeout||15000);
   request.once('response',()=>clearTimeout(headTimer));
   request.on('error',error=>{clearTimeout(headTimer);const failure=Error('UPSTREAM_CONNECTION');failure.code=error.code;reject(failure);});
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
