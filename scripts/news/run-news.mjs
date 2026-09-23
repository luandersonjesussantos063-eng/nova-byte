import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import slugify from "slugify";
import { renderArticle, escapeHtml } from "./template.js";

const ROOT = process.cwd();
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "NovaByteAtualiza/1.0 (+https://novabytesolucoes.com.br/)" }
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
      for (const item of (feed.items || []).slice(0, 10)) {
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

async function fetchSourceText(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NovaByteAtualiza/1.0; +https://novabytesolucoes.com.br/)" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return "";
    const html = await res.text();
    return cleanText(html).slice(0, 14000);
  } catch {
    return "";
  }
}

function validateArticle(article) {
  if (!article || typeof article !== "object") throw new Error("A IA não retornou um artigo válido.");
  if (!article.title || article.title.length < 25 || article.title.length > 100) throw new Error("Título fora do padrão.");
  if (!article.description || article.description.length < 90 || article.description.length > 165) throw new Error("Meta description fora do padrão.");
  if (!article.summary || article.summary.length < 80) throw new Error("Resumo curto demais.");
  if (!article.contentHtml || article.contentHtml.length < 1200) throw new Error("Artigo curto demais.");
  if (!/<h2>/i.test(article.contentHtml)) throw new Error("Artigo sem subtítulos.");
}

function generateArticle(item) {
  const raw = cleanText(item.contentSnippet || item.content || item.summary || "");
  const excerpt = raw.split(/(?<=[.!?])\s+/).slice(0,3).join(" ").slice(0,650);
  const title = String(item.title || "Atualização de tecnologia").trim();
  const category = item.sourceCategory || "Tecnologia";
  const descriptionBase = `${title}. Veja o que essa atualização significa na prática para empresas, sites, aplicativos e profissionais.`;
  const description = descriptionBase.slice(0,155);
  const summary = excerpt || `A ${item.sourceName} publicou uma nova atualização relacionada a ${category.toLowerCase()}. A NovaByte reuniu os pontos principais e o impacto prático.`;
  const practical = category.toLowerCase().includes("android") ? "Para empresas e desenvolvedores, vale acompanhar como a mudança afeta desenvolvimento, compatibilidade e publicação de aplicativos." : category.toLowerCase().includes("seo") || category.toLowerCase().includes("search") ? "Para donos de sites, vale verificar se a mudança afeta indexação, conteúdo, desempenho ou visibilidade nas buscas." : "Para empresas e profissionais, a principal recomendação é avaliar se a novidade muda ferramentas, processos, desempenho ou experiência digital.";
  const body = [
    `<h2>O que foi anunciado</h2><p>${escapeHtml(summary)}</p>`,
    `<h2>Por que isso importa</h2><p>Esta atualização foi publicada por ${escapeHtml(item.sourceName)} e faz parte das mudanças recentes no ecossistema de ${escapeHtml(category)}. A NovaByte acompanha essas fontes oficiais para destacar apenas novidades com impacto prático.</p>`,
    `<h2>O que muda na prática</h2><p>${escapeHtml(practical)}</p>`,
    `<h2>O que vale acompanhar agora</h2><p>Como a atualização pode evoluir ou ganhar novos detalhes, vale acompanhar a documentação oficial e testar mudanças antes de aplicá-las em produção.</p>`
  ].join("");
  return { title, description, summary, contentHtml: body };
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
  if (!re.test(html)) throw new Error("Não encontrei a seção NovaByte Atualiza na home.");
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

  const picked = candidates[0];
  console.log(`Tema selecionado: ${picked.title} (${picked.sourceName})`);
  const sourceText = await fetchSourceText(picked.link);
  const article = generateArticle(picked);
  const slug = slugify(article.title, { lower: true, strict: true, locale: "pt", trim: true }).slice(0, 90);
  if (!slug) throw new Error("Não foi possível gerar slug.");
  if (fs.existsSync(path.join(ROOT, `${slug}.html`))) {
    history.published_ids.push(picked.id);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + "\n");
    console.log("Slug já existente; item marcado como processado.");
    return;
  }

  const { iso, br } = localDate();
  const html = renderArticle({
    title: article.title,
    description: article.description,
    slug,
    dateBR: br,
    dateISO: iso,
    summary: article.summary,
    contentHtml: article.contentHtml,
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
    image: "/og-image.png",
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
