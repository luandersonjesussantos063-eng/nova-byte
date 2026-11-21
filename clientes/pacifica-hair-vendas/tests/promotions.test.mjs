import test from "node:test";
import assert from "node:assert/strict";
import {promotionalPrice,discountLabel} from "../public/promotions.mjs";
import {cartTotals} from "../src/commerce.mjs";
test("80% de desconto em perfume de R$ 200",()=>assert.deepEqual(promotionalPrice(20000,80),{priceCents:4000,compareCents:20000,discountPercent:80}));
test("reproduz o exemplo de 60% com centavos",()=>assert.equal(promotionalPrice(18590,60).priceCents,7436));
test("desativar promoção restaura preço normal",()=>assert.deepEqual(promotionalPrice(20000,0),{priceCents:20000,compareCents:0,discountPercent:0}));
test("descontos inválidos e preço zero são rejeitados",()=>{for(const x of [-1,100,101,1.5,NaN])assert.throws(()=>promotionalPrice(20000,x));assert.throws(()=>promotionalPrice(0,80))});
test("selo e sacola usam o valor promocional",()=>{const p={id:"a",name:"Perfume",stock:4,...promotionalPrice(20000,80)};assert.equal(discountLabel(p),80);assert.equal(cartTotals([{id:"a",qty:2}],[p],{}).subtotalCents,8000);assert.equal(discountLabel({priceCents:20000,compareCents:0}),0)});
