import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import slugify from "slugify";
import { renderArticle, escapeHtml } from "./template.js";

const ROOT = process.cwd();
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "NovaByteAtualiza/2.0 (+https://novabytesolucoes.com.br/)" }
});

const sourcesPath = path.join(ROOT, "scripts/news/sources.json");
const historyPath = path.join(ROOT, "scripts/news/history.json");
const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
history.published_ids ??= [];
history.posts ??= [];

const KEYWORDS = [
  "ai","ia","artificial intelligence","search","seo","google","android","app","apps",
  "web","website","site","security","segurança","performance","chrome","developer",
  "gemini","mobile","play","ranking","indexing","indexação","search console"
];

function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const iso = `${obj.year}-${obj.month}-${obj.day}`;
  const br = `${obj.day}/${obj.month}/${obj.year}`;
  return { iso, br };
}

function cleanText(html = "") {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function itemId(item) {
  return String(item.guid || item.id || item.link || item.title || "").trim();
}

function itemScore(item) {
  const text = `${item.title || ""} ${item.contentSnippet || ""}`.toLowerCase();
  let score = KEYWORDS.reduce((n, k) => n + (text.includes(k) ? 2 : 0), 0);
  const date = new Date(item.isoDate || item.pubDate || 0);
  if (!Number.isNaN(date.valueOf())) {
    const ageDays = (Date.now() - date.valueOf()) / 86400000;
    if (ageDays <= 2) score += 8;
    else if (ageDays <= 7) score += 5;
    else if (ageDays <= 14) score += 2;
    else score -= 10;
  }
  return score;
}

async function getCandidates() {
  const all = [];
  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);
      for (const item of (feed.items || []).slice(0, 12)) {
        const id = itemId(item);
        if (!id || history.published_ids.includes(id)) continue;
        all.push({ ...item, sourceName: source.name, sourceCategory: source.category, id });
      }
    } catch (error) {
      console.warn(`Fonte indisponível: ${source.name}: ${error.message}`);
    }
  }
  return all.sort((a,b) => itemScore(b) - itemScore(a));
}

function looksEnglish(text = "") {
  const s = ` ${text.toLowerCase()} `;
  const english = [" the "," and "," with "," for "," your "," new "," to "," from "," developers "," update "," app "," apps "," search "," now "," introduces "," introducing "," unified "," view "," device "," libraries "," security "," building "," using "," launch "," announcing "," bring "," land "," what "," why "," how "];
  const portuguese = [" o "," a "," os "," as "," de "," do "," da "," para "," com "," novo "," nova "," aplicativo "," atualização "," busca "," segurança "," informações "," dispositivos "," veja "," como "," chega "," muda "];
  const en = english.filter(w => s.includes(w)).length;
  const pt = portuguese.filter(w => s.includes(w)).length;

  // Títulos em inglês costumam ter poucos conectivos detectáveis, mas várias
  // palavras fortes de manchete. Isso evita publicar títulos inteiros em inglês.
  const strongEnglish = ["introducing","unified","device","libraries","developers","announcing","building","using","security","launch","bring","land"];
  const strongHits = strongEnglish.filter(w => s.includes(` ${w} `)).length;

  return en > pt + 1 || (strongHits >= 2 && pt < 2);
}

async function translateToPt(text = "") {
  const input = cleanText(text).slice(0, 430);
  if (!input || !looksEnglish(input)) return input;
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", input);
    url.searchParams.set("langpair", "en|pt-BR");
    const res = await fetch(url, {
      headers: { "User-Agent": "NovaByteAtualiza/2.0" },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return "";
    const data = await res.json();
    const translated = cleanText(data?.responseData?.translatedText || "");
    if (!translated || looksEnglish(translated)) return "";
    return translated;
  } catch {
    return "";
  }
}

function sentenceSummary(text = "") {
  const clean = cleanText(text)
    .replace(/^Posted by[^.]{0,180}\.?\s*/i, "")
    .replace(/^Publicado por[^.]{0,180}\.?\s*/i, "");
  return clean.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 520).trim();
}

function polishTitle(title = "", category = "") {
  let t = cleanText(title)
    .replace(/[.!]+$/g, "")
    .replace(/^Traga seu jogo para Android para a tela do carro hoje$/i, "Android leva jogos para a tela do carro: veja como funciona")
    .replace(/^Leve seu jogo para Android para a tela do carro hoje$/i, "Android leva jogos para a tela do carro: veja como funciona")
    .replace(/^Traga seus jogos para Android para a tela do carro hoje$/i, "Android leva jogos para a tela do carro: veja como funciona")
    .replace(/^Conheça (.+)$/i, "$1: veja o que muda")
    .replace(/^Apresentando (.+)$/i, "$1 chega com novidades")
    .replace(/^Como trazer (.+)$/i, "$1: veja como funciona");

  if (/^como\s+/i.test(t) && !/[?:]/.test(t)) t = t.replace(/^como\s+/i, "") + ": veja como funciona";
  if (/\bhoje$/i.test(t) && t.length > 55) t = t.replace(/\s+hoje$/i, "");
  if (t.length > 88) {
    const cut = t.slice(0, 85);
    const lastSpace = cut.lastIndexOf(" ");
    t = (lastSpace > 55 ? cut.slice(0,lastSpace) : cut).trim();
  }
  return t;
}

