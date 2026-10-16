// NPlay M3U Plus import endpoint for a Cloudflare Worker.
// Secrets: PLAYLIST_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_ADMIN_TOKEN.
// Call POST /import with Authorization: Bearer <IMPORT_ADMIN_TOKEN> from a trusted server.
// No public GET endpoint and no credentials in GitHub or the NPlay browser.
function parsePlaylist(text){
 const result=[];const lines=text.replace(/\r/g,'').split('\n');let meta=null;
 for(const line of lines){
  const value=line.trim();
  if(value.startsWith('#EXTINF:')){meta=value;continue;}
  if(!meta||!/^https?:\/\//i.test(value)){if(value&&!value.startsWith('#'))meta=null;continue;}
  const attr=key=>{const m=meta.match(new RegExp(key+'\\s*=\\s*["\x27]([^"\x27]*)["\x27]','i'));return m?m[1]:'';};
  const title=(meta.slice(meta.indexOf(',')+1)||attr('tvg-name')||'Canal').trim().slice(0,140);
  result.push({title,source_url:value,category:attr('group-title').slice(0,100),logo_url:attr('tvg-logo')||null});
  meta=null;
  if(result.length>=5000)break;
 }
 return result;
}
export default {
 async fetch(request,env){
  if(new URL(request.url).pathname!=='/import'||request.method!=='POST')return new Response('Not found',{status:404});
  const auth=request.headers.get('Authorization')||'';
  if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))return new Response('Unauthorized',{status:401});
  if(!env.PLAYLIST_URL||!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY)return new Response('Missing configuration',{status:503});
  const base=env.SUPABASE_URL.replace(/\/$/,'');
  const headers={apikey:env.SUPABASE_ANON_KEY,Authorization:auth};
  const check=await fetch(base+'/rest/v1/novaplay_admins?select=user_id&limit=1',{headers});
  if(!check.ok)return new Response('Unauthorized',{status:401});
  const admins=await check.json();
  if(!Array.isArray(admins)||admins.length!==1)return new Response('Forbidden',{status:403});
  const source=new URL(env.PLAYLIST_URL);
  if(source.protocol!=='https:')return new Response('HTTPS playlist source required',{status:400});
  const upstream=await fetch(source.toString(),{redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!upstream.ok)return new Response('Playlist unavailable: '+upstream.status,{status:502});
  const declared=Number(upstream.headers.get('content-length')||0);
  if(declared>5*1024*1024)return new Response('Playlist too large',{status:413});
  const content=await upstream.text();
  if(content.length>5*1024*1024)return new Response('Playlist too large',{status:413});
  const channels=parsePlaylist(content);
  // Store metadata in a private staging table, never directly publish untested streams.
  // This table must be created by the operator and protected by RLS.
  const records=channels.map((channel,index)=>({source_key:'m3uplus',source_index:index,title:channel.title,category:channel.category,logo_url:channel.logo_url,source_url:channel.source_url,status:'pending'}));
  let imported=0;
  for(let i=0;i<records.length;i+=100){
   const response=await fetch(base+'/rest/v1/novaplay_import_staging?on_conflict=source_key,source_index',{
    method:'POST',headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:auth,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},
    body:JSON.stringify(records.slice(i,i+100))
   });
   if(!response.ok)return Response.json({error:'Database staging failed',imported},{status:502});
   imported+=Math.min(100,records.length-i);
  }
  return Response.json({imported,published:0,message:'Imported as private pending records. Test and approve before publication.'});
 }
};
