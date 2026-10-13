/* NovaPlay — Painel de administração protegido por Supabase RLS */
(function(){
"use strict";
const PROJECT="vajlhodqxskozuxxlujv";
const API_URL="https://"+PROJECT+".supabase.co";
const PUBLIC_KEY="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const VIDEO_BUCKET="novaplay-videos",POSTER_BUCKET="novaplay-posters";
const MAX_VIDEO=50*1024*1024,MAX_POSTER=5*1024*1024;
const $=id=>document.getElementById(id);
let client=null,editing=null,items=[],busy=false,currentUpload=null,sessionUser=null;
let libraryPage=0;
let qualityFilter="all";
let activityCounts=new Map(),activityLimitReached=false;
let playbackIssues=[],issueSaving=false;
const LIBRARY_PAGE_SIZE=48;
const featuredDefaults=["lostworld","nosferatu","lua","caligari"];
const classicFeatureFilms=[
 {id:"lostworld",title:"O Mundo Perdido",cover:"../assets/posters/lostworld.svg"},
 {id:"nosferatu",title:"Nosferatu",cover:"../assets/posters/nosferatu.svg"},
 {id:"lua",title:"Viagem à Lua",cover:"../assets/posters/lua.svg"},
 {id:"caligari",title:"O Gabinete do Dr. Caligari",cover:"../assets/posters/caligari.svg"}
];
let chosenFeatured=featuredDefaults.slice(),featuredBusy=false,featuredLoaded=false;
let featuredPickedId=null,featuredResultLimit=24;
const classicFeatureSeries=[
 {id:"pauline",title:"Os Perigos de Pauline",cover:"../assets/posters/pauline.svg",type:"series"},
 {id:"phantom",title:"O Império Fantasma",cover:"../assets/posters/phantom.svg",type:"series"}
];

const esc=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function status(id,message,isError=false,isSuccess=false){
 const n=$(id);n.textContent=message;n.classList.toggle("error",isError);n.classList.toggle("success",isSuccess);
}
function show(id){
 ["loading","login-view","pending-view","dashboard"].forEach(key=>$(key).hidden=key!==id);
 $("logout").hidden=id!=="dashboard";window.scrollTo(0,0);
}
function disable(submitted){
 busy=submitted;
 ["submit-upload","refresh-list","cancel-edit","video-file","poster-file","youtube-url","youtube-poster-file","source-type","drive-url","licensed-url","netflix-url","licensed-rights"].forEach(id=>$(id).disabled=submitted);
 $("submit-upload").textContent=submitted?"Enviando...":"Enviar para a NovaPlay";
}
function errorText(err){
 if(!err)return"Erro desconhecido.";
 const msg=String(err.message||err).replace(/(sb_secret_[A-Za-z0-9_]+|eyJ[A-Za-z0-9._-]+)/g,"[oculto]");
 if(/file size|payload too large|entity too large|exceeds.*limit|maximum file/i.test(msg))return"O arquivo excede o limite de armazenamento. Use até 50 MB neste plano.";
 if(/jwt|token.*expired|invalid refresh token/i.test(msg))return"Sua sessão expirou. Faça login novamente.";
 if(/row.level.security|permission denied|unauthorized|403/i.test(msg))return"Você não tem permissão para enviar esse arquivo. Entre com uma conta autorizada.";
 return msg.slice(0,300);
}
async function hasAdmin(){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return null;
 // O servidor concede acesso SOMENTE ao proprietário logado,
 // com e-mail verificado e ID confirmado pelo Supabase Auth.
 // Não há senha de administrador no código nem acesso liberado por e-mail digitado.
 const claim=await client.rpc("novaplay_claim_owner_access");
 if(claim.error)console.warn("NovaPlay: validação de proprietário indisponível.");
 const r=await client.from("novaplay_admins").select("user_id").eq("user_id",user.id).maybeSingle();
 if(r.error)throw r.error;
 return r.data?user:false;
}
async function checkSession(){
 try{
  const u=await hasAdmin();
  sessionUser=u||null;
  if(u){show("dashboard");await loadLibrary();await Promise.all([loadActivity(),loadFeaturedConfig(),loadPlaybackIssues()]);}
  else if(u===false){
   const v=await client.auth.getUser();
   $("pending-email").textContent=v.data.user?.email||"Conta aguardando aprovação";
   show("pending-view");
  }else show("login-view");
 }catch(e){show("login-view");status("auth-message",errorText(e),true)}
}
function extractYoutubeId(raw){
 const text=String(raw||"").trim();
 if(/^[A-Za-z0-9_-]{11}$/.test(text))return text;
 let url;
 try{url=new URL(text)}catch(e){return null}
 if(url.protocol!=="https:")return null;
 const host=url.hostname.toLowerCase().replace(/^www\./,"");
 let id=null;
 if(["youtube.com","m.youtube.com","music.youtube.com","youtube-nocookie.com"].includes(host)){
  if(url.pathname==="/watch")id=url.searchParams.get("v");
  else if(/^\/(embed|shorts|live)\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname))id=url.pathname.split("/")[2];
 }else if(host==="youtu.be")id=url.pathname.split("/")[1];
 return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
}
function parseGoogleDriveLink(raw){
 let url;
 try{url=new URL(String(raw||"").trim())}catch(e){return null}
 if(url.protocol!=="https:")return null;
 if(url.hostname.toLowerCase()!=="drive.google.com")return null;
 let id=null;
 const match=url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]{12,128})(?:\/(?:view|preview|edit))?\/?$/);
 if(match)id=match[1];
 else if(/^\/(?:open|uc)\/?$/.test(url.pathname))id=url.searchParams.get("id");
 if(!id || !/^[A-Za-z0-9_-]{12,128}$/.test(id))return null;
 const rawResourceKey=url.searchParams.get("resourcekey");
 if(rawResourceKey && !/^[A-Za-z0-9_-]{8,256}$/.test(rawResourceKey))return null;
 return {id,resourceKey:rawResourceKey||null};
}
function parseLicensedStreamUrl(raw){
 const str=String(raw||"").trim();
 if(str.length<18||str.length>2048)return null;
 let url;try{url=new URL(str)}catch(e){return null}
 if(url.protocol!=="https:"||url.username||url.password||url.hash)return null;
 const host=url.hostname.toLowerCase();
 if(!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(host)||/(^|\.)netflix\.com$|(^|\.)nflxvideo\.net$|(^|\.)nflximg\.net$/.test(host))return null;
 if(!/\.(mp4|webm|ogv|m3u8)$/i.test(url.pathname))return null;
 return url.href;
}
function sourceMode(){return $("source-type").value}
function setSourceType(){
 const mode=sourceMode();
 const youtube=mode==="youtube",drive=mode==="google-drive",licensed=mode==="licensed",netflix=mode==="netflix-reference",external=youtube||drive||licensed||netflix;
 $("youtube-fields").hidden=!youtube;
 $("drive-fields").hidden=!drive;
 $("licensed-fields").hidden=!licensed;
 $("netflix-fields").hidden=!netflix;
 $("netflix-url").required=netflix;
 $("publish").disabled=netflix;
 if(netflix)$("publish").checked=false;
 $("licensed-url").required=licensed;
 $("upload-files").hidden=external;
 $("youtube-cover-section").hidden=!external;
 $("youtube-url").required=youtube;
 $("drive-url").required=drive;
 $("external-cover-tip").textContent=netflix
  ?"Capa opcional para seu controle privado. Este título não será exibido na NovaPlay."
  :licensed
  ?"Adicione uma capa vertical para o filme licenciado (JPG, PNG ou WebP, até 5 MB)."
  :drive?"Se não escolher capa, usaremos uma arte padrão da NovaPlay. JPG, PNG ou WebP, até 5 MB."
  :"Se não escolher capa, usamos a miniatura do YouTube. JPG, PNG ou WebP, até 5 MB.";
 $("submit-upload").textContent=busy?"Salvando...":netflix?"Salvar referência privada":editing?.catalog_only?"Salvar e liberar para assistir":editing?"Salvar alterações":external?"Cadastrar vídeo pelo link":"Enviar para a NovaPlay";
}
function fileKind(file,video=true){
 const ext=(file.name.split(".").pop()||"").toLowerCase();
 const map=video?{mp4:"video/mp4",webm:"video/webm",ogv:"video/ogg"}:{jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
 const mime=map[ext];
 if(!mime)return null;
 if(file.type && file.type!==mime && !(mime==="video/ogg"&&file.type==="application/ogg"))return null;
 return {ext,mime};
}
function extForMime(file,video=true){const k=fileKind(file,video);if(!k)throw Error(video?"Formato não permitido. Converta o vídeo para MP4, WebM ou OGV.":"A capa deve ser JPG, PNG ou WebP.");return k;}
function pendingKey(file){return "novaplay-pending-"+[file.name,file.size,file.lastModified,sessionUser.id].join("|");}
function createVideoPath(file){
 const key=pendingKey(file), old=sessionStorage.getItem(key);
 if(old&&new RegExp("^"+sessionUser.id+"/[a-f0-9-]{36}\\.(mp4|webm|ogv)$").test(old))return old;
 const path=sessionUser.id+"/"+crypto.randomUUID()+"."+extForMime(file).ext;
 sessionStorage.setItem(key,path);return path;
}
function progress(label,percent){
 $("progress-box").hidden=false;$("progress-label").textContent=label;
 $("progress").value=Math.max(0,Math.min(100,Math.round(percent)));
 $("progress-value").textContent=Math.round(percent)+"%";
}
async function uploadVideo(file,path){
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session)throw Error("Faça login novamente para continuar o envio.");
 progress("Enviando "+file.name,0);
 if(!window.tus||!window.tus.Upload){
   const r=await client.storage.from(VIDEO_BUCKET).upload(path,file,{upsert:false,contentType:extForMime(file).mime});
   if(r.error)throw r.error;progress("Vídeo enviado",100);return;
 }
 return new Promise((resolve,reject)=>{
  const upload=new window.tus.Upload(file,{
   endpoint:"https://"+PROJECT+".storage.supabase.co/storage/v1/upload/resumable",
   retryDelays:[0,3000,5000,10000,20000],
   headers:{authorization:"Bearer "+session.access_token,apikey:PUBLIC_KEY},
   uploadDataDuringCreation:true,
   removeFingerprintOnSuccess:true,
   metadata:{bucketName:VIDEO_BUCKET,objectName:path,contentType:extForMime(file).mime,cacheControl:"3600"},
   chunkSize:6*1024*1024,
   onProgress:(sent,total)=>progress("Enviando vídeo ("+(sent/(1024*1024)).toFixed(1)+" MB de "+(total/(1024*1024)).toFixed(1)+" MB)",100*sent/total),
   onSuccess:()=>{currentUpload=null;progress("Vídeo enviado",100);resolve();},
   onError:err=>{currentUpload=null;reject(err)}
  });
  currentUpload=upload;
  upload.findPreviousUploads().then(previous=>{
   if(previous.length)upload.resumeFromPreviousUpload(previous[0]);
   upload.start();
  }).catch(reject);
 });
}
async function inspectVideo(file){
 // Obtém a duração e, quando o navegador permite, uma miniatura sem enviar o arquivo a terceiros.
 return new Promise(resolve=>{
  const url=URL.createObjectURL(file),video=document.createElement("video");
  let resolved=false,loaded=false;
  const finish=data=>{
   if(resolved)return;resolved=true;clearTimeout(timeout);
   video.pause();video.removeAttribute("src");video.load();URL.revokeObjectURL(url);
   resolve(data);
  };
  const timeout=setTimeout(()=>finish({duration:null,thumbnail:null}),8500);
  function capture(){
   if(resolved||loaded||!video.videoWidth||!video.videoHeight)return;
   loaded=true;
   try{
    const canvas=document.createElement("canvas");canvas.width=480;canvas.height=720;
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.fillStyle="#091527";ctx.fillRect(0,0,480,720);
    const scale=Math.max(480/video.videoWidth,720/video.videoHeight);
    const w=video.videoWidth*scale,h=video.videoHeight*scale;
    ctx.drawImage(video,(480-w)/2,(720-h)/2,w,h);
    const grad=ctx.createLinearGradient(0,510,0,720);grad.addColorStop(0,"#050a1700");grad.addColorStop(1,"#050a17dd");
    ctx.fillStyle=grad;ctx.fillRect(0,510,480,210);
    canvas.toBlob(blob=>{
     finish({duration:Number.isFinite(video.duration)?Math.round(video.duration):null,
      thumbnail:blob?new File([blob],"capa-automatica.jpg",{type:"image/jpeg"}):null});
    },"image/jpeg",.83);
   }catch(e){finish({duration:Number.isFinite(video.duration)?Math.round(video.duration):null,thumbnail:null})}
  }
  video.muted=true;video.preload="auto";video.playsInline=true;
  video.addEventListener("loadedmetadata",()=>{
   if(Number.isFinite(video.duration)&&video.duration>1){
    try{video.currentTime=Math.min(1.5,video.duration/4)}catch(e){}
   }
  });
  video.addEventListener("loadeddata",capture,{once:true});
  video.addEventListener("seeked",capture,{once:true});
  video.addEventListener("error",()=>finish({duration:null,thumbnail:null}),{once:true});
  video.src=url;video.load();
 });
}
async function uploadCover(file){
 const ext=extForMime(file,false);
 const path=sessionUser.id+"/"+crypto.randomUUID()+"."+ext.ext;
 const {error}=await client.storage.from(POSTER_BUCKET).upload(path,file,{contentType:ext.mime,cacheControl:"3600",upsert:false});
 if(error)throw error;
 return path;
}


