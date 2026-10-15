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
let loadSequence=0,livePreviews=null,liveChannelData=[];
function note(message){const el=$("nplay-channel-notice");if(el)el.textContent=message}
function openChannel(item){
 livePreviews?.stop();
 const hls=item.stream_type==="hls"||/\.m3u8?(?:\?|$)/i.test(item.embed_url);
 const open=hls?window.NovaPlayPlayer?.openHls:window.NovaPlayPlayer?.openEmbed;
 if(!open?.(item.embed_url,item.title))console.warn("NPlay: não foi possível abrir o player do canal.");
}
async function load(){
 const list=$("iframe-channel-list");if(!list)return;
 const sequence=++loadSequence;
 note("Carregando canais publicados…");
 try{
  if(!window.supabase)throw Error("Cadastro de canais indisponível");
  const db=window.NPlayAccessClient||window.supabase.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
  const {data,error}=await db.from("novaplay_live_embeds").select("id,title,embed_url,stream_type,logo_url,category").eq("is_published",true).order("created_at",{ascending:false});
  if(error)throw error;
  if(sequence!==loadSequence)return;
  const channels=(data||[]).filter(item=>item.embed_url);
  window.NPlayHeroLive?.setChannels(channels);
  renderChannels(channels);
  note(channels.length?"":"Nenhum canal publicado no momento.");
 }catch(error){
  if(sequence!==loadSequence)return;
  renderChannels([]);note("Não foi possível carregar os canais publicados. Tente novamente em instantes.");
 }
}
function filterLiveChannels(channels,query){
 const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return channels.filter(item=>terms.every(term=>normalize(item.title+" "+(item.category||"")).includes(term)));
}
let liveDisplayMode="all";
function renderChannels(channels){
 liveChannelData=channels;
 const searched=filterLiveChannels(channels,$("nplay-live-search")?.value||"");
 const direct=item=>item.stream_type==="hls"||/\\.m3u8?(?:\\?|$)/i.test(item.embed_url||"")||/\\.(?:mp4|webm)(?:\\?|$)/i.test(item.embed_url||"");
 const visibleChannels=searched.filter(item=>liveDisplayMode==="all"||(liveDisplayMode==="direct"?direct(item):!direct(item)));
 const list=$("iframe-channel-list");if(!list)return;
 if(!livePreviews&&window.NPlayLivePreviews)livePreviews=window.NPlayLivePreviews.create(list);
 livePreviews?.reset();
 list.replaceChildren();
 const count=$("nplay-live-count");if(count)count.textContent=visibleChannels.length+" de "+channels.length+" canais";
 if(!visibleChannels.length&&channels.length){const empty=document.createElement("p");empty.className="nplay-channel-empty";empty.textContent="Nenhum canal encontrado. Tente outro nome ou categoria.";list.append(empty)}
 for(const item of visibleChannels){
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
   art.replaceChildren();
   const label=document.createElement("span");label.className="nplay-channel-wordmark";
   label.textContent=item.title.replace(/\s*·\s*Ao vivo$/i,"");art.append(label);
  };
  const sources=[CHANNEL_LOGOS[channelKey(item.embed_url)],item.logo_url].map(source=>{
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
  card.append(media,title,subtitle);list.append(card);
  if(item.stream_type==="hls"||/\.m3u8?(?:\?|$)/i.test(item.embed_url)){
   const sound=document.createElement("button");sound.type="button";sound.className="nplay-live-sound";sound.hidden=true;media.append(sound);
   livePreviews?.register({card,cover:button,sound,url:item.embed_url,title:item.title});
  }
 }
}
function init(){
 $("nplay-live-mode")?.addEventListener("click",event=>{
  const button=event.target.closest("button[data-live-mode]");if(!button)return;
  liveDisplayMode=button.dataset.liveMode;
  document.querySelectorAll("#nplay-live-mode button").forEach(b=>{b.setAttribute("aria-pressed",String(b===button));b.style.background=b===button?"#3973df":"#172944";});
  renderChannels(liveChannelData);
 });
 $("nplay-live-search")?.addEventListener("input",()=>renderChannels(liveChannelData));
 window.addEventListener("nplay:tv-open",()=>{const panel=$("iframe-channels-panel");if(panel){panel.hidden=false;load()}});
 load();

}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
