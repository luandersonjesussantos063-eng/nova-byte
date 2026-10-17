import {fetchMedia} from './transport.mjs';
import {providerUrl} from './provider-tls.mjs';
export function xtreamIdentity(raw){
 const u=providerUrl(raw),m=/^\/(?:live\/)?([^/]+)\/([^/]+)\/(\d+)\.(m3u8|ts)$/.exec(u.pathname);
 if(!m||u.search||u.hash||!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Object.assign(Error('Invalid live root'),{code:'XTREAM_ROOT_INVALID'});
 return {origin:u.origin,user:decodeURIComponent(m[1]),password:decodeURIComponent(m[2]),id:m[3],format:m[4]};
}
export async function boundedJson(response,max=512000){
 let bytes=0;const parts=[];
 try{for await(const chunk of response){bytes+=chunk.length;if(bytes>max)throw Error('API payload too large');parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
 finally{response.destroy();}
}
function safeCookies(headers){
 return (headers['set-cookie']||[]).map(x=>String(x).split(';')[0]).filter(x=>/^[A-Za-z0-9_~-]+=[^\r\n;]{0,1024}$/.test(x)).slice(0,8).join('; ');
}
export class XtreamClient{
 constructor({fetcher=fetchMedia}={}){this.fetcher=fetcher;}
 async login(raw,signal,{forPlayback=true}={}){
  const identity=xtreamIdentity(raw),u=new URL('/player_api.php',identity.origin);
  u.searchParams.set('username',identity.user);u.searchParams.set('password',identity.password);
  let result;
  for(let attempt=0;attempt<2;attempt++){
   try{result=await this.fetcher(u.href,null,signal);break;}
   catch(error){
    if(error.code==='ECONNRESET'&&attempt===0&&!signal?.aborted){
     console.warn(JSON.stringify({event:'xtream_login_retry',code:'ECONNRESET'}));
     await new Promise(resolve=>setTimeout(resolve,300));
     if(signal?.aborted)break;
     continue;
    }
    throw Object.assign(Error('Xtream login transport failed'),{code:error.code==='ECONNRESET'?'XTREAM_LOGIN_RESET':(error.code==='ETIMEDOUT'||signal?.reason?.name==='TimeoutError')?'XTREAM_LOGIN_TIMEOUT':'XTREAM_LOGIN_CONNECTION'});
   }
  }
  if(!result)throw Object.assign(Error('Xtream login cancelled'),{code:'XTREAM_LOGIN_TIMEOUT'});
  if(result.response.statusCode!==200){result.response.destroy();throw Object.assign(Error('Xtream login denied'),{code:'XTREAM_LOGIN_DENIED'});}
  const cookie=safeCookies(result.response.headers);let info;
  try{info=await boundedJson(result.response);}catch{throw Object.assign(Error('Invalid Xtream response'),{code:'XTREAM_LOGIN_INVALID'});}
  if(Number(info?.user_info?.auth)!==1||String(info.user_info.status).toLowerCase()!=='active')throw Object.assign(Error('Account is not active'),{code:'XTREAM_LOGIN_DENIED'});
  const formats=Array.isArray(info.user_info.allowed_output_formats)?info.user_info.allowed_output_formats:[];
  if(formats.length&&!formats.includes('ts'))throw Object.assign(Error('Account does not offer TS input'),{code:'XTREAM_TS_UNAVAILABLE'});
  const activeRaw=info.user_info.active_cons,limitRaw=info.user_info.max_connections;
  const active=activeRaw==null||activeRaw===''?null:Number(activeRaw);
  const limit=limitRaw==null||limitRaw===''?null:Number(limitRaw);
  const validActive=active!==null&&Number.isFinite(active)&&active>=0;
  const validLimit=limit!==null&&Number.isFinite(limit)&&limit>0;
  console.info(JSON.stringify({event:'xtream_connection_report',active:validActive?active:null,limit:validLimit?limit:null,playback:forPlayback,at_capacity:!!(validActive&&validLimit&&active>=limit)}));
  if(forPlayback&&validActive&&validLimit&&active>=limit)throw Object.assign(Error('All provider connections are in use'),{code:'XTREAM_CONNECTION_LIMIT'});
  // Keep the user-supplied server: no unvalidated server_info/direct_source redirects.
  return {identity,session:{origin:identity.origin,cookie},account:{active:true,connections:active,limit,formats:formats.filter(x=>['ts','m3u8','rtmp'].includes(x))}};
 }
 async inspect(raw,signal){
  const login=await this.login(raw,signal,{forPlayback:false}),i=login.identity;
  const action=async(name,extra={},max=12000000)=>{
   const u=new URL('/player_api.php',i.origin);u.searchParams.set('username',i.user);u.searchParams.set('password',i.password);u.searchParams.set('action',name);
   for(const [key,value] of Object.entries(extra))u.searchParams.set(key,value);
   const r=await this.fetcher(u.href,null,signal,login.session);
   if(r.response.statusCode!==200){r.response.destroy();throw Object.assign(Error('Xtream metadata unavailable'),{code:'XTREAM_CATALOG_INVALID'});}
   return boundedJson(r.response,max);
  };
  const categories=await action('get_live_categories',{},500000),streams=await action('get_live_streams');
  if(!Array.isArray(categories)||!Array.isArray(streams))throw Object.assign(Error('Invalid Xtream catalog'),{code:'XTREAM_CATALOG_INVALID'});
  const channel=streams.find(s=>String(s.stream_id)===i.id);let epg=[];
  try{const info=await action('get_short_epg',{stream_id:i.id,limit:'5'},100000);epg=(info.epg_listings||[]).slice(0,5).map(x=>({title:Buffer.from(String(x.title||'').slice(0,4000),'base64').toString('utf8').slice(0,500),start:String(x.start||'').slice(0,40),end:String(x.end||'').slice(0,40)}));}catch{}
  return {ok:true,account:login.account,channel_count:streams.length,categories:categories.slice(0,500).map(x=>({id:String(x.category_id||'').slice(0,40),name:String(x.category_name||'').slice(0,120)})),selected_channel:channel?{id:i.id,title:String(channel.name||'').slice(0,140)}:null,epg};
 }
 async openHls(login,signal){
  const {identity:i,session}=login;
  const candidates=[`${i.origin}/live/${encodeURIComponent(i.user)}/${encodeURIComponent(i.password)}/${i.id}.m3u8`,`${i.origin}/${encodeURIComponent(i.user)}/${encodeURIComponent(i.password)}/${i.id}.m3u8`];
  for(let n=0;n<candidates.length;n++){
   try{
    const media=await this.fetcher(candidates[n],null,signal,{...session,headerTimeout:8000});
    if(media.response.statusCode===404&&n===0){media.response.destroy();continue;}
    if(media.response.statusCode!==200){media.response.destroy();throw Object.assign(Error('HLS source denied'),{code:'ENGINE_SOURCE_HTTP'});}
    return media;
   }catch(error){
    if(error.code==='ECONNRESET'&&n===0&&!signal.aborted){
     console.warn(JSON.stringify({event:'media_hls_source_reset_retry',candidate:1}));
     await new Promise(resolve=>setTimeout(resolve,350));continue;
    }
    if(error.code?.startsWith('ENGINE_'))throw error;
    throw Object.assign(Error('HLS media connection failed'),{code:error.code==='ECONNRESET'?'ENGINE_SOURCE_RESET':'ENGINE_SOURCE_CONNECTION'});
   }
  }
  throw Object.assign(Error('HLS unavailable'),{code:'ENGINE_SOURCE_HTTP'});
 }
 async openTs(login,signal){
  const {identity:i,session}=login;
  const candidates=[`${i.origin}/live/${encodeURIComponent(i.user)}/${encodeURIComponent(i.password)}/${i.id}.ts`,`${i.origin}/${encodeURIComponent(i.user)}/${encodeURIComponent(i.password)}/${i.id}.ts`];
  for(let n=0;n<candidates.length;n++){
   try{
    const media=await this.fetcher(candidates[n],null,signal,{...session,headerTimeout:8000});
    if(media.response.statusCode===404&&n===0){media.response.destroy();continue;}
    if(media.response.statusCode!==200){media.response.destroy();throw Object.assign(Error('Provider stream denied'),{code:'ENGINE_SOURCE_HTTP'});}
    const type=media.response.headers['content-type']||'';
    if(/text\/|json|html|mpegurl/i.test(type)){media.response.destroy();throw Object.assign(Error('Provider did not return TS'),{code:'ENGINE_SOURCE_INVALID'});}
    return media;
   }catch(error){
    if(error.code==='ECONNRESET'&&n===0&&!signal.aborted){console.warn(JSON.stringify({event:'media_source_reset_retry',candidate:1}));await new Promise(resolve=>setTimeout(resolve,350));continue;}
    if(error.code?.startsWith('ENGINE_'))throw error;
    throw Object.assign(Error('Provider media connection failed'),{code:error.code==='ECONNRESET'?'ENGINE_SOURCE_RESET':'ENGINE_SOURCE_CONNECTION'});
   }
  }
 }
}
