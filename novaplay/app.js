/* NPlay v0.12.0 • player, catálogo e experiência de streaming */
(function(){
"use strict";
const db=window.NovaPlayCatalog;
const remoteDb=window.supabase?.createClient?.("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3",{auth:{persistSession:false,autoRefreshToken:false}});
let uploadedCatalog=[];
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
const favorite=new Set((read(favKey,[])).filter(x=>map.has(x)));
let progress=read(progressKey,{});
if(!progress||typeof progress!=="object"||Array.isArray(progress))progress={};
const save=(key,x)=>{try{localStorage.setItem(key,JSON.stringify(x))}catch(e){}};
const escapeText=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let view="inicio",selected=null,featuredIndex=0,current=null,hls=null,timer=0,attempt=0,timeSaved=0,toastTimeout=null;
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
 if(!Number.isFinite(seconds)||seconds<=0)return"Produção independente";
 return Math.max(1,Math.round(seconds/60))+" min";
}
async function loadUploadedCatalog(){
 if(!remoteDb)return;
 try{
  const data=[];
  // Paginar resultados, inclusive quando o catálogo público ultrapassar 150 títulos.
  for(let offset=0;offset<5000;offset+=500){
   const {data:page,error}=await remoteDb.from("novaplay_library")
    .select("id,title,description,kind,series_title,episode_number,genre,production_year,video_path,r2_object_key,youtube_id,google_drive_id,google_drive_resource_key,licensed_stream_url,poster_path,duration_seconds,created_at,catalog_only")
    .eq("is_published",true).order("created_at",{ascending:false}).range(offset,offset+499);
   if(error){console.error("NPlay: catálogo público não carregou:",error.message); if(offset===0){setTimeout(loadUploadedCatalog,15000);return;}break}
   data.push(...(page||[]));
   if(!page||page.length<500)break;
  }
  const grouped=new Map();
  let additions=[];
  // Em breve é só para fichas sem fonte de vídeo. Listar por último.
  data.sort((a,b)=>Number(!!a.catalog_only)-Number(!!b.catalog_only));
  (data||[]).forEach(record=>{
   const cover=posterUrl(record.poster_path,record.youtube_id,record.title,record.google_drive_id,record.genre);
   const title=record.title||"Sem título";
   const desc=record.description||(record.catalog_only?"Título confirmado na NPlay. Aguardando inclusão de vídeo autorizado.":"Conteúdo disponível na NPlay.");
   if(record.kind==="movie"){
    const film={id:"upload-"+record.id,title,kind:"film",category:record.genre||"Autoral",description:desc,
      year:record.production_year,duration:record.catalog_only?"Em breve":durationText(record.duration_seconds),cover,backdrop:cover,catalogOnly:!!record.catalog_only,
      mode:record.catalog_only?"catalog-only":record.r2_object_key?"r2":record.licensed_stream_url?"licensed":record.google_drive_id?"google-drive":record.youtube_id?"youtube":"private",video_path:record.video_path,r2_object_key:record.r2_object_key,youtube_id:record.youtube_id,google_drive_id:record.google_drive_id,google_drive_resource_key:record.google_drive_resource_key,licensed_stream_url:record.licensed_stream_url,src:null,sourcePage:null,uploaded:true,live:false};
    db.films.push(film);all.push(film);map.set(film.id,film);additions.push(film);
   }else if(record.kind==="episode"&&record.series_title){
    const key=record.series_title.trim().toLocaleLowerCase("pt-BR");
    if(!grouped.has(key))grouped.set(key,[]);
    grouped.get(key).push({...record,cover,title,desc});
   }
  });
  for(const [key,episodes] of grouped){
   episodes.sort((a,b)=>(a.episode_number||0)-(b.episode_number||0));
   const first=episodes[0];
   const show={id:"uploaded-series-"+first.id,title:first.series_title,kind:"series",
    category:first.genre||"Autoral",description:first.desc,year:first.production_year,cover:first.cover,
    backdrop:first.cover,uploaded:true,live:false,
    episodes:episodes.map(rec=>({id:"upload-"+rec.id,label:"Episódio "+rec.episode_number,
      title:rec.title,duration:durationText(rec.duration_seconds),video_path:rec.video_path,r2_object_key:rec.r2_object_key,youtube_id:rec.youtube_id,google_drive_id:rec.google_drive_id,google_drive_resource_key:rec.google_drive_resource_key,licensed_stream_url:rec.licensed_stream_url,src:null,sourcePage:null,mode:rec.r2_object_key?"r2":rec.licensed_stream_url?"licensed":rec.google_drive_id?"google-drive":rec.youtube_id?"youtube":"private"}))};
   db.series.push(show);all.push(show);map.set(show.id,show);additions.push(show);
   show.episodes.forEach(ep=>eps.set(ep.id,{show,ep}));
  }
  uploadedCatalog=additions;
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
 +'<h3>'+escapeText(item.title)+'</h3><p>'+escapeText(isEpisode?(Math.max(1,Math.round((item.progress.duration-item.progress.position)/60))+" min restantes"):(item.kind==="tv"?(item.mode==="external"?"Acessar transmissão no site oficial":"TV aberta • Assista grátis"):(item.catalogOnly?"Em breve":(item.year||"Clássico"))+" • "+(item.category||"Acervo clássico")))+'</p>';
 el.querySelector(".cover-btn").addEventListener("click",()=>item.kind==="tv"&&item.mode==="external"?startWatching(item):isEpisode?play(item.show,item.episode):openDetails(item));
 el.querySelector(".card-direct-play")?.addEventListener("click",e=>{e.stopPropagation();if(isEpisode)play(item.show,item.episode);else startWatching(item)});
 el.querySelector("img").addEventListener("error",function(){
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
 for(const item of db.films.filter(x=>x.kind==="film"&&!x.catalogOnly&&x.mode!=="youtube"))
  groups.get(primaryGenre(item)).push(item);
 return groups;
}
function upcomingFilms(){
 const upcoming=db.films.filter(x=>x.catalogOnly);
 const premium=x=>!!window.NovaPlayCover?.operationCover?.(x.title,false);
 return upcoming.sort((a,b)=>Number(premium(b))-Number(premium(a))||a.title.localeCompare(b.title,"pt-BR"));
}
function renderRows(){
 const holder=$("home-rows");holder.replaceChildren();
 const blocks=[
 ["Continuar assistindo",continued(),"continuar",false],
 ["TV aberta",db.channels,"tv",true],
 ["Filmes licenciados",uploadedCatalog.filter(x=>x.mode==="licensed"&&!x.catalogOnly),"filmes",false],
 ["Filmes do Cloudflare R2",uploadedCatalog.filter(x=>x.kind==="film"&&x.mode==="r2"&&!x.catalogOnly),"filmes",false],
 ["Filmes do YouTube",youtubeFilms(),"youtube",false],
 ["Animes e estreias · Em breve",upcomingFilms(),"em-breve",false],
 ["Filmes clássicos",db.films.filter(x=>x.mode!=="youtube"),"filmes",false],
 ["Séries clássicas",db.series,"series",false],
 ...genreOrder.filter(name=>name!=="Não classificados")
  .map(name=>[name,genreGroups().get(name),"genero:"+name,false]).filter(b=>b[1].length),
 ["Ainda sem gênero",genreGroups().get("Não classificados").slice(0,80),"genero:Não classificados",false],
 ["Adicionados ao catálogo",[...db.films.filter(x=>!x.catalogOnly&&x.mode!=="youtube").slice().reverse(),...db.series,...db.films.filter(x=>x.catalogOnly)],"filmes",false],
 ["Minha lista",all.filter(x=>favorite.has(x.id)),"favoritos",false]
 ];
 blocks.forEach(b=>{const row=shelf(b[0],b[1].slice(0,36),b[2],b[3]);if(row)holder.append(row)});
}
const defaultFeatured=["lostworld","nosferatu","lua","caligari"];
let featured=defaultFeatured.map(byId).filter(Boolean);
// Admin preferences load only after the published film catalog is available.
async function loadFeatured(){
 if(!remoteDb)return;
 try{
  const {data,error}=await remoteDb.from("novaplay_featured")
   .select("film_ids").eq("id",1).maybeSingle();
  if(error)throw error;
  const films=(Array.isArray(data?.film_ids)?data.film_ids:defaultFeatured)
   .map(id=>byId(id)).filter(x=>x&&(x.kind==="film"||x.kind==="series")&&!x.catalogOnly).slice(0,6);
  featured=films.length?films:defaultFeatured.map(byId).filter(Boolean);
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
 window.NovaPlayHeroScenes?.stop?.();
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
function youtubeFilms(){return db.films.filter(x=>!x.catalogOnly && x.mode==="youtube" && /^[A-Za-z0-9_-]{11}$/.test(x.youtube_id||""))}
const categories={
 tv:["TV AO VIVO","TV aberta","Canais gratuitos com reprodução configurada dentro da NPlay. A disponibilidade depende das emissoras.",db.channels],
 filmes:["NOSSO ACERVO","Filmes clássicos","Longas e curtas históricos com versões de arquivo.",db.films.filter(x=>x.mode!=="youtube")],
 youtube:["YOUTUBE · NPLAY","Filmes do YouTube","Assista por meio do player oficial do YouTube. A disponibilidade depende do canal e das permissões de reprodução.",[]],
 "em-breve":["LANÇAMENTOS · NPLAY","Em breve","Prévias de animes e filmes anunciados. Estes títulos ainda não têm vídeo autorizado para reprodução.",[]],
 series:["CAPÍTULO POR CAPÍTULO","Séries clássicas","Escolha uma série para ver seus episódios.",db.series],
 favoritos:["SUA SELEÇÃO","Minha lista","Tudo o que você marcou como favorito.",[]]
};
function renderCategory(kind){
 const conf=categories[kind]||categories.filmes;
 $("category-kicker").textContent=conf[0];$("category-heading").textContent=conf[1];$("category-subtitle").textContent=conf[2];
 const content=$("category-grid");content.replaceChildren();
 let list=kind==="favoritos"?all.filter(x=>favorite.has(x.id)):kind==="youtube"?youtubeFilms():kind==="em-breve"?upcomingFilms():conf[3];
 if(kind==="tv"){
  const section=document.createElement("section");section.id="tv-iframe-grid";section.style.cssText="grid-column:1/-1;margin-bottom:20px";
  const heading=document.createElement("h2");heading.textContent="Canais ao vivo incorporados";section.append(heading);
  const embeds=document.createElement("div");embeds.id="tv-iframe-cards";embeds.style.cssText="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px";
  const loading=document.createElement("p");loading.textContent="Carregando canais...";embeds.append(loading);
  section.append(embeds);content.append(section);
  const sptv=document.createElement("button");sptv.type="button";sptv.className="poster-card channel-card";sptv.style.cssText="background:#12223b;color:white;border:1px solid #375075;border-radius:14px;min-height:170px;padding:18px;cursor:pointer;text-align:center";sptv.textContent="📺 SPTV · Testar transmissão HLS";embeds.append(sptv);
  sptv.onclick=()=>{
   const panel=$("iframe-channels-panel"),viewer=$("iframe-channel-viewer"),player=$("iframe-channel-player");
   if(!panel||!viewer||!player)return;
   if(window.nplaySptvHls){window.nplaySptvHls.destroy();window.nplaySptvHls=null}
   player.replaceChildren();const video=document.createElement("video");video.controls=true;video.autoplay=true;video.playsInline=true;video.style.cssText="width:100%;height:100%;background:black";player.append(video);
   const source="https://nplay-sptv-hls.luandersonjesussantos063.workers.dev/look/sptv/playlist.m3u8";
   $("iframe-channel-heading").textContent="SPTV · Transmissão de teste";panel.hidden=false;viewer.hidden=false;viewer.scrollIntoView({behavior:"smooth"});
   const diagnostic=document.createElement("p");diagnostic.style.cssText="padding:12px;color:#ffd6a5";diagnostic.textContent="Verificando conexão com o servidor SPTV...";player.append(diagnostic);
   fetch(source,{cache:"no-store"}).then(async response=>{if(!response.ok)throw Error("Gateway retornou HTTP "+response.status);const manifest=await response.text();if(!manifest.trim().startsWith("#EXTM3U"))throw Error("O servidor não enviou uma playlist HLS válida.");diagnostic.textContent="Playlist recebida. Preparando vídeo...";}).catch(err=>{diagnostic.textContent="Falha na transmissão: "+err.message+" Solicite ao fornecedor a URL HTTPS oficial do canal.";});
   video.addEventListener("playing",()=>{diagnostic.textContent="Transmissão conectada."});
   video.addEventListener("error",()=>{diagnostic.textContent="Erro de reprodução de vídeo (código "+(video.error?.code||"desconhecido")+")."});
   if(video.canPlayType("application/vnd.apple.mpegurl")){video.src=source;video.play().catch(()=>{})}
   else if(window.Hls?.isSupported()){const hls=new Hls({enableWorker:true});window.nplaySptvHls=hls;hls.loadSource(source);hls.attachMedia(video);hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{}));hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal){const note=document.createElement("p");note.textContent="Falha HLS: "+data.type+" / "+data.details+". Verifique o servidor de origem.";player.append(note);hls.destroy()}})}
   else{const note=document.createElement("p");note.textContent="Este navegador não oferece suporte à transmissão HLS.";player.append(note)}
  };
  if(remoteDb)remoteDb.from("novaplay_live_embeds").select("id,title,embed_url").eq("is_published",true).order("created_at",{ascending:false}).then(({data,error})=>{
   if(!section.isConnected)return;
   embeds.replaceChildren(sptv);
   if(error){const msg=document.createElement("p");msg.textContent="Não foi possível carregar os canais incorporados.";embeds.append(msg);return}
   if(!data?.length){const msg=document.createElement("p");msg.textContent="Nenhum canal incorporado publicado.";embeds.append(msg);return}
   for(const channel of data){
    const button=document.createElement("button");button.type="button";button.className="poster-card channel-card";button.style.cssText="background:#12223b;color:#fff;border:1px solid #375075;border-radius:14px;min-height:170px;padding:18px;cursor:pointer;text-align:center";
    const icon=document.createElement("div");icon.textContent="📺";icon.style.fontSize="42px";
    const label=document.createElement("strong");label.textContent=channel.title;
    const live=document.createElement("p");live.textContent="● AO VIVO";live.style.color="#fb5b68";
    button.append(icon,label,live);
    button.onclick=()=>{
     const panel=$("iframe-channels-panel"),viewer=$("iframe-channel-viewer"),player=$("iframe-channel-player");
     if(!panel||!viewer||!player)return;
     let url;try{url=new URL(channel.embed_url);if(url.protocol!=="https:")return}catch(e){return}
     player.replaceChildren();const frame=document.createElement("iframe");frame.src=url.href;frame.title=channel.title;frame.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";frame.allowFullscreen=true;frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-presentation");frame.style.cssText="width:100%;height:100%;border:0";player.append(frame);
     $("iframe-channel-heading").textContent=channel.title;panel.hidden=false;viewer.hidden=false;viewer.scrollIntoView({behavior:"smooth",block:"start"});
    };
    embeds.append(button)
   }
  });
 }
 const filters=$("genre-filter-panel"),buttons=$("genre-filter-buttons");
 filters.hidden=kind!=="filmes";
 if(kind==="filmes"){
  buttons.replaceChildren();
  const groups=genreGroups();
  for(const name of ["Todos",...genreOrder.filter(name=>groups.get(name).length)]){
   const count=name==="Todos"?db.films.filter(x=>!x.catalogOnly&&x.mode!=="youtube").length:groups.get(name).length;
   const b=document.createElement("button");b.type="button";
   b.className="genre-chip"+(selectedGenre===name?" active":"");
   b.setAttribute("aria-pressed",String(selectedGenre===name));
   b.textContent=name+" ("+count+")";
   b.onclick=()=>{selectedGenre=name;renderCategory("filmes")};
   buttons.append(b);
  }
  list=selectedGenre==="Todos"?db.films:groups.get(selectedGenre)||[];
  $("category-heading").textContent=selectedGenre==="Todos"?"Filmes por gênero":selectedGenre;
  $("genre-filter-count").textContent=list.length+" título"+(list.length===1?"":"s")+" nesta categoria";
 }
 if(!list.length)content.append(empty(kind==="youtube"?"Em breve: filmes do YouTube":"Nenhum título nesta categoria",kind==="youtube"?"Os filmes autorizados cadastrados com um link do YouTube aparecerão automaticamente aqui.":"Selecione outro gênero ou classifique títulos no painel administrativo."));
 else list.forEach(item=>content.append(card(item,item.kind==="tv")));
}
function renderSearch(){
 const q=$("search-input").value.trim().toLocaleLowerCase("pt-BR");
 const results=$("search-results");results.replaceChildren();
 const list=all.filter(x=>(x.title+" "+x.description+" "+x.category+" "+(x.year||"")).toLocaleLowerCase("pt-BR").includes(q));
 $("search-summary").textContent=q?(list.length+" resultado"+(list.length===1?"":"s")+" para “"+q.slice(0,70)+"”"):"Explore filmes, séries e TV aberta no catálogo.";
 if(!list.length)results.append(empty("Nenhum título encontrado","Tente outro nome, gênero ou ano."));
 else list.forEach(x=>results.append(card(x,x.kind==="tv")));
}
function navigate(page){
 window.NovaPlayHeroScenes?.stop?.();
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
 document.querySelectorAll("[data-nav]").forEach(b=>{const yes=b.dataset.nav===chosen;b.classList.toggle("active",yes);if(yes)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
 if(chosen==="inicio"){renderRows();updateHero(featuredIndex)}
 else if(chosen==="buscar"){renderSearch();setTimeout(()=>$("search-input").focus(),100)}
 else renderCategory(chosen);
 window.scrollTo({top:0,behavior:"instant"});
 if(location.hash!=="#"+chosen)history.replaceState(null,"","#"+chosen);
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
 window.NovaPlayHeroScenes?.stop?.();
 window.NovaPlayHover?.close?.();
 stopHeroPreview();
 if(!item)return;selected=item;
 registerCatalogInterest(item,"detail_open");
 $("detail-type").textContent=item.kind==="tv"&&item.mode==="external"?"CANAL GRÁTIS · SITE OFICIAL":item.catalogOnly?(item.category==="Anime · Série"?"ANIME / SÉRIE · EM BREVE":"ANIME / FILME · EM BREVE"):item.kind==="tv"?"● TV ABERTA":item.kind==="series"?"SÉRIE CLÁSSICA":item.mode==="youtube"?"FILME · YOUTUBE":"FILME CLÁSSICO";
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
 if(fullscreenOwned&&!layer.hidden&&!closingFullscreen)closePlayer(true);
});
document.addEventListener("webkitfullscreenchange",()=>{
 const layer=$("player-layer"),fs=document.webkitFullscreenElement;
 if(fs===layer){fullscreenOwned=true;syncLandscape();return}
 if(fullscreenOwned&&!layer.hidden&&!closingFullscreen)closePlayer(true);
});
window.addEventListener("resize",()=>{if(!$("player-layer").hidden)syncLandscape()});
window.addEventListener("orientationchange",()=>{if(!$("player-layer").hidden)syncLandscape()});
function asClock(seconds){
 const value=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 const hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60),secs=value%60;
 return (hours?hours+":"+String(minutes).padStart(2,"0"):String(minutes))+":"+String(secs).padStart(2,"0");
}
function updateCinemaControls(){
 const v=$("video");
 $("cinema-play").textContent=v.paused?"▶":"❚❚";
 $("cinema-play").setAttribute("aria-label",v.paused?"Reproduzir":"Pausar");
 $("cinema-mute").textContent=v.muted?"♪̸":"♫";
 $("cinema-mute").setAttribute("aria-label",v.muted?"Ativar áudio":"Silenciar");
 const duration=v.duration;
 const seekable=Number.isFinite(duration)&&duration>0;
 $("cinema-seek").disabled=!seekable;
 $("cinema-duration").textContent=seekable?asClock(duration):"AO VIVO";
 if(!seekActive){
   const currentTime=seekable?Math.max(0,Math.min(duration,v.currentTime||0)):0;
   $("cinema-elapsed").textContent=asClock(currentTime);
   $("cinema-seek").value=seekable?String(currentTime/duration*100):"0";
 }
}
function showCinemaUi(){
 if($("player-layer").hidden||$("player-layer").classList.contains("youtube-active")||$("player-layer").classList.contains("drive-active"))return;
 $("player-layer").classList.remove("ui-idle");
 clearTimeout(playerUiTimer);
 if(!$("video").paused)playerUiTimer=setTimeout(()=>{
   if(!$("player-layer").hidden&&!$("video").paused)
     $("player-layer").classList.add("ui-idle");
 },4200);
}
function resetCinemaUi(){
 clearTimeout(playerUiTimer);playerUiTimer=null;seekActive=false;
 $("player-layer").classList.remove("ui-idle","youtube-active","drive-active","has-player-error");
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
 const v=$("video");if(v.paused)v.play().catch(()=>showCinemaUi());else v.pause();showCinemaUi()
};
$("cinema-rewind").onclick=()=>{const v=$("video");if(Number.isFinite(v.duration))v.currentTime=Math.max(0,v.currentTime-10);updateCinemaControls();showCinemaUi()};
$("cinema-forward").onclick=()=>{const v=$("video");if(Number.isFinite(v.duration))v.currentTime=Math.min(v.duration,v.currentTime+10);updateCinemaControls();showCinemaUi()};
$("cinema-mute").onclick=()=>{const v=$("video");v.muted=!v.muted;updateCinemaControls();showCinemaUi()};
$("cinema-seek").addEventListener("input",e=>{
 const v=$("video");if(!Number.isFinite(v.duration)||v.duration<=0)return;
 seekActive=true;
 const target=v.duration*Number(e.target.value)/100;
 $("cinema-elapsed").textContent=asClock(target);
 showCinemaUi();
});
$("cinema-seek").addEventListener("change",e=>{
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
 $("player-issue-panel").hidden=true;
 $("player-issue-open").hidden=true;
 $("player-issue-feedback").textContent="";
 issueReportBusy=false;
 resetCinemaUi();
 ++attempt;clearTimeout(timer);timer=0;const video=$("video");
 video.pause();video.onerror=null;video.onplaying=null;video.onwaiting=null;video.oncanplay=null;video.onloadedmetadata=null;video.ontimeupdate=null;video.onended=null;
 if(hls){hls.destroy();hls=null}
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
function playerStatus(msg){$("player-status").textContent=msg}
function playbackFailed(msg,seq){
 if(seq!==attempt||$("player-layer").hidden)return;
 $("player-layer").classList.add("has-player-error");
 showCinemaUi();
 clearTimeout(timer);$("player-error").textContent=msg;
 playerStatus("Transmissão indisponível neste momento");
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
   Promise.resolve(video.play()).catch(()=>{
    if(seq===attempt&&!$("player-layer").hidden){
     playerStatus("Toque em ▶ para reproduzir: o navegador bloqueou o início automático.");
     showCinemaUi();
    }
   });
  }catch(e){playerStatus("Toque em ▶ para reproduzir.");showCinemaUi()}
 };
 try{
  Promise.resolve(video.play()).catch(err=>{
   if(seq!==attempt||$("player-layer").hidden||playerClosing)return;
   if(err?.name!=="AbortError")mutedFallback();
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
function play(item,episode){
 if(item?.kind==="tv"&&item.mode==="external"){openOfficialChannel(item);return}
 window.NovaPlayHeroScenes?.stop?.();
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
 let hasFailed=false;
 const fail=msg=>{if(!hasFailed){hasFailed=true;playbackFailed(msg,seq)}};
 v.onerror=()=>fail("O arquivo não pôde ser reproduzido neste navegador. Tente novamente.");
 v.onplaying=()=>{
   if(seq!==attempt)return;clearTimeout(timer);
   $("player-layer").classList.remove("has-player-error");
   $("player-error").textContent="";
   $("retry-btn").hidden=true;$("fallback-btn").hidden=true;
   playerStatus(item.kind==="tv"?"● AO VIVO — reproduzindo":"▶ Reproduzindo");
 };
 v.onwaiting=()=>{if(seq===attempt)playerStatus("Aguardando dados da transmissão...")};
 v.oncanplay=()=>{if(seq===attempt){clearTimeout(timer);playerStatus(v.paused?"Preparando reprodução automática...":"▶ Reproduzindo")}};
 const progressId=item.kind==="tv"?null:episode?episode.id:item.id;
 setResume(v,progressId,seq);
 if(item.kind==="tv")timer=setTimeout(()=>{if(seq===attempt&&v.readyState<2)fail("O canal está demorando para carregar. Verifique a conexão ou tente novamente.")},22000);
 function startSource(){
  if(seq!==attempt)return;
  if(!src){fail("Não foi possível localizar o arquivo de vídeo.");return}
  if(/\.m3u8(?:\?|$)/i.test(src)){
    if(v.canPlayType("application/vnd.apple.mpegurl")){
      v.src=src;startAutoplay(v,seq);
    }else if(window.Hls&&window.Hls.isSupported()){
      hls=new window.Hls({enableWorker:true,lowLatencyMode:true,maxBufferLength:20});
      hls.on(window.Hls.Events.ERROR,(event,data)=>{
        if(seq!==attempt||!data.fatal)return;
        if(data.type===window.Hls.ErrorTypes.MEDIA_ERROR){try{hls.recoverMediaError();return}catch(e){}}
        fail("A transmissão interrompeu. Toque em Tentar novamente.");
      });
      hls.loadSource(src);hls.attachMedia(v);
      hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{if(seq===attempt)startAutoplay(v,seq)});
    }else fail("Este navegador não carregou o suporte a HLS.");
  }else{
    v.src=src;
    startAutoplay(v,seq);
  }
 }
 if(media.youtube_id){
  // The official YouTube player runs INSIDE NPlay; do not bypass YouTube's restrictions.
  const id=media.youtube_id;
  if(!/^[A-Za-z0-9_-]{11}$/.test(id)){fail("Endereço do vídeo inválido.");return}
  v.pause();v.hidden=true;
  const frame=$("fallback-frame");frame.hidden=false;
  // Autoplay sem som evita o bloqueio inicial; áudio pelo player oficial.
  frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(id)+"?autoplay=1&mute=1&playsinline=1&rel=0";
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
  playerStatus("Preparando vídeo R2 autorizado...");
  src="https://nplay-r2-api.luandersonjesussantos063.workers.dev/watch/"+encodeURIComponent((episode?.id||item.id).replace(/^upload-/,""));
  startSource();
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
$("profile-trigger").onclick=()=>{window.location.href="./admin/"};
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
 window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=0.39.2",{updateViaCache:"none"}).catch(()=>{}));
}
navigate((location.hash||"").slice(1)||"inicio");
loadUploadedCatalog().then(loadFeatured);
})();
