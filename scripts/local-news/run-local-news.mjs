import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import slugify from "slugify";

const ROOT = process.cwd();
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "NovaByteLucasAtualiza/1.0 (+https://novabytesolucoes.com.br/)" }
});

const sources = JSON.parse(fs.readFileSync(path.join(ROOT,"scripts/local-news/sources.json"),"utf8"));
const historyPath = path.join(ROOT,"scripts/local-news/history.json");
const history = JSON.parse(fs.readFileSync(historyPath,"utf8"));
history.published_ids ??= [];
history.posts ??= [];

const LOCAL_TERMS = ["lucas do rio verde","luverdense","luverdenses","lucas/mt","lucas - mt"];
const EXCLUDE = ["sinop","sorriso"];

// Evita publicar manchetes que mencionem Lucas só de passagem sem foco local.
function isLocal(text="") {
  const s = String(text).toLowerCase();
  return LOCAL_TERMS.some(k => s.includes(k));
}

function cleanText(html="") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;/gi,"'")
    .replace(/\s+/g," ")
    .trim();
}

function esc(value="") {
  return String(value)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"America/Cuiaba",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const o = Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return { iso:`${o.year}-${o.month}-${o.day}`, br:`${o.day}/${o.month}/${o.year}` };
}

function itemId(item) {
  return String(item.guid || item.id || item.link || item.title || "").trim();
}

function ageDays(item) {
  const d = new Date(item.isoDate || item.pubDate || 0);
  return Number.isNaN(d.valueOf()) ? 999 : (Date.now()-d.valueOf())/86400000;
}

function sourceFromGoogleTitle(title="") {
  const parts = cleanText(title).split(" - ");
  if (parts.length < 2) return { headline:cleanText(title), source:"Fonte original via Google Notícias" };
  return { headline:parts.slice(0,-1).join(" - ").trim(), source:parts.at(-1).trim() };
}

function categoryFor(text="") {
  const s=text.toLowerCase();
  if (/vaga|emprego|seletivo|concurso|curso|inscri/.test(s)) return "Empregos e oportunidades";
  if (/trânsito|br-163|rodovia|acidente|gcm|segurança|polícia/.test(s)) return "Trânsito e segurança";
  if (/evento|cultura|show|festival|corrida|esporte|jogos/.test(s)) return "Eventos e lazer";
  if (/saúde|ubs|hospital|vacina|pam/.test(s)) return "Saúde";
  if (/obra|bairro|água|esgoto|saae|infraestrutura|habita/.test(s)) return "Cidade e serviços";
  if (/empresa|economia|investimento|agro|comércio|indústria/.test(s)) return "Economia";
  return "Lucas do Rio Verde";
}

async function getCandidates() {
  const out=[];
  for (const src of sources) {
    try {
      const feed=await parser.parseURL(src.url);
      for (const item of (feed.items||[]).slice(0,20)) {
        const id=itemId(item);
        const combined=`${item.title||""} ${item.contentSnippet||""}`;
        if (!id || history.published_ids.includes(id) || !isLocal(combined)) continue;
        if (ageDays(item) > 7) continue;
        out.push({...item,id,sourceFeed:src.name});
      }
    } catch(e) {
      console.warn(`Fonte indisponível: ${src.name}: ${e.message}`);
    }
  }
  return out.sort((a,b)=>ageDays(a)-ageDays(b));
}

function buildPost(item) {
  const parsed=sourceFromGoogleTitle(item.title||"");
  let title=parsed.headline.replace(/[.!]+$/,"").trim();
  if (title.length>105) {
    const cut=title.slice(0,102);
    title=cut.slice(0,cut.lastIndexOf(" ")).trim();
  }
  const snippet=cleanText(item.contentSnippet || item.content || item.summary || "");
  const category=categoryFor(`${title} ${snippet}`);
  const description=(snippet || `Veja o que aconteceu em Lucas do Rio Verde e consulte a fonte original para mais detalhes.`).slice(0,155);
  const summary=(snippet || description).slice(0,430);
  return { title,description,summary,category,sourceName:parsed.source };
}

