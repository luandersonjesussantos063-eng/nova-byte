// Provider metadata only. No media is opened and no upstream locator is returned.
export function programmeTitle(raw){
 let value=String(raw||'').slice(0,4000);
 if(value.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(value)){
  try{const decoded=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)));if(!/[\x00-\x08\x0e-\x1f]/.test(decoded))value=decoded;}catch{}
 }
 return value.replace(/<[^>]*>/g,'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,300);
}
function timestamp(raw){
 if(raw!==null&&raw!==undefined&&raw!==''&&Number.isFinite(Number(raw))){const n=Number(raw);return n>1e12?n:n*1000;}
 // Never guess the timezone of a supplier's unzoned wall-clock string.
 if(typeof raw==='string'&&/(?:Z|[+-]\d\d:?\d\d)$/.test(raw)){const n=Date.parse(raw);if(Number.isFinite(n))return n;}
 return NaN;
}
export function normalizeEpg(rows,now=Date.now()){
 const programmes=(Array.isArray(rows)?rows:[]).slice(0,40).map(p=>({title:programmeTitle(p.title),start:timestamp(p.start_timestamp??p.start),end:timestamp(p.stop_timestamp??p.end_timestamp??p.end)})).filter(p=>p.title&&Number.isFinite(p.start)&&Number.isFinite(p.end)&&p.end>p.start&&p.end-p.start<7*86400000).sort((a,b)=>a.start-b.start);
 const current=programmes.find(p=>p.start<=now&&now<p.end)||null;
 return {current,next:programmes.find(p=>p.start>=(current?.end||now))||null,updated_at:now};
}
export function epgUrl(raw){
 const u=new URL(raw),m=/^\/(?:live\/)?([^/]+)\/([^/]+)\/(\d+)\.(?:m3u8|ts)$/.exec(u.pathname);
 if(!m||u.search||u.hash)return null;
 const api=new URL('/player_api.php',u.origin);
 api.search=new URLSearchParams({username:decodeURIComponent(m[1]),password:decodeURIComponent(m[2]),action:'get_short_epg',stream_id:m[3],limit:'8'}).toString();return api.href;
}
export async function channelEpg({id,source,deliver,readJson,cache,origin,now=Date.now()}){
 const key=new Request(origin+'/epg-cache/'+id),empty={current:null,next:null,updated_at:now};
 try{
  if(cache){const cached=await cache.match(key);if(cached){const data=await readJson(cached,16000);if(data.expires_at>now&&(!data.current||data.current.end>now))return data;}}
  const url=epgUrl(source);if(!url)return empty;
  const response=await deliver(url,AbortSignal.timeout(8000));
  if(!response.ok){await response.body?.cancel();return empty;}
  const payload=await readJson(response,100000),data=normalizeEpg(payload.epg_listings,now);
  data.expires_at=Math.min(now+(data.current?180000:60000),data.current?.end||now+60000);
  if(cache)await cache.put(key,Response.json(data,{headers:{'Cache-Control':'max-age='+Math.max(1,Math.floor((data.expires_at-now)/1000))}})).catch(()=>{});
  return data;
 }catch{return empty;}
}
