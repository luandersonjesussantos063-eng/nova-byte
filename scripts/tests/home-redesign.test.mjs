import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8'),css=fs.readFileSync('studio.css','utf8');
test('home retains business identity, integrations and honest conversion paths',()=>{
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.equal((html.match(/class="service-card /g)||[]).length,7);assert.equal((html.match(/class="project-card /g)||[]).length,4);assert(!html.includes('digopetiscaria.com.br'));for(const name of ['W Prime Elétrica','NPlay','Anuncia Lucas','NovaByte Studio'])assert(html.includes(name));
 for(const phrase of ['Sua ideia merece','sair do papel.','Lucas do Rio Verde','todo o Brasil','Design e identidade visual','Edição de vídeos','Marketing e conteúdo digital'])assert(html.includes(phrase),phrase);
 for(const tag of ['G-T7CCH2S8J7','G-XSB3WYJZ71','ca-pub-2466231259507657','/analytics-prep.js','/portal-privacy.js','https://www.instagram.com/novabyte.solucoes/'])assert(html.includes(tag),tag);
 const serviceLinks=[...html.matchAll(/class="service-cta" href="([^"]+)"/g)].map(m=>new URL(m[1]));assert.equal(serviceLinks.length,7);assert.equal(new Set(serviceLinks.map(u=>u.searchParams.get('text'))).size,7);for(const url of serviceLinks)assert.equal(url.hostname,'wa.me');
});
test('anchors, local resources, accessible controls and reduced motion are valid',()=>{
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));for(const m of html.matchAll(/href="#([^"]+)"/g))assert(ids.has(m[1]),m[1]);
 for(const m of html.matchAll(/(?:src|href)="(\/[^"?#]+)(?:\?[^"#]*)?"/g))assert(fs.existsSync('.'+m[1]),m[1]);
 assert(html.includes('aria-controls="studio-menu"'));assert(html.includes('aria-label="Filtrar projetos"'));assert(css.includes('prefers-reduced-motion:reduce'));
 assert(html.includes('assets/brand/novabyte-instagram.jpg'));assert(fs.statSync('assets/brand/novabyte-instagram.jpg').size<25000);
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(m[1].includes('application/ld+json')){const data=JSON.parse(m[2]);assert(data['@context']);}else if(!m[1].includes('src='))assert.doesNotThrow(()=>new vm.Script(m[2]));}
 assert.doesNotThrow(()=>new vm.Script(fs.readFileSync('home.js','utf8')));
});
