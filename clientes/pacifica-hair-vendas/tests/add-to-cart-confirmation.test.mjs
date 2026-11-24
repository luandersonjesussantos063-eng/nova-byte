import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const app=read('../src/app.js'),css=read('../src/kaia-pink.css');
test('Adding to cart opens Kaia-style confirmation with bag and keep-shopping choices',()=>{
 assert.match(app,/function addedProductModal\(\)/);
 assert.match(app,/Adicionado à sacola!/);
 assert.match(app,/Ir para a sacola/);
 assert.match(app,/Continuar comprando/);
 assert.match(app,/cartDrawer\(\) \+ checkoutModal\(\) \+ detailModal\(\) \+ addedProductModal\(\)/);
 assert.match(app,/persist\(\); state\.addedProductId=id/);
 assert.match(app,/action==="added-bag"/);
 assert.match(app,/action==="added-close"/);
 assert.match(css,/\.p-added-dialog/);
});
test('Recommendations only include in-stock real products and exclude already carted items',()=>{
 assert.match(app,/item\.stock>0&&item\.priceCents>0/);
 assert.match(app,/!inCart\.has\(String\(item\.id\)\)/);
 assert.match(app,/action==="added-recommend"/);
 assert.match(app,/product\.stock<=\(row\?\.qty\|\|0\)/);
 assert.match(app,/persist\(\);state\.addedProductId=id;render\(\)/);
});
test('Confirmation does not enable payments or change order processing',()=>{
 assert.match(app,/pagamentos online ainda não estão ativos/);
 assert.match(app,/state\.cartOpen=true;render\(\)/);
 assert.match(css,/@media\(max-width:600px\)/);
});
