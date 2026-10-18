(()=>{
"use strict";
const $=id=>document.getElementById(id);
const PROVIDER="https://rdcanais.org/premiereclubes";
const CHANNEL_LOGOS={"adultswim":"./assets/channel-logos/adultswim.png","ae":"./assets/channel-logos/ae.png","agromais":"./assets/channel-logos/agromais.png","amc":"./assets/channel-logos/amc.png","animalplanet":"./assets/channel-logos/animalplanet.png","arte1":"./assets/channel-logos/arte1.png","axn":"./assets/channel-logos/axn.png","band":"./assets/channel-logos/band.png","bandnews":"./assets/channel-logos/bandnews.png","bis":"./assets/channel-logos/bis.png","canal-brasil":"./assets/channel-logos/canal-brasil.png","canaloff":"./assets/channel-logos/canaloff.png","cartoonnetwork":"./assets/channel-logos/cartoonnetwork.webp","cartoonito":"./assets/channel-logos/cartoonito.webp","cazetv":"./assets/channel-logos/cazetv.webp","cazetv2":"./assets/channel-logos/cazetv.webp","cazetv3":"./assets/channel-logos/cazetv.webp","cinemax":"./assets/channel-logos/cinemax.png","cnnbrasil":"./assets/channel-logos/cnnbrasil.png","combate":"./assets/channel-logos/combate.png","curta":"./assets/channel-logos/curta.png","discoverychannel":"./assets/channel-logos/discoverychannel.webp","discoveryheh":"./assets/channel-logos/discoveryheh.webp","discoveryid":"./assets/channel-logos/discoveryid.png","discoverykids":"./assets/channel-logos/discoverykids.png","discoveryscience":"./assets/channel-logos/discoveryscience.webp","discoverytheater":"./assets/channel-logos/discoverytheater.png","discoveryturbo":"./assets/channel-logos/discoveryturbo.png","discoveryworld":"./assets/channel-logos/discoveryworld.png","e":"./assets/channel-logos/e.png","fashiontv":"./assets/channel-logos/fashiontv.png","fishtv":"./assets/channel-logos/fishtv.png","foodnetwork":"./assets/channel-logos/foodnetwork.png","futura":"./assets/channel-logos/futura.png","globo":"./assets/channel-logos/globo.png","globonews":"./assets/channel-logos/globonews.png","globoplaynovelas":"./assets/channel-logos/globoplaynovelas.png","gloob":"./assets/channel-logos/gloob.png","gloobinho":"./assets/channel-logos/gloobinho.png","gnt":"./assets/channel-logos/gnt.png","hbo":"./assets/channel-logos/hbo.png","hbo2":"./assets/channel-logos/hbo2.png","hbofamily":"./assets/channel-logos/hbofamily.png","hbopop":"./assets/channel-logos/hbopop.webp","hbosignature":"./assets/channel-logos/hbosignature.png","hboxtreme":"./assets/channel-logos/hboxtreme.png","hboplus":"./assets/channel-logos/hboplus.png","hgtv":"./assets/channel-logos/hgtv.png","history":"./assets/channel-logos/history.webp","history2":"./assets/channel-logos/history2.png","jpnews":"./assets/channel-logos/jpnews.webp","lifetime":"./assets/channel-logos/lifetime.png","megapix":"./assets/channel-logos/megapix.png","modoviagem":"./assets/channel-logos/modoviagem.svg","multishow":"./assets/channel-logos/multishow.png","nsports":"./assets/channel-logos/nsports.png","paramountplus":"./assets/channel-logos/paramountplus.png","paramountplus2":"./assets/channel-logos/paramountplus.png","paramountplus3":"./assets/channel-logos/paramountplus.png","paramountplus4":"./assets/channel-logos/paramountplus.png","premiereclubes":"./assets/channel-logos/premiereclubes.png","premiere2":"./assets/channel-logos/premiereclubes.png","premiere3":"./assets/channel-logos/premiereclubes.png","premiere4":"./assets/channel-logos/premiereclubes.png","premiere5":"./assets/channel-logos/premiereclubes.png","premiere6":"./assets/channel-logos/premiereclubes.png","premiere7":"./assets/channel-logos/premiereclubes.png","premiere8":"./assets/channel-logos/premiereclubes.png","record":"./assets/channel-logos/record.png","recordnews":"./assets/channel-logos/recordnews.png","redetv":"./assets/channel-logos/redetv.png","saborearte":"./assets/channel-logos/saborearte.png","sbt":"./assets/channel-logos/sbt.png","sbtnews":"./assets/channel-logos/sbtnews.png","sonychannel":"./assets/channel-logos/sonychannel.png","sonymovies":"./assets/channel-logos/sonymovies.png","space":"./assets/channel-logos/space.png","sportv":"./assets/channel-logos/sportv.png","sportv2":"./assets/channel-logos/sportv.png","sportv3":"./assets/channel-logos/sportv.png","sportynet":"./assets/channel-logos/sportynet.avif","sportynetplus":"./assets/channel-logos/sportynet.avif","sportynetplus2":"./assets/channel-logos/sportynet.avif","sportynetplus3":"./assets/channel-logos/sportynet.avif","studiouniversal":"./assets/channel-logos/studiouniversal.png","telecineaction":"./assets/channel-logos/telecineaction.png","telecinecult":"./assets/channel-logos/telecinecult.png","telecinefun":"./assets/channel-logos/telecinefun.png","telecinepipoca":"./assets/channel-logos/telecinepipoca.png","telecinepremium":"./assets/channel-logos/telecinepremium.png","telecinetouch":"./assets/channel-logos/telecinetouch.png","tlc":"./assets/channel-logos/tlc.png","tnt":"./assets/channel-logos/tnt.png","tntnovelas":"./assets/channel-logos/tntnovelas.png","tntseries":"./assets/channel-logos/tntseries.png","tooncast":"./assets/channel-logos/tooncast.png","aparecida":"./assets/channel-logos/aparecida.png","tvbrasil":"./assets/channel-logos/tvbrasil.png","tvcultura":"./assets/channel-logos/tvcultura.png","universaltv":"./assets/channel-logos/universaltv.png","usa":"./assets/channel-logos/usa.png","warnertv":"./assets/channel-logos/warnertv.png","woohoo":"./assets/channel-logos/woohoo.png","xsports":"./assets/channel-logos/xsports.png"};
function imageUrl(value){
 const raw=typeof value==="string"?value:value?.url||value?.src;
 if(!raw)return "";
 try{const url=new URL(raw,"https://api.reidoscanais.si/");return url.protocol==="https:"?url.href:""}catch{return ""}
}
function channelKey(url){try{return new URL(url).pathname.replace(/\/+$/,"").split("/").pop()}catch{return ""}}
function channelName(title){
 return String(title||"Canal ao vivo").replace(/\s*·\s*Ao vivo$/i,"").replace(/\s*\[[^\]]*\]\s*$/g,"").replace(/\s+(?:(?:FHD|UHD|HD|SD|4K|8K)[²³0-9]*|H26[45]|HEVC)(?:\s|$)/gi," ").replace(/\s+/g," ").trim();
}
function titleLogo(title){
 const name=channelName(title).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const compact=name.replace(/[^a-z0-9]/g,"");
 if(/^gb(?:\s|$)/.test(name))return CHANNEL_LOGOS.globo;
 if(/^discovery\s+h\s*[&e]\s*h/.test(name))return CHANNEL_LOGOS.discoveryheh;
 if(/^a\s*&\s*e(?:\s|$)/.test(name))return CHANNEL_LOGOS.ae;
 if(/^h2(?:\s|$)/.test(name))return CHANNEL_LOGOS.history2;
 const aliases=Object.keys(CHANNEL_LOGOS).sort((a,b)=>b.length-a.length);
 for(const key of aliases){const token=key.replace(/[^a-z0-9]/g,"");if(token.length>=3?compact.startsWith(token):name===token||name.startsWith(token+" "))return CHANNEL_LOGOS[key];}
 if(/^discovery(?:\s|$)/.test(name))return CHANNEL_LOGOS.discoverychannel;
 if(/^premiere(?:\s|$)/.test(name))return CHANNEL_LOGOS.premiereclubes;
 return "";
}
let loadSequence=0,livePreviews=null,liveChannelData=[],liveScope="tv";
function note(message){const el=$("nplay-channel-notice");if(el)el.textContent=message}
async function openChannel(item){
 livePreviews?.stop();window.NPlayTvSpotlight?.stop();
 await window.NPlayLiveAuth?.waitForRelease?.();
 if(item.staticId){window.NovaPlayPlayer?.openStatic(item.staticId);return;}
 let source;try{source=await window.NPlayLiveAuth?.authorize(item.embed_url)||item.embed_url;}catch(error){note(error.message);return;}
 const hls=item.stream_type==="hls"||/\.m3u8?(?:\?|$)/i.test(item.embed_url);
 const audioOnly=/r[aá]dios?/i.test((item.category||"")+" "+item.title);
 if(audioOnly&&["mpegts","hls"].includes(item.stream_type)){window.NovaPlayPlayer?.openRadio(source,item.title,item.stream_type,item);return;}
 const open=item.stream_type==="mpegts"?window.NovaPlayPlayer?.openMpegts:hls?window.NovaPlayPlayer?.openHls:window.NovaPlayPlayer?.openEmbed;
 if(!open?.(source,item.title,item))console.warn("NPlay: não foi possível abrir o player do canal.");
}
async function load(){
 const list=$("iframe-channel-list");if(!list)return;
 const sequence=++loadSequence;
 note("Carregando canais publicados…");
 try{
  if(!window.supabase)throw Error("Cadastro de canais indisponível");
  const db=window.NPlayAccessClient||window.supabase.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
  const data=[];for(let offset=0;;offset+=500){const page=await db.from("novaplay_live_embeds").select("id,title,embed_url,stream_type,logo_url,category").eq("is_published",true).order("created_at",{ascending:false}).order("id").range(offset,offset+499);if(page.error)throw page.error;data.push(...(page.data||[]));if(!page.data||page.data.length<500)break;}
  if(sequence!==loadSequence)return;
  const channels=(data||[]).filter(item=>item.embed_url);
  window.NPlayLiveCatalog?.setChannels(channels);
  const television=window.NPlayMusic?.select(channels,"tv")||channels;
  const spotlight=await db.from("novaplay_featured").select("tv_spotlight_ids").eq("id",1).maybeSingle();
  if(sequence!==loadSequence)return;
  window.NPlayTvSpotlight?.setChannels(television,spotlight.error?[]:spotlight.data?.tv_spotlight_ids||[]);
  const previews=television.filter(item=>!window.NPlayLiveAuth?.protectedUrl(item.embed_url));
  window.NPlayHeroLive?.setChannels(previews);
  window.NPlayHomeLive?.setChannels(previews);
  renderChannels(channels);
  const scoped=window.NPlayMusic?.select(channels,liveScope)||channels;
  note(scoped.length?"":liveScope==="musica"?"Nenhum canal de música publicado no momento.":"Nenhum canal publicado no momento.");
 }catch(error){
  if(sequence!==loadSequence)return;
  window.NPlayHomeLive?.setChannels([]);window.NPlayTvSpotlight?.setChannels([]);
  renderChannels([]);note("Não foi possível carregar os canais publicados. Tente novamente em instantes.");
 }
}
function filterLiveChannels(channels,query){
 const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return channels.filter(item=>terms.every(term=>normalize([item.title,item.category,...(item.channelNames||[]),...(item.channelCategories||[])].join(" ")).includes(term)));
}
let liveDisplayMode="Todos",liveRegion="Todos",liveLimit=60;
const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function subject(item){const t=norm(item.category+" "+item.title);if(/esport|sport|espn|premiere|nba|nfl|dazn|combate|bein/.test(t))return "Esportes";if(/noticia|news|jornal/.test(t))return "Notícias";if(/infantil|kids|cartoon|gloob|disney|tooncast/.test(t))return "Infantil";if(/filme|serie|cinema|telecine|hbo/.test(t))return "Filmes e séries";if(/document|discovery|history/.test(t))return "Documentários";return "Variedades";}
function international(item){return /\[(?:US|USA|PT|ES|UK|AR|UY)\]/i.test(item.originalTitle||item.title)||/portugal|usa|canada|latinos|argentina|uruguai|deportes|bein|ziggo|sky cinema|sky sports|africa/.test(norm(item.category));}
function favoriteId(item){return item.staticId||"channel-"+item.id;}
function allChannels(channels){const list=[...channels],seen=new Set(list.map(x=>x.embed_url));for(const item of window.NPlayLiveCatalog?.staticChannels()||[]){const url=item.src||item.sourcePage;if(url&&!seen.has(url)){list.push({id:item.id,staticId:item.id,title:item.title,category:item.category||"TV aberta",embed_url:url,stream_type:item.mode,logo_url:item.cover});seen.add(url);}}return list;}
function renderFilters(){const host=$("nplay-live-mode");if(!host)return;host.replaceChildren();
 for(const label of ["Todos","Favoritos","Notícias","Esportes","Infantil","Filmes e séries","Documentários","Variedades"]){const b=document.createElement("button");b.type="button";b.className="genre-chip"+(liveDisplayMode===label?" active":"");b.dataset.liveMode=label;b.textContent=label;b.setAttribute("aria-pressed",String(liveDisplayMode===label));host.append(b);}
 const label=document.createElement("label");label.className="live-region";label.textContent="Região ";const select=document.createElement("select");select.setAttribute("aria-label","Região dos canais");for(const region of ["Todos","Brasil","Internacionais"]){const option=document.createElement("option");option.value=region;option.textContent=region;select.append(option);}select.value=liveRegion;select.onchange=()=>{liveRegion=select.value;liveLimit=60;renderChannels(liveChannelData);};label.append(select);host.append(label);
}
function renderChannels(channels){
 liveChannelData=channels;
 const pool=liveScope==="tv"?allChannels(channels):channels;
 const raw=window.NPlayMusic?.select(pool,liveScope)||pool;
 const regional=raw.filter(item=>liveRegion==="Todos"||(liveRegion==="Internacionais"?international(item):!international(item)));
 const scoped=window.NPlayChannelOrder?.unique(regional)||regional;
 const searched=filterLiveChannels(scoped,$("nplay-live-search")?.value||"");
 const filteredChannels=searched.filter(item=>liveDisplayMode==="Todos"||liveDisplayMode==="Favoritos"&&window.NPlayLiveCatalog?.isFavorite(favoriteId(item))||subject(item)===liveDisplayMode);
 const visibleChannels=liveScope==="tv"?(window.NPlayChannelOrder?.sort(filteredChannels)||filteredChannels):filteredChannels;
 renderFilters();
 const list=$("iframe-channel-list");if(!list)return;
 if(!livePreviews&&window.NPlayLivePreviews)livePreviews=window.NPlayLivePreviews.create(list);
 livePreviews?.reset();
 window.NPlayEpg?.reset();
 list.replaceChildren();
 const count=$("nplay-live-count");if(count)count.textContent=visibleChannels.length+" de "+scoped.length+(liveScope==="musica"?" canais de música":" canais");
 if(!visibleChannels.length&&scoped.length){const empty=document.createElement("p");empty.className="nplay-channel-empty";empty.textContent="Nenhum canal encontrado. Tente outro nome ou categoria.";list.append(empty)}
 for(const item of visibleChannels.slice(0,liveLimit)){
  const isPremiere=item.embed_url===PROVIDER;
  const card=document.createElement("article");
  card.className="nplay-live-card";
  const button=document.createElement("button");
  button.type="button";button.className="nplay-live-cover";
  button.setAttribute("aria-label","Assistir "+item.title);
  const art=document.createElement("span");
  art.className="nplay-live-art"+(isPremiere?" nplay-premiere-art":"");
  // As capas usam a identidade da emissora, nunca a foto do programa da EPG.
  const fallback=()=>{
   art.className="nplay-live-art nplay-channel-fallback-art";
   let hue=0;for(const char of String(item.category||item.title))hue=(hue*31+char.charCodeAt(0))%360;
   art.style.setProperty("--channel-hue",String(hue));
   art.replaceChildren();
   const category=document.createElement("span");category.className="nplay-channel-category";category.textContent=item.category||"NPLAY · TV AO VIVO";art.append(category);
   const label=document.createElement("span");label.className="nplay-channel-wordmark";
   label.textContent=channelName(item.title);art.append(label);
  };
  const sources=[CHANNEL_LOGOS[channelKey(item.embed_url)],titleLogo(item.title),item.logo_url].map(source=>{
   if(typeof source==="string"&&source.startsWith("./assets/"))return source;
   return imageUrl(source);
  }).filter((source,index,all)=>source&&all.indexOf(source)===index);
  if(sources.length){
   art.className="nplay-live-art nplay-channel-logo-art"+(item.dark_logo?" nplay-channel-logo-dark":"");
   const logo=document.createElement("img");logo.className="nplay-live-logo";logo.alt="Logomarca de "+item.title.replace(/\s*·\s*Ao vivo$/i,"");
   logo.loading="lazy";logo.decoding="async";logo.referrerPolicy="no-referrer";
   let sourceIndex=0;
   logo.onerror=()=>{sourceIndex++;if(sourceIndex<sources.length)logo.src=sources[sourceIndex];else fallback()};
   logo.src=sources[0];art.append(logo);
  }else fallback();
  const badge=document.createElement("span");badge.className="nplay-live-badge";badge.textContent="● AO VIVO";
  const play=document.createElement("span");play.className="nplay-live-play";play.textContent="▶";
  button.append(art,badge,play);
  const title=document.createElement("strong");title.className="nplay-live-title";title.textContent=item.title;
  const subtitle=document.createElement("span");subtitle.className="nplay-live-subtitle";subtitle.textContent=item.epg?.current?.title?("Agora: "+item.epg.current.title):(item.category?item.category+" · Ao vivo":"Canal ao vivo · Assistir agora");
  button.onclick=()=>openChannel(item);
  const media=document.createElement("div");media.className="nplay-live-media";media.append(button);
  const favorite=document.createElement("button");favorite.type="button";favorite.className="live-favorite";const saved=window.NPlayLiveCatalog?.isFavorite(favoriteId(item));favorite.textContent=saved?"♥":"♡";favorite.setAttribute("aria-label",(saved?"Remover dos favoritos: ":"Favoritar canal: ")+item.title);favorite.setAttribute("aria-pressed",String(!!saved));favorite.onclick=event=>{event.stopPropagation();window.NPlayLiveCatalog?.toggleFavorite(favoriteId(item));};
  media.append(favorite);card.append(media,title,subtitle);list.append(card);
  window.NPlayEpg?.observe(card,item);
  if(liveScope!=="tv"&&!window.NPlayLiveAuth?.protectedUrl(item.embed_url)&&(item.stream_type==="hls"||/\.m3u8?(?:\?|$)/i.test(item.embed_url))){
   const sound=document.createElement("button");sound.type="button";sound.className="nplay-live-sound";sound.hidden=true;media.append(sound);
   livePreviews?.register({card,cover:button,sound,url:item.embed_url,title:item.title});
  }
 }
 if(visibleChannels.length>liveLimit){const more=document.createElement("button");more.type="button";more.className="btn btn-secondary live-more";more.textContent="Mostrar mais canais";more.onclick=()=>{liveLimit+=60;renderChannels(liveChannelData);};list.append(more);}
}
function init(){
 $("nplay-live-mode")?.addEventListener("click",event=>{
  const button=event.target.closest("button[data-live-mode]");if(!button)return;
  liveDisplayMode=button.dataset.liveMode;liveLimit=60;
  document.querySelectorAll("#nplay-live-mode button").forEach(b=>{b.setAttribute("aria-pressed",String(b===button));b.style.background=b===button?"#3973df":"#172944";});
  renderChannels(liveChannelData);
 });
 $("nplay-live-search")?.addEventListener("input",()=>{liveLimit=60;renderChannels(liveChannelData);});
 window.addEventListener("nplay:favorites-change",()=>renderChannels(liveChannelData));
 window.addEventListener("nplay:channel-play",event=>openChannel(event.detail));
 const openScope=scope=>{
  liveScope=scope;liveDisplayMode="Todos";liveRegion="Todos";liveLimit=60;livePreviews?.stop();
  const panel=$("iframe-channels-panel");if(!panel)return;panel.hidden=false;
  const heading=$("nplay-live-heading");if(heading)heading.textContent=scope==="musica"?"Escolha seu canal de música":"Encontre seu canal";
  const search=$("nplay-live-search");if(search){search.value="";search.placeholder=scope==="musica"?"Buscar canal de música":"Buscar canal ou categoria";search.setAttribute("aria-label",scope==="musica"?"Buscar canal de música":"Buscar canal ao vivo");}
  renderChannels(liveChannelData);load();
 };
 window.addEventListener("nplay:tv-open",()=>openScope("tv"));
 window.addEventListener("nplay:music-open",()=>openScope("musica"));
 if(location.hash==="#musica")openScope("musica");else load();

}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
