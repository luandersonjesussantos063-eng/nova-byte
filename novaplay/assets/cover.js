/* NPlay — capinhas por título + miniaturas originais do Google Drive (quando acessíveis). */
(function(){
"use strict";
function esc(t){return String(t||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function paletteFor(title){
 const colors=[
  ["#071428","#2052a1","#4fd6ff"],
  ["#160d2a","#67349a","#e18cfe"],
  ["#071e26","#076e87","#7fe7dc"],
  ["#250d20","#853961","#ff9c96"],
  ["#1a1a2a","#505f9b","#adc9ff"],
  ["#151b27","#426b8e","#e7a85a"]
 ];
 let h=0;for(const c of String(title||""))h=(h*31+c.charCodeAt(0))>>>0;
 return colors[h%colors.length];
}
function linesOf(raw){
 const words=String(raw||"Filme NPlay").trim().replace(/\s+/g," ").split(" ");
 const result=[];let current="";
 for(const word of words){
  if((current+" "+word).trim().length>17&&current){result.push(current);current=word;}
  else current=(current+" "+word).trim();
  if(result.length===4)break;
 }
 if(result.length<4&&current)result.push(current);
 const limited=result.slice(0,4);
 if(limited.length&&words.join(" ").length>limited.join(" ").length)limited[limited.length-1]=limited[limited.length-1].slice(0,14)+"…";
 return limited;
}
function titleCard(title){
 const [a,b,light]=paletteFor(title);
 const lines=linesOf(title);
 const body=lines.map((line,i)=>'<text x="32" y="'+(435+i*54)+'" font-family="Arial,Helvetica,sans-serif" font-size="'+(line.length>17?29:37)+'" font-weight="800" fill="#ffffff">'+esc(line)+'</text>').join("");
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720" role="img" aria-label="'+esc(title)+'"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+a+'"/><stop offset=".75" stop-color="'+b+'"/><stop offset="1" stop-color="'+a+'"/></linearGradient><radialGradient id="shine"><stop stop-color="'+light+'" stop-opacity=".6"/><stop offset="1" stop-color="'+light+'" stop-opacity="0"/></radialGradient></defs><rect width="480" height="720" fill="url(#g)"/><circle cx="330" cy="210" r="230" fill="url(#shine)"/><path d="M-70 160 L550 70 M-50 250 L520 165 M-50 335 L520 250" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/><circle cx="280" cy="237" r="120" fill="#ffffff" fill-opacity=".06" stroke="#ffffff" stroke-opacity=".25" stroke-width="2"/><path d="M255 175 L345 237 L255 299Z" fill="#ffffff" fill-opacity=".35"/><rect x="0" y="370" width="480" height="350" fill="#050d1b" fill-opacity=".58"/><text x="32" y="62" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="900" letter-spacing="2" fill="#ffffff">N<tspan fill="'+light+'">PLAY</tspan></text>'+body+'<text x="32" y="683" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" letter-spacing="2" fill="#d9ecff">CATÁLOGO DE FILMES</text></svg>';
 return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
}
function driveThumbnail(id){
 if(!/^[A-Za-z0-9_-]{12,128}$/.test(String(id||"")))return null;
 return "https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz=w600";
}

const approvedAnimePosters=Object.freeze({
 "akudama drive legendado":"akudama",
 "another legendado":"another",
 "arcane legendado":"arcane",
 "arcane dublado":"arcane",
 "black clover dublado":"black-clover",
 "castelvania dublado":"castlevania",
 "castlevania dublado":"castlevania",
 "chiyu mahou no machigatta tsukaikata legendado":"chiyu",
 "date a live iv":"date-alive",
 "great pretender razbliuto filme":"great-pretender",
 "jibaku shounen hanako kun dublado":"hanako"
});
/* Capas NPlay produzidas em outubro de 2026, otimizadas para carregamento rápido. */
const premiumMovieCovers=Object.freeze({
 "a era do gelo":"a_era_do_gelo.avif",
 "a era do gelo 2":"a_era_do_gelo_2.avif",
 "a era do gelo 3":"a_era_do_gelo_3.avif",
 "a era do gelo 4":"a_era_do_gelo_4_v2.avif",
 "a familia do futuro":"a_familia_do_futuro_v2.avif"
});
const featuredMovieCovers=Object.freeze({
 "a era do gelo":"a_era_do_gelo",
 "a era do gelo 4":"a_era_do_gelo_4",
 "a familia do futuro":"a_familia_do_futuro",
 "a grande familia o roubo":"a_grande_familia_o_roubo",
 "a fantastica fabrica de chocolate":"a_fantastica_fabrica_de_chocolate"
});
const approvedCoversV2=Object.freeze({
 "a vinganca perfeita":"a_vinganca_perfeita",
 "a vizinhanca assombrada":"a_vizinhanca_assombrada",
 "another legendado":"another_legendado",
 "arcane legendado":"arcane_legendado",
 "belle e sebastian a aventura continua":"belle_e_sebastian_a_aventura_continua",
 "black clover dublado":"black_clover_dublado",
 "castelvania dublado":"castlevania_dublado",
 "castlevania dublado":"castlevania_dublado",
 "date a live iv":"date_a_live_iv",
 "great pretender razbliuto filme":"great_pretender_razbliuto_filme",
 "jibaku shounen hanako kun dublado":"jibaku_shounen_hanako_kun_dublado"
});
/* Capas exclusivas do segundo lote de animações. */
const operationAnimeCovers=Object.freeze({
 "arcane legendado":"arcane_legendado.avif",
 "another legendado":"another_legendado.avif",
 "black clover dublado":"black_clover_dublado.avif",
 "castelvania dublado":"castlevania_dublado.avif",
 "castlevania dublado":"castlevania_dublado.avif",
 "date a live iv":"date_a_live_iv.avif",
 "great pretender razbliuto filme":"great_pretender_razbliuto_filme.avif",
 "jibaku shounen hanako kun dublado":"jibaku_shounen_hanako_kun_dublado.avif",
 "3 palavrinhas completo":"3_palavrinhas_completo.avif"
});
/* Lote original em PNG 16:9, ilustrações autorais sem imagens oficiais. */
const originalSceneCovers=Object.freeze({
 "a casa monstro":"a_casa_monstro.png",
 "a dama e o vagabundo":"a_dama_e_o_vagabundo.png",
 "a fuga das galinhas":"a_fuga_das_galinhas.png",
 "a lenda dos guardioes":"a_lenda_dos_guardioes.png",
 "a nova onda do imperador":"a_nova_onda_do_imperador.png",
 "a origem dos guardioes":"a_origem_dos_guardioes.svg",
 "a pequena sereia":"fantasia_oceano_20261013.svg",
 "a princesa e o sapo":"fantasia_pantano_20261013.svg",
 "carros":"carros.svg",
 "toy story":"brinquedos_imaginacao_20261013.svg"
});
/* Capas de animações publicadas e conferidas, preferidas à miniatura do vídeo. */
function operationCover(title,admin){
 const key=String(title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
   .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
 const art=operationAnimeCovers[key];
 return art?(admin?"../":"./")+"assets/operation-covers/"+art+"?c=0.34.3":null;
}
function approvedAnimePoster(title,admin,genre,knownOnly){
 const key=String(title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
 const premium=premiumMovieCovers[key];
 if(premium)return(admin?"../":"./")+"assets/featured-covers/"+premium;
 const scene=originalSceneCovers[key];
 if(scene)return(admin?"../":"./")+"assets/scene-covers/"+scene+"?c=0.39.1-covers2";
 const operation=operationAnimeCovers[key];
 if(operation)return(admin?"../":"./")+"assets/operation-covers/"+operation+"?c=0.34.3";
 const featured=featuredMovieCovers[key];
 if(featured)return(admin?"../":"./")+"assets/featured-covers/"+featured+".jpg";
 const newer=approvedCoversV2[key];
 if(newer)return(admin?"../":"./")+"assets/approved-covers-v2/"+newer+".jpg";
 const slug=approvedAnimePosters[key];
 if(!slug)return knownOnly?null:genrePoster(title,genre);
 return(admin?"../":"./")+"assets/review-covers/"+slug+".png";
}

/* NPlay Studio: cartazes vetoriais individuais, um por título, sem usar fotogramas dos vídeos. */
function normalizeCoverText(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim()}
function genrePoster(title,genre){
 const raw=String(title||"Título sem nome").replace(/\s+/g," ").trim().slice(0,140);
 const category=normalizeCoverText(genre);
 const normalized=normalizeCoverText(raw);
 let hash=2166136261;
 for(const ch of normalized){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619)}
 hash>>>=0;
 const palettes=[
  ["#08172d","#174c8b","#4fd4ff"],["#1b092e","#4d2383","#e3a2ff"],
  ["#1e0b20","#822c50","#ffab92"],["#071f26","#126b83","#76f4de"],
  ["#221519","#8d5133","#ffdb8f"],["#091627","#263c8a","#accaff"],
  ["#21142b","#813b8e","#f7a8e6"],["#0d2527","#427d57","#c1efa4"]
 ];
 const known=category.includes("animacao")||category.includes("anime")?1:category.includes("terror")?2:category.includes("ficcao")?0:category.includes("aventura")?3:category.includes("acao")?4:category.includes("romance")?6:category.includes("comedia")?7:null;
 const colors=palettes[known??(hash%palettes.length)];
 const [dark,mid,glow]=colors;
 const label=genre&&category!=="importado - revisao"?String(genre).replace(/\s+/g," ").trim().slice(0,25).toUpperCase():"CINEMA · NPLAY";
 const symbols={
  star:'<path d="M240 126l34 103 110 1-89 65 33 105-88-65-88 65 33-105-89-65 110-1z"/>',
  mountain:'<path d="M60 370l95-158 60 78 58-123 142 203z"/>',
  bolt:'<path d="M273 98l-124 178h89l-33 159 142-214h-93z"/>',
  moon:'<path d="M295 115c-75 39-100 126-57 195 24 39 59 57 97 66-107 15-195-61-195-162 0-83 66-152 155-99z"/>',
  orbit:'<circle cx="240" cy="260" r="105"/><ellipse cx="240" cy="260" rx="174" ry="43" transform="rotate(-27 240 260)"/>',
  heart:'<path d="M240 365C198 334 113 268 113 215c0-65 82-91 127-32 45-59 127-33 127 32 0 53-85 119-127 150z"/>',
  sun:'<circle cx="240" cy="250" r="88"/><path d="M240 100v48m0 209v55M93 250h53m188 0h53M135 147l38 38m134 128 38 38m0-204-38 38M173 313l-38 38"/>',
  mask:'<path d="M135 145q106-64 210 0v128q0 91-105 137-105-46-105-137z"/><path d="M175 247q30-29 60 0m10 0q30-29 60 0M190 315q50 47 100 0"/>',
  frame:'<rect x="121" y="145" width="238" height="214" rx="28"/><circle cx="240" cy="252" r="75"/><circle cx="240" cy="252" r="33"/>'
 };
 let symbol=category.includes("terror")?symbols.moon:category.includes("romance")?symbols.heart:category.includes("anime")||category.includes("fantasia")?symbols.star:category==="acao"?symbols.bolt:category.includes("aventura")?symbols.mountain:category.includes("ficcao")?symbols.orbit:category.includes("comedia")||category.includes("animacao")?symbols.sun:category.includes("document")?symbols.frame:[symbols.orbit,symbols.mountain,symbols.mask,symbols.star][hash%4];
 let words=raw.split(" "), lines=[], current="";
 for(const w of words){
  if((current?current.length+1:0)+w.length>17&&current){lines.push(current);current=w}else current+=(current?" ":"")+w;
  if(lines.length>=4)break;
 }
 if(lines.length<4&&current)lines.push(current);
 if(words.join(" ").length>lines.join(" ").length)lines[3]=(lines[3]||"").slice(0,15).trimEnd()+"…";
 const longest=Math.max(1,...lines.map(x=>x.length));
 const size=longest>=21?30:longest>=18?33:longest>=15?38:43;
 const gap=size+10;
 const blockHeight=lines.length*gap;
 const y0=576-blockHeight/2;
 const titleSvg=lines.map((line,i)=>'<text x="240" y="'+Math.round(y0+i*gap)+'" text-anchor="middle" font-size="'+size+'" font-weight="900" letter-spacing="-.6" fill="#fff" stroke="#040714" stroke-width="1.2" paint-order="stroke">'+esc(line)+'</text>').join("");
 let dots="";
 for(let i=0;i<24;i++){
  const x=(hash+i*137+Math.floor(i*i*2.1))%480,y=(hash*3+i*179)%435;
  const radius=1+(i%3);
  dots+='<circle cx="'+x+'" cy="'+y+'" r="'+radius+'" fill="#fff" opacity="'+(0.1+(i%5)*0.06)+'"/>';
 }
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720" role="img" aria-label="Capa de '+esc(raw)+'">'
  +'<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="'+dark+'"/><stop offset=".55" stop-color="'+mid+'"/><stop offset="1" stop-color="'+dark+'"/></linearGradient><radialGradient id="halo"><stop stop-color="'+glow+'" stop-opacity=".63"/><stop offset="1" stop-color="'+glow+'" stop-opacity="0"/></radialGradient><linearGradient id="bottom" x2="0" y2="1"><stop stop-color="#080d1b" stop-opacity=".65"/><stop offset="1" stop-color="#030612" stop-opacity=".98"/></linearGradient></defs>'
  +'<rect width="480" height="720" fill="url(#bg)"/><circle cx="'+(200+hash%95)+'" cy="225" r="220" fill="url(#halo)"/>'
  +'<path d="M-30 74L520-20 M-30 157L520 63 M-30 420L520 326" stroke="#fff" stroke-opacity=".11" stroke-width="2"/>'
  +dots+'<circle cx="240" cy="249" r="160" fill="none" stroke="'+glow+'" stroke-opacity=".34" stroke-width="2"/><circle cx="240" cy="249" r="184" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="1"/>'
  +'<g fill="'+glow+'" fill-opacity=".15" stroke="'+glow+'" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" opacity=".9">'+symbol+'</g>'
  +'<path d="M0 423L480 378V720H0Z" fill="url(#bottom)"/>'
  +'<path d="M32 467H108" stroke="'+glow+'" stroke-width="5" stroke-linecap="round"/>'
  +'<text x="32" y="52" fill="#fff" font-size="23" font-family="Arial,sans-serif" font-weight="900" letter-spacing="1.7">N<tspan fill="'+glow+'">PLAY</tspan></text>'
  +'<text x="32" y="494" fill="'+glow+'" font-size="13" font-weight="800" font-family="Arial,sans-serif" letter-spacing="2">'+esc(label)+'</text>'
  +'<g font-family="Arial,Helvetica,sans-serif">'+titleSvg+'</g>'
  +'<path d="M32 655H448" stroke="#fff" stroke-opacity=".21"/><text x="240" y="681" text-anchor="middle" fill="#c8d5e9" font-size="13" font-family="Arial,sans-serif" letter-spacing="3">FILMES • SÉRIES • ANIMAÇÃO</text></svg>';
 return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
}
/* Ordem única de prioridade para o app e painel:
   1. Capa enviada no painel; 2. capa ilustrada local (inclusive Em breve);
   3. miniatura YouTube somente quando NÃO houver capa personalizada;
   4. cartaz temático individual como último recurso.
   Google Drive nunca define capa automaticamente. */
function selectPoster(title,admin,genre,customUrl,youtubeId){
 if(customUrl)return customUrl;
 const illustrated=approvedAnimePoster(title,admin,genre,true);
 if(illustrated)return illustrated;
 if(/^[A-Za-z0-9_-]{11}$/.test(String(youtubeId||"")))
  return "https://i.ytimg.com/vi/"+youtubeId+"/hqdefault.jpg";
 return genrePoster(title,genre)||titleCard(title);
}
window.NovaPlayCover=Object.freeze({titleCard,driveThumbnail,approvedAnimePoster,genrePoster,operationCover,selectPoster});
})();