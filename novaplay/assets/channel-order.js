/* Editorial order for the Todos TV grid; each station's variants stay together. */
(()=>{
 'use strict';
 const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[²³]/g,'').replace(/[^a-z0-9&!]+/g,' ').trim();
 const stations=[
  /^sport\s*tv\b|^sportv\b/,/^espn\b/,/^premiere\b/,/^combate\b/,/^band\s*sports?\b|^bandsports\b/,/^n\s*sports?\b|^nsports\b/,
  /^hbo\b/,/^telecine\b/,/^tnt\b/,/^warner\b/,/^sony\b/,/^universal\b/,/^megapix\b/,/^cinemax\b/,/^space\b/,/^paramount\b/,/^axn\b/,/^amc\b/,/^a\s*&\s*e\b/,/^fx\b/,
  /^globo\s*news\b|^globonews\b/,/^cnn\b/,/^band\s*news\b|^bandnews\b/,/^record\s*news\b|^recordnews\b/,/^jovem\s*pan\b|^jp\s*news\b/,
  /^cartoon\s*network\b/,/^nick(?:elodeon|\s|$)/,/^disney\b/,/^gloob\b/,/^discovery\s*kids\b/,/^cartoonito\b/,/^boomerang\b/,/^tooncast\b/,
  /^discovery\b/,/^history\b|^h2\b/,/^national\s*geographic\b|^nat\s*geo\b/,/^animal\s*planet\b/,/^off\b|^canal\s*off\b/,
  /^viva\b/,/^multishow\b/,/^gnt\b/,/^bis\b/,/^e!?(?:\s|$)/,/^tlc\b/,/^food\s*network\b/,
  /^(?:globo(?!\s*news)|gb)\b/,/^sbt\b/,/^record(?!\s*news)\b/,/^band(?!\s*(?:news|sports?))\b/,/^rede\s*tv\b|^redetv\b/,/^tv\s*cultura\b|^cultura\b/,
  /^tv\s*brasil\b/,/^rede\s*vida\b/,/^tv\s*aparecida\b/,/^rede\s*super\b/,/^tv\s*novo\s*tempo\b/,/^tv\s*camara\b/,/^tv\s*senado\b/
 ];
 function details(item){
  const name=normal(item.title),rank=stations.findIndex(pattern=>pattern.test(name));
  const base=name.replace(/\b(?:fhd|uhd|hd|sd|4k|8k|h264|h265|hevc)\b/g,'').replace(/\s+/g,' ').trim();
  const quality=/\b(?:4k|8k|uhd)\b/.test(name)?0:/\bfhd\b/.test(name)?1:/\bhd\b/.test(name)?2:/\bsd\b/.test(name)?3:2;
  return {rank:rank<0?1000:rank,base,quality,extra:/\b(?:extra|ppv|mosaico|backup|alternativo)\b/.test(name)?1:0};
 }
 function sort(channels){
  return channels.map((item,index)=>({item,index,...details(item)})).sort((a,b)=>a.rank-b.rank||a.extra-b.extra||a.base.localeCompare(b.base,'pt-BR',{numeric:true})||a.quality-b.quality||normal(a.item.title).localeCompare(normal(b.item.title),'pt-BR',{numeric:true})||a.index-b.index).map(row=>row.item);
 }
 window.NPlayChannelOrder=Object.freeze({sort});
})();
