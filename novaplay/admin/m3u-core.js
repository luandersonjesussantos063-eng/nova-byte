(()=>{
const SPTV='http://95.211.149.215:8081/look/sptv/playlist.m3u8';
const GATEWAY='https://nplay-sptv-hls.luandersonjesussantos063.workers.dev/look/sptv/playlist.m3u8';
function url(value){
 const u=new URL(value.trim());
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.href.length>2048)throw Error('Use um endereço HTTP/HTTPS válido, sem usuário ou senha na URL.');
 u.hash='';return u.href;
}
// Explicitly authorized HTTP-to-HTTPS mappings only. Never proxy arbitrary user-supplied URLs.
const AUTHORIZED_GATEWAYS=Object.freeze({});
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
 const blocks=/#EXTINF\s*:/i.test(text)?text.split(/(?=#EXTINF\s*:)/i).filter(x=>/^#EXTINF\s*:/i.test(x)):text.split('\n').filter(x=>/^https?:\/\//i.test(x.trim()));
 const entries=[],seen=new Set();let duplicates=0,invalid=0;
 for(const block of blocks){
  const separator=commaOutsideQuotes(block),metadata=separator<0?'':block.slice(0,separator),rest=separator<0?block:block.slice(separator+1);
  const match=rest.match(/https?:\/\/[^\s<>"']+/i);
  if(!match){invalid++;continue;}
  try{
   const source=url(match[0]);if(seen.has(source)){duplicates++;continue;}seen.add(source);
   const attr=name=>metadata.match(new RegExp(name+'\\s*=\\s*["\']([^"\']*)["\']','i'))?.[1]||'';
   const title=(separator<0?'':rest.slice(0,match.index).trim().split('\n')[0])||attr('tvg-name')||'Canal '+(entries.length+1);
   let logo=null;try{const candidate=url(attr('tvg-logo'));if(candidate.startsWith('https:'))logo=candidate;}catch{}
   const path=new URL(source).pathname;
   entries.push({title:title.slice(0,140),url:source,logo_url:logo,category:attr('group-title').slice(0,100),unsupported:/\.(mp4|webm|ogv|flv|m4v)$/i.test(path)});
  }catch{invalid++;}
 }
 return {entries:entries.slice(0,limit),duplicates,invalid,total:entries.length,truncated:Math.max(0,entries.length-limit)};
}
globalThis.NPlayM3u={url,playable,parseList};
})();