/* Métricas sem dados pessoais; play_attempt não significa reprodução confirmada. */
async function loadActivity(){
 if(!client||!sessionUser)return;
 const since=new Date(Date.now()-30*86400000).toISOString();
 const seen=new Map();let total=0;let truncated=false;
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await client.from("novaplay_activity_events")
   .select("media_id,event_type,created_at").gte("created_at",since)
   .order("created_at",{ascending:false}).range(offset,offset+499);
  if(error){status("activity-message","Não foi possível consultar métricas: "+errorText(error),true);return}
  for(const event of data||[]){
   const row=seen.get(event.media_id)||{detail:0,attempt:0};
   if(event.event_type==="detail_open")row.detail++;
   if(event.event_type==="play_attempt")row.attempt++;
   seen.set(event.media_id,row);total++;
  }
  if(!data||data.length<500)break;
  if(offset+500>=10000)truncated=true;
 }
 activityCounts=seen;activityLimitReached=truncated;
 status("activity-message",total?("Foram registrados "+total+" eventos anônimos de interesse no período. "+(truncated?"Consulta limitada a 10 mil eventos.":"")):"Medição iniciada nesta versão. Os números anteriores à atualização não estão disponíveis.",false,true);
 renderLibrary();
}


function isFeaturedSeries(row){
 return row.kind==="episode"||/s[eé]rie|anime/i.test(row.genre||"");
}
function normalizeFeaturedSearch(value){
 return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
}
function eligibleFeatured(){
 const films=items.filter(x=>x.kind==="movie"&&x.is_published&&!x.catalog_only
  &&(x.video_path||x.google_drive_id||x.youtube_id||x.licensed_stream_url))
  .map(x=>({id:"upload-"+x.id,title:x.title,record:x,type:isFeaturedSeries(x)?"series":"movie"}));
 const groups=new Map();
 for(const row of items){
  if(row.kind!=="episode"||!row.is_published||row.catalog_only||!row.series_title
   ||!(row.video_path||row.google_drive_id||row.youtube_id||row.licensed_stream_url))continue;
  const key=normalizeFeaturedSearch(row.series_title);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 }
 const series=[...groups.values()].map(episodes=>{
  episodes.sort((a,b)=>(a.episode_number||0)-(b.episode_number||0));
  const first=episodes[0];
  return{id:"uploaded-series-"+first.id,title:first.series_title,record:first,type:"series"};
 });
 return [...classicFeatureFilms.map(x=>({...x,type:"movie"})),...classicFeatureSeries,
  ...[...films,...series].sort((a,b)=>a.title.localeCompare(b.title,"pt-BR"))];
}
function posterOfFeatured(movie){
 if(!movie?.record)return movie?.cover||"../assets/posters/autoral.svg";
 const r=movie.record;
 return window.NovaPlayCover?.approvedAnimePoster?.(r.title,true)
  ||(r.poster_path?client.storage.from(POSTER_BUCKET).getPublicUrl(r.poster_path).data.publicUrl:null)
  ||(r.youtube_id?"https://i.ytimg.com/vi/"+encodeURIComponent(r.youtube_id)+"/hqdefault.jpg":null)
  ||(r.google_drive_id?window.NovaPlayCover?.driveThumbnail(r.google_drive_id):null)
  ||window.NovaPlayCover?.titleCard(r.title)||"../assets/posters/autoral.svg";
}
async function loadFeaturedConfig(){
 const {data,error}=await client.from("novaplay_featured").select("film_ids").eq("id",1).maybeSingle();
 if(error||!Array.isArray(data?.film_ids)){
  status("featured-message","Não foi possível carregar destaques: "+errorText(error||new Error("Configuração ausente.")),true);
  return;
 }
 chosenFeatured=data.film_ids.slice();
 featuredLoaded=true;renderFeatured();
}
function selectFeaturedItem(id){
 const candidates=eligibleFeatured();
 if(!candidates.some(x=>x.id===id)||chosenFeatured.includes(id))return;
 featuredPickedId=id;
 renderFeaturedBrowser(candidates);
}
function renderFeaturedBrowser(candidates){
 const itemsAvailable=candidates||eligibleFeatured();
 const search=$("featured-search"),kind=$("featured-type"),results=$("featured-results");
 if(!search||!kind||!results)return;
 const query=normalizeFeaturedSearch(search.value);
 const choices=itemsAvailable.filter(x=>!chosenFeatured.includes(x.id))
  .filter(x=>kind.value==="all"||x.type===kind.value)
  .filter(x=>!query||normalizeFeaturedSearch(x.title).includes(query));
 // If someone changes the search, do not keep previewing a hidden result.
 if(featuredPickedId&&!choices.some(x=>x.id===featuredPickedId))featuredPickedId=null;
 const filtered=choices.slice(0,featuredResultLimit);
 const disabled=featuredBusy||!featuredLoaded||chosenFeatured.length>=6;
 const summary=$("featured-results-count");
 summary.textContent=featuredLoaded
  ? choices.length+" resultado(s) disponível(is) · "+Math.min(choices.length,featuredResultLimit)+" exibido(s)"
  :"Carregando títulos...";
 results.replaceChildren();
 if(!choices.length){
  const message=document.createElement("p");message.className="featured-empty";
  message.textContent=query?"Nenhum título disponível com esse nome. Tente outro termo.":"Nenhum título disponível nesse filtro.";
  results.append(message);
 }
 for(const film of filtered){
  const btn=document.createElement("button");btn.type="button";
  btn.className="featured-candidate"+(featuredPickedId===film.id?" is-selected":"");
  btn.setAttribute("aria-pressed",String(featuredPickedId===film.id));
  btn.disabled=disabled;btn.dataset.id=film.id;
  const img=document.createElement("img");img.src=posterOfFeatured(film);
  img.alt="Capa de "+film.title;img.loading="lazy";
  img.onerror=function(){if(!this.dataset.fallback){this.dataset.fallback="1";this.src="../assets/posters/autoral.svg"}};
  const info=document.createElement("span");info.className="featured-candidate-details";
  const title=document.createElement("strong");title.textContent=film.title;
  const tag=document.createElement("small");tag.textContent=film.type==="series"?"Série / anime":"Filme";
  info.append(title,tag);
  const check=document.createElement("span");check.className="featured-candidate-check";check.textContent=featuredPickedId===film.id?"✓":"›";
  btn.append(img,info,check);
  btn.onclick=()=>selectFeaturedItem(film.id);
  results.append(btn);
 }
 const more=$("featured-more");
 more.hidden=choices.length<=featuredResultLimit;
 more.disabled=disabled;
 more.textContent="Mostrar mais "+Math.min(24,choices.length-featuredResultLimit)+" resultados";
 const preview=$("featured-preview");
 const picked=choices.find(x=>x.id===featuredPickedId);
 preview.hidden=!picked;
 $("featured-add").disabled=disabled||!picked;
 if(picked){
  $("featured-preview-image").src=posterOfFeatured(picked);
  $("featured-preview-image").alt="Capa de "+picked.title;
  $("featured-preview-title").textContent=picked.title;
  $("featured-preview-type").textContent=picked.type==="series"?"Série / anime · Pronto para destacar":"Filme · Pronto para destacar";
 }
}
function renderFeatured(){
 const list=$("featured-list");
 if(!list)return;
 const available=eligibleFeatured(),byId=new Map(available.map(x=>[x.id,x]));
 const disabled=featuredBusy||!featuredLoaded;
 $("featured-defaults").disabled=disabled||chosenFeatured.join("|")===featuredDefaults.join("|");
 $("featured-selection-count").textContent=chosenFeatured.length+"/6";
 renderFeaturedBrowser(available);
 list.replaceChildren();
 if(!featuredLoaded){const p=document.createElement("p");p.className="muted";p.textContent="Carregando destaques...";list.append(p);return}
 for(const [index,id] of chosenFeatured.entries()){
  const film=byId.get(id);
  const box=document.createElement("div");box.className="featured-entry";
  const rank=document.createElement("span");rank.className="featured-rank";rank.textContent=String(index+1).padStart(2,"0");
  const cover=document.createElement("img");cover.src=posterOfFeatured(film);
  cover.alt=film?"Capa de "+film.title:"Capa indisponível";cover.loading="lazy";
  cover.onerror=function(){if(this.dataset.fallback)return;this.dataset.fallback="1";this.src="../assets/posters/autoral.svg"};
  const info=document.createElement("div");info.className="featured-entry-info";
  const title=document.createElement("strong");title.textContent=film?.title||"Título retirado do catálogo";
  const sub=document.createElement("small");
  sub.textContent=index===0?"★ Destaque principal":film?.type==="series"?"Série / anime":film?.record?"Filme cadastrado":"Filme clássico";
  info.append(title,sub);
  const actions=document.createElement("div");actions.className="featured-entry-actions";
  const up=document.createElement("button");up.type="button";up.className="outline compact";
  up.textContent="↑";up.title="Subir destaque";up.setAttribute("aria-label","Mover "+title.textContent+" para cima");
  up.disabled=disabled||index===0;up.onclick=()=>moveFeatured(index,-1);
  const down=document.createElement("button");down.type="button";down.className="outline compact";
  down.textContent="↓";down.title="Descer destaque";down.setAttribute("aria-label","Mover "+title.textContent+" para baixo");
  down.disabled=disabled||index===chosenFeatured.length-1;down.onclick=()=>moveFeatured(index,1);
  const remove=document.createElement("button");remove.type="button";remove.className="outline compact featured-remove";
  remove.textContent="Retirar";remove.title="Retirar título dos destaques";remove.disabled=disabled||chosenFeatured.length<=1;
  remove.onclick=()=>saveFeatured(chosenFeatured.filter((_,i)=>i!==index));
  actions.append(up,down,remove);box.append(rank,cover,info,actions);list.append(box);
 }
}
async function saveFeatured(next){
 if(featuredBusy||!featuredLoaded)return;
 if(next.length<1||next.length>6||new Set(next).size!==next.length){
  status("featured-message","Mantenha de 1 a 6 filmes diferentes nos destaques.",true);return;
 }
 if(next.some(id=>!eligibleFeatured().some(x=>x.id===id))){
  status("featured-message","Um dos filmes não está mais publicado com vídeo. Atualize a biblioteca e tente novamente.",true);return;
 }
 const original=chosenFeatured.slice();
 featuredBusy=true;chosenFeatured=next.slice();renderFeatured();
 status("featured-message","Salvando ordem dos destaques...");
 try{
  const {data,error}=await client.from("novaplay_featured")
   .update({film_ids:next,updated_at:new Date().toISOString()})
   .eq("id",1).select("film_ids").single();
  if(error)throw error;
  chosenFeatured=data.film_ids.slice();
  if(next.some(id=>!original.includes(id))){
   featuredPickedId=null;
   $("featured-search").value="";
   featuredResultLimit=24;
  }
  status("featured-message","✓ Destaques salvos! A página inicial será atualizada ao recarregar.",false,true);
 }catch(error){
  chosenFeatured=original;
  status("featured-message","Falha ao salvar destaques: "+errorText(error),true);
 }finally{featuredBusy=false;renderFeatured()}
}
function addFeaturedFilm(){
 const id=featuredPickedId;
 if(!id||chosenFeatured.includes(id)||chosenFeatured.length>=6)return;
 saveFeatured([...chosenFeatured,id]);
}
function moveFeatured(index,offset){
 const next=chosenFeatured.slice(),other=index+offset;
 if(other<0||other>=next.length)return;
 [next[index],next[other]]=[next[other],next[index]];
 saveFeatured(next);
}
function restoreFeaturedFilms(){
 if(!confirm("Restaurar os quatro filmes clássicos como destaques da página inicial?"))return;
 saveFeatured(featuredDefaults.slice());
}


