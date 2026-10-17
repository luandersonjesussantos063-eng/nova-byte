// NPlay time-shift test relay. Admin-only; never serves provider credentials.
// The Railway lab remains private; this Worker alone carries its session cookie.
// Turn into a public channel only after separate rights/limits approval.
const SUPABASE="https://vajlhodqxskozuxxlujv.supabase.co";
const ANON_KEY="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const ALLOWED_ORIGINS=new Set(["https://novabytesolucoes.com.br","https://www.novabytesolucoes.com.br"]);
const ENCODER=new TextEncoder();
async function labCookie(pin) {
 const key=await crypto.subtle.importKey("raw",ENCODER.encode(pin),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=new Uint8Array(await crypto.subtle.sign("HMAC",key,ENCODER.encode("nplay-lab-session-v1")));
 return "nplay_lab_auth="+[...signature].map(b=>b.toString(16).padStart(2,"0")).join("");
}
function tokenOf(req,url){return (req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim()||url.searchParams.get("access_token")||"";}
async function adminAllowed(jwt){
 if(!jwt||jwt.length>5000||jwt===ANON_KEY)return false;
 const r=await fetch(SUPABASE+"/rest/v1/novaplay_admins?select=user_id&limit=1",{
  headers:{"apikey":ANON_KEY,"Authorization":"Bearer "+jwt},redirect:"manual",signal:AbortSignal.timeout(8000)});
 if(!r.ok){await r.body?.cancel();return false;}
 const result=await r.json();return Array.isArray(result)&&result.length===1;
}
async function labFetch(env,path){
 const base=new URL(env.TIMESHIFT_BASE_URL);
 if(base.protocol!=="https:"||base.origin!=="https://nplay-timeshift-lab-production.up.railway.app")throw Error("Untrusted source");
 const target=new URL(path,base);
 if(target.origin!==base.origin||!target.pathname.startsWith("/channels/")&&target.pathname!=="/status")throw Error("Invalid path");
 return await fetch(target.toString(),{headers:{"Cookie":await labCookie(env.TIMESHIFT_VIEW_PIN),"Accept":"*/*"},
  redirect:"manual",signal:AbortSignal.timeout(16000),cf:{cacheTtl:0}});
}
const safeChannelPath=/^\/channels\/(a|b)\/(archive\/\d{1,9}\.m3u8|seg\d{1,9}\.ts)$/;
export default {async fetch(req,env){
 const u=new URL(req.url),requestOrigin=req.headers.get("Origin")||"";
 const headers={"Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(requestOrigin)?requestOrigin:"https://novabytesolucoes.com.br",
  "Access-Control-Allow-Methods":"GET,HEAD,OPTIONS","Access-Control-Allow-Headers":"Authorization,Content-Type",
  "Vary":"Origin","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Cache-Control":"private, no-store"};
 const json=(data,status=200)=>Response.json(data,{status,headers});
 if(requestOrigin&&!ALLOWED_ORIGINS.has(requestOrigin))return json({error:"Origem indisponível."},403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(u.pathname==="/healthz"){
  // Health check exposes no source URL, credentials, or channel contents.
  try{
   if(!env.TIMESHIFT_VIEW_PIN||!env.TIMESHIFT_BASE_URL)return json({ok:false,stage:"missing_configuration"},503);
   const r=await labFetch(env,"/status");
   if(!r.ok){await r.body?.cancel();return json({ok:false,stage:"upstream_unavailable",status:r.status},502);}
   const data=await r.json();
   return json({ok:!!(Array.isArray(data.blocks?.a)&&Array.isArray(data.blocks?.b)),
      stage:Array.isArray(data.blocks?.a)&&Array.isArray(data.blocks?.b)?"authenticated":"cookie_rejected"});
  }catch{return json({ok:false,stage:"upstream_connection"},502);}
 }
 if(req.method!=="GET"&&req.method!=="HEAD")return json({error:"Método inválido."},405);
 if(!env.TIMESHIFT_VIEW_PIN||!env.TIMESHIFT_BASE_URL)return json({error:"Relay não configurado."},503);
 const jwt=tokenOf(req,u);
 try{
  if(!await adminAllowed(jwt))return json({error:"Acesso restrito ao administrador."},403);
  if(u.pathname==="/status"){
   const response=await labFetch(env,"/status");
   if(!response.ok){await response.body?.cancel();return json({error:"Gravações indisponíveis."},502);}
   const len=Number(response.headers.get("Content-Length")||0);
   if(len>200000){await response.body?.cancel();return json({error:"Resposta inválida."},502);}
   const text=await response.text();
   if(text.length>200000)return json({error:"Resposta inválida."},502);
   let parsed;try{parsed=JSON.parse(text)}catch{return json({error:"Estado inválido."},502);}
   // The Railway lab deliberately returns HTTP 200 {ok:true} to unauthenticated
   // /status callers. Never silently reinterpret it as zero recorded blocks.
   if(!Array.isArray(parsed.blocks?.a)||!Array.isArray(parsed.blocks?.b)){
    console.warn(JSON.stringify({event:"timeshift_auth_failed",code:"LAB_COOKIE_REJECTED"}));
    return json({error:"A autenticação privada entre Cloudflare e Railway não foi aceita.",code:"LAB_COOKIE_REJECTED"},502);
   }
   return json({active:parsed.active,blocks:{a:parsed.blocks.a,b:parsed.blocks.b}});
  }
  const match=safeChannelPath.exec(u.pathname);
  if(!match)return json({error:"Recurso não encontrado."},404);
  const channel=match[1],resource=match[2],playlist=resource.endsWith(".m3u8");
  if(playlist){
   const end=u.searchParams.get("end");
   if(end!==null&&!/^\d{1,9}$/.test(end))return json({error:"Fim inválido."},400);
   const path=u.pathname+(end===null?"":"?end="+end);
   const response=await labFetch(env,path);
   if(!response.ok){await response.body?.cancel();return json({error:"Bloco não disponível.",upstream_status:response.status},response.status===410?410:502);}
   const raw=await response.text();
   if(raw.length>250000||!raw.startsWith("#EXTM3U"))return json({error:"Playlist inválida."},502);
   const manifest=raw.split(/\r?\n/).map(line=>{
    const value=line.trim();
    if(!value||value.startsWith("#"))return line;
    const segment=/^(?:\.\.\/)?(seg\d{1,9}\.ts)$/.exec(value);
    if(!segment)throw Error("Unexpected playlist resource");
    const target=new URL("/channels/"+channel+"/"+segment[1],u.origin);
    target.searchParams.set("access_token",jwt);
    return target.toString();
   }).join("\n");
   return new Response(req.method==="HEAD"?null:manifest,{status:200,headers:{...headers,"Content-Type":"application/vnd.apple.mpegurl; charset=utf-8"}});
  }
  const response=await labFetch(env,u.pathname);
  if(!response.ok){await response.body?.cancel();return json({error:"Segmento indisponível.",upstream_status:response.status},response.status===404?404:502);}
  const h=new Headers(headers);h.set("Content-Type","video/mp2t");
  if(response.headers.has("Content-Length"))h.set("Content-Length",response.headers.get("Content-Length"));
  return new Response(req.method==="HEAD"?null:response.body,{status:200,headers:h});
 }catch(error){
  console.error(JSON.stringify({event:"timeshift_gateway_failure",code:"RELAY_ERROR"}));
  return json({error:"Não foi possível entregar a gravação."},502);
 }
}};
