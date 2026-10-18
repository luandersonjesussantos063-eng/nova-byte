/* Classificação da seleção YouTube; os vídeos continuam no catálogo do criador. */
(function(root){
"use strict";
const categories=Object.freeze(["Filmes completos","Documentários","Humor","Curtas e animações"]);
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function category(item){
 const genre=normalize(item.category||item.genre);
 if(/filmes? completos?/.test(genre))return categories[0];
 if(/document/.test(genre))return categories[1];
 if(/humor|comedia|stand.?up|esquete/.test(genre))return categories[2];
 if(/curta|animac/.test(genre))return categories[3];
 return categories[0];
}
function select(items){
 const seen=new Set();
 return items.filter(item=>{
  if(item.catalogOnly||item.mode!=="youtube"||!/^[A-Za-z0-9_-]{11}$/.test(item.youtube_id||"")||seen.has(item.youtube_id))return false;
  seen.add(item.youtube_id);return true;
 });
}
function channel(item){return String(item.description||"").match(/^Canal:\s*(.+)$/m)?.[1]?.trim()||"YouTube"}
function comedy(items){return select(items).filter(item=>/humor|comedia|stand.?up|esquete/.test(normalize(item.category||item.genre)))}
root.NPlayYouTube=Object.freeze({categories,category,select,channel,comedy});
})(window);
