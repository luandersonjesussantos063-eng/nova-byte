import {seal,unseal,xtreamTsSource,hlsSource} from './hls-relay.mjs';
import {bridgeUpstream,decryptBridge,releaseBridgeViewer} from './pc-bridge.mjs';
const DB='https://vajlhodqxskozuxxlujv.supabase.co',KEY='sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3';
const AAD='nplay-iptv-media-v1',baseHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'};
const fail=(code,status=502)=>Object.assign(Error(code),{code,status});
export const isIptvRoute=path=>['/player_api.php','/get.php','/xmltv.php','/panel_api.php'].includes(path)||/^\/(?:live|movie|series)\/[^/]+\/[^/]+\/\d+\.(?:ts|m3u8|mp4|webm)$/.test(path)||path.startsWith('/iptv/asset/');
export async function iptvRpc(env,action,input={}){
 if(!env.IPTV_BACKEND_KEY)throw fail('IPTV_UNAVAILABLE',503);
 const r=await fetch(DB+'/rest/v1/rpc/nplay_iptv_backend',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_key:env.IPTV_BACKEND_KEY,p_action:action,p_input:input}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){await r.body?.cancel();throw fail('IPTV_DATABASE',503);}return r.json();
}
export async function iptvAdmin(request,jwt){
 const input=request.method==='GET'?{action:'list'}:await request.json();
 if(!['list','create','update'].includes(input.action))return Response.json({error:'Ação inválida.'},{status:400});
 const r=await fetch(DB+'/rest/v1/rpc/nplay_iptv_admin',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({p_action:input.action,p_input:input.data||{}}),signal:AbortSignal.timeout(15000)});
 const data=await r.json();
 if(!r.ok){const raw=String(data.message||'');const message=raw.includes('PASSWORD_MIN_12')?'A senha precisa ter entre 12 e 64 caracteres.':raw.includes('duplicate key')?'Este usuário já existe.':raw.includes('ADMIN_REQUIRED')?'Acesso administrativo necessário.':'Não foi possível salvar. Confira usuário, validade e limite de telas.';return Response.json({error:message},{status:400});}
 return Response.json({ok:true,data});
}
const hash=async raw=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const clean=raw=>String(raw||'').replace(/[\r\n"<>]/g,' ').trim();
const xml=raw=>String(raw||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// Many Xtream TV applications store category IDs as small, signed integers.
// The old unsigned 32-bit FNV IDs exceeded 2^31 (e.g. INFANTIS=3520097441),
// which causes a signed overflow / empty lists in some native IPTV clients.
// Keep deterministic IDs below one million; accept old unsigned/signed IDs on
// category-filter requests so previously cached clients can still browse.
const categoryHash=raw=>{let n=2166136261;for(const c of String(raw||'Geral'))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export const category=raw=>String(10000+(categoryHash(raw)%900000));
function categoryMatches(raw,requested){
 const hash=categoryHash(raw);
 return String(requested)===category(raw)
  ||String(requested)===String(hash)
  ||String(requested)===String(hash|0);
}
export function extension(item){try{return /\.(m3u8|mp4|webm)$/i.exec(new URL(item.source_url).pathname)?.[1]||'mp4';}catch{return /\.(mp4|webm)$/i.exec(item.r2_key||'')?.[1]||'mp4';}}
function logo(raw){if(!raw)return '';try{if(/^https:\/\//.test(raw))return new URL(raw).href;if(raw.startsWith('assets/'))return 'https://novabytesolucoes.com.br/novaplay/'+raw;return DB+'/storage/v1/object/public/novaplay-posters/'+raw.split('/').map(encodeURIComponent).join('/');}catch{return '';}}
function streamInfo(item,index){return {num:index+1,name:item.title,stream_type:item.kind==='live'?'live':'movie',stream_id:item.id,stream_icon:logo(item.logo),epg_channel_id:item.kind==='live'?'nplay-'+item.id:null,added:'0',category_id:category(item.category),custom_sid:'',tv_archive:0,direct_source:'',tv_archive_duration:0,container_extension:item.kind==='live'?'ts':extension(item),rating:'0',rating_5based:0};}
function movieInfo(item){return {name:item.title,o_name:item.title,cover_big:logo(item.logo),movie_image:logo(item.logo),plot:item.description||'',genre:item.category||'',releasedate:item.production_year?item.production_year+'-01-01':'',duration_secs:item.duration_seconds||0,duration:new Date((item.duration_seconds||0)*1000).toISOString().slice(11,19),rating:'0',cast:'',director:'',backdrop_path:[],youtube_trailer:''};}
export function catalogAction(action,params,catalog){
 const all=catalog.items||[],kind=action.includes('live')?'live':action.includes('series')?'series':'vod';
 let items=kind==='series'?(catalog.series||[]).map(s=>({...s,category:all.find(x=>x.series_title===s.title)?.category||'Séries',logo:all.find(x=>x.series_title===s.title)?.logo})):all.filter(x=>x.kind===kind);
 if(action.endsWith('_categories'))return [...new Map(items.map(x=>[category(x.category),{category_id:category(x.category),category_name:x.category,parent_id:0}])).values()];
 const filter=params.get('category_id');if(filter&&filter!=='0'&&filter!=='-1')items=items.filter(x=>categoryMatches(x.category,filter));
 if(action==='get_live_streams'||action==='get_vod_streams')return items.map(streamInfo);
 if(action==='get_vod_info'){
  const item=all.find(x=>x.kind==='vod'&&x.id===Number(params.get('vod_id')));if(!item)return {};
  return {info:movieInfo(item),movie_data:{stream_id:item.id,name:item.title,added:'0',category_id:category(item.category),container_extension:extension(item),custom_sid:'',direct_source:''}};
 }
 if(action==='get_series')return items.map(x=>({series_id:x.id,name:x.title,cover:logo(x.logo),plot:'',cast:'',director:'',genre:x.category,releaseDate:'',last_modified:'0',rating:'0',rating_5based:0,backdrop_path:[],youtube_trailer:'',episode_run_time:'',category_id:category(x.category)}));
 if(action==='get_series_info'){
  const series=(catalog.series||[]).find(x=>x.id===Number(params.get('series_id')));if(!series)return {};
  const episodes={},seasons=[];
  for(const x of all.filter(x=>x.kind==='episode'&&x.series_title===series.title)){
   const season=String(x.season_number||1);if(!episodes[season]){episodes[season]=[];seasons.push({season_number:Number(season),name:'Temporada '+season,episode_count:0});}
   episodes[season].push({id:String(x.id),episode_num:x.episode_number||episodes[season].length+1,title:x.title,container_extension:extension(x),info:movieInfo(x),custom_sid:'',added:'0',season:Number(season),direct_source:''});
  }
  for(const s of seasons)s.episode_count=episodes[s.season_number].length;
  return {seasons,info:{name:series.title,cover:logo(all.find(x=>x.series_title===series.title)?.logo),plot:'',genre:all.find(x=>x.series_title===series.title)?.category||'Séries'},episodes};
 }
 if(action==='get_short_epg'||action==='get_simple_data_table')return {epg_listings:[]};
 throw fail('UNSUPPORTED_ACTION',400);
}
export function playlist(catalog,origin,username,password,output='ts'){
 const creds=encodeURIComponent(username)+'/'+encodeURIComponent(password),lines=['#EXTM3U'];
 for(const x of catalog.items||[]){const ext=x.kind==='live'?(output==='hls'||output==='m3u8'?'m3u8':'ts'):extension(x),kind=x.kind==='live'?'live':x.kind==='episode'?'series':'movie';lines.push(`#EXTINF:-1 tvg-id="${x.kind==='live'?'nplay-'+x.id:''}" tvg-name="${clean(x.title)}" tvg-logo="${clean(logo(x.logo))}" group-title="${clean(x.category)}",${clean(x.title)}`,`${origin}/${kind}/${creds}/${x.id}.${ext}`);}
 return lines.join('\n')+'\n';
}
async function bridge(env){const info=await iptvRpc(env,'bridge');if(!info.cipher)throw fail('RECEIVER_OFFLINE',503);return decryptBridge(info.cipher,env.HLS_MEDIA_KEY);}
async function liveSource(env,item){const entry=await hlsSource(env,item.ref);if(!entry)throw fail('CONTENT_UNAVAILABLE',404);return entry.url;}
async function finishSession(env,session,config,raw){
 await Promise.allSettled([iptvRpc(env,'release',{account_id:session.account_id,session_id:session.session_id}),...(config&&raw?[releaseBridgeViewer(config,raw,session.owner)]:[])]);
}
// Streaming is guarded throughout playback, so blocking an account also stops an open stream.
function guardedBody(response,request,env,session,ctx,config,raw){
 const reader=response.body.getReader();let cancelled=false,lastCheck=Date.now();
 const body=new ReadableStream({
  async pull(controller){
   try{
    if(Date.now()-lastCheck>15000){lastCheck=Date.now();const check=await iptvRpc(env,'touch',session);if(!check.ok)throw fail('ACCESS_ENDED',403);}
    const {done,value}=await reader.read();if(done){await finish();controller.close();}else controller.enqueue(value);
   }catch{controller.error(Error('Playback ended'));await finish();}
  },async cancel(){await finish();}
 });
 async function finish(){if(cancelled)return;cancelled=true;await reader.cancel().catch(()=>{});await finishSession(env,session,config,raw);}
 request.signal?.addEventListener('abort',()=>{const task=finish();ctx?.waitUntil?.(task);},{once:true});
 return body;
}
async function textLimited(response){const reader=response.body.getReader(),decoder=new TextDecoder();let text='',size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000)throw fail('PLAYLIST_INVALID');text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel().catch(()=>{});}}
async function hlsResponse(response,request,env,payload,validateUrl){
 if(!response.ok){await response.body?.cancel();throw fail('CHANNEL_UNAVAILABLE',502);}
 const type=response.headers.get('Content-Type')||'';
 if(!/mpegurl/i.test(type)&&!new URL(payload.url).pathname.endsWith('.m3u8')){
  if(/text\/|json|html/i.test(type)){await response.body?.cancel();throw fail('MEDIA_INVALID');}
  const h=new Headers(baseHeaders);for(const k of ['Content-Type','Content-Length','Content-Range','Accept-Ranges'])if(response.headers.has(k))h.set(k,response.headers.get(k));return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:h});
 }
 const text=await textLimited(response);if(!text.trimStart().startsWith('#EXTM3U')||/\{\$/.test(text))throw fail('PLAYLIST_INVALID');
 const base=response.url||payload.url,origin=new URL(request.url).origin;
 const local=async raw=>{const target=validateUrl(new URL(raw,base).href).href;const token=await seal(JSON.stringify({...payload,url:target}),AAD,env.HLS_MEDIA_KEY);const ext=new URL(target).pathname.endsWith('.m3u8')?'m3u8':'bin';return `${origin}/iptv/asset/${token}/media.${ext}`;};
 const lines=[];
 for(const raw of text.split(/\r?\n/)){
  let line=raw.trim();if(!line){lines.push('');continue;}
  if(!line.startsWith('#')){lines.push(await local(line));continue;}
  if(!/^#EXT(?:M3U|INF:|-X-)/.test(line)||/^#EXT-X-(?:SESSION-DATA|DEFINE|CONTENT-STEERING|DATERANGE):/.test(line))continue;
  if(line.startsWith('#EXTINF:'))line=line.slice(0,line.indexOf(',')>=0?line.indexOf(','):line.length)+',';
  for(const match of [...line.matchAll(/(?:^|[, :])URI="([^"]+)"/g)])line=line.replace('URI="'+match[1]+'"','URI="'+await local(match[1])+'"');lines.push(line);
 }
 return new Response(request.method==='HEAD'?null:lines.join('\n'),{headers:{...baseHeaders,'Content-Type':'application/vnd.apple.mpegurl'}});
}
export async function handleIptv(request,env,ctx,{validateUrl,upstream}){
 const u=new URL(request.url),json=(x,status=200)=>Response.json(x,{status,headers:baseHeaders});
 if(!['GET','HEAD','POST'].includes(request.method))return json({error:'METHOD'},405);
 try{
  const asset=/^\/iptv\/asset\/([A-Za-z0-9_-]{1,7000})\/media\.(?:m3u8|bin)$/.exec(u.pathname);
  if(asset){
   let p;try{p=JSON.parse(await unseal(asset[1],AAD,env.HLS_MEDIA_KEY));}catch{throw fail('SESSION_INVALID',403);}
   if(p.exp<Date.now()||!p.account_id||!p.session_id)throw fail('SESSION_EXPIRED',403);
   const check=await iptvRpc(env,'touch',p);if(!check.ok)throw fail(check.code,403);
   const deliver=p.live?await bridgeUpstream(await bridge(env),validateUrl,p.owner):upstream;
   const response=await deliver(p.url,request.signal,request.headers.get('Range'));
   return await hlsResponse(response,request,env,p,validateUrl);
  }
  const media=/^\/(live|movie|series)\/([^/]{1,128})\/([^/]{1,256})\/(\d{1,10})\.(ts|m3u8|mp4|webm)$/.exec(u.pathname);
  let params=u.searchParams;
  if(request.method==='POST'){
   const content=await request.text();if(content.length>4096)throw fail('REQUEST_TOO_LARGE',413);params=new URLSearchParams(content);
  }
  const username=media?decodeURIComponent(media[2]):params.get('username')||'',password=media?decodeURIComponent(media[3]):params.get('password')||'';
  if(!/^[a-z0-9_]{4,40}$/.test(username)||password.length<12||password.length>128)return u.pathname.includes('api.php')?json({user_info:{auth:0,status:'Disabled'}}):json({error:'AUTH'},401);
  if(env.IPTV_LOGIN_LIMIT){const gate=await env.IPTV_LOGIN_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});if(!gate.success)throw fail('TRY_LATER',429);}
  const account=await iptvRpc(env,'authenticate',{username,password});
  if(!account.ok)return u.pathname.includes('api.php')?json({user_info:{auth:0,status:account.code==='EXPIRED'?'Expired':'Disabled'}}):json({error:account.code},401);
  if(media){
   const fingerprint=await hash([account.id,request.headers.get('CF-Connecting-IP')||'unknown',request.headers.get('User-Agent')||'',params.get('device_id')||''].join('\n'));
   const start=await iptvRpc(env,'start',{account_id:account.id,stream_id:Number(media[4]),fingerprint});if(!start.ok)throw fail(start.code,start.code==='CONNECTION_LIMIT'?429:403);
   for(const old of start.replaced||[]){if(old.kind!=='live')continue;try{const config=await bridge(env),entry=await hlsSource(env,old.ref);if(entry)await releaseBridgeViewer(config,entry.url,await hash('nplay-iptv\n'+old.session_id));}catch{}}
   const item=start.item;if((media[1]==='live')!==(item.kind==='live')||(media[1]==='series'&&item.kind!=='episode')||(media[1]==='movie'&&item.kind!=='vod'))throw fail('CONTENT_UNAVAILABLE',404);
   const session={account_id:account.id,session_id:start.session_id,owner:await hash('nplay-iptv\n'+start.session_id)};
   let config,raw;
   try{
    if(item.kind==='live'){
     raw=await liveSource(env,item);config=await bridge(env);
     const deliver=await bridgeUpstream(config,validateUrl,session.owner);
     if(media[5]==='ts'){
      const ts=/\.m3u8$/i.test(new URL(raw).pathname)?xtreamTsSource(raw):raw;if(!ts)throw fail('FORMAT_UNAVAILABLE',422);
      const response=await deliver(ts,request.signal,null,{xtream:true});if(!response.ok){await response.body?.cancel();throw fail('CHANNEL_UNAVAILABLE');}
      const body=request.method==='HEAD'?null:guardedBody(response,request,env,session,ctx,config,raw);
      if(request.method==='HEAD'){await response.body?.cancel();await finishSession(env,session,config,raw);}
      return new Response(body,{headers:{...baseHeaders,'Content-Type':'video/mp2t'}});
     }
     raw=raw.replace(/\.ts$/,'.m3u8');const response=await deliver(raw,request.signal,null,{xtream:true});
     return await hlsResponse(response,request,env,{...session,live:true,url:response.url||raw,exp:Math.min(Date.now()+6*3600000,Date.parse(account.expires_at))},validateUrl);
    }
    if(item.r2_key){
     if(!env.IPTV_VIDEOS)throw fail('VIDEO_STORAGE_UNAVAILABLE',503);
     let object;try{object=request.method==='HEAD'?await env.IPTV_VIDEOS.head(item.r2_key):await env.IPTV_VIDEOS.get(item.r2_key,{range:request.headers});}catch{throw fail('INVALID_RANGE',416);}
     if(!object)throw fail('VIDEO_NOT_FOUND',404);
     const headers=new Headers(baseHeaders);object.writeHttpMetadata(headers);headers.set('ETag',object.httpEtag);headers.set('Accept-Ranges','bytes');headers.set('Content-Type',extension(item)==='webm'?'video/webm':'video/mp4');headers.set('Cache-Control','no-store');
     const range=object.range;let status=200;
     if(range){status=206;const offset=range.offset??Math.max(0,object.size-range.suffix),length=range.length??Math.min(range.suffix,object.size);headers.set('Content-Range',`bytes ${offset}-${offset+length-1}/${object.size}`);headers.set('Content-Length',String(length));}else headers.set('Content-Length',String(object.size));
     if(request.method==='HEAD'){await finishSession(env,session);return new Response(null,{headers,status});}
     return new Response(guardedBody(new Response(object.body),request,env,session,ctx),{headers,status});
    }
    validateUrl(item.source_url);const response=await upstream(item.source_url,request.signal,request.headers.get('Range'));
    if(!response.ok){await response.body?.cancel();throw fail('VIDEO_UNAVAILABLE',502);}
    if(extension(item)==='m3u8')return await hlsResponse(response,request,env,{...session,url:item.source_url,live:false,exp:Math.min(Date.now()+6*3600000,Date.parse(account.expires_at))},validateUrl);
    const headers=new Headers(baseHeaders);for(const k of ['Content-Type','Content-Length','Content-Range','Accept-Ranges'])if(response.headers.has(k))headers.set(k,response.headers.get(k));
    if(request.method==='HEAD'){await response.body?.cancel();await finishSession(env,session);return new Response(null,{headers,status:response.status});}
    return new Response(guardedBody(response,request,env,session,ctx),{headers,status:response.status});
   }catch(error){await finishSession(env,session,config,raw);throw error;}
  }
  const action=params.get('action');
  if((u.pathname==='/player_api.php'||u.pathname==='/panel_api.php')&&!action){
   const now=Math.floor(Date.now()/1000);return json({user_info:{username,password,message:'NPlay',auth:1,status:'Active',exp_date:String(Math.floor(Date.parse(account.expires_at)/1000)),is_trial:'0',active_cons:account.active_connections,created_at:String(now),max_connections:String(account.max_connections),allowed_output_formats:['m3u8','ts']},server_info:{url:u.hostname,port:'80',https_port:'443',server_protocol:'https',rtmp_port:'0',timezone:'America/Campo_Grande',timestamp_now:now,time_now:new Date().toISOString().slice(0,19).replace('T',' ')}});
  }
  const catalog=await iptvRpc(env,'catalog',{account_id:account.id});if(!catalog.ok)throw fail('AUTH',401);
  if(u.pathname==='/get.php')return new Response(request.method==='HEAD'?null:playlist(catalog,u.origin,username,password,params.get('output')),{headers:{...baseHeaders,'Content-Type':'audio/x-mpegurl; charset=utf-8','Content-Disposition':'attachment; filename="nplay.m3u"'}});
  if(u.pathname==='/xmltv.php')return new Response('<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="NPlay">'+catalog.items.filter(x=>x.kind==='live').map(x=>`<channel id="nplay-${x.id}"><display-name>${xml(x.title)}</display-name>${logo(x.logo)?`<icon src="${xml(logo(x.logo))}"/>`:''}</channel>`).join('')+'</tv>',{headers:{...baseHeaders,'Content-Type':'application/xml; charset=utf-8'}});
  return json(catalogAction(action||'',params,catalog));
 }catch(error){const code=error.code||'IPTV_INTERNAL';console.error(JSON.stringify({event:'iptv_failed',code}));return json({error:code},error.status||502);}
}
