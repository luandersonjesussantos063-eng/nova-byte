// Encrypted resource locators keep provider account paths out of HLS manifests.
const encoder=new TextEncoder();
function encode(bytes){let s='';for(const n of bytes)s+=String.fromCharCode(n);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function decode(text){return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function key(secret){if(!secret)throw Error('Media key missing');return crypto.subtle.importKey('raw',decode(secret),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(url,id,secret){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(id)},await key(secret),encoder.encode(url)));const result=new Uint8Array(iv.length+cipher.length);result.set(iv);result.set(cipher,iv.length);return encode(result);}
async function unseal(token,id,secret){const data=decode(token);if(data.length<29||data.length>5000)throw Error('Invalid locator');return new TextDecoder('utf-8',{fatal:true}).decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:data.slice(0,12),additionalData:encoder.encode(id)},await key(secret),data.slice(12)));}
async function textLimited(response,max=512000){const reader=response.body?.getReader();if(!reader)throw Error('Missing manifest');const decoder=new TextDecoder('utf-8',{fatal:true});let text='',size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Manifest too large');text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel().catch(()=>{});}}
export async function hlsSource(env,id){
 const prefix='PULSE_CATALOG_'+id[0]+'_';const names=Object.keys(env).filter(name=>name.startsWith(prefix)).sort();
 if(names.length){const encoded=names.map(name=>env[name]).join('');if(encoded.length>16000)throw Error('Catalog shard too large');const data=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));const map=JSON.parse(await textLimited(new Response(stream),256000));if(typeof map[id]==='string')return {url:map[id]};}
 return await env.LIVE_SOURCES.get(id,'json');
}
export async function relayHls({request,env,id,jwt,origin,rootUrl,locator,upstream,validateUrl,cors}){
 const source=locator?await unseal(locator,id,env.HLS_MEDIA_KEY):rootUrl;
 validateUrl(source);
 const r=await upstream(source,request.signal,request.headers.get('Range'));
 if(!r.ok){await r.body?.cancel();return Response.json({error:'O fornecedor não disponibilizou o sinal deste canal.'},{status:502,headers:{...cors,'X-NPlay-Error':'UPSTREAM_HTTP','X-NPlay-Upstream-Status':String(r.status)}});}
 const type=r.headers.get('Content-Type')||'',manifest=!locator||/mpegurl/i.test(type)||/\.m3u8?$/i.test(new URL(source).pathname);
 if(manifest){
  if(request.method==='HEAD'){await r.body?.cancel();return new Response(null,{headers:{...cors,'Content-Type':'application/vnd.apple.mpegurl'}});}
  const text=await textLimited(r);if(!text.trimStart().startsWith('#EXTM3U')||/\{\$/.test(text))throw Error('Unsupported manifest');
  const base=r.url||source;
  const local=async raw=>{const url=validateUrl(new URL(raw,base).href).href;const encrypted=await seal(url,id,env.HLS_MEDIA_KEY);return origin+'/live/'+id+'/asset/'+encrypted+'?access_token='+encodeURIComponent(jwt);};
  const lines=[];
  for(const raw of text.split(/\r?\n/)){
   let line=raw.trim();
   if(!line){lines.push('');continue;}
   if(!line.startsWith('#')){lines.push(await local(line));continue;}
   if(!/^#EXT(?:M3U|INF:|-X-)/.test(line)||/^#EXT-X-(?:SESSION-DATA|DEFINE|CONTENT-STEERING|DATERANGE):/.test(line))continue;
   if(line.startsWith('#EXTINF:'))line=line.slice(0,line.indexOf(',')>=0?line.indexOf(','):line.length)+',';
   const matches=[...line.matchAll(/(?:^|[, :])URI="([^"]+)"/g)];
   for(const match of matches)line=line.replace('URI="'+match[1]+'"','URI="'+await local(match[1])+'"');
   lines.push(line);
  }
  return new Response(lines.join('\n'),{headers:{...cors,'Content-Type':'application/vnd.apple.mpegurl'}});
 }
 if(/text\/|json|html/i.test(type)){await r.body?.cancel();throw Error('Invalid media');}
 const headers=new Headers({...cors,'Content-Type':type||'application/octet-stream'});
 for(const name of ['Content-Length','Content-Range','Accept-Ranges'])if(r.headers.has(name))headers.set(name,r.headers.get(name));
 if(request.method==='HEAD'){await r.body?.cancel();return new Response(null,{status:r.status,headers});}
 return new Response(r.body,{status:r.status,headers});
}
