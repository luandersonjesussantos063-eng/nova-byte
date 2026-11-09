import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const HOST='https://novabytesolucoes.com.br';
const ROOT=process.cwd();
const existing=(p)=>fs.existsSync(path.join(ROOT,p));
const folders=['anuncia-lucas','aplicativos','atendimento-local','avaliacoes','avaliar','automacao',
 'como-funciona','criacao-de-sites','duvidas','empresa','explorar','landing-pages',
 'projetos','servicos','sistemas'];
const pages=fs.readdirSync(ROOT).filter(x=>x.endsWith('.html'))
 .concat(folders.filter(x=>existing(x+'/index.html')).map(x=>x+'/index.html'));
const html=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const tag=(s,needle)=>[...s.matchAll(/<[^>]+>/g)].map(m=>m[0]).find(t=>new RegExp(needle,'i').test(t))||'';
const attr=(t,n)=>t.match(new RegExp('\\b'+n+'=["\\']([^"\\']+)["\\']','i'))?.[1];
const canonical=(s)=>attr(tag(s,'<link\\b[^>]*rel=["\\']canonical["\\']'),'href');
const robots=(s)=>attr(tag(s,'<meta\\b[^>]*name=["\\']robots["\\']'),'content')||'';
const route=(p)=>p==='index.html'?'/':p.endsWith('/index.html')?'/'+p.slice(0,-'index.html'.length):'/'+p;
const localPath=(raw,page)=>{
 if(!raw||raw.startsWith('#')||/^(?:https?:|mailto:|tel:|data:|blob:|javascript:|\/\/)/i.test(raw))return null;
 let location;
 try{location=new URL(raw,HOST+route(page))}catch{return null}
 if(location.origin!==HOST)return null;
 let pathname;
 try{pathname=decodeURIComponent(location.pathname)}catch{return null}
 if(!pathname.startsWith('/')||pathname.includes('\\0'))return null;
 const rel=path.posix.normalize(pathname).replace(/^\\//,'');
 if(rel.startsWith('../'))return null;
 return rel;
};
test('Sitemap only lists real, canonical public pages',()=>{
 const xml=fs.readFileSync(path.join(ROOT,'sitemap.xml'),'utf8');
 const urls=[...xml.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(m=>m[1]);
 assert(urls.length>=50,'Unexpectedly small sitemap');
 assert.equal(new Set(urls).size,urls.length,'Sitemap contains duplicate URLs');
 for(const u of urls){
  const item=new URL(u);
  assert.equal(item.origin,HOST,'Wrong host in sitemap: '+u);
  const rel=decodeURIComponent(item.pathname).replace(/^\\//,'');
  const file=(!rel||rel.endsWith('/'))?rel+'index.html':rel;
  assert(existing(file),'Sitemap contains missing page: '+u);
  const doc=html(file);
  assert(!/noindex/i.test(robots(doc)),'Sitemap points to noindex page: '+u);
  assert.equal(canonical(doc),u,'Sitemap canonical mismatch: '+u);
 }
});
test('Public marketing pages declare the correct canonical, including app landing pages',()=>{
 for(const file of pages){
  const doc=html(file);
  if(/noindex/i.test(robots(doc)))continue;
  const expected=HOST+route(file);
  assert.equal(canonical(doc),expected,'Missing or wrong canonical on '+file);
 }
});
test('Internal HTML links, static assets and social preview images exist',()=>{
 for(const file of pages){
  const doc=html(file);
  const refs=[...doc.matchAll(/\\b(?:href|src)=["']([^"']+)["']/gi)].map(m=>m[1]);
  const social=[...doc.matchAll(/<meta\\b[^>]*property=["']og:image["'][^>]*>/gi)]
   .map(m=>attr(m[0],'content'));
  for(const raw of [...refs,...social]){
   const rel=localPath(raw,file);if(rel===null||!rel)continue;
   const resolved=rel.endsWith('/')?rel+'index.html':rel;
   assert(existing(resolved)||existing(resolved+'/index.html'),'Broken local reference in '+file+': '+raw);
  }
 }
});