/* Reports are not automatic proof that a Drive file is deleted. */
async function loadPlaybackIssues(){
 if(!client||!sessionUser)return;
 const {data,error}=await client.from("novaplay_playback_issues")
  .select("item_id,report_count,first_reported_at,last_reported_at,status")
  .eq("status","open").order("last_reported_at",{ascending:false}).limit(150);
 if(error){status("issue-message","Não foi possível carregar os avisos: "+errorText(error),true);return}
 playbackIssues=data||[];
 renderPlaybackIssues();
}
function renderPlaybackIssues(){
 const container=$("issue-list");
 if(!container)return;
 const count=$("issue-total");if(count)count.textContent="("+playbackIssues.length+")";
 container.replaceChildren();
 if(!playbackIssues.length){
  const p=document.createElement("p");p.className="muted";
  p.textContent="Nenhum vídeo reportado até agora. Se alguém encontrar um link que não abre, ele aparecerá aqui.";
  container.append(p);
  return;
 }
 const byId=new Map(items.map(x=>[x.id,x]));
 for(const issue of playbackIssues){
  const movie=byId.get(issue.item_id);
  const card=document.createElement("article");card.className="issue-item";
  const info=document.createElement("div");info.className="issue-info";
  const title=document.createElement("strong");title.textContent=movie?.title||"Título não encontrado no catálogo";
  const subtitle=document.createElement("small");
  subtitle.textContent=issue.report_count+" aviso(s) · Último: "+new Date(issue.last_reported_at).toLocaleString("pt-BR");
  info.append(title,subtitle);
  const controls=document.createElement("div");controls.className="issue-controls";
  if(movie?.google_drive_id||movie?.youtube_id||movie?.licensed_stream_url){
   const open=document.createElement("a");open.className="outline compact";
   open.textContent="Testar link ↗";open.target="_blank";open.rel="noopener noreferrer";
   open.href=movie.licensed_stream_url|| (movie.google_drive_id
    ? "https://drive.google.com/file/d/"+encodeURIComponent(movie.google_drive_id)+"/view"+(movie.google_drive_resource_key?"?resourcekey="+encodeURIComponent(movie.google_drive_resource_key):"")
    : "https://www.youtube.com/watch?v="+encodeURIComponent(movie.youtube_id));
   controls.append(open);
  }
  if(movie){
   const edit=document.createElement("button");edit.type="button";edit.className="outline compact";
   edit.textContent="Corrigir fonte";edit.onclick=()=>{
    beginEdit(movie);
    document.querySelector(".editor")?.scrollIntoView({behavior:"smooth",block:"start"});
   };
   controls.append(edit);
  }
  const fixed=document.createElement("button");fixed.type="button";fixed.className="outline compact";
  fixed.textContent="Marcar resolvido";fixed.disabled=issueSaving;
  fixed.onclick=async()=>{
   if(issueSaving||!confirm("Você conferiu o link e o problema foi resolvido?"))return;
   issueSaving=true;fixed.disabled=true;
   const {error}=await client.from("novaplay_playback_issues")
    .update({status:"resolved",resolved_at:new Date().toISOString()})
    .eq("item_id",issue.item_id);
   issueSaving=false;
   if(error){status("issue-message","Erro ao marcar como resolvido: "+errorText(error),true);fixed.disabled=false;return}
   status("issue-message","Aviso marcado como resolvido.",false,true);
   await loadPlaybackIssues();
  };
  controls.append(fixed);card.append(info,controls);container.append(card);
 }
}

