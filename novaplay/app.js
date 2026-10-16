/* NPlay v0.12.0 • player, catálogo e experiência de streaming */
(function(){
"use strict";
const db=window.NovaPlayCatalog;
const remoteDb=window.NPlayAccessClient||window.supabase?.createClient?.("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
let uploadedCatalog=[];
let homeLiveChannels=[],homeLivePreviews=null;
if(!db){console.error("O catálogo não foi carregado.");return;}
const $=id=>document.getElementById(id);
const all=[...db.channels,...db.films,...db.series];
const map=new Map(all.map(x=>[x.id,x]));
const eps=new Map();db.series.forEach(show=>(show.episodes||[]).forEach(ep=>eps.set(ep.id,{show,ep})));
const favKey="novaplay-favorites-v2",progressKey="novaplay-progress-v1";
/* Métrica anônima de interesse. Conta abertura da ficha e TENTATIVAS de reprodução,
   nunca declara que um vídeo externo efetivamente foi reproduzido. */
function registerCatalogInterest(item,eventType){
 if(!remoteDb||!item?.id?.startsWith("upload-"))return;
 if(eventType!=="detail_open"&&eventType!=="play_attempt")return;
 const mediaId=item.id.slice("upload-".length);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mediaId))return;
 const key="novaplay-measure:"+eventType+":"+mediaId;
 try{
  const last=Number(sessionStorage.getItem(key)||0);
  if(Date.now()-last<10*60*1000)return;
  sessionStorage.setItem(key,String(Date.now()));
 }catch(e){}
 remoteDb.from("novaplay_activity_events").insert({media_id:mediaId,event_type:eventType})
  .then(({error})=>{if(error)console.warn("Medição NPlay indisponível:",error.message)})
  .catch(()=>{});
}
function read(key,fallback){try{const x=JSON.parse(localStorage.getItem(key));return x??fallback}catch(e){return fallback}}
const savedFavorites=read(favKey,[]);
const favorite=new Set((Array.isArray(savedFavorites)?savedFavorites:[]).filter(x=>typeof x==="string"));
const searchText=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
let progress=read(progressKey,{});
if(!progress||typeof progress!=="object"||Array.isArray(progress))progress={};
const save=(key,x)=>{try{localStorage.setItem(key,JSON.stringify(x))}catch(e){}};
const escapeText=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let view="inicio",selected=null,featuredIndex=0,current=null,hls=null,tsPlayer=null,timer=0,attempt=0,timeSaved=0,toastTimeout=null;
let playerUiTimer=null,seekActive=false;
let fullscreenOwned=false,closingFullscreen=false,lockedLandscape=false,playerClosing=false,cinemaSession=0;
let issueReportBusy=false;
let previewTimer=null,previewSequence=0,previewHls=null;

function posterUrl(path,youtubeId,title,driveId,genre){
 const custom=path&&remoteDb?remoteDb.storage.from("novaplay-posters").getPublicUrl(path).data.publicUrl:null;
 return window.NovaPlayCover?.selectPoster?.(title,false,genre,custom,youtubeId)
   ||window.NovaPlayCover?.genrePoster?.(title,genre)
   ||window.NovaPlayCover?.titleCard(title)||"./assets/posters/autoral.svg";
}
function durationText(seconds){
 if(!Number.isFinite(seconds)||seconds<=0)return"Duração não informada";
 return Math.max(1,Math.round(seconds/60))+" min";
}
async function loadUploadedCatalog(){
 if(!remoteDb)return;
 try{
  const data=[];
  // Paginar resultados, inclusive quando o catálogo público ultrapassar 150 títulos.
  for(let offset=0;offset<5000;offset+=500){
   const {data:page,error}=await remoteDb.from("novaplay_library")
    .select("id,title,description,kind,series_title,season_number,episode_number,genre,production_year,video_path,r2_object_key,youtube_id,google_drive_id,google_drive_resource_key,licensed_stream_url,poster_path,duration_seconds,created_at,catalog_only")
    .eq("is_published",true).order("created_at",{ascending:false}).range(offset,offset+499);
   if(error){console.error("NPlay: catálogo público não carregou:",error.message); if(offset===0){setTimeout(loadUploadedCatalog,15000);return;}break}
   data.push(...(page||[]));
   if(!page||page.length<500)break;
  }
  for(let i=all.length-1;i>=0;i--){if(all[i].uploaded){map.delete(all[i].id);all.splice(i,1);}}
   db.films=db.films.filter(x=>!x.uploaded);db.series=db.series.filter(x=>!x.uploaded);
   for(const [id,pair] of eps){if(pair.show.uploaded)eps.delete(id);}
   const grouped=new Map();
  let additions=[];
  // Em breve é só para fichas sem fonte de vídeo. Listar por último.
  data.sort((a,b)=>Number(!!a.catalog_only)-Number(!!b.catalog_only));
  (data||[]).forEach(record=>{
   const cover=posterUrl(record.poster_path,record.youtube_id,record.title,record.google_drive_id,record.genre);
   const title=(record.title||"Sem título").replace(/\bTorrent\b/ig,"").replace(/\s*\((?:19|20)\d{2}\)\s*$/,"").replace(/\s{2,}/g," ").trim();
   const desc=record.description||(record.catalog_only?"Título confirmado na NPlay. Aguardando inclusão de vídeo autorizado.":"Conteúdo disponível na NPlay.");
   if(record.kind==="movie"){
    const film={id:"upload-"+record.id,title,kind:"film",category:record.genre||"Autoral",description:desc,
      year:record.production_year||Number((record.title||"").match(/\((19\d{2}|20\d{2})\)\s*$/)?.[1])||null,duration:record.catalog_only?"Em breve":durationText(record.duration_seconds),cover,backdrop:cover,catalogOnly:!!record.catalog_only,
      mode:record.catalog_only?"catalog-only":record.r2_object_key?"r2":record.licensed_stream_url?"licensed":record.google_drive_id?"google-drive":record.youtube_id?"youtube":"private",video_path:record.video_path,r2_object_key:record.r2_object_key,youtube_id:record.youtube_id,google_drive_id:record.google_drive_id,google_drive_resource_key:record.google_drive_resource_key,licensed_stream_url:record.licensed_stream_url,src:null,sourcePage:record.youtube_id?"https://www.youtube.com/watch?v="+record.youtube_id:null,uploaded:true,live:false};
    db.films.push(film);all.push(film);map.set(film.id,film);additions.push(film);
   }else if(record.kind==="episode"&&record.series_title){
    const key=searchText(record.series_title.trim())+"/"+(record.season_number||1);
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push({...record,cover,title,desc});
   }
  });
  for(const [key,episodes] of grouped){
   episodes.sort((a,b)=>(a.episode_number||0)-(b.episode_number||0));
   const first=episodes[0];
   const show={id:"uploaded-series-"+first.id,title:first.series_title+" · Temporada "+(first.season_number||1),kind:"series",
    category:first.genre||"Autoral",description:first.desc,year:first.production_year,cover:first.cover,
    backdrop:first.cover,uploaded:true,live:false,
    episodes:episodes.map(rec=>({id:"upload-"+rec.id,label:"Episódio "+rec.episode_number,
      title:rec.title,duration:durationText(rec.duration_seconds),video_path:rec.video_path,r2_object_key:rec.r2_object_key,youtube_id:rec.youtube_id,google_drive_id:rec.google_drive_id,google_drive_resource_key:rec.google_drive_resource_key,licensed_stream_url:rec.licensed_stream_url,season_number:rec.season_number||1,src:null,sourcePage:null,mode:rec.r2_object_key?"r2":rec.licensed_stream_url?"licensed":rec.google_drive_id?"google-drive":rec.youtube_id?"youtube":"private"}))};
   db.series.push(show);all.push(show);map.set(show.id,show);additions.push(show);
   show.episodes.forEach(ep=>eps.set(ep.id,{show,ep}));
  }
  uploadedCatalog=additions;
   await loadFeatured();
  if(view==="inicio")renderRows();
  else if(view==="buscar")renderSearch();
  else if(categories[view])renderCategory(view);
 }catch(err){console.warn("NPlay: não foi possível obter novos conteúdos.",String(err))}
}

function icon(id){return '<svg aria-hidden="true"><use href="#i-'+id+'"></use></svg>'}
function toast(message){clearTimeout(toastTimeout);const n=$("toast");n.textContent=message;n.classList.add("show");toastTimeout=setTimeout(()=>n.classList.remove("show"),2600)}
function favLabel(item){return favorite.has(item.id)?"Na minha lista":"Minha lista"}
function toggleFavorite(item){
 if(favorite.has(item.id)){favorite.delete(item.id);toast("Removido da minha lista")}
 else{favorite.add(item.id);toast("Adicionado à minha lista")}
 save(favKey,[...favorite]);if(selected?.id===item.id)refreshFavoriteButton();
 if(view==="favoritos")renderCategory("favoritos");
 if(view==="inicio")renderRows();
}
function progressItem(id){const p=progress[id];return p&&Number.isFinite(p.position)&&p.position>5&&Number.isFinite(p.duration)&&p.duration>0&&p.position/p.duration<.94?p:null}
function continued(){
 return Object.entries(progress).filter(([id])=>progressItem(id)).sort((a,b)=>(b[1].updated||0)-(a[1].updated||0))
  .map(([id,p])=>{const ep=eps.get(id);if(ep)return{...ep.show,id,kind:"episode",title:ep.show.title+" • "+ep.ep.label,cover:ep.show.cover,description:ep.show.description,progress:p,show:ep.show,episode:ep.ep};const film=map.get(id);return film&&film.kind==="film"?{...film,progress:p}:null}).filter(Boolean).slice(0,12);
}
function byId(id){return map.get(id)||null}
function card(item,channel=false){
 const isEpisode=item.kind==="episode";const cover=item.cover||"./assets/icon.svg";
 const el=document.createElement("article");el.className="poster-card"+(channel?" channel-card":"");
 if(item.mode==="youtube")el.classList.add("youtube-card");
 el.dataset.id=item.id;
 if(channel){
  const color=/^#[0-9a-fA-F]{6}$/.test(item.brandColor||"")?item.brandColor:"#102a45";
  el.style.setProperty("--channel-primary",color);
  if(item.mode==="external")el.classList.add("channel-official-link");
 }
 const pct=item.progress?Math.min(100,Math.max(0,Math.round(item.progress.position/item.progress.duration*100))):0;
 const channelArt=channel&&item.customLabel?'<span class="channel-custom-label">'+escapeText(item.customLabel)+'</span>':"";
 el.innerHTML='<div class="cover">'+(channelArt||'<img loading="lazy" decoding="async" src="'+escapeText(cover)+'" alt="'+escapeText(channel?"Logomarca de "+item.title:"Capa ilustrativa: "+item.title)+'">')
 +(channel?'<span class="onair'+(item.mode==="external"?' official-source':'')+'">'+escapeText(item.mode==="external"?(item.externalLabel||"SITE OFICIAL"):"AO VIVO")+'</span>':item.catalogOnly?'<span class="catalog-coming-soon">EM BREVE</span>':'')
 +'<button type="button" class="cover-btn" aria-label="'+escapeText(isEpisode?"Continuar "+item.title:"Ver detalhes de "+item.title)+'"></button>'
 +(item.catalogOnly?'':'<button type="button" class="card-direct-play" aria-label="Assistir '+escapeText(item.title)+'">'+icon("play")+'</button>')
 +(pct?'<span class="card-progress"><span style="width:'+pct+'%"></span></span>':'')+'</div>'
 +'<h3>'+escapeText(item.title)+'</h3><p>'+escapeText(isEpisode?(Math.max(1,Math.round((item.progress.duration-item.progress.position)/60))+" min restantes"):(item.kind==="tv"?(item.mode==="external"?"Acessar transmissão no site oficial":"TV ao vivo • Assista grátis"):(item.catalogOnly?"Em breve":(item.year||(item.kind==="series"?"Série":"Filme")))+" • "+(item.category||"Acervo clássico")))+'</p>';
 if(item.mode==="youtube"){
  el.querySelector("p").textContent=window.NPlayYouTube.channel(item);
  const duration=document.createElement("span");duration.className="youtube-duration";duration.textContent=item.duration||"YouTube";
  el.querySelector(".cover").append(duration);
  el.querySelector("img")?.setAttribute("alt","Miniatura de "+item.title);
 }
 if(item.progress){
  el.querySelector("p").textContent=Math.max(1,Math.ceil((item.progress.duration-item.progress.position)/60))+" min restantes · "+pct+"% assistido";
  const remove=document.createElement("button");remove.type="button";remove.className="continue-remove";remove.textContent="×";remove.setAttribute("aria-label","Remover "+item.title+" de Continuar assistindo");
  remove.onclick=event=>{event.stopPropagation();delete progress[item.id];save(progressKey,progress);renderRows();};el.querySelector(".cover").append(remove);
 }
 el.querySelector(".cover-btn").addEventListener("click",()=>item.kind==="tv"&&item.mode==="external"?startWatching(item):isEpisode?play(item.show,item.episode):openDetails(item));
 el.querySelector(".card-direct-play")?.addEventListener("click",e=>{e.stopPropagation();if(isEpisode)play(item.show,item.episode);else startWatching(item)});
 el.querySelector("img")?.addEventListener("error",function(){
  if(this.dataset.fallbackShown)return;
  this.dataset.fallbackShown="1";
  if(channel){
   this.hidden=true;
   const mark=document.createElement("span");
   mark.className="channel-custom-label";
   mark.textContent=item.title;
   this.parentNode.insertBefore(mark,this);
   return;
  }
  this.src=window.NovaPlayCover?.genrePoster?.(item.title,item.category)||window.NovaPlayCover?.titleCard(item.title)||"./assets/posters/autoral.svg";
 });
 window.NovaPlayHover?.attach?.(el,item,{
  play:()=>{if(isEpisode)play(item.show,item.episode);else startWatching(item)},
  details:()=>openDetails(item),
  signedUrl:async path=>{
   if(!remoteDb)return null;
   const {data,error}=await remoteDb.storage.from("novaplay-videos").createSignedUrl(path,90);
   return error?null:data?.signedUrl||null;
  }
 });
 return el;
}
function empty(title,subtitle){const div=document.createElement("div");div.className="empty-state";const h=document.createElement("h3");h.textContent=title;const p=document.createElement("p");p.textContent=subtitle;div.append(h,p);return div}
let shelfSequence=0;
function shelf(title,items,key,withLive=false){
 if(!items.length)return null;
 const section=document.createElement("section");section.className="shelf";
 const head=document.createElement("div");head.className="shelf-top";
 const h=document.createElement("h2");h.className="shelf-title";h.textContent=title;
 if(withLive){const badge=document.createElement("span");badge.className="live-label";badge.textContent="● AO VIVO";h.append(badge)}
 const more=document.createElement("button");more.className="see-all";more.textContent="Ver todos ›";
 if(key==="continuar")more.hidden=true;else more.addEventListener("click",()=>navigate(key));
 head.append(h,more);
 const rail=document.createElement("div");rail.className="shelf-rail";
 const track=document.createElement("div");
 track.className="shelf-track";
 track.id="shelf-track-"+(++shelfSequence);
 track.setAttribute("aria-label",title);
 track.tabIndex=0;
 items.forEach(item=>track.append(card(item,item.kind==="tv")));
 function arrow(direction){
  const button=document.createElement("button");
  button.type="button";
  button.className="shelf-arrow shelf-arrow-"+(direction<0?"prev":"next");
  button.setAttribute("aria-label",(direction<0?"Ver filmes anteriores em ":"Ver próximos filmes em ")+title);
  button.setAttribute("aria-controls",track.id);
  button.title=direction<0?"Voltar filmes":"Próximos filmes";
  button.hidden=true;
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(direction<0?"m15 5-7 7 7 7":"m9 5 7 7-7 7")+'"/></svg>';
  button.addEventListener("click",()=>{
   window.NovaPlayHover?.close?.();
   const firstCard=track.querySelector(".poster-card");
   const cardWidth=firstCard?.getBoundingClientRect().width||260;
   const amount=Math.max(cardWidth,track.clientWidth*.84);
   track.scrollBy({left:direction*amount,
    behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
  });
  return button;
 }
 const prev=arrow(-1),next=arrow(1);
 const refresh=()=>{
  if(!section.isConnected)return;
  const max=Math.max(0,track.scrollWidth-track.clientWidth);
  prev.hidden=max<=8||track.scrollLeft<=5;
  next.hidden=max<=8||track.scrollLeft>=max-5;
 };
 track.addEventListener("scroll",refresh,{passive:true});
 rail.append(track,prev,next);
 section.append(head,rail);
 if("ResizeObserver" in window){
  const observer=new ResizeObserver(refresh);
  observer.observe(track);
 }else{
  // Legacy-browser fallback; all modern browsers use the observer above.
  window.addEventListener("resize",refresh,{passive:true});
 }
 requestAnimationFrame(refresh);
 return section;
}

const genreOrder=["Animação","Ação","Aventura","Comédia","Drama","Fantasia","Ficção científica","Romance","Suspense","Terror","Documentário","Não classificados"];
let selectedGenre="Todos";
function normalizeGenre(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function primaryGenre(film){
 const value=normalizeGenre(film.category).trim();
 if(!value||/^(importado|autoral|outros|sem genero|a classificar|producao independente)/.test(value))return "Não classificados";
 const names=[
 ["Animação",/animac|desenho|infantil/],["Ação",/acao|policial|artes marciais/],
 ["Aventura",/aventura/],["Comédia",/comedia|humor/],["Drama",/drama/],
 ["Fantasia",/fantasia|magia/],["Ficção científica",/ficcao cientifica|sci.?fi/],
 ["Romance",/romance|romant/],["Suspense",/suspense|misterio/],
 ["Terror",/terror|horror/],["Documentário",/documentario/]
 ];
 for(const [name,pattern] of names){if(pattern.test(value))return name}
 return "Não classificados";
}
function genreGroups(){
 const groups=new Map(genreOrder.map(name=>[name,[]]));
 for(const item of uploadedCatalog.filter(x=>x.kind==="film"&&!x.catalogOnly&&x.mode!=="youtube"))
  groups.get(primaryGenre(item)).push(item);
 return groups;
}
function upcomingFilms(){
 const upcoming=db.films.filter(x=>x.catalogOnly);
 const premium=x=>!!window.NovaPlayCover?.operationCover?.(x.title,false);
 return upcoming.sort((a,b)=>Number(premium(b))-Number(premium(a))||a.title.localeCompare(b.title,"pt-BR"));
}
function renderRows(){
 const holder=$("home-rows");
 if(!homeLivePreviews&&window.NPlayLivePreviews)homeLivePreviews=window.NPlayLivePreviews.create(holder,{maxParallel:4});
 homeLivePreviews?.reset();holder.replaceChildren();
 const blocks=[
 ["Continuar assistindo",continued(),"continuar",false],
 ["TV ao vivo",[...homeLiveChannels,...db.channels],"tv",true],
 ["Filmes licenciados",uploadedCatalog.filter(x=>x.mode==="licensed"&&!x.catalogOnly),"filmes",false],
 ["Sua próxima sessão",uploadedCatalog.filter(x=>x.kind==="film"&&x.mode==="r2"&&!x.catalogOnly),"filmes",false],
 ["Séries para acompanhar",uploadedCatalog.filter(x=>x.kind==="series"&&!x.catalogOnly),"series",false],
 ["Seleção YouTube",youtubeFilms(),"youtube",false],
 ["Animes e estreias · Em breve",upcomingFilms(),"em-breve",false],
 ...genreOrder.filter(name=>name!=="Não classificados")
  .map(name=>[name,genreGroups().get(name),"genero:"+name,false]).filter(b=>b[1].length>=3),
 ["Ainda sem gênero",genreGroups().get("Não classificados").slice(0,80),"genero:Não classificados",false],
 ["Minha lista",all.filter(x=>favorite.has(x.id)),"favoritos",false]
 ];
 blocks.forEach(b=>{
  const items=b[1].slice(0,36),row=shelf(b[0],items,b[2],b[3]);if(!row)return;holder.append(row);
  if(!b[3]||!homeLivePreviews)return;
  const cards=row.querySelectorAll(".poster-card");
  items.forEach((item,index)=>{
   if(item.mode!=="hls"||!item.src)return;
   const card=cards[index],cover=card?.querySelector(".cover");if(!cover)return;
   const sound=document.createElement("button");sound.type="button";sound.className="nplay-live-sound";sound.hidden=true;cover.append(sound);
   homeLivePreviews.register({card,cover,sound,url:item.src,title:item.title});
  });
 });
}
// The home shelf reuses the published live catalog; it never imports or republishes a stream.
function selectHomeLiveChannels(channels){
 const choices=[
  ["2a538992-1915-43d7-b115-bf83afe34194","Nick Online HD","#e66b18"],
  ["5ca05f1a-72f5-4925-bb91-809b99e99c3c","NTV Brazil","#224c91"],
  ["084c6066-f604-4b5c-8dec-c236ca140ec0","Comedy Central Brasil","#242a36"],
  ["27482c9d-3abf-45c8-9b95-56b3996465a5","SBT Interior SP","#173878"]
 ];
 const published=new Map((channels||[]).map(item=>[item.id,item])),seen=new Set();
 return choices.flatMap(([id,title,brandColor])=>{
  const item=published.get(id);if(!item)return [];
  let url;try{url=new URL(item.embed_url);if(url.protocol!=="https:"||url.username||url.password||seen.has(url.href))return [];}catch{return [];}
  const direct=item.stream_type==="hls"||/\.m3u8(?:\?|$)/i.test(url.href);
  if(!direct)return [];
  seen.add(url.href);
  const cover=id==="27482c9d-3abf-45c8-9b95-56b3996465a5"?"./assets/channel-logos/sbt.png":item.logo_url;
  return [{id:"live-"+id,homeLive:true,title,kind:"tv",mode:"hls",live:true,src:url.href,cover:cover||"",customLabel:cover?null:title,brandColor,category:"TV ao vivo",description:"Acompanhe a programação ao vivo dentro da NPlay."}];
 });
}
window.NPlayHomeLive={setChannels(channels){
 for(let i=all.length-1;i>=0;i--)if(all[i].homeLive){map.delete(all[i].id);all.splice(i,1);}
 homeLiveChannels=selectHomeLiveChannels(channels);
 for(const item of homeLiveChannels){all.push(item);map.set(item.id,item);}
 renderRows();
}};
const defaultFeatured=[];
let featured=defaultFeatured.map(byId).filter(Boolean);
// Admin preferences load only after the published film catalog is available.
async function loadFeatured(){
 if(!remoteDb)return;
 try{
  const {data,error}=await remoteDb.from("novaplay_featured")
   .select("film_ids,youtube_featured_id").eq("id",1).maybeSingle();
  if(error)throw error;
  youtubeFeaturedId=data?.youtube_featured_id?"upload-"+data.youtube_featured_id:null;
  const films=(Array.isArray(data?.film_ids)?data.film_ids:defaultFeatured)
   .map(id=>byId(id)).filter(x=>x&&(x.kind==="film"||x.kind==="series")&&!x.catalogOnly).slice(0,6);
  featured=films.length?films:uploadedCatalog.filter(x=>(x.kind==="film"||x.kind==="series")&&!x.catalogOnly).slice(0,6);
  updateHero(0);
 }catch(e){console.warn("NPlay: destaques personalizados indisponíveis.",e.message)}
}

function stopHeroPreview(){
 previewSequence++;
 clearTimeout(previewTimer);previewTimer=null;
 if(previewHls){previewHls.destroy();previewHls=null}
 const video=$("hero-preview-video");
 video.pause();video.removeAttribute("src");video.load();
 video.hidden=true;video.onerror=null;
 const frame=$("hero-preview-frame");frame.src="about:blank";frame.hidden=true;
 $("hero-preview-panel").hidden=true;
 $("hero-preview-feedback").textContent="";
}
async function openHeroPreview(item){
 window.NovaPlayHeroScenes?.stop?.();window.NPlayHeroLive?.stop?.();
 if(!item||item.catalogOnly){toast("Este título ainda não tem um vídeo para prévia.");return}
 stopHeroPreview();
 const seq=previewSequence;
 const media=item.kind==="series"?item.episodes?.[0]:item;
 if(!media){toast("Não há vídeo disponível para esta prévia.");return}
 const panel=$("hero-preview-panel"),message=$("hero-preview-feedback");
 panel.hidden=false;$("hero-preview-heading").textContent=item.title;
 message.textContent="Preparando prévia com áudio...";
 const video=$("hero-preview-video"),frame=$("hero-preview-frame");
 const timeout=()=>{
  if(seq!==previewSequence||panel.hidden)return;
  stopHeroPreview();toast("Prévia encerrada após 30 segundos.");
 };
 const beginTimer=()=>{previewTimer=setTimeout(timeout,30000)};
 if(media.youtube_id){
  const id=media.youtube_id;
  if(!/^[a-zA-Z0-9_-]{11}$/.test(id)){message.textContent="Link do YouTube inválido";return}
  video.hidden=true;frame.hidden=false;
  frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(id)+"?autoplay=1&playsinline=1&rel=0&mute=0";
  message.textContent="Toque em ▶ no player se o navegador pedir para ativar o som.";
  beginTimer();
 }else if(media.google_drive_id){
  const id=media.google_drive_id,key=media.google_drive_resource_key;
  if(!/^[A-Za-z0-9_-]{12,128}$/.test(id)||(key&&!/^[A-Za-z0-9_-]{8,256}$/.test(key))){
   message.textContent="Link do Google Drive inválido";return;
  }
  video.hidden=true;frame.hidden=false;
  frame.src="https://drive.google.com/file/d/"+encodeURIComponent(id)+"/preview"+(key?"?resourcekey="+encodeURIComponent(key):"");
  message.textContent="Google Drive: toque em ▶ no player para iniciar o vídeo com áudio.";
  beginTimer();
 }else{
  video.hidden=false;frame.hidden=true;video.muted=false;video.volume=1;
  let source=media.licensed_stream_url||media.src;
  if(media.video_path){
   if(!remoteDb){message.textContent="Serviço de vídeos indisponível";return}
   const response=await remoteDb.storage.from("novaplay-videos").createSignedUrl(media.video_path,120);
   if(seq!==previewSequence||panel.hidden)return;
   if(response.error||!response.data?.signedUrl){message.textContent="Prévia indisponível neste momento.";return}
   source=response.data.signedUrl;
  }
  if(!source){message.textContent="Não há arquivo disponível para prévia.";return}
  if(/\.m3u8(?:\?|$)/i.test(source)&&!video.canPlayType("application/vnd.apple.mpegurl")&&window.Hls?.isSupported()){
   previewHls=new window.Hls({enableWorker:true,maxBufferLength:12});
   previewHls.loadSource(source);previewHls.attachMedia(video);
  }else video.src=source;
  video.onerror=()=>{if(seq===previewSequence)message.textContent="Não foi possível carregar o vídeo deste provedor."};
  video.onplaying=()=>{if(seq===previewSequence)message.textContent="▶ Prévia com áudio · até 30 segundos"};
  video.play().catch(()=>{
   if(seq===previewSequence)message.textContent="Toque em ▶ no próprio vídeo para ouvir a prévia.";
  });
  beginTimer();
 }
}
function updateHero(index){
 stopHeroPreview();
 if(window.NPlayHeroLive)return;
 if(!featured.length)return;
 featuredIndex=(index+featured.length)%featured.length;const x=featured[featuredIndex];
 $("hero-art").style.backgroundImage="url('"+(x.backdrop||x.cover).replace(/'/g,"%27")+"')";
 $("hero-title").textContent=x.title;
 const normalizedTitle=String(x.title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
 const editorialGenres={
  "a era do gelo 4":["Aventura","Comédia"],
  "a familia do futuro":["Ficção científica","Aventura"],
  "a grande familia o roubo":["Humor"],
  "a fantastica fabrica de chocolate":["Fantasia","Família"],
  "a pequena polegar":["Fantasia","Família"]
 };
 const extras=editorialGenres[normalizedTitle]||[];
 const format=normalizedTitle==="a grande familia o roubo"?"Especial":x.kind==="series"?"Série":"Filme";
 $("hero-genre").textContent=x.kind==="series"?"SÉRIE EM DESTAQUE":"DESTAQUE DO CATÁLOGO";
 $("hero-description").textContent=x.description||"Conheça esta história e descubra por que ela merece um lugar na sua lista.";
 const wrap=$("hero-metadata");wrap.replaceChildren();
 const facts=[format,x.category&&!/^(autoral|importado|outros|sem gênero)$/i.test(x.category)?x.category:null,...extras,x.year,
   x.duration&&!/^(produção independente|em breve|clássico)$/i.test(x.duration)?x.duration:null];
 for(const fact of facts.filter(Boolean)){
  const span=document.createElement("span");span.textContent=String(fact);wrap.append(span);
 }
 $("hero-play").onclick=()=>startWatching(x);
 $("hero-preview-open").onclick=()=>openHeroPreview(x);
 $("hero-info").onclick=()=>openDetails(x);
 const dots=$("hero-dots");dots.replaceChildren();
 featured.forEach((film,i)=>{const b=document.createElement("button");b.className="hero-dot"+(i===featuredIndex?" active":"");b.setAttribute("aria-label","Destacar "+film.title);b.addEventListener("click",()=>updateHero(i));dots.append(b)});
 window.NovaPlayHeroScenes?.show?.(x);
}
function youtubeFilms(){return window.NPlayYouTube.select(db.films)}
let selectedYouTubeCategory="Todos",youtubeFeaturedId=null;
function renderYouTubeSelection(content,list){
 content.className="category-grid youtube-selection";
 content.replaceChildren();
 const core=window.NPlayYouTube;
 const filters=document.createElement("div");filters.className="youtube-filters";
 filters.setAttribute("role","group");filters.setAttribute("aria-label","Categorias do YouTube");
 for(const name of ["Todos",...core.categories]){
  const count=name==="Todos"?list.length:list.filter(item=>core.category(item)===name).length;
  const button=document.createElement("button");button.type="button";
  button.className="genre-chip"+(selectedYouTubeCategory===name?" active":"");
  button.textContent=name+" ("+count+")";button.setAttribute("aria-pressed",String(selectedYouTubeCategory===name));
  button.onclick=()=>{selectedYouTubeCategory=name;renderYouTubeSelection(content,list)};
  filters.append(button);
 }
 content.append(filters);
 const visible=selectedYouTubeCategory==="Todos"?list:list.filter(item=>core.category(item)===selectedYouTubeCategory);
 const count=document.createElement("p");count.className="youtube-count";count.setAttribute("role","status");count.textContent=visible.length+" vídeo"+(visible.length===1?"":"s")+" na seleção";content.append(count);
 if(!visible.length){content.append(empty("Nenhum vídeo nesta categoria","Os vídeos cadastrados no painel aparecerão aqui conforme o gênero escolhido."));return;}
 const featured=visible.find(item=>item.id===youtubeFeaturedId)||visible[0];
 const hero=document.createElement("section");hero.className="youtube-feature";hero.setAttribute("aria-label","Vídeo em destaque");
 hero.innerHTML='<img decoding="async" src="'+escapeText(featured.cover)+'" alt=""><div class="youtube-feature-copy"><span class="youtube-eyebrow">EM DESTAQUE · '+escapeText(core.category(featured))+'</span><h2>'+escapeText(featured.title)+'</h2><p>'+escapeText(core.channel(featured))+' · '+escapeText(featured.duration)+'</p><div class="youtube-feature-actions"><button type="button" class="btn btn-primary youtube-feature-play">'+icon("play")+' Assistir</button><button type="button" class="btn btn-secondary youtube-feature-details">Detalhes</button></div></div>';
 hero.querySelector(".youtube-feature-play").onclick=()=>startWatching(featured);
 hero.querySelector(".youtube-feature-details").onclick=()=>openDetails(featured);
 content.append(hero);
 for(const name of core.categories){
  const items=visible.filter(item=>core.category(item)===name);
  const row=shelf(name,items,"continuar");if(row)content.append(row);
 }
}
const categories={
 musica:["MÚSICA · NPLAY","Música","Canais musicais ao vivo para ouvir e assistir. Escolha seu canal e dê o play.",[]],
 tv:["TV AO VIVO","TV ao vivo","Encontre seus canais por nome, categoria ou região.",db.channels],
 filmes:["NOSSO ACERVO","Filmes","Filmes com áudio em português.",db.films.filter(x=>x.mode!=="youtube")],
 youtube:["YOUTUBE · NPLAY","Seleção YouTube","Filmes, documentários e boas histórias para descobrir. Escolha uma categoria e assista pelo player oficial do YouTube.",[]],
 "em-breve":["LANÇAMENTOS · NPLAY","Em breve","Prévias de animes e filmes anunciados. Estes títulos ainda não têm vídeo autorizado para reprodução.",[]],
 series:["CAPÍTULO POR CAPÍTULO","Séries","Escolha uma série com áudio em português.",db.series],
 favoritos:["SUA SELEÇÃO","Minha lista","Tudo o que você marcou como favorito.",[]]
};
function renderCategory(kind){
 const conf=categories[kind]||categories.filmes;
 $("category-kicker").textContent=conf[0];$("category-heading").textContent=conf[1];$("category-subtitle").textContent=conf[2];
 const content=$("category-grid");content.className="category-grid";content.replaceChildren();
 let list=kind==="series"?db.series:kind==="favoritos"?all.filter(x=>favorite.has(x.id)):kind==="youtube"?youtubeFilms():kind==="em-breve"?upcomingFilms():conf[3];
 if(kind==="tv")window.dispatchEvent(new Event("nplay:tv-open"));
 if(kind==="musica")window.dispatchEvent(new Event("nplay:music-open"));
 const filters=$("genre-filter-panel"),buttons=$("genre-filter-buttons");
 filters.hidden=kind!=="filmes";
 if(kind==="filmes"){
  buttons.replaceChildren();
  const groups=genreGroups();
  for(const name of ["Todos",...genreOrder.filter(name=>groups.get(name).length)]){
   const count=name==="Todos"?uploadedCatalog.filter(x=>x.kind==="film"&&!x.catalogOnly&&x.mode!=="youtube").length:groups.get(name).length;
   const b=document.createElement("button");b.type="button";
   b.className="genre-chip"+(selectedGenre===name?" active":"");
   b.setAttribute("aria-pressed",String(selectedGenre===name));
   b.textContent=name+" ("+count+")";
   b.onclick=()=>{selectedGenre=name;renderCategory("filmes")};
   buttons.append(b);
  }
  list=selectedGenre==="Todos"?uploadedCatalog.filter(x=>x.kind==="film"&&!x.catalogOnly&&x.mode!=="youtube"):groups.get(selectedGenre)||[];
  $("category-heading").textContent=selectedGenre==="Todos"?"Filmes por gênero":selectedGenre;
  $("genre-filter-count").textContent=list.length+" título"+(list.length===1?"":"s")+" nesta categoria";
 }
 content.hidden=kind==="tv"||kind==="musica";
 if(kind==="musica"||kind==="tv")return;
 if(kind==="youtube"){renderYouTubeSelection(content,list);return;}
 if(!list.length)content.append(empty("Nenhum título nesta categoria","Selecione outro gênero ou classifique títulos no painel administrativo."));
 else list.forEach(item=>content.append(card(item,item.kind==="tv")));
}
let searchKind="Tudo";
const recentSearchKey="nplay-recent-searches-v1";
function rememberSearch(){const q=$("search-input").value.trim().slice(0,100);if(!q)return;const old=read(recentSearchKey,[]);save(recentSearchKey,[q,...(Array.isArray(old)?old:[]).filter(x=>x!==q)].slice(0,6));}
function renderSearch(){
 const q=searchText($("search-input").value.trim()),results=$("search-results");results.replaceChildren();
 const filters=document.createElement("div");filters.className="search-filters";filters.setAttribute("aria-label","Tipo de conteúdo");
 for(const kind of ["Tudo","Filmes","Séries","TV","YouTube"]){const b=document.createElement("button");b.type="button";b.className="genre-chip"+(searchKind===kind?" active":"");b.textContent=kind;b.setAttribute("aria-pressed",String(searchKind===kind));b.onclick=()=>{searchKind=kind;renderSearch()};filters.append(b);}
 results.append(filters);
 if(!q){
  $("search-summary").textContent="O que você quer assistir hoje?";
  const intro=document.createElement("div");intro.className="search-discover";
  for(const [page,label] of [["filmes","Explorar filmes"],["series","Explorar séries"],["tv","TV ao vivo"],["youtube","Seleção YouTube"]]){const b=document.createElement("button");b.type="button";b.textContent=label;b.onclick=()=>navigate(page);intro.append(b);}
  results.append(intro);
  const recent=read(recentSearchKey,[]);
  if(Array.isArray(recent)&&recent.length){const panel=document.createElement("div");panel.className="search-recent";const h=document.createElement("h2");h.textContent="Buscas recentes";panel.append(h);for(const term of recent.filter(x=>typeof x==="string")){const b=document.createElement("button");b.type="button";b.className="genre-chip";b.textContent=term;b.onclick=()=>{$("search-input").value=term;renderSearch()};panel.append(b);}const clear=document.createElement("button");clear.type="button";clear.className="genre-chip";clear.textContent="Limpar histórico";clear.onclick=()=>{save(recentSearchKey,[]);renderSearch()};panel.append(clear);results.append(panel);}return;
 }
 const list=all.filter(x=>(searchKind==="Tudo"||searchKind==="Filmes"&&x.kind==="film"&&x.mode!=="youtube"||searchKind==="Séries"&&x.kind==="series"||searchKind==="TV"&&x.kind==="tv"||searchKind==="YouTube"&&x.mode==="youtube")&&searchText(x.title+" "+x.description+" "+x.category+" "+(x.year||"")).includes(q));
 $("search-summary").textContent=list.length+" resultado"+(list.length===1?"":"s")+" para “"+q.slice(0,70)+"”";
 if(!list.length)results.append(empty("Nenhum título encontrado","Tente outro nome, gênero ou ano."));else list.forEach(x=>results.append(card(x,x.kind==="tv")));
}
$("search-input").addEventListener("keydown",event=>{if(event.key==="Enter"){rememberSearch();renderSearch();}});
function navigate(page){
 window.NovaPlayHeroScenes?.stop?.();window.NPlayHeroLive?.stop?.();
 window.NovaPlayHover?.close?.();
 stopHeroPreview();
 const genreLink=typeof page==="string"&&page.startsWith("genero:");
 if(genreLink)selectedGenre=page.slice("genero:".length);
 else if(page==="filmes"&&view!=="filmes")selectedGenre="Todos";
 const chosen=genreLink?"filmes":page==="buscar"?"buscar":(categories[page]?page:"inicio");
 view=chosen;
 $("view-home").hidden=chosen!=="inicio";
 $("view-category").hidden=chosen==="inicio"||chosen==="buscar";
 $("view-search").hidden=chosen!=="buscar";
 const embeddedPanel=$("iframe-channels-panel");if(embeddedPanel)embeddedPanel.hidden=chosen!=="tv"&&chosen!=="musica";
 document.querySelectorAll("[data-nav]").forEach(b=>{const yes=b.dataset.nav===chosen;b.classList.toggle("active",yes);if(yes)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
 if(chosen==="inicio"){renderRows();updateHero(featuredIndex)}
 else if(chosen==="buscar"){renderSearch();setTimeout(()=>$("search-input").focus(),100)}
 else renderCategory(chosen);
 window.scrollTo({top:0,behavior:"instant"});
 if(location.hash!=="#"+chosen)history.replaceState(null,"","#"+chosen);
 if(chosen==="inicio")window.NPlayHeroLive?.sync?.();
}
function refreshFavoriteButton(){
 const btn=$("detail-favorite");if(!selected)return;
 btn.innerHTML=icon(favorite.has(selected.id)?"check":"plus")+" <span>"+escapeText(favLabel(selected))+"</span>";
}
/* Pluto TV e emissoras sem stream autorizado abrem o site oficial.
   Nenhum URL interno ou HLS de terceiros é extraído da plataforma. */
function openOfficialChannel(item){
 const url=item?.sourcePage;
 if(!/^https:\/\//i.test(url||"")){toast("Link oficial indisponível.");return}
 window.open(url,"_blank","noopener,noreferrer");
}
function startWatching(item){
 if(!item)return;
 if(item.liveRecord){window.dispatchEvent(new CustomEvent("nplay:channel-play",{detail:item.liveRecord}));return;}
 if(item.kind==="tv"&&item.mode==="external"){
  openOfficialChannel(item);return;
 }
 if(item.catalogOnly){toast("Este título está na grade como Em breve. O vídeo ainda não foi cadastrado.");return;}
 if(item.kind==="series"){
  const episode=item.episodes?.find(e=>progressItem(e.id))||item.episodes?.[0];
  if(!episode){toast("Essa série ainda não tem episódios disponíveis");return}
  play(item,episode);
 }else play(item);
}
function openDetails(item){
 window.NovaPlayHeroScenes?.stop?.();window.NPlayHeroLive?.stop?.();
 window.NovaPlayHover?.close?.();
 stopHeroPreview();
 if(!item)return;selected=item;
 registerCatalogInterest(item,"detail_open");
 $("detail-type").textContent=item.kind==="tv"&&item.mode==="external"?"CANAL GRÁTIS · SITE OFICIAL":item.catalogOnly?(item.category==="Anime · Série"?"ANIME / SÉRIE · EM BREVE":"ANIME / FILME · EM BREVE"):item.kind==="tv"?"● TV ABERTA":item.kind==="series"?"SÉRIE":item.mode==="youtube"?"FILME · YOUTUBE":"FILME";
 $("detail-title").textContent=item.title;
 $("detail-meta").textContent=[item.year,item.duration,item.category].filter(Boolean).join("  •  ");
 $("detail-description").textContent=item.description;
 $("detail-image").src=item.kind==="tv"?item.cover:(item.backdrop||item.cover);
 $("detail-image").alt="Arte ilustrativa de "+item.title;
 $("detail-play-label").textContent=item.kind==="tv"&&item.mode==="external"?"Abrir no site oficial ↗":item.kind==="tv"?"Assistir ao vivo":item.kind==="series"?"Assistir à série":"Assistir filme";
 $("detail-play").hidden=!!item.catalogOnly;
 $("detail-preview-play").hidden=!!item.catalogOnly;
 $("detail-play").onclick=()=>startWatching(item);
 $("detail-preview-play").onclick=()=>startWatching(item);
 refreshFavoriteButton();
 $("detail-favorite").onclick=()=>toggleFavorite(item);
 const section=$("episode-section"),list=$("episode-list");list.replaceChildren();
 section.hidden=item.kind!=="series";
 if(item.kind==="series"){
   item.episodes.forEach((ep,i)=>{
     const btn=document.createElement("button");btn.type="button";btn.className="episode";
     const extra=progressItem(ep.id);const extraText=extra?" • Continuar em "+Math.floor(extra.position/60)+" min":"";
     btn.innerHTML='<img class="episode-image" src="'+escapeText(item.cover)+'" alt=""><span class="episode-data"><strong>'+escapeText(ep.label)+'</strong><span>'+escapeText(ep.duration||"Clássico")+' • Arquivo histórico'+escapeText(extraText)+'</span></span><span class="episode-arrow">'+icon("play")+'</span>';
     btn.onclick=()=>play(item,ep);list.append(btn)
   });
 }
 $("detail-layer").hidden=false;document.body.classList.add("modal-open");
 setTimeout(()=>$("close-details").focus(),0);
}
function closeDetails(){
 $("detail-layer").hidden=true;selected=null;
 if($("player-layer").hidden)document.body.classList.remove("modal-open");
}
function syncLandscape(){
 const layer=$("player-layer");
 if(layer.hidden){layer.classList.remove("force-landscape");return}
 const portrait=window.innerHeight>window.innerWidth;
 layer.classList.toggle("force-landscape",portrait);
}
function enterCinema(){
 const layer=$("player-layer");
 const session=++cinemaSession;
 layer.classList.add("cinema");fullscreenOwned=false;closingFullscreen=false;
 syncLandscape();
 // Fullscreen ocorre somente em resposta à ação da pessoa.
 const enter=layer.requestFullscreen?.bind(layer)||layer.webkitRequestFullscreen?.bind(layer);
 if(!enter)return;
 try{
  const result=enter({navigationUI:"hide"});
  Promise.resolve(result).then(()=>{
   // Se o filme já foi fechado, desfazer uma solicitação atrasada.
   if(session!==cinemaSession||playerClosing||layer.hidden){
    if(document.fullscreenElement===layer||document.webkitFullscreenElement===layer){
     try{Promise.resolve(document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen?.()).catch(()=>{})}catch(e){}
    }
    return;
   }
   fullscreenOwned=!!(document.fullscreenElement===layer||document.webkitFullscreenElement===layer);
   if(fullscreenOwned&&screen.orientation&&typeof screen.orientation.lock==="function"){
    try{
     Promise.resolve(screen.orientation.lock("landscape")).then(()=>{
      if(session!==cinemaSession||playerClosing||layer.hidden){
       try{screen.orientation.unlock?.()}catch(e){}
       return;
      }
      lockedLandscape=true;syncLandscape();
     }).catch(()=>{if(session===cinemaSession)syncLandscape()});
    }catch(e){syncLandscape()}
   }else syncLandscape();
  }).catch(()=>{if(session===cinemaSession)syncLandscape()});
 }catch(e){syncLandscape()}
}
function leaveCinema(skipFullscreen=false){
 const layer=$("player-layer");
 if(lockedLandscape&&screen.orientation&&typeof screen.orientation.unlock==="function"){
  try{screen.orientation.unlock()}catch(e){}
 }
 lockedLandscape=false;
 const wasFullscreen=document.fullscreenElement===layer||document.webkitFullscreenElement===layer;
 fullscreenOwned=false;
 if(skipFullscreen!==true&&wasFullscreen){
  closingFullscreen=true;
  let result;
  try{
   result=document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen?.();
  }catch(e){result=Promise.reject(e)}
  // Aguardar o navegador sair do fullscreen ANTES de ocultar a janela.
  return Promise.resolve(result).catch(()=>{}).finally(()=>{closingFullscreen=false});
 }
 closingFullscreen=false;
 return Promise.resolve();
}
document.addEventListener("fullscreenchange",()=>{
 const layer=$("player-layer"),fs=document.fullscreenElement;
 if(fs===layer){fullscreenOwned=true;syncLandscape();return}
 if(fullscreenOwned&&!layer.hidden&&!closingFullscreen){fullscreenOwned=false;layer.classList.remove("force-landscape");if(lockedLandscape){try{screen.orientation?.unlock?.()}catch(e){}lockedLandscape=false;}showCinemaUi();}
});
document.addEventListener("webkitfullscreenchange",()=>{
 const layer=$("player-layer"),fs=document.webkitFullscreenElement;
 if(fs===layer){fullscreenOwned=true;syncLandscape();return}
 if(fullscreenOwned&&!layer.hidden&&!closingFullscreen){fullscreenOwned=false;layer.classList.remove("force-landscape");if(lockedLandscape){try{screen.orientation?.unlock?.()}catch(e){}lockedLandscape=false;}showCinemaUi();}
});
window.addEventListener("resize",()=>{if(!$("player-layer").hidden)syncLandscape()});
window.addEventListener("orientationchange",()=>{if(!$("player-layer").hidden)syncLandscape()});
function asClock(seconds){
 const value=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 const hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60),secs=value%60;
 return (hours?hours+":"+String(minutes).padStart(2,"0"):String(minutes))+":"+String(secs).padStart(2,"0");
}
function updateCinemaControls(){
 const v=window.NPlayCasting?.state()||$("video");
 $("cinema-play").textContent=v.paused?"▶":"❚❚";
 $("cinema-play").setAttribute("aria-label",v.paused?"Reproduzir":"Pausar");
 $("cinema-mute").textContent=v.muted?"♪̸":"♫";
 $("cinema-mute").setAttribute("aria-label",v.muted?"Ativar áudio":"Silenciar");
 const volume=$("cinema-volume"),level=$("cinema-volume-level");
 const percent=Math.round(v.volume*100);
 if(volume)volume.value=String(percent);
 if(level)level.textContent=(v.muted?0:percent)+"%";
 const duration=v.duration;
 const seekable=Number.isFinite(duration)&&duration>0;
 $("cinema-seek").disabled=!seekable;
 $("cinema-duration").textContent=seekable?asClock(duration):(current?.item?.kind==="tv"?"AO VIVO":"Carregando…");
 if(!seekActive){
   const currentTime=seekable?Math.max(0,Math.min(duration,v.currentTime||0)):0;
   $("cinema-elapsed").textContent=asClock(currentTime);
   $("cinema-seek").value=seekable?String(currentTime/duration*100):"0";
   $("cinema-seek").style.setProperty("--played",$("cinema-seek").value+"%");
 }
}
function showCinemaUi(){
 if($("player-layer").hidden||$("player-layer").classList.contains("youtube-active")||$("player-layer").classList.contains("drive-active")||$("player-layer").classList.contains("live-embed-active"))return;
 $("player-layer").classList.remove("ui-idle");
 clearTimeout(playerUiTimer);
 if(!$("video").paused)playerUiTimer=setTimeout(()=>{
   if(!$("player-layer").hidden&&!$("video").paused)
     $("player-layer").classList.add("ui-idle");
 },4200);
}
function resetCinemaUi(){
 clearTimeout(playerUiTimer);playerUiTimer=null;seekActive=false;
 $("player-layer").classList.remove("ui-idle","youtube-active","drive-active","live-embed-active","has-player-error");
 $("cinema-controls").hidden=true;
 $("player-status").hidden=false;
 $("player-content-note").hidden=false;
}
const cinemaVideo=$("video");
cinemaVideo.addEventListener("play",()=>{updateCinemaControls();showCinemaUi()});
cinemaVideo.addEventListener("pause",()=>{updateCinemaControls();showCinemaUi()});
cinemaVideo.addEventListener("timeupdate",updateCinemaControls);
cinemaVideo.addEventListener("durationchange",updateCinemaControls);
cinemaVideo.addEventListener("volumechange",updateCinemaControls);
cinemaVideo.addEventListener("loadedmetadata",updateCinemaControls);
cinemaVideo.addEventListener("pointerdown",()=>showCinemaUi());
$("player-layer").addEventListener("pointermove",e=>{
 if(!$("player-layer").classList.contains("youtube-active")&&!$("player-layer").classList.contains("drive-active"))showCinemaUi();
});
$("cinema-play").onclick=()=>{
 if(window.NPlayCasting?.command("toggle")){updateCinemaControls();showCinemaUi();return;}
 const v=$("video");if(v.paused)v.play().catch(()=>showCinemaUi());else v.pause();showCinemaUi()
};
$("cinema-rewind").onclick=()=>{const state=window.NPlayCasting?.state();if(state){window.NPlayCasting.command("seek",state.currentTime-10);updateCinemaControls();showCinemaUi();return;}const v=$("video");if(Number.isFinite(v.duration))v.currentTime=Math.max(0,v.currentTime-10);updateCinemaControls();showCinemaUi()};
$("cinema-forward").onclick=()=>{const state=window.NPlayCasting?.state();if(state){window.NPlayCasting.command("seek",state.currentTime+10);updateCinemaControls();showCinemaUi();return;}const v=$("video");if(Number.isFinite(v.duration))v.currentTime=Math.min(v.duration,v.currentTime+10);updateCinemaControls();showCinemaUi()};
$("cinema-mute").onclick=()=>{if(window.NPlayCasting?.command("mute")){updateCinemaControls();return;}const v=$("video");v.muted=!v.muted;if(!v.muted&&v.volume===0)v.volume=1;updateCinemaControls();showCinemaUi()};
$("cinema-volume")?.addEventListener("input",e=>{
 const v=$("video"),value=Number(e.target.value);
 if(!Number.isFinite(value))return;
 if(window.NPlayCasting?.command("volume",value/100)){updateCinemaControls();return;}
 v.volume=Math.max(0,Math.min(100,value))/100;v.muted=v.volume===0;
 updateCinemaControls();showCinemaUi();
});
$("cinema-seek").addEventListener("input",e=>{
 const v=window.NPlayCasting?.state()||$("video");if(!Number.isFinite(v.duration)||v.duration<=0)return;
 seekActive=true;
 e.target.style.setProperty("--played",e.target.value+"%");
 const target=v.duration*Number(e.target.value)/100;
 $("cinema-elapsed").textContent=asClock(target);
 showCinemaUi();
});
$("cinema-seek").addEventListener("change",e=>{
 const state=window.NPlayCasting?.state();
 if(state){window.NPlayCasting.command("seek",state.duration*Number(e.target.value)/100);seekActive=false;updateCinemaControls();showCinemaUi();return;}
 const v=$("video");
 if(Number.isFinite(v.duration)&&v.duration>0)v.currentTime=Math.min(v.duration,Math.max(0,v.duration*Number(e.target.value)/100));
 seekActive=false;updateCinemaControls();showCinemaUi()
});
$("cinema-fullscreen").onclick=()=>{
 const layer=$("player-layer");
 if(document.fullscreenElement===layer && document.exitFullscreen){
   document.exitFullscreen().catch(()=>{});return;
 }
 if(!document.fullscreenElement){
   try{Promise.resolve(layer.requestFullscreen({navigationUI:"hide"})).catch(()=>{})}catch(e){}
 }
 showCinemaUi();
};
function stopPlayback(){
 window.NPlayCasting?.reset();
 clearNplayShieldTimer();const started=$("nplay-live-video-started");if(started){started.hidden=true;started.disabled=false;started.textContent="Vídeo começou"}
 const shield=$("nplay-live-touch-shield"),toggle=$("nplay-live-touch-toggle");if(shield)shield.hidden=true;if(toggle)toggle.hidden=true;
 if($("player-loading"))$("player-loading").hidden=true;
 $("player-live-reload").hidden=true;
 $("player-issue-panel").hidden=true;
 $("player-issue-open").hidden=true;
 $("player-issue-feedback").textContent="";
 issueReportBusy=false;
 resetCinemaUi();
 ++attempt;clearTimeout(timer);timer=0;const video=$("video");
 video.pause();video.onerror=null;video.onplaying=null;video.onwaiting=null;video.oncanplay=null;video.onloadedmetadata=null;video.ontimeupdate=null;video.onended=null;
 if(hls){hls.destroy();hls=null}
 if(tsPlayer){tsPlayer.destroy();tsPlayer=null}
 video.removeAttribute("src");video.load();video.hidden=false;
 $("fallback-frame").src="about:blank";$("fallback-frame").hidden=true;current=null;
}
function closePlayer(skipFullscreen=false){
 const layer=$("player-layer");
 if(layer.hidden||playerClosing)return;
 playerClosing=true;
 ++cinemaSession; // Cancela solicitações de fullscreen/orientação pendentes.
 const exitTask=leaveCinema(skipFullscreen===true);
 stopPlayback();
 const finish=()=>{
  layer.classList.remove("cinema","force-landscape");
  layer.hidden=true;
  document.body.classList.remove("modal-open");
  if(!$("detail-layer").hidden)closeDetails();
  playerClosing=false;
  if(view==="inicio")renderRows();
 };
 Promise.resolve(exitTask).then(finish,finish);
}
function playerStatus(msg){
 $("player-status").textContent=msg;
 const loading=$("player-loading");
 if(loading){loading.textContent=msg;loading.hidden=!(current?.item?.kind==="tv"&&!current.item.liveEmbedUrl&&!$("player-layer").hidden&&!/reproduzindo/i.test(msg));}
}
function playbackFailed(msg,seq){
 if(seq!==attempt||$("player-layer").hidden)return;
 $("player-layer").classList.add("has-player-error");
 showCinemaUi();
 clearTimeout(timer);$("player-error").textContent=msg;
 playerStatus(current?.item?.kind==="tv"?"Não foi possível iniciar a transmissão":"Não foi possível iniciar o vídeo");
 $("retry-btn").hidden=false;$("fallback-btn").hidden=!(current&&current.item.fallbackEmbed);
}
function useFallback(){
 if(!current?.item.fallbackEmbed)return;
 const x=current.item;clearTimeout(timer);
 $("video").pause();if(hls){hls.destroy();hls=null}
 $("video").hidden=true;
 $("fallback-frame").hidden=false;
 $("fallback-frame").src=x.fallbackEmbed;
 $("fallback-btn").hidden=true;$("retry-btn").hidden=false;
 $("player-error").textContent="";
 playerStatus("Player oficial alternativo. Toque em ▶ para iniciar.");
}
/* Disparar play no primeiro clique, com fallback silencioso se houver bloqueio. */
function startAutoplay(video,seq){
 if(seq!==attempt||$("player-layer").hidden||playerClosing)return;
 const mutedFallback=()=>{
  if(seq!==attempt||$("player-layer").hidden||playerClosing)return;
  video.muted=true;
  try{
   Promise.resolve(video.play()).catch(err=>{
    if(err?.name==="NotAllowedError"&&seq===attempt&&!$("player-layer").hidden){
     playerStatus("Toque em ▶ para reproduzir: o navegador bloqueou o início automático.");
     showCinemaUi();
    }
   });
  }catch(e){playerStatus("Toque em ▶ para reproduzir.");showCinemaUi()}
 };
 try{
  Promise.resolve(video.play()).catch(err=>{
   if(seq!==attempt||$("player-layer").hidden||playerClosing)return;
   if(err?.name==="NotAllowedError")mutedFallback();
  });
 }catch(e){mutedFallback()}
}
function setResume(video,id,seq){
 if(!id)return;
 let lastSaved=0;
 video.onloadedmetadata=()=>{
   if(seq!==attempt)return;
   const x=progressItem(id);
   if(x&&video.duration&&x.position<video.duration-10){try{video.currentTime=x.position}catch(e){}}
 };
 video.ontimeupdate=()=>{
   if(seq!==attempt||video.paused||!Number.isFinite(video.duration)||video.duration<=0||!Number.isFinite(video.currentTime))return;
   const now=Date.now();if(now-lastSaved<3500)return;lastSaved=now;
   if(video.currentTime/video.duration>.96){delete progress[id]}
   else progress[id]={position:video.currentTime,duration:video.duration,updated:now};
   save(progressKey,progress);
 };
 video.onended=()=>{delete progress[id];save(progressKey,progress);if(view==="inicio")renderRows()};
}
let nplayShieldTimer=null;
function clearNplayShieldTimer(){if(nplayShieldTimer!==null){clearTimeout(nplayShieldTimer);nplayShieldTimer=null}}
function setupLiveTouchShield(){
 const frame=$("fallback-frame"),wrap=frame?.parentElement;if(!wrap)return;
 let overlay=$("nplay-live-touch-shield"),toggle=$("nplay-live-touch-toggle"),started=$("nplay-live-video-started");
 if(!overlay){
  overlay=document.createElement("div");overlay.id="nplay-live-touch-shield";
  overlay.style.cssText="position:absolute;inset:0;z-index:12;background:transparent;pointer-events:auto";
  overlay.setAttribute("aria-label","Toques bloqueados sobre o vídeo");
  wrap.style.position="relative";wrap.appendChild(overlay);
 }
 if(!toggle){
  toggle=document.createElement("button");toggle.id="nplay-live-touch-toggle";toggle.type="button";
  toggle.style.cssText="position:fixed;z-index:2147483000;right:16px;bottom:22px;padding:12px 17px;border-radius:12px;background:#2364d5;color:#fff;border:1px solid #a8c6ff;font-weight:800;cursor:pointer;box-shadow:0 4px 18px #0009";
  document.body.appendChild(toggle);
  toggle.onclick=()=>{
   clearNplayShieldTimer();
   const shield=$("nplay-live-touch-shield"),enabled=shield?.hidden;
   if(shield)shield.hidden=!enabled;
   toggle.textContent=enabled?"Liberar controles do vídeo":"Proteger tela";
   const confirm=$("nplay-live-video-started");if(confirm)confirm.hidden=true;
  };
 }
 if(!started){
  started=document.createElement("button");started.id="nplay-live-video-started";started.type="button";
  started.style.cssText="position:fixed;z-index:2147483000;left:16px;bottom:22px;padding:12px 17px;border-radius:12px;background:#152c4b;color:#fff;border:1px solid #a8c6ff;font-weight:800;cursor:pointer;box-shadow:0 4px 18px #0009";
  document.body.appendChild(started);
  started.onclick=()=>{
   clearNplayShieldTimer();started.disabled=true;started.textContent="Proteção em 5 segundos…";
   nplayShieldTimer=setTimeout(()=>{
    nplayShieldTimer=null;const shield=$("nplay-live-touch-shield"),button=$("nplay-live-touch-toggle");
    if(!$("player-layer")?.hidden&&current?.item?.liveEmbedUrl){
     if(shield)shield.hidden=false;if(button)button.textContent="Liberar controles do vídeo";
    }
    started.hidden=true;started.disabled=false;started.textContent="Vídeo começou";
   },5000);
  };
 }
 clearNplayShieldTimer();overlay.hidden=true;toggle.hidden=false;toggle.textContent="Proteger tela";
 started.hidden=false;started.disabled=false;started.textContent="Vídeo começou";
}
function openLiveEmbed(url,title){
 let source;
 try{source=new URL(url);if(source.protocol!=="https:")return false}catch{return false}
 window.NovaPlayHeroScenes?.stop?.();window.NPlayHeroLive?.stop?.();window.NovaPlayHover?.close?.();stopHeroPreview();
 $("detail-layer").hidden=true;selected=null;
 stopPlayback();
 current={item:{title:String(title||"Canal ao vivo"),kind:"tv",liveEmbedUrl:source.href},episode:null};
 const layer=$("player-layer"),frame=$("fallback-frame");
 layer.hidden=false;layer.classList.add("live-embed-active");document.body.classList.add("modal-open");
 $("video").hidden=true;$("cinema-controls").hidden=true;
 $("player-status").hidden=true;$("player-content-note").hidden=true;
 $("player-heading").textContent="AO VIVO · "+current.item.title;
 $("player-title").textContent=current.item.title;$("player-error").textContent="";
 $("retry-btn").hidden=true;$("fallback-btn").hidden=true;$("source-link").hidden=true;
 $("player-live-reload").hidden=false;
 frame.title=current.item.title;frame.setAttribute("allow","autoplay; encrypted-media; fullscreen; picture-in-picture");
 // Iframes externos não recebem permissão para abrir pop-ups ou navegar a janela principal.
 // Scripts e reprodução continuam habilitados; alguns provedores podem recusar sandbox.
 frame.removeAttribute("sandbox");
 frame.referrerPolicy="no-referrer";frame.hidden=false;frame.src=source.href;
 setupLiveTouchShield();enterCinema();$("player-close").focus();return true;
}
function openLiveHls(url,title,mode="hls",audioOnly=false){
 let source;try{source=new URL(url);if(source.protocol!=="https:"||source.username||source.password)return false}catch{return false}
 play({id:"live-"+source.href,title:String(title||"Canal ao vivo"),kind:"tv",src:source.href,mode,live:true,audioOnly});return true;
}
window.NPlayLiveCatalog={staticChannels:()=>db.channels,isFavorite:id=>favorite.has(id),toggleFavorite:id=>{const item=map.get(id);if(item)toggleFavorite(item);},setChannels(channels){
 for(let i=all.length-1;i>=0;i--)if(all[i].liveRecord){map.delete(all[i].id);all.splice(i,1);}
 for(const record of channels){const id="channel-"+record.id;const item={id,title:record.title,kind:"tv",live:true,mode:record.stream_type,category:record.category||"TV ao vivo",description:"Transmissão ao vivo · "+(record.category||"TV"),cover:record.logo_url||"",customLabel:record.logo_url?null:record.title,liveRecord:record};all.push(item);map.set(id,item);}
 if(view==="buscar")renderSearch();if(view==="favoritos")renderCategory("favoritos");
}};
window.NovaPlayPlayer={openStatic:id=>{const item=byId(id);if(!item)return false;startWatching(item);return true;},openHls:openLiveHls,openRadio:(url,title,mode)=>openLiveHls(url,title,mode==="mpegts"?"mpegts":"hls",true),openMpegts:(url,title)=>openLiveHls(url,title,"mpegts"),openEmbed:openLiveEmbed,closeEmbed:()=>{if(current?.item?.liveEmbedUrl)closePlayer()}};
$("player-live-reload").onclick=()=>{if(current?.item?.liveEmbedUrl)openLiveEmbed(current.item.liveEmbedUrl,current.item.title)};
function play(item,episode){
 if(item?.liveEmbedUrl){openLiveEmbed(item.liveEmbedUrl,item.title);return}
 if(item?.kind==="tv"&&item.mode==="external"){openOfficialChannel(item);return}
 window.NovaPlayHeroScenes?.stop?.();window.NPlayHeroLive?.stop?.();
 window.NovaPlayHover?.close?.();
 stopHeroPreview();
 if(!item)return;
 if(item.catalogOnly){toast("Este título está em breve; não há vídeo para reproduzir.");return;}
 registerCatalogInterest(episode||item,"play_attempt");
 // A camada de detalhes fecha, mas o player continua aberto.
 $("detail-layer").hidden=true;selected=null;
 stopPlayback();current={item,episode:episode||null};
 const media=episode||item;
 $("player-layer").hidden=false;document.body.classList.add("modal-open");
 const yt=!!media.youtube_id,drive=!!media.google_drive_id,externalEmbed=yt||drive;
 // Reports are accepted only for published items in our remote catalog.
 $("player-issue-open").hidden=!/^upload-[0-9a-f-]{36}$/i.test(media.id||"");
 $("player-issue-panel").hidden=true;
 $("player-layer").classList.toggle("youtube-active",yt);
 $("player-layer").classList.toggle("drive-active",drive);
 $("cinema-controls").hidden=externalEmbed;
 $("video").controls=false;
 $("video").autoplay=true;
 $("video").playsInline=true;
 $("video").preload="auto";
 $("video").muted=false;
 $("video").volume=1;
 $("player-status").hidden=externalEmbed;
 $("player-content-note").hidden=externalEmbed;
 updateCinemaControls();
 if(!externalEmbed)showCinemaUi();
 enterCinema();
 $("player-heading").textContent=item.title;
 $("player-title").textContent=episode?item.title+" · "+episode.label:item.title;
 $("player-error").textContent="";playerStatus("Preparando reprodução...");
 $("retry-btn").hidden=true;$("fallback-btn").hidden=true;
 $("source-link").href=media.sourcePage||item.sourcePage||"#";
 $("source-link").hidden=item.kind==="tv"||!(media.sourcePage||item.sourcePage);
 $("player-content-note").textContent=item.kind==="tv"
  ?"A transmissão vem diretamente da emissora. Em caso de instabilidade, toque em 'Tentar novamente'."
  :"Vídeo histórico disponibilizado por arquivo público. Algumas versões podem estar indisponíveis ou não ter áudio e legendas em português.";
 $("player-main")?.scrollTo?.(0,0);
 const v=$("video");v.hidden=false;
 const seq=++attempt;
 let src=media.licensed_stream_url||media.src;
 let hasFailed=false,networkRecoveries=0,r2ExpiresAt=0,r2Refreshing=false;
 const fail=msg=>{if(!hasFailed){hasFailed=true;playbackFailed(msg,seq)}};
 v.onerror=()=>{
  if(media.r2_object_key&&r2ExpiresAt&&Date.now()>=r2ExpiresAt-30000&&!r2Refreshing){loadR2(true);return;}
  fail(v.error?.code===3?"O navegador não conseguiu decodificar este vídeo. O arquivo precisa de uma versão compatível.":"Não foi possível carregar o vídeo. Tente novamente ou informe o problema ao administrador.");
 };
 v.onplaying=()=>{
   if(seq!==attempt)return;hasFailed=false;if(item.kind!=="tv"||item.audioOnly||v.videoWidth>0)clearTimeout(timer);
   $("player-layer").classList.remove("has-player-error");
   $("player-error").textContent="";
   $("retry-btn").hidden=true;$("fallback-btn").hidden=true;
   playerStatus(item.kind==="tv"?(item.audioOnly?"♫ AO VIVO — rádio reproduzindo":v.videoWidth>0?"● AO VIVO — reproduzindo":"Aguardando imagem da transmissão…"):"▶ Reproduzindo");
 };
 v.onwaiting=()=>{if(seq===attempt&&!hasFailed)playerStatus(item.kind==="tv"?"Aguardando dados da transmissão...":"Carregando vídeo para continuar...")};
 v.oncanplay=()=>{if(seq===attempt&&!hasFailed){if(item.kind!=="tv")clearTimeout(timer);playerStatus(v.paused?"Preparando reprodução automática...":"▶ Reproduzindo")}};
 const progressId=item.kind==="tv"?null:episode?episode.id:item.id;
 setResume(v,progressId,seq);
 if(item.kind==="tv")timer=setTimeout(()=>{if(seq===attempt&&((!item.audioOnly&&!v.videoWidth)||v.readyState<2))fail("O canal está demorando para carregar. Verifique a conexão ou tente novamente.")},22000);
 if(!media.youtube_id&&!media.google_drive_id&&!window.NPlayLiveAuth?.protectedUrl(media.src))window.NPlayCasting?.configure({
  title:episode?item.title+" · "+episode.label:item.title,live:item.kind==="tv",
  onChange:updateCinemaControls,
  onProgress(position,duration){
   if(seq!==attempt||!progressId||!Number.isFinite(duration)||duration<=0||!Number.isFinite(position))return;
   const now=Date.now();if(now-timeSaved<3500)return;timeSaved=now;
   if(position/duration>.96)delete progress[progressId];else progress[progressId]={position,duration,updated:now};save(progressKey,progress);
  },
  async getSource(){
   if(media.r2_object_key){
    const auth=(window.NPlayAccessClient||remoteDb)?.auth;
    let session=(await auth?.getSession())?.data?.session;
    if(session?.expires_at*1000<Date.now()+60000)session=(await auth.refreshSession())?.data?.session;
    if(!session?.access_token)throw Error("Sua sessão expirou. Reabra a NPlay.");
    const delivery="https://nplay-r2-api.luandersonjesussantos063.workers.dev",id=(episode?.id||item.id).replace(/^upload-/,"");
    const control=new AbortController(),deadline=setTimeout(()=>control.abort(),12000);
    try{
     const response=await fetch(delivery+"/cast/"+encodeURIComponent(id),{method:"POST",headers:{Authorization:"Bearer "+session.access_token},cache:"no-store",signal:control.signal});
     const info=await response.json();
     if(!response.ok)throw Error(info.error||"Não foi possível autorizar este vídeo na TV.");
     const target=new URL(info.url);
     if(target.origin!==delivery||target.pathname!=="/cast-media/"+id||!target.searchParams.has("ticket"))throw Error("Endereço de transmissão inválido.");
     return info;
    }finally{clearTimeout(deadline);}
   }
   const url=src||v.currentSrc;
   if(!url||url.startsWith("blob:"))throw Error("Aguarde o vídeo carregar e tente novamente.");
   return {url,content_type:/\.m3u8(?:\?|$)/i.test(url)?"application/x-mpegURL":/\.webm(?:\?|$)/i.test(url)?"video/webm":/\.ogv(?:\?|$)/i.test(url)?"video/ogg":"video/mp4"};
  },
  setNativeSource(url){
   if(seq!==attempt)return;
   const position=v.currentTime,wasPaused=v.paused;
   if(hls){hls.destroy();hls=null;}
   src=url;r2ExpiresAt=0;
   v.addEventListener("loadedmetadata",()=>{if(seq!==attempt)return;if(Number.isFinite(v.duration)&&position>0)v.currentTime=Math.min(position,v.duration);if(!wasPaused)startAutoplay(v,seq);},{once:true});
   v.src=url;v.load();
  }
 });
 function startSource(){
  if(seq!==attempt)return;
  if(!src){fail("Não foi possível localizar o arquivo de vídeo.");return}
  if(media.mode==="mpegts"){
   if(!window.mpegts?.isSupported()){fail("Este navegador não suporta este sinal ao vivo. Use uma versão atual do Chrome ou Edge.");return;}
   tsPlayer=window.mpegts.createPlayer({type:"mpegts",isLive:true,url:src},{enableWorker:true,lazyLoad:false});
   tsPlayer.on(window.mpegts.Events.ERROR,()=>fail("Não foi possível receber o sinal. Tente novamente ou avise o administrador."));
   tsPlayer.attachMediaElement(v);tsPlayer.load();startAutoplay(v,seq);
  }else if(media.mode==="hls"||/\.m3u8?(?:\?|$)/i.test(src)){
    const nativeHls=v.canPlayType("application/vnd.apple.mpegurl");
    const managedHls=window.Hls&&window.Hls.isSupported();
    if(nativeHls&&!(item.kind==="tv"&&managedHls)){
      v.src=src;startAutoplay(v,seq);
    }else if(window.Hls&&window.Hls.isSupported()){
      hls=new window.Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:item.kind==="tv"?20:60,maxMaxBufferLength:180,maxBufferSize:64*1024*1024,backBufferLength:30,startLevel:0,capLevelToPlayerSize:true,abrEwmaDefaultEstimate:400000});
      hls.on(window.Hls.Events.ERROR,(event,data)=>{
        if(seq!==attempt||!data.fatal)return;
        if(item.kind==="tv"&&nativeHls&&data.type===window.Hls.ErrorTypes.NETWORK_ERROR){
          hls.destroy();hls=null;playerStatus("Tentando o modo de reprodução do navegador…");
          v.src=src;startAutoplay(v,seq);return;
        }
        if(media.r2_object_key&&data.type===window.Hls.ErrorTypes.NETWORK_ERROR&&r2ExpiresAt&&Date.now()>=r2ExpiresAt-30000&&!r2Refreshing){loadR2(true);return;}
        if(data.type===window.Hls.ErrorTypes.NETWORK_ERROR&&networkRecoveries++<3){playerStatus("Reconectando e carregando vídeo...");hls.startLoad();return}
        if(data.type===window.Hls.ErrorTypes.MEDIA_ERROR){try{hls.recoverMediaError();return}catch(e){}}
        fail("A transmissão interrompeu. Toque em Tentar novamente.");
      });
      hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{if(seq===attempt)startAutoplay(v,seq)});
      hls.attachMedia(v);hls.loadSource(src);
    }else fail("Este navegador não carregou o suporte a HLS.");
  }else{
    v.src=src;
    startAutoplay(v,seq);
  }
 }
 async function loadR2(resume=false){
  if(r2Refreshing||seq!==attempt)return;r2Refreshing=true;
  const position=resume?v.currentTime:0;
  playerStatus(resume?"Renovando sessão de reprodução…":"Preparando seu vídeo…");
  const delivery="https://nplay-r2-api.luandersonjesussantos063.workers.dev",id=encodeURIComponent((episode?.id||item.id).replace(/^upload-/,""));
  const control=new AbortController(),deadline=setTimeout(()=>control.abort(),12000);
  try{
   const auth=(window.NPlayAccessClient||remoteDb)?.auth;
   let result=await auth?.getSession(),session=result?.data?.session;
   if(session?.expires_at*1000<Date.now()+60000){result=await auth.refreshSession();session=result?.data?.session;}
   if(!session?.access_token)throw Error("Sua sessão expirou. Reabra a NPlay para entrar novamente.");
   const response=await fetch(delivery+"/playback/"+id,{signal:control.signal,headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const info=await response.json();
   if(!response.ok)throw Error(response.status===401?"Sua sessão expirou. Reabra a NPlay para entrar novamente.":response.status===404?"Este dispositivo não tem acesso ao vídeo ou o conteúdo não está disponível.":"O serviço de vídeo está indisponível. Tente novamente.");
   const url=new URL(info.url);
   if(url.origin!==delivery||!(url.pathname.startsWith("/hls/"+id+"/")||url.pathname==="/watch/"+id))throw Error("O serviço retornou um endereço de vídeo inválido.");
   url.searchParams.set("access_token",session.access_token);
   if(seq!==attempt)return;
   src=url.href;r2ExpiresAt=session.expires_at*1000;hasFailed=false;
   if(hls){hls.destroy();hls=null;}
   if(position>0)v.addEventListener("loadedmetadata",()=>{if(seq===attempt)try{v.currentTime=position}catch{}},{once:true});
   startSource();
  }catch(error){if(seq===attempt)fail(error.name==="AbortError"?"O serviço de vídeo demorou para responder. Tente novamente.":error.message);}
  finally{clearTimeout(deadline);r2Refreshing=false;}
 }
 if(media.youtube_id){
  // The official YouTube player runs INSIDE NPlay; do not bypass YouTube's restrictions.
  const id=media.youtube_id;
  if(!/^[A-Za-z0-9_-]{11}$/.test(id)){fail("Endereço do vídeo inválido.");return}
  v.pause();v.hidden=true;
  const frame=$("fallback-frame");frame.hidden=false;
  // A sessão foi aberta por um clique: pedir reprodução com áudio.
  // Se o navegador bloquear autoplay, o play oficial continua disponível.
  frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(id)+"?autoplay=1&mute=0&controls=1&playsinline=1&rel=0";
  $("retry-btn").hidden=true;$("fallback-btn").hidden=true;
  // Evita o aviso permanente por cima da imagem. O player oficial
  // continua com seus próprios controles, marca e regras de exibição.
  $("player-status").textContent="";
  $("player-content-note").textContent="";
 }else if(media.google_drive_id){
  // Google Drive's own file preview player; never attempt to extract or proxy streams.
  const id=media.google_drive_id;
  const key=media.google_drive_resource_key;
  if(!/^[A-Za-z0-9_-]{12,128}$/.test(id) || (key&&!/^[A-Za-z0-9_-]{8,256}$/.test(key))){
    fail("Link do Google Drive inválido.");return;
  }
  v.pause();v.hidden=true;
  const frame=$("fallback-frame");frame.hidden=false;
  const params=new URLSearchParams();
  if(key)params.set("resourcekey",key);
  // Best effort: o player externo do Google Drive pode ignorar autoplay.
  params.set("autoplay","1");
  frame.src="https://drive.google.com/file/d/"+encodeURIComponent(id)+"/preview?"+params.toString();
  $("retry-btn").hidden=true;$("fallback-btn").hidden=true;
  // The Google preview stays embedded; don't overlay the movie with a warning.
  $("player-status").textContent="";
  $("player-content-note").textContent="";
 }else if(media.r2_object_key){
  loadR2();
 }else if(media.video_path){
  if(!remoteDb){fail("Serviço de mídia indisponível. Recarregue a página.");return}
  playerStatus("Preparando vídeo publicado...");
  remoteDb.storage.from("novaplay-videos").createSignedUrl(media.video_path,7200).then(({data,error})=>{
    if(seq!==attempt)return;
    if(error||!data?.signedUrl){fail("Este vídeo não está liberado para reprodução. Tente novamente mais tarde.");return}
    src=data.signedUrl;startSource();
  }).catch(()=>{if(seq===attempt)fail("Não foi possível conectar ao armazenamento do vídeo.")});
 }else startSource();
 // No extra focus change or intermediate details screen: playback opens immediately.
}

function openPlaybackIssue(){
 if(!current||$("player-issue-open").hidden)return;
 $("player-issue-panel").hidden=false;
 $("player-issue-feedback").textContent="";
 $("player-issue-report").disabled=issueReportBusy;
}
async function reportPlaybackIssue(){
 if(issueReportBusy||!current||!remoteDb)return;
 const item=current.episode||current.item;
 const id=String(item.id||"").match(/^upload-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
 if(!id){$("player-issue-feedback").textContent="Este conteúdo não pode ser reportado aqui.";return}
 issueReportBusy=true;
 $("player-issue-report").disabled=true;
 $("player-issue-feedback").textContent="Enviando aviso...";
 try{
  const {data,error}=await remoteDb.rpc("novaplay_report_playback_problem",{p_item_id:id});
  if(error||data!==true)throw error||new Error("Erro de envio");
  $("player-issue-feedback").textContent="✓ Aviso enviado. O administrador poderá verificar ou substituir o link. Obrigado!";
 }catch(e){
  issueReportBusy=false;
  $("player-issue-report").disabled=false;
  $("player-issue-feedback").textContent="Não foi possível enviar o aviso. Tente novamente mais tarde.";
 }
}
$("player-issue-open").onclick=openPlaybackIssue;
$("player-issue-report").onclick=reportPlaybackIssue;
$("player-issue-dismiss").onclick=()=>{$("player-issue-panel").hidden=true};
$("player-issue-retry").onclick=()=>{if(current)play(current.item,current.episode)};

$("hero-preview-close").onclick=stopHeroPreview;
$("player-back").onclick=()=>closePlayer();$("player-close").onclick=()=>closePlayer();
$("retry-btn").onclick=()=>{if(current)play(current.item,current.episode)};
$("fallback-btn").onclick=useFallback;
$("close-details").onclick=closeDetails;
 $("detail-back").onclick=closeDetails;
document.querySelectorAll("[data-close='details']").forEach(x=>x.addEventListener("click",closeDetails));
$("search-trigger").onclick=()=>navigate("buscar");

$("search-input").addEventListener("input",renderSearch);
$("brand-link").addEventListener("click",e=>{e.preventDefault();navigate("inicio")});
document.querySelectorAll("[data-nav]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.nav)));
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"){
   if(!$("player-issue-panel").hidden)$("player-issue-panel").hidden=true;
   else if(!$("hero-preview-panel").hidden)stopHeroPreview();
   else if(!$("player-layer").hidden)closePlayer();
   else if(!$("detail-layer").hidden)closeDetails();
 }
});
document.addEventListener("visibilitychange",()=>{if(document.hidden){stopHeroPreview();if(!$("player-layer").hidden)$("video").pause()}});
window.addEventListener("scroll",()=>$("app-header").classList.toggle("is-scrolled",window.scrollY>24),{passive:true});
if("serviceWorker" in navigator&&location.protocol==="https:"){
 window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=0.49.25",{updateViaCache:"none"}).catch(()=>{}));
}
$("hero-play").onclick=()=>navigate("tv");
$("hero-info").onclick=()=>navigate("filmes");
navigate((location.hash||"").slice(1)||"inicio");
loadUploadedCatalog();
})();
