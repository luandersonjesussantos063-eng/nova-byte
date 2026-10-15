const ORIGIN="https://novabytesolucoes.com.br";
const SUPABASE="https://vajlhodqxskozuxxlujv.supabase.co";
const ANON="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const json=(x,status=200,headers={})=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json",...headers}});
async function publishedVideo(id){
 if(!/^[0-9a-f-]{36}$/i.test(id))return null;
 const response=await fetch(SUPABASE+"/rest/v1/novaplay_library?id=eq."+encodeURIComponent(id)+"&select=r2_object_key,is_published,licensed_rights_confirmed,rights_reviewed,catalog_only&limit=1",{headers:{apikey:ANON,Authorization:"Bearer "+ANON}});
 if(!response.ok)throw Error("Catalog lookup unavailable");
 const record=(await response.json())?.[0];
 if(!record?.r2_object_key||!record.is_published||!record.licensed_rights_confirmed||!record.rights_reviewed||record.catalog_only)return null;
 if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-z0-9-]{8,80}\.(mp4|webm|ogv)$/i.test(record.r2_object_key))return null;
 return record;
}
async function sourceVersion(etag){
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(etag.replaceAll('"','')));
 return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,"0")).join("").slice(0,16);
}
async function adaptiveResponse(request,env,route,cors){
 if(!["GET","HEAD"].includes(request.method))return json({error:"Método inválido"},405,cors);
 const parts=route.pathname.split("/");
 const record=await publishedVideo(parts[2]);
 if(!record)return json({error:"Vídeo não publicado ou não autorizado"},404,cors);
 const headers={...cors,"Cache-Control":"no-store"};
 if(parts[1]==="playback"){
  if(parts.length!==3)return json({error:"Rota inválida"},404,cors);
  const source=await env.VIDEOS.head(record.r2_object_key);
  if(!source)return json({error:"Vídeo indisponível"},404,cors);
  const version=await sourceVersion(source.etag);
  const master=await env.VIDEOS.head(record.r2_object_key+".hls/"+version+"/master.m3u8");
  const fallback=route.origin+"/watch/"+parts[2];
  return json({type:master?"hls":"mp4",url:master?route.origin+"/hls/"+parts[2]+"/"+version+"/master.m3u8":fallback,fallback},200,headers);
 }
 const version=parts[3],file=parts.slice(4).join("/");
 if(!/^[0-9a-f]{16}$/.test(version||"")||!(/^(master\.m3u8|[0-2]\/(index\.m3u8|segment_[0-9]{5}\.ts))$/).test(file))return json({error:"Segmento inválido"},400,cors);
 const object=await env.VIDEOS.get(record.r2_object_key+".hls/"+version+"/"+file);
 if(!object)return json({error:"Segmento indisponível"},404,cors);
 const h=new Headers({...headers,"Content-Type":file.endsWith(".m3u8")?"application/vnd.apple.mpegurl":"video/mp2t","Content-Length":String(object.size),"X-Content-Type-Options":"nosniff"});
 h.set("Access-Control-Expose-Headers","Content-Length,Content-Range,Accept-Ranges");
 // Segments are immutable per source version; authorization is rechecked on each request.
 if(file.endsWith(".ts"))h.set("Cache-Control","private, max-age=3600");
 return new Response(request.method==="HEAD"?null:object.body,{headers:h});
}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin");
 const cors={"Access-Control-Allow-Origin":origin===ORIGIN?ORIGIN:"null","Access-Control-Allow-Methods":"GET,HEAD,POST,PUT,OPTIONS","Access-Control-Allow-Headers":"Authorization,Content-Type,Range","Vary":"Origin"};
 if(request.method==="OPTIONS")return new Response(null,{headers:cors});
 const reply=(x,s=200)=>json(x,s,cors);
 if(new URL(request.url).pathname==="/health")return reply({ok:true,bucket:"nplay-filmes",version:"2-adaptive"});
 const route=new URL(request.url);
 if(route.pathname.startsWith("/playback/")||route.pathname.startsWith("/hls/")){try{return await adaptiveResponse(request,env,route,cors)}catch{return reply({error:"Não foi possível preparar a reprodução"},503)}}
 if(route.pathname.startsWith("/watch/")&&(request.method==="GET"||request.method==="HEAD")){
  try{
  const id=route.pathname.slice(7);
  if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:"Vídeo inválido"},400);
  const lookup=await fetch(SUPABASE+"/rest/v1/novaplay_library?id=eq."+encodeURIComponent(id)+"&select=r2_object_key,is_published,licensed_rights_confirmed,rights_reviewed,catalog_only",{headers:{"apikey":ANON,"Authorization":"Bearer "+ANON}});
  if(!lookup.ok)return reply({error:"Não foi possível validar o título"},503);
  const record=(await lookup.json())?.[0];
  if(!record?.r2_object_key||!record.is_published||!record.licensed_rights_confirmed||!record.rights_reviewed||record.catalog_only)return reply({error:"Vídeo não publicado ou não autorizado"},404);
  const key=record.r2_object_key;
  if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-z0-9-]{8,80}\.(mp4|webm|ogv)$/i.test(key))return reply({error:"Arquivo inválido"},400);
  const range=request.headers.get("Range");let options={},metadata=null;
  if(range||request.method==="HEAD"){
   metadata=await env.VIDEOS.head(key);if(!metadata)return reply({error:"Vídeo indisponível"},404);
  }
  if(range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match||(!match[1]&&!match[2]))return reply({error:"Range inválido"},416);
   const size=metadata.size;let start,end;
   if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return reply({error:"Range inválido"},416);start=Math.max(0,size-suffix);end=size-1;}
   else{start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return new Response(null,{status:416,headers:{...cors,"Content-Range":"bytes */"+size}});
   options.range={offset:start,length:end-start+1};
  }
  const object=request.method==="HEAD"?metadata:await env.VIDEOS.get(key,options);
  if(!object)return reply({error:"Vídeo indisponível"},404);
  const h=new Headers({"Access-Control-Allow-Origin":ORIGIN,"Vary":"Origin","Accept-Ranges":"bytes","Access-Control-Expose-Headers":"Content-Range,Content-Length,Accept-Ranges","Cache-Control":"private, max-age=60","Content-Type":object.httpMetadata?.contentType||"video/mp4","X-Content-Type-Options":"nosniff"});
  const servedRange=object.range||options.range;
  if(servedRange){const offset=servedRange.offset||0,length=servedRange.length||object.size-offset;h.set("Content-Range","bytes "+offset+"-"+(offset+length-1)+"/"+object.size);h.set("Content-Length",String(length));}else h.set("Content-Length",String(object.size));
  return new Response(request.method==="HEAD"?null:object.body,{status:servedRange?206:200,headers:h});
  }catch(e){console.error("NPlay watch failed",e?.stack||String(e));return reply({error:"Falha ao acessar vídeo no R2",detail:String(e?.message||e).slice(0,160)},502);}
 }
 if(origin!==ORIGIN)return reply({error:"Origin não autorizado"},403);
 const token=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
 if(!token)return reply({error:"Login obrigatório"},401);
 const headers={"apikey":ANON,"Authorization":"Bearer "+token};
 const u=await fetch(SUPABASE+"/auth/v1/user",{headers});
 if(!u.ok)return reply({error:"Sessão inválida"},401);
 const user=await u.json();
 const admin=await fetch(SUPABASE+"/rest/v1/novaplay_admins?user_id=eq."+encodeURIComponent(user.id)+"&select=user_id",{headers});
 if(!admin.ok||!(await admin.json()).length)return reply({error:"Sem permissão administrativa"},403);
 const url=new URL(request.url),path=url.pathname;
 try{
  if(path==="/uploads/start"&&request.method==="POST"){
   const b=await request.json();
   if(!/^[a-z0-9-]{8,80}\.(mp4|webm|ogv)$/i.test(b.filename||""))return reply({error:"Nome de arquivo inválido"},400);
   const key=user.id+"/"+crypto.randomUUID()+"-"+b.filename;
   const m=await env.VIDEOS.createMultipartUpload(key,{httpMetadata:{contentType:b.filename.endsWith(".mp4")?"video/mp4":b.filename.endsWith(".webm")?"video/webm":"video/ogg"}});
   return reply({key,uploadId:m.uploadId});
  }
  if(path==="/uploads/part"&&request.method==="PUT"){
   const key=url.searchParams.get("key"),uploadId=url.searchParams.get("uploadId"),part=Number(url.searchParams.get("part"));
   if(!key?.startsWith(user.id+"/")||!uploadId||!Number.isInteger(part)||part<1||part>10000)return reply({error:"Parâmetros inválidos"},400);
   const upload=env.VIDEOS.resumeMultipartUpload(key,uploadId);
   const result=await upload.uploadPart(part,request.body);
   return reply({partNumber:result.partNumber,etag:result.etag});
  }
  if(path==="/uploads/complete"&&request.method==="POST"){
   const b=await request.json();
   if(!b.key?.startsWith(user.id+"/")||!b.uploadId||!Array.isArray(b.parts)||!b.parts.length)return reply({error:"Parâmetros inválidos"},400);
   const upload=env.VIDEOS.resumeMultipartUpload(b.key,b.uploadId);
   await upload.complete(b.parts);
   return reply({ok:true,key:b.key});
  }
  if(path==="/uploads/abort"&&request.method==="POST"){
   const b=await request.json();
   if(!b.key?.startsWith(user.id+"/")||!b.uploadId)return reply({error:"Parâmetros inválidos"},400);
   await env.VIDEOS.resumeMultipartUpload(b.key,b.uploadId).abort();
   return reply({ok:true});
  }
  if(path==="/processor/source"&&request.method==="GET"){
   const key=url.searchParams.get("key");
   if(!key||!key.startsWith(user.id+"/")||!/(\.mp4|\.webm|\.ogv|\.mov|\.mkv)$/i.test(key))return reply({error:"Arquivo inválido"},400);
   const object=await env.VIDEOS.get(key);
   if(!object)return reply({error:"Arquivo não encontrado"},404);
   return new Response(object.body,{headers:{"Content-Type":object.httpMetadata?.contentType||"application/octet-stream","Cache-Control":"no-store",...cors}});
  }
  if(path==="/processor/output"&&request.method==="PUT"){
   const key=url.searchParams.get("key");
   if(!key||!key.startsWith("hls/"+user.id+"/")||!/^hls\/[0-9a-f-]+\/[a-zA-Z0-9_-]+\/(index\.m3u8|segment_[0-9]{5}\.ts)$/.test(key))return reply({error:"Destino inválido"},400);
   const type=key.endsWith(".m3u8")?"application/vnd.apple.mpegurl":"video/mp2t";
   if(Number(request.headers.get("content-length")||0)>25000000)return reply({error:"Segmento muito grande"},413);
   await env.VIDEOS.put(key,request.body,{httpMetadata:{contentType:type,cacheControl:"private, max-age=3600"}});
   return reply({ok:true,key});
  }
  return reply({error:"Rota inexistente"},404);
 }catch(e){return reply({error:"Falha ao processar operação no R2"},500)}
}}