async function loadLibrary(){
 // Ler todas as páginas: o catálogo importado pode ter centenas de rascunhos.
 const gathered=[];
 const select="id,title,description,kind,series_title,episode_number,genre,production_year,video_path,youtube_id,google_drive_id,google_drive_resource_key,licensed_stream_url,netflix_reference_url,licensed_rights_confirmed,poster_path,is_published,rights_reviewed,rights_reviewed_at,catalog_only,review_queue_id,quality_score,quality_score_source,quality_score_note,quality_scored_at,file_size_bytes,mime_type,created_at";
 for(let offset=0;offset<5000;offset+=500){
  const {data,error}=await client.from("novaplay_library").select(select).order("created_at",{ascending:false}).range(offset,offset+499);
  if(error){status("upload-message","Não foi possível ler a biblioteca: "+errorText(error),true);return}
  gathered.push(...(data||[]));
  if(!data||data.length<500)break;
 }
 // Exibir primeiro os títulos com vídeo; referências Em breve aparecem por último.
 items=gathered.sort((a,b)=>Number(!!a.catalog_only)-Number(!!b.catalog_only));
 status("upload-message","Biblioteca atualizada: "+items.length+" registros encontrados no banco.",false,true);
 renderLibrary();
 renderFeatured();
 renderPlaybackIssues();
}
function renderLibrary(){
 $("stat-total").textContent=items.length;
 $("stat-live").textContent=items.filter(x=>x.is_published&&!x.catalog_only).length;
 $("stat-drafts").textContent=items.filter(x=>x.catalog_only).length;
 const withVideo=items.filter(x=>x.is_published&&!x.catalog_only).length;
 const comingSoon=items.filter(x=>x.catalog_only).length;
 const info=$("source-summary");
 if(info)info.textContent=withVideo+" títulos publicados com fonte de vídeo · "+comingSoon+" títulos Em breve sem vídeo cadastrado. Os links ainda precisam de teste de reprodução.";
 const sourceFilter=$("library-state-filter");
 if(sourceFilter){
  const option=sourceFilter.querySelector('option[value="catalog_only"]');
  if(option)option.textContent="Em breve (sem vídeo) · "+comingSoon;
  const playable=sourceFilter.querySelector('option[value="has_video"]');
  if(playable)playable.textContent="Com vídeo cadastrado · "+withVideo;
 }
 const available=items.filter(x=>x.rights_reviewed&&!x.is_published&&!isNetflixReference(x));
 const pendingReview=items.filter(x=>!x.is_published&&!x.rights_reviewed);
 const markAll=$("bulk-mark-reviewed");
 if(markAll){markAll.disabled=busy||!pendingReview.length;markAll.textContent="Marcar todos como conferidos ("+pendingReview.length+")";}
 const bulk=$("bulk-publish");if(bulk){bulk.disabled=busy||!available.length;bulk.textContent="Liberar todos os conferidos ("+available.length+")";}
 const summary=$("review-summary");if(summary)summary.textContent=available.length+" prontos para publicar · "+pendingReview.length+" rascunhos ainda sem conferência";
 const activitySummary=$("activity-summary");
 if(activitySummary){
  const events=[...activityCounts.values()];
  activitySummary.textContent=events.reduce((sum,e)=>sum+e.detail,0)+" aberturas de detalhes · "+events.reduce((sum,e)=>sum+e.attempt,0)+" tentativas de reprodução nos últimos 30 dias. "+(activityLimitReached?"Leitura parcial.":"");
 }
 const filter=$("filter-title").value.trim().toLocaleLowerCase("pt-BR");
 const statusFilter=$("library-state-filter")?.value||"all";
 const ratingFilter=qualityFilter;
 const scores=items.filter(x=>Number.isInteger(x.quality_score));
 const notRated=items.length-scores.length;
 const below=items.filter(x=>Number.isInteger(x.quality_score)&&x.quality_score<6).length;
 const approved=items.filter(x=>Number.isInteger(x.quality_score)&&x.quality_score>=6).length;
 const label=$("quality-summary");
 if(label)label.textContent=scores.length+" de "+items.length+" filmes avaliados · "+approved+" com nota de 6 a 10 · "+below+" abaixo de 6 · "+notRated+" sem nota.";
 const chips=$("quality-groups");
 if(chips){
  const groups=[["all","Todos",items.length],["pending","Sem nota",notRated],["passing","6 a 10",approved],["below6","Abaixo de 6",below]];
  for(let n=10;n>=1;n--)groups.push(["score:"+n,"Nota "+n,items.filter(x=>x.quality_score===n).length]);
  chips.replaceChildren();
  groups.forEach(([id,name,n])=>{
   const btn=document.createElement("button");btn.type="button";btn.className="quality-chip"+(ratingFilter===id?" quality-chip-active":"");
   btn.textContent=name+" ("+n+")";btn.setAttribute("aria-pressed",String(ratingFilter===id));
   btn.addEventListener("click",()=>{qualityFilter=id;libraryPage=0;renderLibrary()});chips.append(btn);
  });
 }
 const shown=items.filter(x=>{
  if(!(x.title+" "+(x.series_title||"")).toLocaleLowerCase("pt-BR").includes(filter))return false;
  if(statusFilter==="imported"&&x.genre!=="Importado - revisão")return false;
  if(statusFilter==="licensed"&&!x.licensed_stream_url)return false;
  if(statusFilter==="catalog_only"&&!x.catalog_only)return false;
  if(statusFilter==="has_video"&&(x.catalog_only||!x.is_published))return false;
  if(statusFilter==="draft"&&x.is_published)return false;
  if(statusFilter==="reviewed"&&(x.is_published||!x.rights_reviewed))return false;
  if(statusFilter==="published"&&!x.is_published)return false;
  if(ratingFilter==="pending"&&x.quality_score!==null)return false;
  if(ratingFilter==="passing"&&!(x.quality_score>=6))return false;
  if(ratingFilter==="below6"&&!(x.quality_score!==null&&x.quality_score<6))return false;
  if(ratingFilter.startsWith("score:")&&x.quality_score!==Number(ratingFilter.slice(6)))return false;
  return true;
 });
 const list=$("library-list");list.replaceChildren();
 if(!shown.length){const p=document.createElement("p");p.className="muted";p.textContent=filter?"Nenhum vídeo encontrado.":"Nenhum vídeo enviado ainda. Comece pelo formulário ao lado.";list.append(p);return}
 const pageCount=Math.ceil(shown.length/LIBRARY_PAGE_SIZE);
 libraryPage=Math.max(0,Math.min(libraryPage,pageCount-1));
 shown.slice(libraryPage*LIBRARY_PAGE_SIZE,(libraryPage+1)*LIBRARY_PAGE_SIZE).forEach(row=>{
  const item=document.createElement("article");item.className="movie-item";
  const poster=window.NovaPlayCover?.approvedAnimePoster?.(row.title,true)||(row.poster_path?client.storage.from(POSTER_BUCKET).getPublicUrl(row.poster_path).data.publicUrl:(row.youtube_id?"https://i.ytimg.com/vi/"+encodeURIComponent(row.youtube_id)+"/hqdefault.jpg":row.google_drive_id?(window.NovaPlayCover?.driveThumbnail(row.google_drive_id)||window.NovaPlayCover?.titleCard(row.title)):(window.NovaPlayCover?.titleCard(row.title)||"../assets/posters/autoral.svg")));
  const source=row.catalog_only?"Aguardando vídeo autorizado":row.licensed_stream_url?"Licenciado · Streaming direto":row.youtube_id?"YouTube · Link":row.google_drive_id?"Google Drive · Link":((row.file_size_bytes||0)/(1024*1024)).toFixed(1)+" MB";
  const engagement=activityCounts.get(row.id)||{detail:0,attempt:0};
  const metricBadge='<small>Ficha: '+engagement.detail+' · Tentativas de assistir: '+engagement.attempt+' (30 dias)</small>';
  const review=row.genre==="Importado - revisão";
  const displayState=row.catalog_only?(row.is_published?"NA GRADE · EM BREVE":"RASCUNHO · SEM VÍDEO"):row.is_published?"PUBLICADO":row.rights_reviewed?"CONFERIDO · AGUARDA PUBLICAÇÃO":review?"RASCUNHO · REVISAR DIREITOS":"RASCUNHO";
  const grade=Number.isInteger(row.quality_score)?row.quality_score:null;
  const gradeTag=grade===null?"SEM NOTA":grade<6?"NOTA "+grade+" · CANDIDATO À RETIRADA":"NOTA "+grade+" · MANTER";
  const gradeBadge='<span class="quality-status'+(grade!==null&&grade<6?" quality-below":"")+'">'+gradeTag+'</span>';
  const options='<option value="">Sem nota</option>'+Array.from({length:10},(_,i)=>i+1).map(n=>'<option value="'+n+'"'+(grade===n?' selected':'')+'>'+n+'/10</option>').join("");
  const gradeEditor='<div class="quality-editor">'+
   '<label class="quality-select-label">Nota <select class="quality-select" aria-label="Nota de '+esc(row.title)+'">'+options+'</select></label>'+
   '<input type="text" class="quality-note" maxlength="500" placeholder="Motivo da nota (opcional)" value="'+esc(row.quality_score_note||"")+'" aria-label="Motivo da nota de '+esc(row.title)+'">'+
   '<button type="button" class="quality-save">Salvar nota</button></div>';
  item.innerHTML='<img class="movie-thumb" alt="" loading="lazy" src="'+esc(poster)+'"><div class="movie-main"><strong>'+esc(row.title)+'</strong><small>'+esc(row.catalog_only?(row.genre==="Anime · Série"?"Anime / série":"Anime / filme"):(row.kind==="episode"?(row.series_title+" · Ep. "+row.episode_number):"Filme/curta"))+' · '+esc(source)+'</small>'+metricBadge+'<span class="movie-state'+(row.is_published?"":" draft")+'">'+displayState+'</span>'+gradeBadge+gradeEditor+'<div class="movie-buttons"><button class="review">'+(row.rights_reviewed?'✓ Conferido':'Marcar como conferido')+'</button><button class="edit">Editar</button><button class="publish">'+(row.is_published?(row.catalog_only?"Ocultar Em breve":"Retirar do catálogo"):"Publicar")+'</button><button class="danger delete">Excluir</button></div></div>';
  item.querySelector(".movie-thumb").addEventListener("error",function(){
   if(this.dataset.fallbackShown)return;
   this.dataset.fallbackShown="1";
   this.src=window.NovaPlayCover?.titleCard(row.title)||"../assets/posters/autoral.svg";
  });
  item.querySelector(".quality-save").onclick=()=>saveQualityScore(row,item);
  item.querySelector(".review").onclick=()=>toggleReview(row);
   item.querySelector(".edit").textContent=row.catalog_only?"Liberar para assistir":"Editar";
  item.querySelector(".edit").classList.toggle("release",!!row.catalog_only);
  item.querySelector(".edit").onclick=()=>beginEdit(row);
  item.querySelector(".publish").onclick=()=>togglePublish(row);
  item.querySelector(".delete").onclick=()=>removeItem(row);
  list.append(item);
 });
 if(pageCount>1){
  const bar=document.createElement("div");bar.style.cssText="display:flex;align-items:center;gap:12px;justify-content:space-between;margin-top:18px;flex-wrap:wrap";
  const prev=document.createElement("button");prev.type="button";prev.className="outline compact";prev.textContent="‹ Anterior";prev.disabled=libraryPage===0;
  const next=document.createElement("button");next.type="button";next.className="outline compact";next.textContent="Próxima ›";next.disabled=libraryPage>=pageCount-1;
  const info=document.createElement("span");info.className="muted";info.textContent="Mostrando "+(libraryPage*LIBRARY_PAGE_SIZE+1)+"–"+Math.min((libraryPage+1)*LIBRARY_PAGE_SIZE,shown.length)+" de "+shown.length+" · Página "+(libraryPage+1)+" de "+pageCount;
  const change=delta=>{libraryPage+=delta;renderLibrary();document.querySelector(".library").scrollIntoView({behavior:"smooth",block:"start"})};
  prev.onclick=()=>change(-1);next.onclick=()=>change(1);bar.append(prev,info,next);list.append(bar);
 }
}
function setKind(){
 const isEpisode=$("kind").value==="episode";
 $("series-fields").hidden=!isEpisode;
 $("series-name").required=isEpisode;$("episode-number").required=isEpisode;
}
function beginEdit(row){
 if(busy)return;
 const releasing=!!row.catalog_only;
 editing=row;$("form-title").textContent=releasing?"Liberar título para assistir":"Editar conteúdo";$("cancel-edit").hidden=false;
 $("title").value=row.title;$("kind").value=row.kind;setKind();
 $("year").value=row.production_year||"";
 $("series-name").value=row.series_title||"";$("episode-number").value=row.episode_number||"";
 $("genre").value=row.genre;$("description").value=row.description||"";
 $("publish").checked=releasing&&!isNetflixReference(row)?true:row.is_published;
 $("source-type").value=isNetflixReference(row)?"netflix-reference":row.licensed_stream_url?"licensed":row.google_drive_id?"google-drive":row.youtube_id?"youtube":releasing?"google-drive":"upload";
 $("youtube-url").value=row.youtube_id?"https://youtu.be/"+row.youtube_id:"";
 $("drive-url").value=row.google_drive_id?"https://drive.google.com/file/d/"+row.google_drive_id+"/view"+(row.google_drive_resource_key?"?resourcekey="+encodeURIComponent(row.google_drive_resource_key):""):"";
 $("licensed-url").value=row.licensed_stream_url||"";
 $("netflix-url").value=row.netflix_reference_url||"";
 $("licensed-rights").checked=!!row.licensed_rights_confirmed;
 setSourceType();
 $("video-file").value="";$("poster-file").value="";$("youtube-poster-file").value="";
 $("video-file-label").textContent=releasing?"Selecionar vídeo autorizado":"Trocar vídeo (opcional)";
 $("poster-file-label").textContent="Trocar capa (opcional)";
 $("submit-upload").textContent=isNetflixReference(row)?"Salvar referência privada":releasing?"Salvar e liberar para assistir":"Salvar alterações";
 status("upload-message",releasing?"“"+row.title+"” já está na grade como Em breve. Adicione o arquivo ou link do vídeo autorizado. Ao salvar, sairá de Em breve e terá reprodução habilitada. Sem um vídeo, não será liberado.":"Editando “"+row.title+"”. Você pode mudar só o texto ou trocar arquivos.",false,releasing);
 document.querySelector(".editor").scrollIntoView({behavior:"smooth",block:"start"});
}
function resetForm(){
 editing=null;$("upload-form").reset();$("form-title").textContent="Adicionar filme ou episódio";
 $("cancel-edit").hidden=true;$("series-fields").hidden=true;$("series-name").required=false;$("episode-number").required=false;
 $("source-type").value="upload";$("youtube-url").value="";$("drive-url").value="";$("licensed-url").value="";$("licensed-rights").checked=false;$("netflix-url").value="";$("youtube-poster-file").value="";setSourceType();
 $("video-file-label").textContent="Selecionar vídeo do telefone";$("poster-file-label").textContent="Escolher capa (opcional)";
 $("submit-upload").textContent="Enviar para a NovaPlay";$("progress-box").hidden=true;$("publish").checked=false;
}


