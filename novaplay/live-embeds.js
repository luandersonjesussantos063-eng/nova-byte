(()=>{
"use strict";
const $=id=>document.getElementById(id);
const PROVIDER="https://rdcanais.org/premiereclubes";
const CHANNEL_LOGOS={"adultswim":"https://cdn.reidoscanais.si/imagens/adultswim.png","ae":"https://cdn.reidoscanais.si/imagens/ae.png","agromais":"https://cdn.reidoscanais.si/imagens/agromais.png","amc":"https://cdn.reidoscanais.si/imagens/amc.png","animalplanet":"https://cdn.reidoscanais.si/imagens/animalplanet.png","arte1":"https://cdn.reidoscanais.si/imagens/arte1.png","axn":"https://cdn.reidoscanais.si/imagens/axn.png","band":"https://cdn.reidoscanais.si/imagens/band.png","bandnews":"https://cdn.reidoscanais.si/imagens/bandnews.png","bis":"https://cdn.reidoscanais.si/imagens/bis.png","canal-brasil":"https://cdn.reidoscanais.si/imagens/canalbrasil.png","canaloff":"https://cdn.reidoscanais.si/imagens/canaloff.png","cartoonnetwork":"https://cdn.reidoscanais.si/imagens/cartoonnetwork.webp","cartoonito":"https://cdn.reidoscanais.si/imagens/cartoonito.webp","cazetv":"https://cdn.reidoscanais.si/imagens/cazetv.webp","cazetv2":"https://cdn.reidoscanais.si/imagens/cazetv.webp","cazetv3":"https://cdn.reidoscanais.si/imagens/cazetv.webp","cinemax":"https://cdn.reidoscanais.si/imagens/cinemax.png","cnnbrasil":"https://cdn.reidoscanais.si/imagens/cnnbrasil.png","combate":"https://cdn.reidoscanais.si/imagens/combate.png","curta":"https://cdn.reidoscanais.si/imagens/curta.png","discoverychannel":"https://cdn.reidoscanais.si/imagens/discoverychannel.webp","discoveryheh":"https://cdn.reidoscanais.si/imagens/discoveryheh.webp","discoveryid":"https://cdn.reidoscanais.si/imagens/discoveryid.png","discoverykids":"https://cdn.reidoscanais.si/imagens/discoverykids.png","discoveryscience":"https://cdn.reidoscanais.si/imagens/discoveryscience.webp","discoverytheater":"https://cdn.reidoscanais.si/imagens/discoverytheater.png","discoveryturbo":"https://cdn.reidoscanais.si/imagens/discoveryturbo.png","discoveryworld":"https://cdn.reidoscanais.si/imagens/discoveryworld.png","e":"https://cdn.reidoscanais.si/imagens/e.png","fashiontv":"https://cdn.reidoscanais.si/imagens/fashiontv.png","fishtv":"https://cdn.reidoscanais.si/imagens/fishtv.png","foodnetwork":"https://cdn.reidoscanais.si/imagens/foodnetwork.png","futura":"https://cdn.reidoscanais.si/imagens/futura.png","globo":"https://cdn.reidoscanais.si/imagens/tvglobo.png","globonews":"https://cdn.reidoscanais.si/imagens/globonews.png","globoplaynovelas":"https://cdn.reidoscanais.si/imagens/globoplaynovelas.png","gloob":"https://cdn.reidoscanais.si/imagens/gloob.png","gloobinho":"https://cdn.reidoscanais.si/imagens/gloobinho.png","gnt":"https://cdn.reidoscanais.si/imagens/gnt.png","hbo":"https://cdn.reidoscanais.si/imagens/hbo.png","hbo2":"https://cdn.reidoscanais.si/imagens/hbo2.png","hbofamily":"https://cdn.reidoscanais.si/imagens/hbofamily.png","hbopop":"https://cdn.reidoscanais.si/imagens/hbopop.webp","hbosignature":"https://cdn.reidoscanais.si/imagens/hbosignature.png","hboxtreme":"https://cdn.reidoscanais.si/imagens/hboxtreme.png","hboplus":"https://cdn.reidoscanais.si/imagens/hboplus.png","hgtv":"https://cdn.reidoscanais.si/imagens/hgtv.png","history":"https://cdn.reidoscanais.si/imagens/history.webp","history2":"https://cdn.reidoscanais.si/imagens/history2.png","jpnews":"https://cdn.reidoscanais.si/imagens/jpnews.webp","lifetime":"https://cdn.reidoscanais.si/imagens/lifetime.png","megapix":"https://cdn.reidoscanais.si/imagens/megapix.png","modoviagem":"https://cdn.reidoscanais.si/imagens/modoviagem.svg","multishow":"https://cdn.reidoscanais.si/imagens/multishow.png","nsports":"https://cdn.reidoscanais.si/imagens/nsports.png","paramountplus":"https://cdn.reidoscanais.si/imagens/paramountplus.png","paramountplus2":"https://cdn.reidoscanais.si/imagens/paramountplus.png","paramountplus3":"https://cdn.reidoscanais.si/imagens/paramountplus.png","paramountplus4":"https://cdn.reidoscanais.si/imagens/paramountplus.png","premiereclubes":"https://cdn.reidoscanais.si/imagens/premiere.png","premiere2":"https://cdn.reidoscanais.si/imagens/premiere.png","premiere3":"https://cdn.reidoscanais.si/imagens/premiere.png","premiere4":"https://cdn.reidoscanais.si/imagens/premiere.png","premiere5":"https://cdn.reidoscanais.si/imagens/premiere.png","premiere6":"https://cdn.reidoscanais.si/imagens/premiere.png","premiere7":"https://cdn.reidoscanais.si/imagens/premiere.png","premiere8":"https://cdn.reidoscanais.si/imagens/premiere.png","record":"https://cdn.reidoscanais.si/imagens/record.png","recordnews":"https://cdn.reidoscanais.si/imagens/recordnews.png","redetv":"https://cdn.reidoscanais.si/imagens/redetv.png","saborearte":"https://cdn.reidoscanais.si/imagens/saborearte.png","sbt":"https://cdn.reidoscanais.si/imagens/sbt.png","sbtnews":"https://cdn.reidoscanais.si/imagens/sbtnews.png","sonychannel":"https://cdn.reidoscanais.si/imagens/sonychannel.png","sonymovies":"https://cdn.reidoscanais.si/imagens/sonymovies.png","space":"https://cdn.reidoscanais.si/imagens/space.png","sportv":"https://cdn.reidoscanais.si/imagens/sportv.png","sportv2":"https://cdn.reidoscanais.si/imagens/sportv.png","sportv3":"https://cdn.reidoscanais.si/imagens/sportv.png","sportynet":"https://cdn.reidoscanais.si/imagens/sportynet.avif","sportynetplus":"https://cdn.reidoscanais.si/imagens/sportynet.avif","sportynetplus2":"https://cdn.reidoscanais.si/imagens/sportynet.avif","sportynetplus3":"https://cdn.reidoscanais.si/imagens/sportynet.avif","studiouniversal":"https://cdn.reidoscanais.si/imagens/studiouniversal.png","telecineaction":"https://cdn.reidoscanais.si/imagens/telecineaction.png","telecinecult":"https://cdn.reidoscanais.si/imagens/telecinecult.png","telecinefun":"https://cdn.reidoscanais.si/imagens/telecinefun.png","telecinepipoca":"https://cdn.reidoscanais.si/imagens/telecinepipoca.png","telecinepremium":"https://cdn.reidoscanais.si/imagens/telecinepremium.png","telecinetouch":"https://cdn.reidoscanais.si/imagens/telecinetouch.png","tlc":"https://cdn.reidoscanais.si/imagens/tlc.png","tnt":"https://cdn.reidoscanais.si/imagens/tnt.png","tntnovelas":"https://cdn.reidoscanais.si/imagens/tntnovelas.png","tntseries":"https://cdn.reidoscanais.si/imagens/tntseries.png","tooncast":"https://cdn.reidoscanais.si/imagens/tooncast.png","aparecida":"https://cdn.reidoscanais.si/imagens/aparecida.png","tvbrasil":"https://cdn.reidoscanais.si/imagens/tvbrasil.png","tvcultura":"https://cdn.reidoscanais.si/imagens/tvcultura.png","universaltv":"https://cdn.reidoscanais.si/imagens/universaltv.png","usa":"https://cdn.reidoscanais.si/imagens/usa.png","warnertv":"https://cdn.reidoscanais.si/imagens/warnertv.png","woohoo":"https://cdn.reidoscanais.si/imagens/woohoo.png","xsports":"https://cdn.reidoscanais.si/imagens/xsports.png"};
function imageUrl(value){
 const raw=typeof value==="string"?value:value?.url||value?.src;
 if(!raw)return "";
 try{const url=new URL(raw,"https://api.reidoscanais.si/");return url.protocol==="https:"?url.href:""}catch{return ""}
}
function channelKey(url){try{return new URL(url).pathname.replace(/\/+$/,"").split("/").pop()}catch{return ""}}
function channelIdentity(url){try{const u=new URL(url);return u.origin+u.pathname.replace(/\/+$/,"")+u.search}catch{return url}}
let currentUrl="",currentTitle="";
const player=()=>$("iframe-channel-player");
function note(message){const el=$("nplay-channel-notice");if(el)el.textContent=message}
function closeChannel(){
 const el=player();if(el)el.replaceChildren();
 currentUrl="";currentTitle="";
 $("iframe-channel-viewer").hidden=true;
 note("");
}
function openChannel(url,title){
 let parsed;
 try{parsed=new URL(url);if(parsed.protocol!=="https:")throw Error("HTTPS necessário")}catch(e){note("Endereço do canal inválido.");return}
 currentUrl=parsed.href;currentTitle=title;
 const el=player();el.replaceChildren();
 const frame=document.createElement("iframe");
 frame.src=currentUrl;frame.title=title;
 frame.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
 frame.allowFullscreen=true;

 frame.loading="eager";
 frame.referrerPolicy="strict-origin-when-cross-origin";
 frame.style.cssText="display:block;width:100%;height:100%;border:0;background:#000";
 // O provedor bloqueia iframe sandboxed. Mantemos incorporação padrão sem alterar o conteúdo remoto.
 el.append(frame);
 $("iframe-channel-heading").textContent=title;
 $("iframe-channel-viewer").hidden=false;
 note(currentUrl.includes("rdcanais.org")?"Transmissão incorporada de site externo. O fornecedor pode exibir anúncios ou abrir outras abas. Som baixo? Confira também o volume dentro do player e o volume de mídia do aparelho.":"Transmissão incorporada de fonte externa. Som baixo? Confira também o volume dentro do player e o volume de mídia do aparelho.");
 $("iframe-channel-viewer").scrollIntoView({behavior:"smooth",block:"start"});
}
async function load(){
 const list=$("iframe-channel-list");if(!list)return;
 list.replaceChildren();
 // Players publicados nas páginas oficiais das emissoras. Preservamos os
 // controles e anúncios da origem; nenhum sinal é retransmitido pela NPlay.
 const channels=[
  {title:"TV Gazeta",logo_url:"./assets/channel-logos/tv-gazeta.webp",embed_url:"https://geo.dailymotion.com/player/xb2fp.html?video=x9xwtpy",source_page:"https://www.tvgazeta.com.br/aovivo/"},
  {title:"TV Assembleia MT",logo_url:"./assets/channel-logos/assembleia-mt.png",dark_logo:true,embed_url:"https://owncast.al.mt.gov.br/embed/video",source_page:"https://www.al.mt.gov.br/institucional/tv/14/10/2026"},
  {title:"Premiere Clubes · Ao vivo",embed_url:PROVIDER},
  {title:"Paramount+ 2 · Ao vivo",embed_url:"https://rdcanais.org/paramountplus2"},
  {title:"TNT Novelas · Ao vivo",embed_url:"https://rdcanais.org/tntnovelas"},
  {title:"Discovery Kids · Ao vivo",embed_url:"https://rdcanais.org/discoverykids"},
  {title:"Discovery Home & Health · Ao vivo",embed_url:"https://rdcanais.org/discoveryheh"},
  {title:"HBO+ · Ao vivo",embed_url:"https://rdcanais.org/hboplus"},
  {title:"Gloob · Ao vivo",embed_url:"https://rdcanais.org/gloob"}
 ];
 // Sincronização dinâmica: a API fornece os canais ativos.
 // Em caso de falha de rede/CORS, os canais já cadastrados permanecem disponíveis.
 try{
  const response=await fetch("https://api.reidoscanais.si/channels",{headers:{Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error("HTTP "+response.status);
  const payload=await response.json();
  const records=Array.isArray(payload.data)?payload.data:payload.data?.channels;
  if(payload.success!==true||!Array.isArray(records))throw Error("Formato inesperado");
  const existing=new Map(channels.map(x=>[channelIdentity(x.embed_url),x]));
  for(const entry of records){
   const url=entry?.embeds?.find(x=>typeof x?.embed_url==="string"&&x.embed_url.startsWith("https://"))?.embed_url;
   if(!url)continue;
   const metadata={logo_url:imageUrl(entry.logo_url||entry.logo||entry.image||entry.thumbnail||entry.poster),category:typeof entry.category==="string"?entry.category:entry.category?.name||"",epg:entry.epg||null};
   const identity=channelIdentity(url),known=existing.get(identity);
   if(known){if(metadata.logo_url)known.logo_url=metadata.logo_url;known.category=metadata.category;known.epg=metadata.epg;continue}
   const item={title:String(entry.name||entry.title||entry.id||"Canal"),embed_url:url,...metadata};
   existing.set(identity,item);channels.push(item);
  }
 }catch(error){console.warn("NPlay: API de canais indisponível",error);note("Não foi possível sincronizar a API agora. Os canais existentes continuam disponíveis.");}
 if(window.supabase){
  try{
   const db=window.supabase.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
   const {data,error}=await db.from("novaplay_live_embeds").select("id,title,embed_url").eq("is_published",true).order("created_at",{ascending:false});
   if(error)throw error;
   const seen=new Set(channels.map(item=>item.embed_url));
   for(const item of data||[]){
    if(!item.embed_url||seen.has(item.embed_url))continue;
    seen.add(item.embed_url);channels.push(item);
   }
  }catch(e){note("Alguns canais cadastrados não puderam ser carregados. O Premiere Clubes continua disponível.")}
 }

 for(const item of channels){
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
  const sources=[item.logo_url,CHANNEL_LOGOS[channelKey(item.embed_url)]].map(source=>{
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
  button.onclick=()=>openChannel(item.embed_url,item.title);
  card.append(button,title,subtitle);list.append(card);
 }
}
function init(){
 window.addEventListener("nplay:tv-open",()=>{const panel=$("iframe-channels-panel");if(panel){panel.hidden=false;load()}});
 if(location.hash==="#tv")load();
 $("iframe-channel-close").onclick=closeChannel;
 const reload=$("nplay-channel-reload");
 if(reload)reload.onclick=()=>{if(currentUrl)openChannel(currentUrl,currentTitle)};
 const fullscreen=$("nplay-channel-fullscreen");
 if(fullscreen)fullscreen.onclick=async()=>{const el=player();if(!el||!currentUrl)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await el.requestFullscreen()}catch(e){note("Tela cheia não está disponível neste navegador.")}};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
