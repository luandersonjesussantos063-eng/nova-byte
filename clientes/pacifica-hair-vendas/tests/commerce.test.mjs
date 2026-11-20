import test from "node:test";
import assert from "node:assert/strict";
import { brl, cartTotals, normalizeCart, safeCents } from "../src/commerce.mjs";
const products = [{ id:"a",name:"Creme",priceCents:10000,stock:5 }];
test("valor em reais", () => assert.equal(brl(12990), "R$\u00a0129,90"));
test("conta o desconto Pix e a taxa de cartão corretamente", () => {
 const t=cartTotals([{id:"a",qty:2}],products,{pixPercent:10,cardPercent:5});
 assert.equal(t.subtotalCents,20000);
 assert.equal(t.pixTotalCents,18000);
 assert.equal(t.cardTotalCents,21000);
});
test("não usa valores de preços ou quantidades inválidos", () => {
 assert.equal(safeCents(-1),0);
 assert.equal(cartTotals([{id:"a",qty:8}],products).subtotalCents,0);
 assert.deepEqual(normalizeCart([{id:"a",qty:-3}, {id:"a",qty:2}]),[{id:"a",qty:2}]);
});