function practicalText(category = "") {
  const c = category.toLowerCase();
  if (c.includes("android") || c.includes("aplicativo")) {
    return "Para empresas e desenvolvedores, o ponto principal é acompanhar compatibilidade, adaptação de interfaces, testes em diferentes formatos de tela e mudanças que possam afetar a publicação de aplicativos.";
  }
  if (c.includes("seo") || c.includes("search") || c.includes("google")) {
    return "Para quem depende do Google, vale verificar se a atualização muda indexação, apresentação dos resultados, conteúdo, desempenho ou a forma como as páginas são descobertas.";
  }
  if (c.includes("web") || c.includes("performance")) {
    return "Para sites e sistemas web, vale observar impacto em desempenho, compatibilidade, experiência no celular e boas práticas de desenvolvimento.";
  }
  return "Para empresas e profissionais, vale avaliar se a novidade muda ferramentas, processos, experiência digital ou oportunidades de automação.";
}

async function generateArticle(item) {
  const rawTitle = cleanText(item.title || "Atualização de tecnologia");
  const rawSnippet = sentenceSummary(item.contentSnippet || item.content || item.summary || "");
  const translatedTitle = await translateToPt(rawTitle);
  const title = polishTitle(translatedTitle, item.sourceCategory || "Tecnologia");
  const snippet = await translateToPt(rawSnippet);

  if (!title || title.length < 18 || looksEnglish(title)) throw new Error("Título não ficou confiável em português.");
  if (!snippet || snippet.length < 45 || looksEnglish(snippet)) throw new Error("Resumo não ficou confiável em português.");

  const category = item.sourceCategory || "Tecnologia";
  const descriptionBase = `${title}. Entenda a novidade e o impacto prático para empresas, sites, aplicativos e profissionais.`;
  const description = descriptionBase.slice(0, 155);
  const summary = snippet.slice(0, 520);

  const body = [
    `<h2>O que foi anunciado</h2><p>Segundo a ${escapeHtml(item.sourceName)}, ${escapeHtml(summary.charAt(0).toLowerCase() + summary.slice(1))}</p>`,
    `<h2>Por que isso importa</h2><p>A atualização entra no radar da NovaByte porque está ligada a ${escapeHtml(category.toLowerCase())}. Em vez de reproduzir a publicação original, destacamos o ponto central e o que merece atenção para quem trabalha ou investe em tecnologia.</p>`,
    `<h2>O que muda na prática</h2><p>${escapeHtml(practicalText(category))}</p>`,
    `<h2>O que vale acompanhar agora</h2><p>A recomendação é acompanhar a documentação oficial e esperar detalhes adicionais quando a novidade ainda estiver em implantação. Mudanças técnicas devem ser testadas antes de entrar em produção.</p>`
  ].join("");

  return { title, description, summary, contentHtml: body };
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapTitle(text, max = 30) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function generateCover({ title, category, dateBR, slug }) {
  const lines = wrapTitle(title);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#07111f"/>
    <stop offset="58%" stop-color="#0d2740"/>
    <stop offset="100%" stop-color="#173f5e"/>
  </linearGradient>
  <radialGradient id="glow">
    <stop offset="0%" stop-color="#70c8fb" stop-opacity=".28"/>
    <stop offset="100%" stop-color="#70c8fb" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<circle cx="1040" cy="120" r="260" fill="url(#glow)"/>
<circle cx="1080" cy="600" r="330" fill="#ffffff" opacity=".025"/>
<path d="M870 70 L1120 190 L1010 440 L780 320 Z" fill="none" stroke="#70c8fb" stroke-opacity=".12" stroke-width="2"/>
<text x="72" y="78" fill="#70c8fb" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" letter-spacing="2">NOVABYTE ATUALIZA</text>
<rect x="72" y="112" width="410" height="44" rx="22" fill="#102d49" stroke="#376889"/>
<text x="94" y="141" fill="#d8efff" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="700">${escapeXml(category.toUpperCase().slice(0,38))}</text>
${lines.map((line,i)=>`<text x="72" y="${245+i*66}" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="48" font-weight="700">${escapeXml(line)}</text>`).join("")}
<text x="72" y="570" fill="#a9c4da" font-family="Arial,Helvetica,sans-serif" font-size="22">${escapeXml(dateBR)}  •  novabytesolucoes.com.br</text>
<text x="1080" y="560" text-anchor="middle" fill="#70c8fb" font-family="Arial,Helvetica,sans-serif" font-size="68" font-weight="800">N·B</text>
</svg>`;

  const dir = path.join(ROOT, "assets/news");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${slug}.svg`);
  fs.writeFileSync(out, svg, "utf8");
  return `/assets/news/${slug}.svg`;
}

