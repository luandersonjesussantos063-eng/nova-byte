// Authentication: each profile uses a cryptographically random 256-bit capability.
// Only its SHA-256 digest reaches the table. Never log headers or request bodies.
const allowed = new Set(['https://novabytesolucoes.com.br','https://www.novabytesolucoes.com.br']);
Deno.serve(async(req: Request)=>{
 const origin=req.headers.get('origin')||'';
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
 if(allowed.has(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowed.has(origin))return reply(403,{error:'origin'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'method'});
 const code=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 const match=/^MF1-([LJ])-([a-f0-9]{64})$/.exec(code);
 if(!match)return reply(401,{error:'connection_code_required'});
 try{
  if(Number(req.headers.get('content-length')||0)>2097152)return reply(413,{error:'too_large'});
  const raw=await req.text();if(new TextEncoder().encode(raw).length>2097152)return reply(413,{error:'too_large'});
  const body=JSON.parse(raw),profile=match[1]==='L'?'luanderson':'jackeline';
  if(body.profile!==profile)return reply(403,{error:'wrong_profile'});
  const tokenHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code))),b=>b.toString(16).padStart(2,'0')).join('');
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const dbHeaders={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'return=representation'};
  const query=url+'/rest/v1/mf_profile_sync?token_hash=eq.'+tokenHash;
  if(body.action==='pull'){
   const r=await fetch(query+'&select=profile,revision,state',{headers:dbHeaders});if(!r.ok)return reply(503,{error:'storage'});
   const rows=await r.json();if(!rows.length)return reply(404,{error:'not_found'});
   if(rows[0].profile!==profile)return reply(403,{error:'wrong_profile'});
   return reply(200,rows[0]);
  }
  if(body.action!=='push')return reply(400,{error:'action'});
  const s=body.state;
  if(!s||s.version!==3||!Array.isArray(s.events)||s.events.length>12000||!Array.isArray(s.sessions)||s.sessions.length>500||typeof s.progress!=='object'||s.progress===null||typeof s.essay!=='string'||s.essay.length>20000||!Number.isSafeInteger(body.revision)||body.revision<0)return reply(400,{error:'state'});
  const revision=body.revision+1;
  let r:Response;
  if(body.revision===0)r=await fetch(url+'/rest/v1/mf_profile_sync',{method:'POST',headers:dbHeaders,body:JSON.stringify({token_hash:tokenHash,profile,revision,state:s})});
  else r=await fetch(query+'&profile=eq.'+profile+'&revision=eq.'+body.revision,{method:'PATCH',headers:dbHeaders,body:JSON.stringify({revision,state:s,updated_at:new Date().toISOString()})});
  if(r.status===409)return reply(409,{error:'revision_conflict'});
  if(!r.ok)return reply(503,{error:'storage'});
  const rows=await r.json();if(!rows.length)return reply(409,{error:'revision_conflict'});
  return reply(200,{revision});
 }catch{return reply(400,{error:'request'});}
});
