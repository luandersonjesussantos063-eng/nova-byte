/* One card per station, with an editorial order for the live catalog. */
(()=>{
 'use strict';
 const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[²³]/g,'').replace(/[^a-z0-9&!]+/g,' ').trim();
 const sourceTitle=item=>String(item.originalTitle||item.liveRecord?.title||item.title||'');
 function name(item){
  const raw=typeof item==='string'?item:String(item.title||'');
  let title=raw.replace(/\[[^\]]*\]/g,' ').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g,'')
   .replace(/\b(?:FULL\s*HD|FHDR|FHD|UHD|HD|SD|HDR|[248]K|H\.?26[45]|HEVC|AVC|\d{3,4}[pi]|\d{2}FPS)\d*\b/gi,' ')
   .replace(/\s*[·|]\s*ao vivo\s*$/i,'').replace(/\b(?:backup|alternativ[oa]|op[cç][aã]o|servidor)\s*\d*\b/gi,' ')
   .replace(/\(\s*\)|\[\s*\]/g,' ').replace(/^[\s·|:–-]+|[\s·|:–-]+$/g,'').replace(/\s+/g,' ').trim();
  const token=normal(title).replace(/[^a-z0-9]/g,'');
  if(/^(?:(?:tv|rede)\s+)?(?:globo|gb)(?:\s|$)/i.test(title)&&!/^globo\s*(?:news|play)/i.test(title))return 'Globo';
  if(/^sbt(?:\s|$)/i.test(title)&&!/^sbt\s*news\b/i.test(title))return 'SBT';
  if(/^(?:record(?:\s*tv)?|tv\s+record)(?:\s|$)/i.test(title)&&!/^record\s*news\b/i.test(title))return 'Record';
  if(/^band(?:\s|$)/i.test(title)&&!/^band\s*(?:news|sports?)\b/i.test(title))return 'Band';
  const numbered=token.match(/^(sportv|espn|premiere)(\d*)$/);
  if(numbered){const label={sportv:'SporTV',espn:'ESPN',premiere:'Premiere'}[numbered[1]];return label+(numbered[2]&&Number(numbered[2])>1?' '+Number(numbered[2]):'');}
  const aliases={premiereclubes:'Premiere',espnbrasil:'ESPN',globonews:'GloboNews',recordnews:'Record News',sbtnews:'SBT News',bandsports:'BandSports',bandnews:'BandNews',nick:'Nickelodeon',nickonline:'Nickelodeon',nickelodeon:'Nickelodeon',nickelodeonbrasil:'Nickelodeon',nickjr:'Nick Jr.',nickjunior:'Nick Jr.',cartoonnetwork:'Cartoon Network',cartoonnetworkbrasil:'Cartoon Network',comedycentral:'Comedy Central',comedycentralbrasil:'Comedy Central',warner:'Warner TV',warnerchannel:'Warner TV',warnertv:'Warner TV',sony:'Sony Channel',sonychannel:'Sony Channel',universal:'Universal TV',universalchannel:'Universal TV',universaltv:'Universal TV',discovery:'Discovery Channel',discoverychannel:'Discovery Channel',discoveryheh:'Discovery Home & Health',discoveryhomehealth:'Discovery Home & Health',discoveryhomeandhealth:'Discovery Home & Health',discoveryid:'Investigation Discovery',investigationdiscovery:'Investigation Discovery',natgeo:'National Geographic',nationalgeographic:'National Geographic',h2:'History 2',history2:'History 2',ae:'A&E',e:'E!',cnnbrasil:'CNN Brasil'};
  return aliases[token]||title||'Canal ao vivo';
 }
 function key(item){return name(item).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\+/g,' plus ').replace(/[^a-z0-9]/g,'');}
 const stations=[
  /^sport\s*tv\b|^sportv\b/,/^espn\b/,/^premiere\b/,/^combate\b/,/^band\s*sports?\b|^bandsports\b/,/^n\s*sports?\b|^nsports\b/,/^caze\s*tv\b|^cazetv\b/,
  /^hbo\b/,/^telecine\b/,/^tnt\b/,/^warner\b/,/^sony\b/,/^universal\b/,/^megapix\b/,/^cinemax\b/,/^space\b/,/^paramount\b/,/^axn\b/,/^amc\b/,/^a\s*&\s*e\b/,/^fx\b/,
  /^globo\s*news\b|^globonews\b/,/^cnn\b/,/^band\s*news\b|^bandnews\b/,/^record\s*news\b|^recordnews\b/,/^jovem\s*pan\b|^jp\s*news\b/,
  /^cartoon\s*network\b/,/^nick(?:elodeon|\s|$)/,/^disney\b/,/^gloob\b/,/^discovery\s*kids\b/,/^cartoonito\b/,/^boomerang\b/,/^tooncast\b/,
  /^discovery\b/,/^history\b|^h2\b/,/^national\s*geographic\b|^nat\s*geo\b/,/^animal\s*planet\b/,/^off\b|^canal\s*off\b/,
  /^viva\b/,/^multishow\b/,/^gnt\b/,/^bis\b/,/^e!?(?:\s|$)/,/^tlc\b/,/^food\s*network\b/,/^comedy\s*central\b/,
  /^(?:globo(?!\s*news)|gb)\b/,/^sbt\b/,/^record(?!\s*news)\b/,/^band(?!\s*(?:news|sports?))\b/,/^rede\s*tv\b|^redetv\b/,/^tv\s*cultura\b|^cultura\b/,
  /^tv\s*brasil\b/,/^rede\s*vida\b/,/^tv\s*aparecida\b/,/^rede\s*super\b/,/^tv\s*novo\s*tempo\b/,/^tv\s*camara\b/,/^tv\s*senado\b/
 ];
 function details(item){
  const title=normal(name(item)),rank=stations.findIndex(pattern=>pattern.test(title)),raw=normal(sourceTitle(item));
  const quality=/\bfhd\b|\b1080[pi]\b/.test(raw)?0:/\bhd\b|\b720p\b/.test(raw)?1:/\b(?:4k|8k|uhd|fhdr)\b/.test(raw)?2:/\bsd\b/.test(raw)?3:4;
  const extra=/\b(?:extra|ppv|mosaico|backup|alternativo)\b/.test(raw)?1:0;
  const tier=/\[(?:US|USA|PT|ES|UK|AR|UY)\]/i.test(sourceTitle(item))?3:extra?2:rank<0?1:0;
  return {rank:rank<0?1000:rank,base:key(item),quality,extra,tier};
 }
 function sort(channels){
  return channels.map((item,index)=>({item,index,...details(item)})).sort((a,b)=>a.tier-b.tier||a.rank-b.rank||a.extra-b.extra||a.base.localeCompare(b.base,'pt-BR',{numeric:true})||a.quality-b.quality||normal(a.item.title).localeCompare(normal(b.item.title),'pt-BR',{numeric:true})||a.index-b.index).map(row=>row.item);
 }
 function preference(item){
  const raw=sourceTitle(item),title=normal(raw);
  return [/\[(?:US|USA|PT|ES|UK|AR|UY)\]/i.test(raw)?1:0,
   /\[(?:L|LEG)\]|backup|alternativ|(?:fhd|hd|sd)[²³⁴2-9]/i.test(raw)?1:0,
   /^(?:hls|mpegts)$/.test(item.stream_type||item.mode||'')?0:1,
   details(item).quality,
   /\b(?:nacional|sp capital|sp sp|sao paulo)\b/.test(title)?0:/\brj capital\b/.test(title)?1:2];
 }
 function compareSources(a,b){
  const aa=preference(a),bb=preference(b);
  for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];
  return String(a.id||'').localeCompare(String(b.id||''),'en');
 }
 function unique(channels){
  const groups=new Map();
  for(const item of channels){const id=key(item);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(item);}
  return [...groups.values()].map(variants=>{
   const best=variants.reduce((a,b)=>compareSources(a,b)<=0?a:b);
   return {...best,title:name(best),originalTitle:sourceTitle(best),
    channelNames:[...new Set(variants.flatMap(x=>x.channelNames||[sourceTitle(x)]))],
    channelCategories:[...new Set(variants.flatMap(x=>x.channelCategories||[x.category||'']))]};
  });
 }
 window.NPlayChannelOrder=Object.freeze({sort,unique,key,name});
})();