function renderArticle({title,description,summary,category,sourceName,sourceUrl,slug,dateISO,dateBR}) {
  const schema=JSON.stringify({
    "@context":"https://schema.org","@type":"NewsArticle",
    headline:title,description,datePublished:dateISO,dateModified:dateISO,
    author:{"@type":"Organization",name:"NovaByte Soluções"},
    publisher:{"@type":"Organization",name:"NovaByte Soluções",url:"https://novabytesolucoes.com.br/"},
    about:{"@type":"City",name:"Lucas do Rio Verde"},
    mainEntityOfPage:`https://novabytesolucoes.com.br/${slug}.html`
  });
  return `<!doctype html><html lang="pt-BR"><head>
<meta name="google-adsense-account" content="ca-pub-2466231259507657">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2466231259507657" crossorigin="anonymous"></script>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | Lucas Atualiza</title>
<meta name="description" content="${esc(description)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="https://novabytesolucoes.com.br/${slug}.html">
<meta property="og:type" content="article"><meta property="og:site_name" content="NovaByte Soluções">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="https://novabytesolucoes.com.br/${slug}.html"><meta property="og:image" content="https://novabytesolucoes.com.br/og-image.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/portal.css">
<script type="application/ld+json">${schema}</script></head><body>
<header class="nb-header"><div><a class="nb-brand" href="/">NovaByte Soluções</a><nav><a href="/">Início</a><a href="/noticias-lucas-do-rio-verde.html">Lucas Atualiza</a><a href="/anuncia-lucas/">Anúncia Lucas</a><a href="/contato.html">Contato</a></nav></div></header>
<main class="nb-main"><p class="nb-crumbs"><a href="/">Início</a> › <a href="/noticias-lucas-do-rio-verde.html">Lucas Atualiza</a> › ${esc(title)}</p>
<p class="nb-meta">${esc(category.toUpperCase())} · ${dateBR}</p><h1>${esc(title)}</h1><p class="lead">${esc(description)}</p>
<div class="nb-callout"><strong>Resumo</strong><p>${esc(summary)}</p></div>
<h2>O que aconteceu</h2><p>${esc(summary)}</p>
<h2>Por que isso importa para Lucas do Rio Verde</h2><p>O assunto tem impacto ou interesse direto para moradores, trabalhadores, empresas ou visitantes de Lucas do Rio Verde. O Lucas Atualiza reúne a informação em linguagem simples e mantém a fonte original disponível para conferência.</p>
<h2>Onde conferir as informações completas</h2><p>Como datas, horários, inscrições e orientações podem mudar, consulte sempre a publicação original antes de tomar qualquer decisão.</p>
<p class="nb-meta"><strong>Fonte:</strong> <a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer nofollow">${esc(sourceName)}</a>. Conteúdo resumido e contextualizado pela NovaByte Soluções.</p>
<section class="nb-callout"><h2>Tem uma informação de Lucas?</h2><p>Empresas, eventos e iniciativas locais podem sugerir pautas para o Lucas Atualiza.</p><a class="nb-button" href="https://wa.me/5531983771576?text=Ol%C3%A1%21%20Quero%20enviar%20uma%20sugest%C3%A3o%20de%20pauta%20para%20o%20Lucas%20Atualiza." target="_blank" rel="noopener">Enviar sugestão ↗</a></section>
</main><footer class="nb-footer"><strong>Lucas Atualiza · NovaByte Soluções</strong><div>Informação local de Lucas do Rio Verde - MT.</div><nav><a href="/noticias-lucas-do-rio-verde.html">Notícias locais</a><a href="/anuncia-lucas/">Anúncia Lucas</a><a href="/sobre.html">Sobre</a><a href="/contato.html">Contato</a></nav></footer>
<script defer src="/portal-privacy.js"></script></body></html>`;
}

function card(p) {
  return `<a class="nb-card" href="/${esc(p.slug)}.html"><span>${esc(p.category.toUpperCase())} · ${esc(p.date.split("-").reverse().join("/"))}</span><h2>${esc(p.title)}</h2><p>${esc(p.description)}</p><b>Ler notícia →</b><small>Fonte: ${esc(p.sourceName)}</small></a>`;
}

function updateHub() {
  const file=path.join(ROOT,"noticias-lucas-do-rio-verde.html");
  let html=fs.readFileSync(file,"utf8");
  const cards=history.posts.slice(0,40).map(card).join("");
  const re=/<div class="nb-grid">[\s\S]*?<\/div>\s*<div class="local-callout">/;
  if (!re.test(html)) throw new Error("Grade do Lucas Atualiza não encontrada.");
  html=html.replace(re,`<div class="nb-grid">${cards}</div>\n<div class="local-callout">`);
  fs.writeFileSync(file,html);
}

function updateSitemap(slug,dateISO) {
  const file=path.join(ROOT,"sitemap.xml");
  let xml=fs.readFileSync(file,"utf8");
  if (xml.includes(`/${slug}.html</loc>`)) return;
  xml=xml.replace("</urlset>",`  <url><loc>https://novabytesolucoes.com.br/${slug}.html</loc><lastmod>${dateISO}</lastmod></url>\n</urlset>`);
  fs.writeFileSync(file,xml);
}

async function main() {
  const candidates=await getCandidates();
  if (!candidates.length) { console.log("Nenhuma notícia local inédita encontrada."); return; }

  const picked=candidates[0];
  const post=buildPost(picked);
  if (!post.title || post.title.length<15) { console.log("Notícia sem título confiável."); return; }

  const slugBase=slugify(post.title,{lower:true,strict:true,locale:"pt",trim:true}).slice(0,82);
  const slug=`lucas-${slugBase}`;
  if (fs.existsSync(path.join(ROOT,`${slug}.html`))) {
    history.published_ids.unshift(picked.id);
    fs.writeFileSync(historyPath,JSON.stringify(history,null,2)+"\n");
    return;
  }

  const {iso,br}=localDate();
  fs.writeFileSync(path.join(ROOT,`${slug}.html`),renderArticle({
    ...post,slug,dateISO:iso,dateBR:br,sourceUrl:picked.link
  }));

  history.published_ids.unshift(picked.id);
  history.posts.unshift({
    slug,title:post.title,description:post.description,date:iso,category:post.category,
    sourceName:post.sourceName,source:picked.link
  });
  history.published_ids=history.published_ids.slice(0,600);
  history.posts=history.posts.slice(0,150);

  updateHub();
  updateSitemap(slug,iso);
  fs.writeFileSync(historyPath,JSON.stringify(history,null,2)+"\n");
  console.log(`Publicado: https://novabytesolucoes.com.br/${slug}.html`);
}

main().catch(err=>{console.error("Lucas Atualiza falhou:",err);process.exit(1);});