async function saveQualityScore(row,element){
 if(busy)return;
 const raw=element.querySelector(".quality-select").value;
 const score=raw===""?null:Number(raw);
 const note=element.querySelector(".quality-note").value.trim();
 if(score!==null&&(!Number.isInteger(score)||score<1||score>10)){
  status("quality-message","A nota deve estar entre 1 e 10.",true);return;
 }
 const changes={
  quality_score:score,
  quality_score_source:score===null?null:"manual",
  quality_score_note:score===null?null:(note||null),
  quality_scored_at:score===null?null:new Date().toISOString()
 };
 busy=true;
 const button=element.querySelector(".quality-save");button.disabled=true;button.textContent="Salvando...";
 try{
  const {data,error}=await client.from("novaplay_library").update(changes).eq("id",row.id).select("id").single();
  if(error)throw error;
  Object.assign(row,changes);
  status("quality-message",score===null?"Nota de “"+row.title+"” apagada.":"Nota salva para “"+row.title+"”: "+score+"/10.",false,true);
  renderLibrary();
 }catch(e){
  status("quality-message","Falha ao salvar a nota: "+errorText(e),true);
  button.disabled=false;button.textContent="Salvar nota";
 }finally{busy=false}
}

function isNetflixReference(row){return !!row.netflix_reference_url}
function netflixReferenceUrl(value){try{const u=new URL(value.trim());if(u.protocol!=="https:"||u.hostname.replace(/^www\./,"")!=="netflix.com"||u.username||u.password)return null;const direct=u.pathname.match(/^\/(?:title|watch)\/(\d{5,12})(?:\/|$)/);const id=direct?.[1]||u.searchParams.get("jbv");if(!id||!/^\d{5,12}$/.test(id))return null;return u.href}catch{return null}}
async function toggleReview(row){
 if(busy)return;
 const next=!row.rights_reviewed;
 if(next&&isNetflixReference(row)){status("bulk-message","Este título da Netflix está apenas como referência. Substitua por um link licenciado antes de conferir.",true);return}
 if(next&&!confirm("Você conferiu este filme e confirma que possui autorização de exibição pública na NovaPlay e que o link é acessível? Marcar “"+row.title+"” como conferido?"))return;
 busy=true;renderLibrary();
 try{
  const stamp=next?new Date().toISOString():null;
  const {error}=await client.from("novaplay_library").update({rights_reviewed:next,rights_reviewed_at:stamp}).eq("id",row.id);
  if(error)throw error;
  row.rights_reviewed=next;row.rights_reviewed_at=stamp;
  status("bulk-message",next?"Título conferido: "+row.title:"Conferência retirada: "+row.title,false,true);
 }catch(e){status("bulk-message","Falha ao salvar conferência: "+errorText(e),true)}
 finally{busy=false;renderLibrary()}
}
async function togglePublish(row){
 if(busy)return;
 const publish=!row.is_published;
 if(publish&&isNetflixReference(row)){status("bulk-message","Título da Netflix bloqueado como rascunho. Edite e substitua pelo vídeo licenciado para liberar.",true);return}
 if(publish&&!confirm(row.catalog_only?"Exibir a ficha de “"+row.title+"” na grade como EM BREVE, sem reprodução, até cadastrar um vídeo?":"Confirma autorização para disponibilizar publicamente “"+row.title+"” na NovaPlay, incluindo o arquivo indicado pelo link?"))return;
 busy=true;renderLibrary();
 try{
  const changes={is_published:publish};
  if(publish&&!row.rights_reviewed){changes.rights_reviewed=true;changes.rights_reviewed_at=new Date().toISOString();}
  const {error}=await client.from("novaplay_library").update(changes).eq("id",row.id);
  if(error)throw error;
  await loadLibrary();
 }catch(e){status("bulk-message","Falha ao mudar publicação: "+errorText(e),true)}
 finally{busy=false;renderLibrary()}
}
async function bulkMarkReviewed(){
 if(busy||!sessionUser)return;
 // Usa todos os rascunhos, independentemente da página ou filtro ativo.
 const ids=items.filter(x=>!x.is_published&&!x.rights_reviewed&&!isNetflixReference(x)).map(x=>x.id);
 if(!ids.length){
  status("bulk-message","Não há rascunhos pendentes de conferência.",false,true);
  return;
 }
 const confirmed=confirm(
  "MARCAR TODOS COMO CONFERIDOS\n\n"+
  "Você confirma que já revisou os "+ids.length+" filmes pendentes, incluindo os links e as autorizações de exibição pública de cada obra?\n\n"+
  "Essa ação marca todos os rascunhos pendentes, em todas as páginas, mas NÃO publica nenhum filme. A publicação continuará exigindo o botão 'Liberar todos os conferidos'."
 );
 if(!confirmed)return;
 busy=true;renderLibrary();
 let marked=0;
 try{
  const stamp=new Date().toISOString();
  for(let index=0;index<ids.length;index+=80){
   status("bulk-message","Salvando conferência... "+marked+" de "+ids.length);
   const batch=ids.slice(index,index+80);
   const {data,error}=await client.from("novaplay_library")
    .update({rights_reviewed:true,rights_reviewed_at:stamp})
    .in("id",batch).eq("is_published",false).eq("rights_reviewed",false)
    .select("id");
   if(error)throw error;
   marked+=(data||[]).length;
  }
  status("bulk-message","Conferência salva para "+marked+" filme(s). Nenhum filme foi publicado. Use 'Liberar todos os conferidos' quando desejar.",false,true);
 }catch(err){
  status("bulk-message","Falha depois de marcar "+marked+" filme(s): "+errorText(err)+". Atualize o painel e confira os restantes.",true);
 }finally{
  busy=false;
  await loadLibrary();
  renderLibrary();
 }
}

