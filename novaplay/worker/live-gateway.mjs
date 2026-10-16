import {relayHls,hlsSource} from './hls-relay.mjs';
// Private provider URLs live in KV; viewers receive only channel IDs.
const DB="https://vajlhodqxskozuxxlujv.supabase.co",KEY="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function publicIPv4(host){
 const parts=host.split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
 const [a,b,c]=parts;
 return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&(c===0||c===2))||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113)||host==='168.63.129.16');
}
function sourceUrl(raw){
 const u=new URL(raw),h=u.hostname.toLowerCase().replace(/\.$/,'');
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!h.includes('.')||(/^[\d.]+$/.test(h)&&!publicIPv4(h))||h.includes(':')||/\.(local|internal|localhost|home\.arpa)$/.test(h)||u.href.length>4096)throw Error('Invalid source');
 return u;
}
async function readJson(response,max=400000){
 const reader=response.body?.getReader();if(!reader)throw Error('Empty response');let bytes=0,parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max)throw Error('Payload too large');parts.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const data=new Uint8Array(bytes);let offset=0;for(const p of parts){data.set(p,offset);offset+=p.length;}return JSON.parse(new TextDecoder().decode(data));
}
function token(request){return (request.headers.get('Authorization')||'').replace(/^Bearer /i,'')||new URL(request.url).searchParams.get('access_token')||'';}
function dbHeaders(jwt){return {apikey:KEY,Authorization:'Bearer '+jwt,'Content-Type':'application/json'};}
async function admin(jwt){
 const r=await fetch(DB+'/rest/v1/novaplay_admins?select=user_id&limit=1',{headers:dbHeaders(jwt)});
 return r.ok&&(await readJson(r,4000))?.length===1;
}
async function published(id,jwt,origin,format="ts"){
 const r=await fetch(DB+'/rest/v1/novaplay_live_embeds?id=eq.'+id+'&select=embed_url&limit=1',{headers:dbHeaders(jwt)});
 if(!r.ok)return false;const rows=await readJson(r,5000);
 return rows?.[0]?.embed_url===origin+'/live/'+id+(format==='hls'?'/index.m3u8':'/stream.ts');
}
async function upstream(raw,signal,range){
 let url=sourceUrl(raw);
 for(let hop=0;hop<4;hop++){
  const headers=new Headers();if(range)headers.set('Range',range);
  const r=await fetch(url.href,{headers,redirect:'manual',signal,cf:{cacheTtl:0}});
  if(![301,302,303,307,308].includes(r.status))return r;
  const target=r.headers.get('Location');await r.body?.cancel();if(!target)throw Error('Missing location');url=sourceUrl(new URL(target,url).href);
 }
 throw Error('Redirect limit');
}
async function channelId(url){
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url))).slice(0,16);hash[6]=(hash[6]&15)|80;hash[8]=(hash[8]&63)|128;
 const hex=[...hash].map(x=>x.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}
