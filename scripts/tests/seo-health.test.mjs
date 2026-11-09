import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const HOST = 'https://novabytesolucoes.com.br';
const ROOT = process.cwd();
const existing = (p) => fs.existsSync(path.join(ROOT, p));
const folders = ['anuncia-lucas', 'aplicativos', 'atendimento-local', 'avaliacoes', 'avaliar',
  'automacao', 'como-funciona', 'criacao-de-sites', 'duvidas', 'empresa', 'explorar',
  'landing-pages', 'projetos', 'servicos', 'sistemas'];
const pages = fs.readdirSync(ROOT).filter(p => p.endsWith('.html'))
  .concat(folders.filter(f => existing(f + '/index.html')).map(f => f + '/index.html'));
const html = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const canonical = s => s.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];
const robots = s => s.match(/<meta\b[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
const route = p => p === 'index.html' ? '/' :
  p.endsWith('/index.html') ? '/' + p.slice(0, -'index.html'.length) : '/' + p;
const localPath = (raw, page) => {
  if (!raw || raw.includes('${') || raw.startsWith('#') || /^(?:https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(raw)) return null;
  let u;
  try { u = new URL(raw, HOST + route(page)); } catch { return null; }
  if (u.origin !== HOST) return null;
  const relative = path.posix.normalize(decodeURIComponent(u.pathname)).replace(/^\//, '');
  return relative.startsWith('../') ? null : relative;
};

test('sitemap lists real canonical pages on the correct host', () => {
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert(urls.length >= 50, 'Sitemap unexpectedly small');
  assert.equal(new Set(urls).size, urls.length, 'Repeated sitemap URLs');
  for (const address of urls) {
    const u = new URL(address);
    assert.equal(u.origin, HOST);
    const rel = decodeURIComponent(u.pathname).replace(/^\//, '');
    const file = !rel || rel.endsWith('/') ? rel + 'index.html' : rel;
    assert(existing(file), 'Missing page in sitemap: ' + address);
    assert(!robots(html(file)).includes('noindex'), 'Noindex page in sitemap: ' + address);
    assert.equal(canonical(html(file)), address, 'Wrong canonical in sitemap: ' + address);
  }
});

test('indexable marketing pages specify their own canonical URL', () => {
  for (const page of pages) {
    const doc = html(page);
    if (/noindex/i.test(robots(doc))) continue;
    assert.equal(canonical(doc), HOST + route(page), 'Canonical missing or wrong: ' + page);
  }
});

test('local links, script/image sources and social images resolve to files', () => {
  for (const page of pages) {
    const doc = html(page);
    const refs = [...doc.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)].map(m => m[1]);
    const previews = [...doc.matchAll(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi)].map(m => m[1]);
    for (const link of [...refs, ...previews]) {
      const rel = localPath(link, page);
      if (!rel) continue;
      const resolved = rel.endsWith('/') ? rel + 'index.html' : rel;
      assert(existing(resolved) || existing(resolved + '/index.html'), 'Bad link in ' + page + ': ' + link);
    }
  }
});
