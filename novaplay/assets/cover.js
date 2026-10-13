/* NovaPlay — capinhas por título + miniaturas originais do Google Drive (quando acessíveis). */
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
 const words=String(raw||"Filme NovaPlay").trim().replace(/\s+/g," ").split(" ");
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
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720" viewBox="0 0 480 720" role="img" aria-label="'+esc(title)+'"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+a+'"/><stop offset=".75" stop-color="'+b+'"/><stop offset="1" stop-color="'+a+'"/></linearGradient><radialGradient id="shine"><stop stop-color="'+light+'" stop-opacity=".6"/><stop offset="1" stop-color="'+light+'" stop-opacity="0"/></radialGradient></defs><rect width="480" height="720" fill="url(#g)"/><circle cx="330" cy="210" r="230" fill="url(#shine)"/><path d="M-70 160 L550 70 M-50 250 L520 165 M-50 335 L520 250" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/><circle cx="280" cy="237" r="120" fill="#ffffff" fill-opacity=".06" stroke="#ffffff" stroke-opacity=".25" stroke-width="2"/><path d="M255 175 L345 237 L255 299Z" fill="#ffffff" fill-opacity=".35"/><rect x="0" y="370" width="480" height="350" fill="#050d1b" fill-opacity=".58"/><text x="32" y="62" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="900" letter-spacing="2" fill="#ffffff">NOVA<tspan fill="'+light+'">PLAY</tspan></text>'+body+'<text x="32" y="683" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" letter-spacing="2" fill="#d9ecff">CATÁLOGO DE FILMES</text></svg>';
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
/* Capas NovaPlay produzidas em outubro de 2026, otimizadas para carregamento rápido. */
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
function approvedAnimePoster(title,admin){
 const key=String(title||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
 const premium=premiumMovieCovers[key];
 if(premium)return(admin?"../":"./")+"assets/featured-covers/"+premium;
 const featured=featuredMovieCovers[key];
 if(featured)return(admin?"../":"./")+"assets/featured-covers/"+featured+".jpg";
 const newer=approvedCoversV2[key];
 if(newer)return(admin?"../":"./")+"assets/approved-covers-v2/"+newer+".jpg";
 const slug=approvedAnimePosters[key];
 if(!slug)return null;
 return(admin?"../":"./")+"assets/review-covers/"+slug+".png";
}

window.NovaPlayCover=Object.freeze({titleCard,driveThumbnail,approvedAnimePoster});
})();