async function equalSecret(a,b){
 if(!a||!b)return false;const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));const aa=await hash(a),bb=await hash(b);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;
}
export default {async fetch(request,env){
 const route=new URL(request.url),origin=request.headers.get('Origin')||'';
 const allowed=['https://novabytesolucoes.com.br','https://www.novabytesolucoes.com.br'];
 const cors={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Access-Control-Allow-Headers':'Authorization,Content-Type,Range','Access-Control-Allow-Methods':'GET,HEAD,POST,OPTIONS','Access-Control-Expose-Headers':'Content-Length,Content-Range,Accept-Ranges','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 const json=(data,status=200)=>Response.json(data,{status,headers:cors});
 if(origin&&!allowed.includes(origin))return json({error:'Origem não autorizada.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(route.pathname==='/health')return json({service:'NPlay live gateway',protected:true});
 const jwt=token(request);if(!jwt||jwt===KEY||jwt.length>8192)return json({error:'Entre no NPlay para continuar.'},401);
 try{
  if(route.pathname==='/admin/import'&&request.method==='POST'){
   if(!await admin(jwt))return json({error:'Acesso administrativo necessário.'},403);
   const input=await readJson(request);if(!input.rights_confirmed||!Array.isArray(input.channels)||input.channels.length>100||!input.channels.length)return json({error:'Lote inválido. Use até 100 canais com autorização confirmada.'},400);
   const rows=[];
   for(const entry of input.channels){
    const url=sourceUrl(entry.source_url);if(/\/(movie|series)\//i.test(url.pathname))continue;
    const title=String(entry.title||'').trim().slice(0,140);if(!title)continue;
    const id=await channelId(url.href);let logo=null;try{const l=new URL(entry.logo_url);if(l.protocol==='https:'&&!l.username&&!l.password&&!l.search)logo=l.href;}catch{}
    await env.LIVE_SOURCES.put(id,JSON.stringify({url:url.href}));
    rows.push({id,title,category:String(entry.category||'Variedades').slice(0,100),logo_url:logo,embed_url:route.origin+'/live/'+id+'/stream.ts',stream_type:'mpegts',rights_confirmed:true,is_published:false});
   }
   if(!rows.length)return json({error:'Nenhum canal ao vivo encontrado neste lote.'},422);
   const saved=await fetch(DB+'/rest/v1/novaplay_live_embeds?on_conflict=embed_url',{method:'POST',headers:{...dbHeaders(jwt),Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)});
   if(!saved.ok){await saved.body?.cancel();return json({error:'Não foi possível salvar os canais. Os links permanecem protegidos.'},502);}
   return json({imported:(await readJson(saved,200000)).length,published:false});
  }
  const diagnostic=route.pathname.match(/^\/probe\/([0-9a-f-]{36})$/i);
  if(diagnostic&&request.method==='GET'){
   if(!await equalSecret(jwt,env.PROBE_KEY))return json({error:'Acesso restrito.'},403);
   const entry=await env.LIVE_SOURCES.get(diagnostic[1],'json');if(!entry)return json({error:'Canal não cadastrado.'},404);
   const r=await upstream(entry.url,AbortSignal.timeout(15000),'bytes=0-1023');
   const reader=r.body?.getReader();const first=reader?await reader.read():null;await reader?.cancel();
   const b=first?.value||new Uint8Array();return json({status:r.status,type:r.headers.get('Content-Type'),bytes:b.length,mpegts:b[0]===71,hls:new TextDecoder().decode(b.slice(0,10)).startsWith('#EXTM3U')});
  }
  const hls=route.pathname.match(/^\/live\/([0-9a-f-]{36})\/(?:index\.m3u8|asset\/([A-Za-z0-9_-]{1,7000}))$/i);
  if(hls&&['GET','HEAD'].includes(request.method)&&uuid.test(hls[1])){
   if(!await published(hls[1],jwt,route.origin,'hls'))return json({error:'Canal não liberado para este aparelho.'},403);
   const entry=await hlsSource(env,hls[1]);if(!entry)return json({error:'Fonte indisponível.'},404);
   return await relayHls({request,env,id:hls[1],jwt,origin:route.origin,rootUrl:entry.url,locator:hls[2],upstream,validateUrl:sourceUrl,cors});
  }
  const match=route.pathname.match(/^\/live\/([0-9a-f-]{36})\/stream\.ts$/i);
  if(!match||!['GET','HEAD'].includes(request.method)||!uuid.test(match[1]))return json({error:'Canal não encontrado.'},404);
  if(!await published(match[1],jwt,route.origin))return json({error:'Canal não liberado para este aparelho.'},403);
  const entry=await env.LIVE_SOURCES.get(match[1],'json');if(!entry)return json({error:'Fonte indisponível.'},404);
  const r=await upstream(entry.url,request.signal,request.headers.get('Range'));
  if(!r.ok){await r.body?.cancel();return json({error:'O fornecedor não disponibilizou o sinal deste canal.'},502);}
  const type=r.headers.get('Content-Type')||'';if(/text\/|json|html/i.test(type)){await r.body?.cancel();return json({error:'A fonte não retornou um vídeo compatível.'},502);}
  const headers=new Headers({...cors,'Content-Type':'video/mp2t'});
  for(const name of ['Content-Length','Content-Range','Accept-Ranges'])if(r.headers.has(name))headers.set(name,r.headers.get(name));
  if(request.method==='HEAD'){await r.body?.cancel();return new Response(null,{status:r.status,headers});}
  return new Response(r.body,{status:r.status,headers});
 }catch{return json({error:'Não foi possível conectar à fonte. Tente novamente em instantes.'},502);}
}};
