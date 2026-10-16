(()=>{
const SPTV='http://95.211.149.215:8081/look/sptv/playlist.m3u8';
const GATEWAY='https://nplay-sptv-hls.luandersonjesussantos063.workers.dev/look/sptv/playlist.m3u8';
function url(value){
 const u=new URL(value.trim());
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.href.length>2048)throw Error('Use um endereço HTTP/HTTPS válido, sem usuário ou senha na URL.');
 u.hash='';return u.href;
}
function isPlaylist(value){
 const u=new URL(value);
 return /\/get\.php\/?$/i.test(u.pathname)||/^m3u(?:_plus)?$/i.test(u.searchParams.get('type')||'');
}
function displayUrl(value){
 const u=new URL(value);
 for(const name of [...u.searchParams.keys()])if(/^(username|password|token|access_token|key|auth|authorization)$/i.test(name))u.searchParams.set(name,'oculto');
 return u.href;
}
// Explicitly authorized HTTP-to-HTTPS mappings only. Never proxy arbitrary user-supplied URLs.
const AUTHORIZED_GATEWAYS=Object.freeze({});
function candidates(value,{protocol=globalThis.location?.protocol||'https:'}={}){
 const normalized=url(value),u=new URL(normalized);
 if(u.protocol==='https:')return [normalized];
 const options=[];
 if(protocol==='http:')options.push(normalized);
 u.protocol='https:';options.push(u.href);
 return [...new Set(options)];
}
async function gateways(value,{signal}={}){
 const normalized=url(value),options=[];
 try{options.push(playable(normalized));}catch{}
 const configured=globalThis.NPLAY_AUTHORIZED_GATEWAYS||{};
 if(Object.prototype.hasOwnProperty.call(configured,normalized))options.push(configured[normalized]);
 // Only ask explicitly configured operators; never send sources to public proxies.
 for(const address of (globalThis.NPLAY_GATEWAY_URLS||[]).slice(0,5)){
  if(signal?.aborted)throw new DOMException('Teste interrompido.','AbortError');
  let endpoint;try{endpoint=new URL('/resolve',url(address));if(endpoint.protocol!=='https:')continue;}catch{continue;}
  endpoint.searchParams.set('source',normalized);
  const control=new AbortController(),abort=()=>control.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,5000);
  try{
   const response=await fetch(endpoint,{signal:control.signal,credentials:'omit',referrerPolicy:'no-referrer'});
   if(response.ok){const data=await response.json();const target=new URL(url(data.url));if(target.protocol==='https:'&&target.origin===endpoint.origin)options.push(target.href);}
  }catch(error){if(signal?.aborted)throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 return [...new Set(options.map(value=>{try{const target=url(value);return target.startsWith('https:')?target:null;}catch{return null;}}).filter(Boolean))];
}
function playable(value){
 const normalized=url(value),u=new URL(normalized);
 if(u.protocol==='https:')return normalized;
 if(u.origin+u.pathname===SPTV)return GATEWAY+u.search;
 if(Object.prototype.hasOwnProperty.call(AUTHORIZED_GATEWAYS,normalized))return AUTHORIZED_GATEWAYS[normalized];
 throw Error('Este endereço usa HTTP. O teste dentro do site precisa de uma versão HTTPS ou de um gateway autorizado já configurado. Isso não significa que o canal esteja fora do ar.');
}
function commaOutsideQuotes(text){let quote=null;for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c===',')return i;}return -1;}
function parseList(input,limit=500){
 if(input.length>2*1024*1024)throw Error('A lista excedeu 2 MB. Divida em partes menores.');
 const text=input.replace(/\r/g,'').replace(/^\uFEFF/,'');
 const blocks=[];
 if(/#EXTINF\s*:/i.test(text)){
  for(const block of text.split(/(?=#EXTINF\s*:)/i).filter(x=>/^#EXTINF\s*:/i.test(x)))blocks.push({block});
 }else{
  let title='';
  for(const raw of text.split('\n')){
   const line=raw.trim();if(!line||line.startsWith('#'))continue;
   if(/^https?:\/\//i.test(line)){blocks.push({block:line,title});title='';}
   else title=line;
  }
 }
 const entries=[],seen=new Set();let duplicates=0,invalid=0;
 for(const {block,title:plainTitle} of blocks){
  const separator=/^#EXTINF\s*:/i.test(block)?commaOutsideQuotes(block):-1,metadata=separator<0?'':block.slice(0,separator),rest=separator<0?block:block.slice(separator+1);
  const match=rest.match(/https?:\/\/[^\s<>"']+/i);
  if(!match){invalid++;continue;}
  try{
   const source=url(match[0]);if(seen.has(source)){duplicates++;continue;}seen.add(source);
   const attr=name=>metadata.match(new RegExp(name+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||'';
   const title=plainTitle||(separator<0?'':rest.slice(0,match.index).trim().split('\n')[0])||attr('tvg-name')||'Canal '+(entries.length+1);
   let logo=null;try{const candidate=url(attr('tvg-logo'));if(candidate.startsWith('https:'))logo=candidate;}catch{}
   const path=new URL(source).pathname;
   entries.push({title:title.slice(0,140),url:source,logo_url:logo,category:attr('group-title').slice(0,100),isPlaylist:isPlaylist(source),unsupported:/\.(mp4|webm|ogv|flv|m4v)$/i.test(path)});
  }catch{invalid++;}
 }
 return {entries:entries.slice(0,limit),duplicates,invalid,total:entries.length,truncated:Math.max(0,entries.length-limit)};
}
globalThis.NPlayM3u={url,isPlaylist,displayUrl,playable,candidates,gateways,parseList};
})();
