import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import '../../kaia-glow/catalog-presentation.js';
const presentation=globalThis.KaiaCatalogPresentation;
test('presentation cleanup preserves commercial identifiers, prices and stock',()=>{
 const product={id:'123',sku:'KG-TEST-123',price:123.45,available:false,name:'Nome (cadastro sem título na origem)',brand:"d'Alba",description:'Texto. Disponibilidade e valor conforme contagem de setembro de 2026. Confirme com a loja antes da compra.'};
 presentation.normalize(product);
 assert.equal(product.id,'123');assert.equal(product.sku,'KG-TEST-123');assert.equal(product.price,123.45);assert.equal(product.available,false);
 assert.equal(product.name,'Nome');assert.equal(product.brand,'d’Alba');assert.equal(product.description,'Texto.');
});
test('all 69 product landing pages retain their canonical routes and useful purchase links',()=>{
 const ctx={window:{}};vm.runInNewContext(readFileSync('kaia-glow/catalog.js','utf8'),ctx);
 assert.equal(ctx.window.KAIA_CATALOG.length,69);
 for(const p of ctx.window.KAIA_CATALOG){
  const path=new URL(p.url).pathname;const file='dist/kaia-glow'+path+'index.html';
  assert(existsSync(file),path);const html=readFileSync(file,'utf8');
  assert(!/ainda está em preparação|setembro de 2026|cadastro sem título na origem/i.test(html),p.name);
  assert(html.includes('id="landingBuy"'),p.name);assert(html.includes('id="landingPrice"'),p.name);
  assert(html.includes('data-product-id="'+p.id+'"'),p.name);
  assert(!html.includes('"@type":"AggregateRating"')); // No fabricated reviews.
 }
 assert(!readFileSync('dist/kaia-glow/_headers','utf8').includes('\\n'));
});
test('pending photos do not masquerade as product photography',()=>{
 assert.equal(presentation.hasPhoto({images:['assets/kaia-product-photo-pending.svg']}),false);
 assert.equal(presentation.hasPhoto({images:['assets/catalog/real.webp']}),true);
});
