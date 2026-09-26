import fs from "node:fs";
import path from "node:path";
import slugify from "slugify";

const ROOT=process.cwd();
const sources=JSON.parse(fs.readFileSync(path.join(ROOT,"scripts/local-news/sources.json"),"utf8"));
const historyPath=path.join(ROOT,"scripts/local-news/history.json");
const history=JSON.parse(fs.readFileSync(historyPath,"utf8"));
history.published_ids??=[];
history.posts??=[];

const UA="NovaByteLucasAtualiza/2.0 (+https://novabytesolucoes.com.br/)";

function cleanText(html=""){
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&ccedil;/gi,"ç")
    .replace(/&atilde;/gi,"ã")
    .replace(/&aacute;/gi,"á")
    .replace(/&eacute;/gi,"é")
    .replace(/&iacute;/gi,"í")
    .replace(/&oacute;/gi,"ó")
    .replace(/&uacute;/gi,"ú")
    .replace(/\s+/g," ")
    .trim();
}
function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function localDate(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Cuiaba",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {iso:`${o.year}-${o.month}-${o.day}`,br:`${o.day}/${o.month}/${o.year}`};
}
function isLocal(t=""){
  const s=t.toLowerCase();
  return s.includes("lucas do rio verde")||s.includes("luverdense")||s.includes("luverdenses");
}
function categoryFor(t=""){
  const s=t.toLowerCase();
  if(/vaga|emprego|seletivo|concurso|curso|inscri/.test(s)) return "Empregos e oportunidades";
  if(/trânsito|br-163|rodovia|acidente|gcm|segurança|polícia/.test(s)) return "Trânsito e segurança";
  if(/evento|cultura|show|festival|corrida|esporte|jogos|dança|teatro/.test(s)) return "Eventos e lazer";
  if(/saúde|ubs|hospital|vacina|pam/.test(s)) return "Saúde";
  if(/obra|bairro|água|esgoto|saae|infraestrutura|habita/.test(s)) return "Cidade e serviços";
  if(/empresa|economia|investimento|agro|comércio|indústria/.test(s)) return "Economia";
  return "Lucas do Rio Verde";
}
async function fetchText(url){
  const r=await fetch(url,{headers:{"User-Agent":UA,"Accept-Language":"pt-BR,pt;q=0.9"},redirect:"follow",signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.text();
}
function absoluteUrl(href,base){
  try{return new URL(href,base).href}catch{return null}
}
function discoverLinks(html,base,sourceName){
  const out=[];
  const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while((m=re.exec(html))){
    const title=cleanText(m[2]);
    if(!title||title.length<20||!isLocal(title)) continue;
    const url=absoluteUrl(m[1],base);
    if(!url||!/^https?:/i.test(url)) continue;
    if(history.published_ids.includes(url)) continue;
    out.push({id:url,url,title,sourceName});
  }
  return out;
}
function extractMeta(html,name){
  const patterns=[
    new RegExp(`<meta[^>]+property=["']og:${name}["'][^>]+content=["']([^"']+)["']`,"i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,"i")
  ];
  for(const p of patterns){const m=html.match(p);if(m)return cleanText(m[1]);}
  return "";
}
function extractParagraphs(html){
  const out=[];
  const re=/<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while((m=re.exec(html))){
    const t=cleanText(m[1]);
    if(t.length<70) continue;
    if(/publicidade|cookies|política de privacidade|assine|compartilhe|whatsapp|facebook|instagram/i.test(t)) continue;
    out.push(t);
  }
  return [...new Set(out)].slice(0,14);
}
function compressSentence(text,max=190){
  let t=cleanText(text).replace(/^[-–—]\s*/,"");
  const first=t.split(/(?<=[.!?])\s+/)[0]||t;
  t=first;
  if(t.length>max){
    const cut=t.slice(0,max);
    t=cut.slice(0,cut.lastIndexOf(" ")).trim()+"…";
  }
  return t;
}
function practicalInfo(paras){
  const joined=paras.join(" ");
  const bits=[];
  const dates=[...joined.matchAll(/\b(?:segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:-feira)?[^.]{0,80}\b\d{1,2}h(?:\d{2})?\b/gi)].map(m=>m[0]);
  const money=[...joined.matchAll(/R\$\s?[\d\.]+(?:,\d{2})?/g)].map(m=>m[0]);
  const numbers=[...joined.matchAll(/\b\d{1,3}\s+(?:alunos|vagas|pessoas|atletas|famílias|empresas)\b/gi)].map(m=>m[0]);
  for(const x of [...dates,...money,...numbers]) if(!bits.includes(x)) bits.push(x);
  return bits.slice(0,5);
}
async function getCandidates(){
  const all=[];
  for(const src of sources){
    try{
      const html=await fetchText(src.url);
      all.push(...discoverLinks(html,src.url,src.name));
    }catch(e){console.warn(`Fonte indisponível: ${src.name}: ${e.message}`);}
  }
  const seen=new Set();
  return all.filter(x=>{if(seen.has(x.url))return false;seen.add(x.url);return true;}).slice(0,30);
}
async function enrich(candidate){
  const html=await fetchText(candidate.url);
  const paras=extractParagraphs(html);
  const metaDesc=extractMeta(html,"description")||extractMeta(html,"og:description");
  if(paras.join(" ").length<650) throw new Error("conteúdo insuficiente na matéria original");
  const facts=paras.slice(0,6).map(p=>compressSentence(p)).filter(Boolean);
  if(facts.length<3) throw new Error("poucos fatos extraídos");
  let title=candidate.title.replace(/[.!]+$/,"").trim();
  if(title.length>110){const c=title.slice(0,107);title=c.slice(0,c.lastIndexOf(" ")).trim();}
  const category=categoryFor(title+" "+facts.join(" "));
  const description=(metaDesc||facts[0]||title).slice(0,155);
  return {title,category,description,facts,practical:practicalInfo(paras),sourceName:candidate.sourceName,sourceUrl:candidate.url};
}
function renderArticle(a){
  const {title,description,category,sourceName,sourceUrl,slug,dateISO,dateBR,facts,practical}=a;
  const summary=facts.slice(0,2).join(" ");
  const schema=JSON.stringify({"@context":"https://schema.org","@type":"NewsArticle",headline:title,description,datePublished:dateISO,dateModified:dateISO,author:{"@type":"Organization",name:"NovaByte Soluções"},publisher:{"@type":"Organization",name:"NovaByte Soluções",url:"https://novabytesolucoes.com.br/"},about:{"@type":"City",name:"Lucas do Rio Verde"},mainEntityOfPage:`https://novabytesolucoes.com.br/${slug}.html`});
  const factHtml=facts.map((f,i)=>`<p>${i===0?"Segundo a fonte consultada, ":""}${esc(f)}</p>`).join("");
  const practicalHtml=practical.length?`<h2>Informações práticas</h2><ul>${practical.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:"";
  return `<!doctype html><html lang="pt-BR"><head>
<meta name="google-adsense-account" content="ca-pub-2466231259507657"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2466231259507657" crossorigin="anonymous"></script>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Lucas Atualiza</title>
<meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="https://novabytesolucoes.com.br/${slug}.html">
<meta property="og:type" content="article"><meta property="og:site_name" content="NovaByte Soluções"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="https://novabytesolucoes.com.br/${slug}.html"><meta property="og:image" content="https://novabytesolucoes.com.br/og-image.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/portal.css"><script type="application/ld+json">${schema}</script></head><body>
<header class="nb-header"><div><a class="nb-brand" href="/">NovaByte Soluções</a><nav><a href="/">Início</a><a href="/noticias-lucas-do-rio-verde.html">Lucas Atualiza</a><a href="/anuncia-lucas/">Anúncia Lucas</a><a href="/contato.html">Contato</a></nav></div></header>
<main class="nb-main"><p class="nb-crumbs"><a href="/">Início</a> › <a href="/noticias-lucas-do-rio-verde.html">Lucas Atualiza</a> › ${esc(title)}</p>
<p class="nb-meta">${esc(category.toUpperCase())} · ${dateBR}</p><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p>
<div class="nb-callout"><strong>Resumo</strong><p>${esc(summary)}</p></div>
<h2>O que aconteceu</h2>${factHtml}
${practicalHtml}
<h2>Contexto local</h2><p>O Lucas Atualiza reúne os principais pontos da informação para quem vive, trabalha ou empreende em Lucas do Rio Verde. Quando houver horários, inscrições, mudanças de serviço ou orientações oficiais, vale conferir a fonte original antes de sair de casa ou tomar uma decisão.</p>
<p class="nb-meta"><strong>Fonte:</strong> <a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">${esc(sourceName)}</a>. Resumo editorial da NovaByte Soluções com base na publicação original.</p>
<section class="nb-callout"><h2>Tem uma informação de Lucas?</h2><p>Empresas, eventos e iniciativas locais podem sugerir pautas para o Lucas Atualiza.</p><a class="nb-button" href="https://wa.me/5531983771576?text=Ol%C3%A1%21%20Quero%20enviar%20uma%20sugest%C3%A3o%20de%20pauta%20para%20o%20Lucas%20Atualiza." target="_blank" rel="noopener">Enviar sugestão ↗</a></section>
</main><footer class="nb-footer"><strong>Lucas Atualiza · NovaByte Soluções</strong><div>Informação local de Lucas do Rio Verde - MT.</div><nav><a href="/noticias-lucas-do-rio-verde.html">Notícias locais</a><a href="/anuncia-lucas/">Anúncia Lucas</a><a href="/sobre.html">Sobre</a><a href="/contato.html">Contato</a></nav></footer><script defer src="/portal-privacy.js"></script></body></html>`;
}
function card(p){return `<a class="nb-card" href="/${esc(p.slug)}.html"><span>${esc(p.category.toUpperCase())} · ${esc(p.date.split("-").reverse().join("/"))}</span><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><b>Ler notícia →</b><small>Fonte: ${esc(p.sourceName)}</small></a>`;}
function updateHub(){const file=path.join(ROOT,"noticias-lucas-do-rio-verde.html");let html=fs.readFileSync(file,"utf8");const cards=history.posts.slice(0,40).map(card).join("");const re=/<div class="nb-grid">[\s\S]*?<\/div>\s*<div class="local-callout">/;if(!re.test(html))throw new Error("Grade do Lucas Atualiza não encontrada.");html=html.replace(re,`<div class="nb-grid">${cards}</div>\n<div class="local-callout">`);fs.writeFileSync(file,html);}
function updateSitemap(slug,dateISO){const file=path.join(ROOT,"sitemap.xml");let xml=fs.readFileSync(file,"utf8");if(xml.includes(`/${slug}.html</loc>`))return;xml=xml.replace("</urlset>",`  <url><loc>https://novabytesolucoes.com.br/${slug}.html</loc><lastmod>${dateISO}</lastmod></url>\n</urlset>`);fs.writeFileSync(file,xml);}
async function main(){
  const candidates=await getCandidates();
  if(!candidates.length){console.log("Nenhuma notícia local inédita encontrada.");return;}
  let picked=null,article=null;
  for(const c of candidates){
    try{const a=await enrich(c);picked=c;article=a;break}catch(e){console.warn(`Pulando ${c.title}: ${e.message}`);}
  }
  if(!picked||!article){console.log("Nenhuma matéria com conteúdo suficiente encontrada.");return;}
  const slugBase=slugify(article.title,{lower:true,strict:true,locale:"pt",trim:true}).slice(0,82);
  const slug=`lucas-${slugBase}`;
  if(fs.existsSync(path.join(ROOT,`${slug}.html`))){history.published_ids.unshift(picked.id);fs.writeFileSync(historyPath,JSON.stringify(history,null,2)+"\n");return;}
  const {iso,br}=localDate();
  fs.writeFileSync(path.join(ROOT,`${slug}.html`),renderArticle({...article,slug,dateISO:iso,dateBR:br}));
  history.published_ids.unshift(picked.id);
  history.posts.unshift({slug,title:article.title,description:article.description,date:iso,category:article.category,sourceName:article.sourceName,source:article.sourceUrl});
  history.published_ids=history.published_ids.slice(0,600);history.posts=history.posts.slice(0,150);
  updateHub();updateSitemap(slug,iso);fs.writeFileSync(historyPath,JSON.stringify(history,null,2)+"\n");
  console.log(`Publicado: https://novabytesolucoes.com.br/${slug}.html`);
}
main().catch(e=>{console.error("Lucas Atualiza falhou:",e);process.exit(1);});