function renderNewsCard(post) {
  return `<a class="nb-card" href="/${escapeHtml(post.slug)}.html"><span>${escapeHtml(post.category.toUpperCase())} · ${escapeHtml(post.date.split("-").reverse().join("/"))}</span><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(post.description)}</p><b>Ler notícia →</b></a>`;
}

function updateHub() {
  const file = path.join(ROOT, "noticias-tecnologia.html");
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, "utf8");
  const cards = history.posts.slice(0, 30).map(renderNewsCard).join("");
  const re = /<div class="nb-grid">[\s\S]*?<\/div><div class="nb-callout">/;
  if (!re.test(html)) throw new Error("Não encontrei a grade de notícias em noticias-tecnologia.html.");
  html = html.replace(re, `<div class="nb-grid">${cards}</div><div class="nb-callout">`);
  fs.writeFileSync(file, html);
}

function updateHome() {
  const file = path.join(ROOT, "index.html");
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, "utf8");
  const latest = history.posts.slice(0, 3);
  const cards = latest.map(post => `<a class="studio-service" href="/${escapeHtml(post.slug)}.html"><span class="service-number">${escapeHtml(post.date.slice(8,10)+"/"+post.date.slice(5,7))}</span><div class="service-icon" aria-hidden="true">✦</div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.description)}</p><div class="service-tags"><span>${escapeHtml(post.category)}</span></div></a>`).join("");
  const replacement = `<section class="shell studio-section" aria-labelledby="news-title"><div class="section-intro"><div><p class="section-index">NovaByte Atualiza</p><h2 id="news-title">Tecnologia muda rápido.<br>A gente traduz o que importa.</h2></div><p>Notícias sobre IA, Google, SEO, Android e aplicativos com foco no impacto real para empresas e projetos digitais.</p></div><div class="services-grid">${cards}</div><p><a class="text-link" href="/noticias-tecnologia.html">Ver todas as notícias <span aria-hidden="true">↗</span></a></p></section>`;
  const re = /<section class="shell studio-section" aria-labelledby="news-title">[\s\S]*?<\/section>/;
  if (!re.test(html)) {
    console.log("Home comercial sem bloco dinâmico de notícias; atualização da home ignorada.");
    return;
  }
  html = html.replace(re, replacement);
  fs.writeFileSync(file, html);
}

function updateSitemap(slug, dateISO) {
  const file = path.join(ROOT, "sitemap.xml");
  let xml = fs.readFileSync(file, "utf8");
  if (xml.includes(`/${slug}.html</loc>`)) return;
  const entry = `  <url><loc>https://novabytesolucoes.com.br/${slug}.html</loc><lastmod>${dateISO}</lastmod></url>\n`;
  xml = xml.replace("</urlset>", entry + "</urlset>");
  fs.writeFileSync(file, xml);
}

async function main() {
  const candidates = await getCandidates();
  if (!candidates.length) {
    console.log("Nenhuma novidade inédita encontrada nas fontes configuradas.");
    return;
  }

  let picked = null;
  let article = null;
  for (const candidate of candidates.slice(0, 8)) {
    try {
      const candidateArticle = await generateArticle(candidate);
      picked = candidate;
      article = candidateArticle;
      break;
    } catch (error) {
      console.warn(`Pulando "${candidate.title}": ${error.message}`);
    }
  }

  if (!picked || !article) {
    console.log("Nenhuma notícia passou no filtro de português e qualidade hoje.");
    return;
  }

  console.log(`Tema selecionado: ${picked.title} (${picked.sourceName})`);
  const slug = slugify(article.title, { lower: true, strict: true, locale: "pt", trim: true }).slice(0, 90);
  if (!slug) throw new Error("Não foi possível gerar slug.");
  if (fs.existsSync(path.join(ROOT, `${slug}.html`))) {
    history.published_ids.push(picked.id);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + "\n");
    console.log("Slug já existente; item marcado como processado.");
    return;
  }

  const { iso, br } = localDate();
  const imageUrl = generateCover({ title: article.title, category: picked.sourceCategory, dateBR: br, slug });
  const html = renderArticle({
    title: article.title,
    description: article.description,
    slug,
    dateBR: br,
    dateISO: iso,
    summary: article.summary,
    contentHtml: article.contentHtml,
    imageUrl,
    sourceName: picked.sourceName,
    sourceUrl: picked.link,
    category: picked.sourceCategory
  });

  fs.writeFileSync(path.join(ROOT, `${slug}.html`), html);
  history.published_ids.unshift(picked.id);
  history.posts.unshift({
    slug,
    title: article.title,
    description: article.description,
    date: iso,
    category: picked.sourceCategory,
    image: imageUrl,
    source: picked.link
  });
  history.published_ids = history.published_ids.slice(0, 500);
  history.posts = history.posts.slice(0, 100);

  updateHub();
  updateHome();
  updateSitemap(slug, iso);
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + "\n");
  console.log(`Publicado: https://novabytesolucoes.com.br/${slug}.html`);
}

main().catch(error => {
  console.error("NovaByte Atualiza falhou:", error);
  process.exit(1);
});
