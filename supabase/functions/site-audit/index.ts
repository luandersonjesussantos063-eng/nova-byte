import {validateUrl,safeFetch} from "./safe-http.mjs";

const ALLOWED_ORIGINS = new Set([
  "https://novabytesolucoes.com.br",
  "https://www.novabytesolucoes.com.br",
  "https://luandersonjesussantos063-eng.github.io",
]);

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://novabytesolucoes.com.br";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options":"nosniff", "Referrer-Policy":"no-referrer" },
  });
}

async function readLimited(res: Response, maxBytes = 1_200_000) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const size = chunks.reduce((n,c)=>n+c.byteLength,0);
  const out = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return new TextDecoder("utf-8").decode(out);
}

function one(html: string, re: RegExp) {
  return html.match(re)?.[1]?.trim() || "";
}
function count(html: string, re: RegExp) {
  return [...html.matchAll(re)].length;
}
function stripTags(s: string) {
  return s.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function hasMeta(html: string, name: string) {
  const a = new RegExp('<meta[^>]+name=["\\\']'+name+'["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']','i');
  const b = new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+name=["\\\']'+name+'["\\\']','i');
  return one(html,a) || one(html,b);
}
function getCanonical(html: string) {
  return one(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
         one(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
}

function issue(title:string, detail:string, severity:"high"|"medium"|"low", category="SEO") {
  return { title, detail, severity, category };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origem não autorizada." }, 403, origin);

  try {
    if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'Envie os dados em JSON.'},415,origin);
    const reader=req.body?.getReader();let rawBody='',bodySize=0;
    if(reader){const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;bodySize+=value.byteLength;if(bodySize>4096){await reader.cancel();return json({error:'Dados excessivos.'},413,origin);}rawBody+=decoder.decode(value,{stream:true});}rawBody+=decoder.decode();}
    let body;try{body=JSON.parse(rawBody)}catch{return json({error:'Dados inválidos.'},400,origin);}

    let raw = String(body?.url || "").trim();
    if (!raw) return json({ error: "Informe o endereço do site." }, 400, origin);
    if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    const target = validateUrl(raw);
    const base=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!base||!secret)return json({error:'Serviço temporariamente indisponível.'},503,origin);
    const signingKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const ip=req.headers.get('x-forwarded-for')?.split(',').pop()?.trim()||'unknown';
    const digest=await crypto.subtle.sign('HMAC',signingKey,new TextEncoder().encode('audit:'+ip));
    const identity=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const permit=await fetch(base+'/rest/v1/rpc/nb_security_reserve',{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({p_identity:identity,p_scope:'site-audit'}),signal:AbortSignal.timeout(5000)});
    if(!permit.ok)return json({error:'Não foi possível validar o limite de uso. Tente novamente mais tarde.'},503,origin);
    if(await permit.json()!==true)return json({error:'Limite de análises atingido. Aguarde antes de tentar novamente.'},429,origin);

    const { res, url, elapsed } = await safeFetch(target);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return json({ error: "O endereço não retornou uma página HTML." }, 400, origin);
    }
    const html = await readLimited(res);
    const lower = html.toLowerCase();

    const title = one(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = hasMeta(html, "description");
    const viewport = hasMeta(html, "viewport");
    const robotsMeta = hasMeta(html, "robots");
    const canonical = getCanonical(html);
    const lang = one(html, /<html[^>]+lang=["']([^"']+)["']/i);
    const h1s = count(html, /<h1\b[^>]*>/gi);
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);
    const imgsNoAlt = imgs.filter(tag=>!(/\balt\s*=\s*["'][^"']*["']/i.test(tag))).length;
    const links = count(html, /<a\b[^>]+href=/gi);
    const text = stripTags(html);
    const words = text ? text.split(/\s+/).length : 0;
    const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
    const hasOgDesc = /<meta[^>]+property=["']og:description["']/i.test(html);
    const hasSchema = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
    const https = url.protocol === "https:";
    const h2s = count(html, /<h2\b[^>]*>/gi);
    const h3s = count(html, /<h3\b[^>]*>/gi);
    const forms = count(html, /<form\b[^>]*>/gi);
    const buttons = count(html, /<button\b[^>]*>/gi);
    const hasHeader = /<header\b/i.test(html);
    const hasMain = /<main\b/i.test(html);
    const hasFooter = /<footer\b/i.test(html);
    const hasNav = /<nav\b/i.test(html);
    const hasWhatsapp = /wa\.me\/|api\.whatsapp\.com\/|whatsapp/i.test(html);
    const hasPhone = /href=["']tel:/i.test(html);
    const hasEmail = /href=["']mailto:/i.test(html);
    const hasContactLink = /href=["'][^"']*(contato|contact)[^"']*["']/i.test(html);
    const hasCtaText = /(orçamento|orcamento|fale conosco|falar conosco|chame no whatsapp|whatsapp|comprar|agendar|solicitar|começar|comecar|contratar|pedir agora|saiba mais)/i.test(text);
    const hasTrustSignals = /(depoimentos?|avaliações?|avaliacoes|clientes|portfólio|portfolio|projetos|quem somos|sobre nós|sobre nos|política de privacidade|politica de privacidade|termos)/i.test(text);
    const hasPriceSignals = /(r\$|preço|preco|a partir de|mensalidade|plano)/i.test(text);

    let robotsTxt = { found:false, status:0 };
    let sitemap = { found:false, status:0 };
    try {
      const robotsUrl = new URL("/robots.txt", url);
      const rr = await safeFetch(robotsUrl, 7000, 2);
      robotsTxt = { found: rr.res.ok, status: rr.res.status };
    } catch {}
    try {
      const smUrl = new URL("/sitemap.xml", url);
      const sr = await safeFetch(smUrl, 7000, 2);
      sitemap = { found: sr.res.ok, status: sr.res.status };
    } catch {}

    const issues = [];
    if (!res.ok) issues.push(issue("Página retornou status HTTP "+res.status, "A página principal deve responder normalmente para visitantes e mecanismos de busca.", "high", "Disponibilidade"));
    if (!https) issues.push(issue("Site sem HTTPS", "Use HTTPS para proteger a navegação e evitar alertas de segurança.", "high", "Segurança"));
    if (!title) issues.push(issue("Título da página ausente", "Adicione um elemento title claro e específico para a página.", "high"));
    else if (title.length < 20 || title.length > 65) issues.push(issue("Título pode ser melhorado", "O título tem "+title.length+" caracteres. Mantenha-o claro e descritivo, evitando extremos de tamanho.", "medium"));
    if (!description) issues.push(issue("Meta description ausente", "Adicione uma descrição que resuma o conteúdo e ajude a contextualizar a página.", "medium"));
    else if (description.length < 70 || description.length > 170) issues.push(issue("Meta description pode ser ajustada", "A descrição tem "+description.length+" caracteres.", "low"));
    if (h1s === 0) issues.push(issue("Nenhum H1 encontrado", "Use um título principal H1 que represente claramente o assunto da página.", "high"));
    else if (h1s > 1) issues.push(issue("Mais de um H1 encontrado", "A página possui "+h1s+" elementos H1. Revise a hierarquia de títulos.", "medium"));
    if (!viewport) issues.push(issue("Viewport mobile ausente", "Inclua a meta viewport para adaptação correta em celulares.", "high", "Mobile"));
    if (!canonical) issues.push(issue("URL canônica ausente", "Defina rel=canonical para indicar a versão preferencial da página.", "medium"));
    if (robotsMeta.toLowerCase().includes("noindex")) issues.push(issue("Página marcada como noindex", "A meta robots contém noindex e pode impedir a indexação desta página.", "high"));
    if (!robotsTxt.found) issues.push(issue("robots.txt não encontrado", "Publique um robots.txt na raiz do domínio para orientar rastreadores.", "medium"));
    if (!sitemap.found) issues.push(issue("sitemap.xml não encontrado", "Um sitemap ajuda mecanismos de busca a descobrir páginas importantes.", "medium"));
    if (imgsNoAlt > 0) issues.push(issue("Imagens sem atributo alt", imgsNoAlt+" imagem(ns) não possuem atributo alt detectável.", "medium", "Acessibilidade"));
    if (!lang) issues.push(issue("Idioma da página não definido", "Defina o atributo lang no elemento html.", "low", "Acessibilidade"));
    if (!hasOgTitle || !hasOgDesc) issues.push(issue("Metadados sociais incompletos", "Open Graph ajuda no compartilhamento da página em redes e mensageiros.", "low", "Compartilhamento"));
    if (!hasSchema) issues.push(issue("Dados estruturados não detectados", "Schema.org pode ajudar mecanismos de busca a entender entidades e conteúdo.", "low"));
    if (words < 150) issues.push(issue("Pouco conteúdo textual detectado", "A página possui aproximadamente "+words+" palavras visíveis. Conteúdo útil e específico pode melhorar contexto e relevância.", "medium", "Conteúdo"));
    if (words >= 150 && words < 300) issues.push(issue("Conteúdo pode ser aprofundado", "A página possui aproximadamente "+words+" palavras. Para páginas de serviço, vale avaliar se responde dúvidas, benefícios e objeções do visitante.", "low", "Conteúdo"));
    if (h2s === 0 && words > 250) issues.push(issue("Conteúdo sem subtítulos H2", "Textos maiores ficam mais fáceis de ler e entender quando são divididos em seções claras.", "medium", "Conteúdo"));
    if (!hasCtaText && !hasWhatsapp && !hasContactLink) issues.push(issue("Chamada para ação pouco clara", "Não detectamos uma chamada evidente para orçamento, contato, compra ou próximo passo.", "high", "Conversão"));
    if (!hasWhatsapp && !hasPhone && !hasEmail && !hasContactLink && forms === 0) issues.push(issue("Contato direto não detectado", "Facilite a conversão com WhatsApp, telefone, e-mail, formulário ou uma página de contato visível.", "high", "Conversão"));
    if (!hasTrustSignals) issues.push(issue("Poucos sinais de confiança detectados", "Considere apresentar projetos, clientes, avaliações, informações sobre a empresa, políticas ou outros elementos que reforcem credibilidade.", "medium", "Conversão"));
    if (!hasNav) issues.push(issue("Navegação principal não detectada", "Uma navegação clara ajuda visitantes a encontrar serviços, informações e contato.", "medium", "UX"));
    if (!hasMain || !hasHeader || !hasFooter) issues.push(issue("Estrutura semântica pode melhorar", "Não detectamos todos os elementos estruturais principais (header, main e footer). Isso pode afetar organização e acessibilidade.", "low", "UX"));
    if (elapsed > 3000) issues.push(issue("Resposta inicial lenta", "O servidor levou cerca de "+(elapsed/1000).toFixed(1)+"s para responder nesta verificação.", "medium", "Desempenho"));

    const penalty = (severity:string, high=14, medium=7, low=3) => severity === "high" ? high : severity === "medium" ? medium : low;
    let seo = 100, contentScore = 100, conversion = 100, ux = 100;
    for (const i of issues) {
      if (i.category === "SEO" || i.category === "Conteúdo" || i.category === "Mobile") seo -= penalty(i.severity);
      if (i.category === "Conteúdo" || i.category === "SEO") contentScore -= penalty(i.severity, 12, 6, 3);
      if (i.category === "Conversão") conversion -= penalty(i.severity, 22, 11, 5);
      if (i.category === "UX" || i.category === "Mobile" || i.category === "Acessibilidade") ux -= penalty(i.severity, 18, 9, 4);
    }
    if (words >= 500) contentScore += 5;
    if (h2s >= 2) contentScore += 4;
    if (hasCtaText) conversion += 8;
    if (hasWhatsapp || hasPhone || hasEmail || forms > 0) conversion += 8;
    if (hasTrustSignals) conversion += 8;
    if (hasNav) ux += 6;
    if (hasHeader && hasMain && hasFooter) ux += 6;
    seo = Math.max(0, Math.min(100, seo));
    contentScore = Math.max(0, Math.min(100, contentScore));
    conversion = Math.max(0, Math.min(100, conversion));
    ux = Math.max(0, Math.min(100, ux));
    let quality = 100;
    for (const i of issues) quality -= i.severity === "high" ? 9 : i.severity === "medium" ? 4 : 2;
    quality = Math.max(0, Math.min(100, quality));

    return json({
      ok: true,
      finalUrl: url.toString(),
      httpStatus: res.status,
      responseMs: elapsed,
      scores: { seo, technical: quality, content: contentScore, conversion, ux },
      checks: {
        https, title, titleLength:title.length, description, descriptionLength:description.length,
        h1Count:h1s, canonical, viewport:!!viewport, robotsMeta, robotsTxt, sitemap,
        images:imgs.length, imagesWithoutAlt:imgsNoAlt, links, lang, wordCount:words,
        openGraph: hasOgTitle && hasOgDesc, structuredData: hasSchema,
        h2Count:h2s, h3Count:h3s, forms, buttons, hasHeader, hasMain, hasFooter, hasNav,
        hasWhatsapp, hasPhone, hasEmail, hasContactLink, hasCtaText, hasTrustSignals, hasPriceSignals
      },
      issues
    }, 200, origin);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Não foi possível analisar o site.";
    return json({ error: msg }, 400, origin);
  }
});