async function bulkPublishReviewed(){
 if(busy||!sessionUser)return;
 const ids=items.filter(x=>x.rights_reviewed&&!x.is_published&&!isNetflixReference(x)).map(x=>x.id);
 if(!ids.length){status("bulk-message","Nenhum rascunho conferido para publicar.");return}
 if(!confirm("LIBERAR TODOS OS CONFERIDOS: serão publicados "+ids.length+" filmes. Confirma que conferiu as licenças de exibição de TODOS eles, e que quer disponibilizá-los ao público agora? Os não conferidos continuarão rascunhos."))return;
 busy=true;renderLibrary();$("bulk-publish").disabled=true;
 let done=0;
 try{
  for(let index=0;index<ids.length;index+=80){
   status("bulk-message","Publicando conferidos... "+done+" de "+ids.length);
   const group=ids.slice(index,index+80);
   const {data,error}=await client.from("novaplay_library").update({is_published:true}).in("id",group).eq("is_published",false).eq("rights_reviewed",true).select("id");
   if(error)throw error;
   done+=(data||[]).length;
  }
  status("bulk-message","Concluído: "+done+" filmes conferidos foram publicados. Os demais permanecem em rascunho.",false,true);
 }catch(err){status("bulk-message","Publicação interrompida após "+done+" filmes: "+errorText(err)+". Atualize a lista antes de repetir.",true)}
 finally{busy=false;await loadLibrary();renderLibrary()}
}
async function removeItem(row){
 if(busy)return;
 if(!confirm("Excluir “"+row.title+"” definitivamente? O vídeo e a capa também serão removidos. Esta ação não tem volta."))return;
 const {error}=await client.from("novaplay_library").delete().eq("id",row.id);
 if(error){alert("Não foi possível excluir: "+errorText(error));return;}
 const cleanup=row.video_path?[client.storage.from(VIDEO_BUCKET).remove([row.video_path])]:[];
 if(row.poster_path)cleanup.push(client.storage.from(POSTER_BUCKET).remove([row.poster_path]));
 const results=await Promise.allSettled(cleanup);
 if(results.some(x=>x.status==="rejected"||x.value?.error))alert("O conteúdo saiu da biblioteca, mas a limpeza dos arquivos teve uma falha. Confira o Storage depois.");
 if(editing?.id===row.id)resetForm();
 await loadLibrary();
}
async function sendForm(e){
 e.preventDefault();if(busy||!sessionUser)return;
 const mode=sourceMode();
 const youtube=mode==="youtube",drive=mode==="google-drive",licensed=mode==="licensed",netflix=mode==="netflix-reference",external=youtube||drive||licensed||netflix;
 const file=$("video-file").files[0]||null;
 const cover=(external?$("youtube-poster-file"):$("poster-file")).files[0]||null;
 const youtubeId=youtube?extractYoutubeId($("youtube-url").value):null;
 const driveFile=drive?parseGoogleDriveLink($("drive-url").value):null;
 if(licensed&&netflixReferenceUrl($("licensed-url").value)){
  $("netflix-url").value=$("licensed-url").value.trim();
  $("source-type").value="netflix-reference";setSourceType();
  status("upload-message","Reconheci o link da Netflix e alterei para cadastro privado. Confira e clique novamente em Salvar referência privada.",false,true);
  return;
 }
 const licensedUrl=licensed?parseLicensedStreamUrl($("licensed-url").value):null;
 const netflixUrl=netflix?netflixReferenceUrl($("netflix-url").value):null;
 if(netflix&&!netflixUrl){status("upload-message","Informe um link oficial Netflix /title/ID ou /browse/genre/...?...jbv=ID.",true);return}
 if(licensed&&!licensedUrl){status("upload-message","Informe um link HTTPS direto autorizado terminando em .mp4, .webm, .ogv ou .m3u8. Endereços de filmes na Netflix não funcionam aqui.",true);return}
 if(licensed&&$("publish").checked&&!$("licensed-rights").checked){status("upload-message","Para publicar este filme, confirme que já possui licença para exibição pública na NovaPlay. Enquanto aguarda, salve como rascunho.",true);return}
 if(youtube&&!youtubeId){status("upload-message","Cole um link válido do YouTube, como https://youtu.be/ID ou youtube.com/watch?v=ID.",true);return}
 if(drive&&!driveFile){status("upload-message","Cole um link de arquivo do Google Drive, como https://drive.google.com/file/d/ID/view. Links de pastas ou pesquisa Google não funcionam.",true);return}
 if(!external&&!file&&(!editing||!editing.video_path)){
  status("upload-message","Selecione um vídeo MP4/WebM do celular, ou escolha a opção 'Filme grande pelo YouTube'.",true);return;
 }
 if(!external&&file){
  if(!fileKind(file)){status("upload-message","Formato incompatível: escolha MP4, WebM ou OGV.",true);return}
  if(file.size>MAX_VIDEO){status("upload-message","Este arquivo tem "+(file.size/(1024*1024)).toFixed(1)+" MB. Para filmes maiores, mude para 'Filme grande pelo YouTube' e cole o link.",true);return}
  if(file.size<1){status("upload-message","O vídeo está vazio.",true);return}
 }
 if(cover&&(!fileKind(cover,false)||cover.size>MAX_POSTER)){status("upload-message","Capa inválida. Use JPG, PNG ou WebP com até 5 MB.",true);return}
 const kind=$("kind").value;
 const payload={
  title:$("title").value.trim(),
  description:$("description").value.trim(),
  kind,
  series_title:kind==="episode"?$("series-name").value.trim():null,
  episode_number:kind==="episode"?Number($("episode-number").value):null,
  production_year:$("year").value?Number($("year").value):null,
  genre:$("genre").value.trim()||"Autoral",
  is_published:netflix?false:$("publish").checked,
  catalog_only:netflix,
  licensed_stream_url:licensed?licensedUrl:null,
  netflix_reference_url:netflix?netflixUrl:null,
  licensed_rights_confirmed:licensed&&$("licensed-rights").checked
 };
 if(licensed||netflix)payload.rights_reviewed=licensed&&!!payload.licensed_rights_confirmed;
 if(netflix){payload.rights_reviewed_at=null;payload.licensed_rights_confirmed=false}
 if(payload.title.length<2){status("upload-message","Informe um título de pelo menos 2 caracteres.",true);return}
 if(kind==="episode"&&(!payload.series_title||!payload.episode_number)){status("upload-message","Informe o nome da série e o número do episódio.",true);return}
 disable(true);status("upload-message",external?"Preparando vídeo pelo link...":"Preparando envio do vídeo...");
 let newVideo=null,newPoster=null;
 try{
  let generated={duration:null,thumbnail:null};
  if(!external&&file){
   status("upload-message","Lendo o vídeo e preparando a capa...");
   generated=await inspectVideo(file);
   if(generated.duration!==null)payload.duration_seconds=generated.duration;
  }
  const chosenCover=cover||generated.thumbnail;
  if(chosenCover){
    status("upload-message","Enviando capa...");
    newPoster=await uploadCover(chosenCover);
  }
  if(external){
    Object.assign(payload,{
      youtube_id:youtube?youtubeId:null,
      google_drive_id:drive?driveFile.id:null,
      google_drive_resource_key:drive?driveFile.resourceKey:null,
      licensed_stream_url:licensed?licensedUrl:null,
      video_path:null,mime_type:null,file_size_bytes:null,duration_seconds:null
    });
  }else{
   payload.youtube_id=null;payload.google_drive_id=null;payload.google_drive_resource_key=null;
   if(file){
     newVideo=createVideoPath(file);
     await uploadVideo(file,newVideo);
     Object.assign(payload,{video_path:newVideo,mime_type:extForMime(file).mime,file_size_bytes:file.size});
   }
  }
  if(newPoster)payload.poster_path=newPoster;
  if(!editing)payload.created_by=sessionUser.id;
  status("upload-message",external?"Salvando link no catálogo...":"Salvando informações do filme...");
  const result=editing
   ?await client.from("novaplay_library").update(payload).eq("id",editing.id).select("id").single()
   :await client.from("novaplay_library").insert(payload).select("id").single();
  if(result.error)throw result.error;
  if(editing?.video_path && (external||newVideo) && editing.video_path!==newVideo){
    const clean=await client.storage.from(VIDEO_BUCKET).remove([editing.video_path]);
    if(clean.error)console.warn("Limpeza de vídeo antigo não concluída.");
  }
  if(editing?.poster_path&&newPoster&&editing.poster_path!==newPoster){
    const clean=await client.storage.from(POSTER_BUCKET).remove([editing.poster_path]);
    if(clean.error)console.warn("Limpeza de capa antiga não concluída.");
  }
  if(file)sessionStorage.removeItem(pendingKey(file));
  const wasCatalogOnly=!!editing?.catalog_only;
  resetForm();
  status("upload-message",netflix?"Referência da Netflix salva como rascunho privado. Sem reprodução e sem publicação.":wasCatalogOnly?(payload.is_published?"Vídeo cadastrado! O título saiu de Em breve e está liberado para assistir.":"Vídeo cadastrado como rascunho. O título ainda não está publicado."):"Conteúdo salvo! "+(payload.is_published?"Já está disponível na NovaPlay.":"Salvo como rascunho."),false,true);
  await loadLibrary();
 }catch(err){
   status("upload-message","Não foi possível salvar: "+errorText(err)+". Confira as informações e tente novamente.",true);
 }finally{disable(false);setSourceType()}
}
async function authAction(e){
 e.preventDefault();
 const email=$("email").value.trim(),password=$("password").value;
 $("sign-in").disabled=true;status("auth-message","Verificando acesso...");
 try{
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error)throw error;
  status("auth-message","");await checkSession();
 }catch(e){status("auth-message","Não foi possível entrar: "+errorText(e),true)}
 finally{$("sign-in").disabled=false}
}
async function signUp(){
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||password.length<8){status("auth-message","Informe seu e-mail e escolha uma senha com no mínimo 8 caracteres.",true);return}
 const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
 if(error)status("auth-message",errorText(error),true);
 else{status("auth-message",data.session?"Cadastro criado. Aguardando liberação administrativa.":"Cadastro solicitado. Verifique seu e-mail para confirmar a conta e peça a liberação administrativa.",false,true);if(data.session)await checkSession();}
}
async function forgot(){
 const email=$("email").value.trim();
 if(!email){status("auth-message","Digite seu e-mail primeiro.",true);return}
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
 status("auth-message",error?errorText(error):"Se a conta existir, enviaremos instruções de recuperação para esse e-mail.",!!error,!error);
}
function init(){
 if(!window.supabase?.createClient){show("login-view");status("auth-message","Não foi possível carregar a conexão de armazenamento. Confira a internet e atualize a página.",true);return}
 client=window.supabase.createClient(API_URL,PUBLIC_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
 $("login-form").onsubmit=authAction;$("signup").onclick=signUp;$("forgot").onclick=forgot;
 $("pending-exit").onclick=async()=>{await client.auth.signOut();show("login-view")};
 $("logout").onclick=async()=>{if(busy)return;await client.auth.signOut();sessionUser=null;show("login-view")};
 $("upload-form").onsubmit=sendForm;$("kind").onchange=setKind;$("source-type").onchange=setSourceType;setSourceType();
 $("licensed-url").addEventListener("input",()=>{const url=netflixReferenceUrl($("licensed-url").value);if(url&&$("source-type").value==="licensed"){$("netflix-url").value=url;$("source-type").value="netflix-reference";setSourceType();status("upload-message","Link da Netflix detectado: referência privada selecionada automaticamente. O filme ficará em rascunho.",false,true)}});
 $("licensed-new").onclick=()=>{
  resetForm();
  $("kind").value="movie";setKind();
  $("source-type").value="licensed";setSourceType();
  $("publish").checked=false;
  $("form-title").textContent="Adicionar filme licenciado";
  status("upload-message","Cole o link de vídeo fornecido pelo licenciador. Salve como rascunho até ter os direitos confirmados.",false,true);
  document.querySelector(".editor").scrollIntoView({behavior:"smooth",block:"start"});
  $("title").focus();
 };
 $("cancel-edit").onclick=()=>{resetForm();status("upload-message","Edição cancelada.")};
 $("bulk-mark-reviewed").onclick=bulkMarkReviewed;
 $("bulk-publish").onclick=bulkPublishReviewed;
 $("featured-search").oninput=()=>{featuredResultLimit=24;renderFeaturedBrowser()};
 $("featured-type").onchange=()=>{featuredResultLimit=24;renderFeaturedBrowser()};
 $("featured-more").onclick=()=>{featuredResultLimit+=24;renderFeaturedBrowser()};
 $("featured-add").onclick=addFeaturedFilm;
 $("featured-defaults").onclick=restoreFeaturedFilms;
 $("issue-refresh").onclick=loadPlaybackIssues;
 $("refresh-list").onclick=()=>Promise.all([loadLibrary(),loadActivity(),loadFeaturedConfig(),loadPlaybackIssues()]);$("filter-title").oninput=()=>{libraryPage=0;renderLibrary()};if($("library-state-filter"))$("library-state-filter").onchange=()=>{libraryPage=0;renderLibrary()};
 $("video-file").onchange=()=>{$("video-file-label").textContent=$("video-file").files[0]?.name||"Selecionar vídeo do telefone"};
 $("poster-file").onchange=()=>{$("poster-file-label").textContent=$("poster-file").files[0]?.name||"Escolher capa (opcional)"};
 $("youtube-poster-file").onchange=()=>{$("youtube-poster-label").textContent=$("youtube-poster-file").files[0]?.name||"Adicionar capa personalizada (opcional)"};
 client.auth.onAuthStateChange((event)=>{
  if(event==="PASSWORD_RECOVERY"){setTimeout(async()=>{const pass=prompt("Digite sua nova senha (pelo menos 8 caracteres):");if(pass&&pass.length>=8){const {error}=await client.auth.updateUser({password:pass});alert(error?errorText(error):"Senha alterada. Agora você pode entrar.")}},100)}
 });
 checkSession();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
