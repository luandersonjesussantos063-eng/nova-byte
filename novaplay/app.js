/* NovaPlay v0.12.0 • player, catálogo e experiência de streaming */
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
function read(key,fallback){try{const x=JSON.parse(localStorage.getItem(key));return x??fallback}catch(e){return fallback}}
const favorite=new Set((read(favKey,[])).filter(x=>map.has(x)));
let progress=read(progressKey,{});
if(!progress||typeof progress!=="object"||Array.isArray(progress))progress={};
const save=(key,x)=>{try{localStorage.setItem(key,JSON.stringify(x))}catch(e){}};
const escapeText=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let view="inicio",selected=null,featuredIndex=0,current=null,hls=null,timer=0,attempt=0,timeSaved=0,toastTimeout=null;
let playerUiTimer=null,seekActive=false;
let fullscreenOwned=false,closingFullscreen=false,lockedLandscape=false;

function posterUrl(path,youtubeId){
 if(!path&&youtubeId&&/^[A-Za-z0-9_-]{11}$/.test(youtubeId))return"https://i.ytimg.com/vi/"+youtubeId+"/hqdefault.jpg";
 if(!remoteDb||!path)return"./assets/posters/autoral.svg";
 return remoteDb.storage.from("novaplay-posters").getPublicUrl(path).data.publicUrl;
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
    .select("id,title,description,kind,series_title,episode_number,genre,production_year,video_path,youtube_id,google_drive_id,google_drive_resource_key,poster_path,duration_seconds,created_at")
    .eq("is_published",true).order("created_at",{ascending:false}).range(offset,offset+499);
   if(error){console.warn("NovaPlay: catálogo remoto indisponível.",error.message);break}
   data.push(...(page||[]));
   if(!page||page.length<500)break;
  }
  const grouped=new Map();
  let additions=[];
  (data||[]).forEach(record=>{
   const cover=posterUrl(record.poster_path,record.youtube_id);
   const title=record.title||"Sem título";
   const desc=record.description||"Produção original disponível na NovaPlay.";
   if(record.kind==="movie"){
    const film={id:"upload-"+record.id,title,kind:"film",category:record.genre||"Autoral",description:desc,
      year:record.production_year,duration:durationText(record.duration_seconds),cover,backdrop:cover,
      mode:record.google_drive_id?"google-drive":record.youtube_id?"youtube":"private",video_path:record.video_path,youtube_id:record.youtube_id,google_drive_id:record.google_drive_id,google_drive_resource_key:record.google_drive_resource_key,src:null,sourcePage:null,uploaded:true,live:false};
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
      title:rec.title,duration:durationText(rec.duration_seconds),video_path:rec.video_path,youtube_id:rec.youtube_id,google_drive_id:rec.google_drive_id,google_drive_resource_key:rec.google_drive_resource_key,src:null,sourcePage:null,mode:rec.google_drive_id?"google-drive":rec.youtube_id?"youtube":"private"}))};
   db.series.push(show);all.push(show);map.set(show.id,show);additions.push(show);
   show.episodes.forEach(ep=>eps.set(ep.id,{show,ep}));
  }
  uploadedCatalog=additions;
  if(view==="inicio")renderRows();
  else if(view==="buscar")renderSearch();
  else if(categories[view])renderCategory(view);
 }catch(err){console.warn("NovaPlay: não foi possível obter novos conteúdos.",String(err))}
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
 const pct=item.progress?Math.min(100,Math.max(0,Math.round(item.progress.position/item.progress.duration*100))):0;
 el.innerHTML='<div class="cover"><img loading="lazy" decoding="async" src="'+escapeText(cover)+'" alt="Capa ilustrativa: '+escapeText(item.title)+'">'
 +(channel?'<span class="onair">AO VIVO</span>':'')
 +'<button type="button" class="cover-btn" aria-label="'+escapeText(isEpisode?"Continuar "+item.title:"Ver detalhes de "+item.title)+'"></button>'
 +'<button type="button" class="card-direct-play" aria-label="Assistir '+escapeText(item.title)+'">'+icon("play")+'</button>'
 +(pct?'<span class="card-progress"><span style="width:'+pct+'%"></span></span>':'')+'</div>'
 +'<h3>'+escapeText(item.title)+'</h3><p>'+escapeText(isEpisode?(Math.max(1,Math.round((item.progress.duration-item.progress.position)/60))+" min restantes"):(item.kind==="tv"?"TV aberta • Assista grátis":(item.year||"Clássico")+" • "+(item.category||"Acervo clássico")))+'</p>';
 el.querySelector(".cover-btn").addEventListener("click",()=>isEpisode?play(item.show,item.episode):openDetails(item));
 el.querySelector(".card-direct-play").addEventListener("click",e=>{e.stopPropagation();if(isEpisode)play(item.show,item.episode);else startWatching(item)});
 el.querySelector("img").addEventListener("error",function(){this.style.display="none";this.parentElement.style.background="linear-gradient(135deg,#173e65,#4e417a)"});
 return el;
}
function empty(title,subtitle){const div=document.createElement("div");div.className="empty-state";const h=document.createElement("h3");h.textContent=title;const p=document.createElement("p");p.textContent=subtitle;div.append(h,p);return div}
function shelf(title,items,key,withLive=false){
 if(!items.length)return null;
 const section=document.createElement("section");section.className="shelf";
 const head=document.createElement("div");head.className="shelf-top";
 const h=document.createElement("h2");h.className="shelf-title";h.textContent=title;
 if(withLive){const badge=document.createElement("span");badge.className="live-label";badge.textContent="● AO VIVO";h.append(badge)}
 const more=document.createElement("button");more.className="see-all";more.textContent="Ver todos ›";
 if(key==="continuar")more.hidden=true;else more.addEventListener("click",()=>navigate(key));
 head.append(h,more);
 const track=document.createElement("div");track.className="shelf-track";track.setAttribute("aria-label",title);
 items.forEach(item=>track.append(card(item,item.kind==="tv")));
 section.append(head,track);return section;
}
function renderRows(){
 const holder=$("home-rows");holder.replaceChildren();
 const blocks=[
 ["Continuar assistindo",continued(),"continuar",false],
 ["TV aberta",db.channels,"tv",true],
 ["Produções da NovaPlay",uploadedCatalog,"filmes",false],
 ["Filmes clássicos",db.films,"filmes",false],
 ["Séries clássicas",db.series,"series",false],
 ["Adicionados ao catálogo",[...db.films.slice().reverse(),...db.series],"filmes",false],
 ["Minha lista",all.filter(x=>favorite.has(x.id)),"favoritos",false]
 ];
 blocks.forEach(b=>{const row=shelf(...b);if(row)holder.append(row)});
}
const featured=["lostworld","nosferatu","lua","caligari"].map(byId).filter(Boolean);
function updateHero(index){
 if(!featured.length)return;
 featuredIndex=(index+featured.length)%featured.length;const x=featured[featuredIndex];
 $("hero-art").style.backgroundImage="url('"+(x.backdrop||x.cover).replace(/'/g,"%27")+"')";
 $("hero-title").textContent=x.title;$("hero-genre").textContent="CINEMA CLÁSSICO";
 $("hero-description").textContent=x.description;
 const wrap=$("hero-metadata");wrap.replaceChildren();
 [x.year,x.duration,"Cinema em domínio público*"].filter(Boolean).forEach(s=>{const span=document.createElement("span");span.textContent=s;wrap.append(span)});
 $("hero-play").onclick=()=>play(x);
 $("hero-info").onclick=()=>openDetails(x);
 const dots=$("hero-dots");dots.replaceChildren();
 featured.forEach((film,i)=>{const b=document.createElement("button");b.className="hero-dot"+(i===featuredIndex?" active":"");b.setAttribute("aria-label","Destacar "+film.title);b.addEventListener("click",()=>updateHero(i));dots.append(b)});
}
const categories={
 tv:["TV AO VIVO","Assista à TV aberta","Canais gratuitos, reproduzidos pelo player da NovaPlay.",db.channels],
 filmes:["NOSSO ACERVO","Filmes clássicos","Longas e curtas históricos com versões de arquivo.",db.films],
 series:["CAPÍTULO POR CAPÍTULO","Séries clássicas","Escolha uma série para ver seus episódios.",db.series],
 favoritos:["SUA SELEÇÃO","Minha lista","Tudo o que você marcou como favorito.",[]]
};
function renderCategory(kind){
 const conf=categories[kind]||categories.filmes;
 $("category-kicker").textContent=conf[0];$("category-heading").textContent=conf[1];$("category-subtitle").textContent=conf[2];
 const content=$("category-grid");content.replaceChildren();
 const list=kind==="favoritos"?all.filter(x=>favorite.has(x.id)):conf[3];
 if(!list.length)content.append(empty("Sua lista está vazia","Abra um filme, série ou canal e toque em 'Minha lista' para salvar aqui."));
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
 const chosen=page==="buscar"?"buscar":(categories[page]?page:"inicio");
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
function startWatching(item){
 if(!item)return;
 if(item.kind==="series"){
  const episode=item.episodes?.find(e=>progressItem(e.id))||item.episodes?.[0];
  if(!episode){toast("Essa série ainda não tem episódios disponíveis");return}
  play(item,episode);
 }else play(item);
}
function openDetails(item){
 if(!item)return;selected=item;
 $("detail-type").textContent=item.kind==="tv"?"● TV ABERTA":item.kind==="series"?"SÉRIE CLÁSSICA":"FILME CLÁSSICO";
 $("detail-title").textContent=item.title;
 $("detail-meta").textContent=[item.year,item.duration,item.category].filter(Boolean).join("  •  ");
 $("detail-description").textContent=item.description;
 $("detail-image").src=item.kind==="tv"?item.cover:(item.backdrop||item.cover);
 $("detail-image").alt="Arte ilustrativa de "+item.title;
 $("detail-play-label").textContent=item.kind==="tv"?"Assistir ao vivo":item.kind==="series"?"Assistir à série":"Assistir filme";
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
 layer.classList.add("cinema");fullscreenOwned=false;closingFullscreen=false;
 syncLandscape();
 // Must be initiated directly by the tap/click; otherwise Android rejects fullscreen.
 const enter=layer.requestFullscreen?.bind(layer)||layer.webkitRequestFullscreen?.bind(layer);
 if(!enter)return;
 try{
  const result=enter({navigationUI:"hide"});
  Promise.resolve(result).then(()=>{
   if(layer.hidden)return;
   fullscreenOwned=!!(document.fullscreenElement===layer||document.webkitFullscreenElement===layer);
   if(screen.orientation&&typeof screen.orientation.lock==="function"){
    try{
     Promise.resolve(screen.orientation.lock("landscape")).then(()=>{lockedLandscape=true;syncLandscape()}).catch(()=>{syncLandscape()});
    }catch(e){syncLandscape()}
   }else syncLandscape();
  }).catch(()=>{syncLandscape()});
 }catch(e){syncLandscape()}
}
function leaveCinema(skipFullscreen=false){
 const layer=$("player-layer");
 layer.classList.remove("cinema","force-landscape");
 if(lockedLandscape&&screen.orientation&&typeof screen.orientation.unlock==="function"){
  try{screen.orientation.unlock()}catch(e){}
 }
 lockedLandscape=false;
 if(!skipFullscreen&&(document.fullscreenElement===layer||document.webkitFullscreenElement===layer)){
  closingFullscreen=true;
  try{Promise.resolve(document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen?.()).catch(()=>{}).finally(()=>{closingFullscreen=false})}catch(e){closingFullscreen=false}
 }else{closingFullscreen=false}
 fullscreenOwned=false;
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
 resetCinemaUi();
 ++attempt;clearTimeout(timer);timer=0;const video=$("video");
 video.pause();video.onerror=null;video.onplaying=null;video.onwaiting=null;video.oncanplay=null;video.onloadedmetadata=null;video.ontimeupdate=null;video.onended=null;
 if(hls){hls.destroy();hls=null}
 video.removeAttribute("src");video.load();video.hidden=false;
 $("fallback-frame").src="about:blank";$("fallback-frame").hidden=true;current=null;
}
function closePlayer(skipFullscreen=false){
 leaveCinema(skipFullscreen);
 stopPlayback();$("player-layer").hidden=true;document.body.classList.remove("modal-open");
 if(!$("detail-layer").hidden)closeDetails();
 if(view==="inicio")renderRows();
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
 if(!item)return;
 // A camada de detalhes fecha, mas o player continua aberto.
 $("detail-layer").hidden=true;selected=null;
 stopPlayback();current={item,episode:episode||null};
 const media=episode||item;
 $("player-layer").hidden=false;document.body.classList.add("modal-open");
 const yt=!!media.youtube_id,drive=!!media.google_drive_id,externalEmbed=yt||drive;
 $("player-layer").classList.toggle("youtube-active",yt);
 $("player-layer").classList.toggle("drive-active",drive);
 $("cinema-controls").hidden=externalEmbed;
 $("video").controls=false;
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
 let src=media.src;
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
 v.oncanplay=()=>{if(seq===attempt){clearTimeout(timer);playerStatus("Pronto para assistir — toque no ▶ se necessário")}};
 const progressId=item.kind==="tv"?null:episode?episode.id:item.id;
 setResume(v,progressId,seq);
 if(item.kind==="tv")timer=setTimeout(()=>{if(seq===attempt&&v.readyState<2)fail("O canal está demorando para carregar. Verifique a conexão ou tente novamente.")},22000);
 function startSource(){
  if(seq!==attempt)return;
  if(!src){fail("Não foi possível localizar o arquivo de vídeo.");return}
  if(/\.m3u8(?:\?|$)/i.test(src)){
    if(v.canPlayType("application/vnd.apple.mpegurl")){
      v.src=src;v.play().catch(()=>playerStatus("Toque no botão ▶ do vídeo para começar."));
    }else if(window.Hls&&window.Hls.isSupported()){
      hls=new window.Hls({enableWorker:true,lowLatencyMode:true,maxBufferLength:20});
      hls.on(window.Hls.Events.ERROR,(event,data)=>{
        if(seq!==attempt||!data.fatal)return;
        if(data.type===window.Hls.ErrorTypes.MEDIA_ERROR){try{hls.recoverMediaError();return}catch(e){}}
        fail("A transmissão interrompeu. Toque em Tentar novamente.");
      });
      hls.loadSource(src);hls.attachMedia(v);
      hls.on(window.Hls.Events.MANIFEST_PARSED,()=>{if(seq===attempt)v.play().catch(()=>playerStatus("Toque no ▶ do vídeo para começar."))});
    }else fail("Este navegador não carregou o suporte a HLS.");
  }else{
    v.src=src;
    v.play().catch(()=>playerStatus("Toque no botão ▶ do vídeo para começar."));
  }
 }
 if(media.youtube_id){
  // The official YouTube player runs INSIDE NovaPlay; do not bypass YouTube's restrictions.
  const id=media.youtube_id;
  if(!/^[A-Za-z0-9_-]{11}$/.test(id)){fail("Endereço do vídeo inválido.");return}
  v.pause();v.hidden=true;
  const frame=$("fallback-frame");frame.hidden=false;
  frame.src="https://www.youtube-nocookie.com/embed/"+encodeURIComponent(id)+"?autoplay=1&playsinline=1&rel=0";
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
  const resource=key?"?resourcekey="+encodeURIComponent(key):"";
  frame.src="https://drive.google.com/file/d/"+encodeURIComponent(id)+"/preview"+resource;
  $("retry-btn").hidden=true;$("fallback-btn").hidden=true;
  // The Google preview stays embedded; don't overlay the movie with a warning.
  $("player-status").textContent="";
  $("player-content-note").textContent="";
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
$("player-back").onclick=closePlayer;$("player-close").onclick=closePlayer;
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
   if(!$("player-layer").hidden)closePlayer();
   else if(!$("detail-layer").hidden)closeDetails();
 }
});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&!$("player-layer").hidden){$("video").pause()}});
window.addEventListener("scroll",()=>$("app-header").classList.toggle("is-scrolled",window.scrollY>24),{passive:true});
if("serviceWorker" in navigator&&location.protocol==="https:"){
 window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
navigate((location.hash||"").slice(1)||"inicio");
loadUploadedCatalog();
})();
