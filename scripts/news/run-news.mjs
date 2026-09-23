import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import slugify from "slugify";
import OpenAI from "openai";
import { renderArticle, escapeHtml } from "./template.js";

const ROOT = process.cwd();
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "NovaByteAtualiza/1.0 (+https://novabytesolucoes.com.br/)" }
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY não configurada nos Secrets do GitHub.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

async function generateArticle(item, sourceText) {
  const prompt = `Você escreve para a área "NovaByte Atualiza", da NovaByte Soluções, um site brasileiro sobre desenvolvimento web, aplicativos, SEO e inteligência artificial.

Crie uma matéria ORIGINAL em português do Brasil com base SOMENTE nas informações fornecidas abaixo.

FONTE: ${item.sourceName}
TÍTULO ORIGINAL: ${item.title || ""}
URL: ${item.link || ""}
RESUMO DO FEED: ${cleanText(item.contentSnippet || item.content || "").slice(0, 2500)}
TEXTO EXTRAÍDO DA FONTE: ${sourceText}

Regras obrigatórias:
- Não copie frases da fonte. Parafraseie e contextualize.
- Não invente números, datas, produtos, recursos, resultados ou declarações que não estejam na fonte.
- Se algo não estiver claro, omita.
- Foque no que muda na prática para empresas, sites, SEO, desenvolvedores ou aplicativos.
- Não faça sensacionalismo.
- Não diga que a NovaByte testou algo que não testou.
- O texto deve ter entre 550 e 900 palavras.
- Use 4 a 6 subtítulos <h2>.
- Pode usar <p>, <h2>, <ul>, <li> e <strong>. Não use <html>, <body>, markdown ou links dentro do corpo.
- A meta description deve ter entre 120 e 155 caracteres.
- O título deve ser informativo e ter no máximo 90 caracteres.
- O resumo deve ter 2 ou 3 frases.
- Retorne apenas os campos solicitados.`;

  const response = await openai.responses.create({
    model: "gpt-5.6-luna",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "novabyte_news_article",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            summary: { type: "string" },
            contentHtml: { type: "string" }
          },
          required: ["title","description","summary","contentHtml"]
        }
      }
    }
  });
  const article = JSON.parse(response.output_text);
  validateArticle(article);
  return article;
}

async function generateImage(title, category, slug) {
  const response = await openai.images.generate({
    model: "gpt-image-2",
    prompt: `Editorial technology news cover for NovaByte Soluções. Topic: ${title}. Category: ${category}. Modern Brazilian technology publication, premium dark digital atmosphere, realistic devices or abstract interface elements when relevant, strong depth and lighting, clean composition, no text, no letters, no logos, no trademarks, no watermarks. Leave visual breathing room for use as a website article hero image.`,
    size: "1536x1024",
    quality: "low"
  });
  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("A API de imagem não retornou a capa.");
  const dir = path.join(ROOT, "assets/news");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.png`);
  fs.writeFileSync(file, Buffer.from(base64, "base64"));
  return `/assets/news/${slug}.png`;
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
  const article = await generateArticle(picked, sourceText);
  const slug = slugify(article.title, { lower: true, strict: true, locale: "pt", trim: true }).slice(0, 90);
  if (!slug) throw new Error("Não foi possível gerar slug.");
  if (fs.existsSync(path.join(ROOT, `${slug}.html`))) {
    history.published_ids.push(picked.id);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2) + "\n");
    console.log("Slug já existente; item marcado como processado.");
    return;
  }

  const { iso, br } = localDate();
  const imageUrl = await generateImage(article.title, picked.sourceCategory, slug);
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
