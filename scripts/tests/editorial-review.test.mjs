import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {automaticNewsEnabled} from '../editorial-policy.mjs';
const audit=JSON.parse(fs.readFileSync('docs/adsense-review-2026-10-21.json','utf8'));
const read=p=>fs.readFileSync(p,'utf8');
test('retired summaries are not published and review hubs cannot advertise or request indexing',()=>{
 assert.equal(audit.archivedArticles.length,114);
 const sitemap=read('sitemap.xml');
 for(const f of audit.archivedArticles){
  assert(!fs.existsSync(f),'retired public file: '+f);
  assert(!sitemap.includes('/'+f+'</loc>'),f);
 }
 for(const f of audit.archiveHubs){
  const html=read(f);assert.match(html,/<meta name="robots" content="noindex,follow">/,f);
  assert(!/pagead2\.googlesyndication\.com|adsbygoogle|monetization\.js/.test(html),f);
  assert(!sitemap.includes('/'+f+'</loc>'),f);
 }
 for(const f of ['ferramentas.html','como-saber-se-site-tem-seo.html','por-que-meu-site-nao-aparece-no-google.html'])assert(sitemap.includes('/'+f+'</loc>'),f);
 assert.match(read('index.html'), /<meta name="robots" content="index,follow/);
 assert(read('novaplay/index.html').includes('content="index,follow,max-image-preview:large"'));
 assert(!/^Disallow:\s*\/\s*$/m.test(read('robots.txt')));
});
test('paused publication scripts exit without changing public content or fetching news',()=>{
 assert.equal(automaticNewsEnabled(),false);
 const files=['index.html','sitemap.xml','noticias-tecnologia.html','noticias-lucas-do-rio-verde.html','scripts/news/history.json','scripts/local-news/history.json'];
 const fingerprint=()=>createHash('sha256').update(files.map(read).join('\0')).digest('hex');const before=fingerprint();
 const pages=fs.readdirSync('.').filter(f=>f.endsWith('.html')).sort();
 for(const f of ['scripts/news/run-news.mjs','scripts/local-news/run-local-news.mjs']){
  const out=execFileSync(process.execPath,[f],{encoding:'utf8',timeout:10000});assert(out.includes('Publicação automática pausada'));
 }
 assert.equal(fingerprint(),before);assert.deepEqual(fs.readdirSync('.').filter(f=>f.endsWith('.html')).sort(),pages);
 for(const f of ['novabyte-news.yml','lucas-atualiza.yml']){const yaml=read('.github/workflows/'+f);assert(!/^  (schedule|push):/m.test(yaml));}
});
test('home and affected service pages contain valid inline JavaScript',()=>{
 for(const f of ['index.html','criacao-de-sites-lucas-do-rio-verde.html','landing-page-profissional.html','sistemas-personalizados.html']){
  for(const m of read(f).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   if(/type=["'](?:application\/ld\+json|application\/json)["']|\bsrc=/i.test(m[1]))continue;
   assert.doesNotThrow(()=>new vm.Script(m[2]),f);
  }
 }
});
test('navigation and guides under review do not request ads; verification identity remains available',()=>{
 const directories=['servicos','projetos','empresa','como-funciona','duvidas','atendimento-local','explorar','avaliacoes'];
 const guides=['como-melhorar-seo-do-site','ia-consegue-criar-site-completo','ia-consegue-criar-aplicativo-completo','landing-page-ou-site-qual-escolher','quanto-custa-criar-site-profissional-2026','como-saber-se-site-esta-lento','site-ou-instagram-para-empresa','quanto-tempo-demora-criar-aplicativo','quanto-custa-criar-aplicativo'];
 for(const file of [...directories.map(p=>p+'/index.html'),...guides.map(p=>p+'.html')]){
  const html=read(file);assert(!/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle|<ins\b[^>]*adsbygoogle/.test(html),file);
  for(const link of ['/privacidade.html','/termos.html','/politica-editorial.html'])assert(html.includes('href="'+link+'"'),file+': '+link);
 }
 assert(read('index.html').includes('name="google-adsense-account" content="ca-pub-2466231259507657"'));
 assert.match(read('ads.txt'),/^google\.com, pub-2466231259507657, DIRECT, f08c47fec0942fa0\s*$/);
});
