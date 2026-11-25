import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const app=read("../src/app.js"),delivery=read("../public/pacifica-checkout-delivery.mjs"),css=read("../src/kaia-pink.css");
test("Cart has an accessible next-step delivery action before payment",()=>{
 assert.match(app,/data-action="delivery-checkout"/);
 assert.match(app,/Continuar para entrega/);
 assert.match(app,/Consultar sacola pelo WhatsApp/);
 assert.match(app,/pacifica-checkout-delivery\.mjs/);
});
test("Delivery confirms verified customer, stores full address server-side, then opens payment",()=>{
 assert.match(delivery,/verifiedUser\(\)/);
 assert.match(delivery,/pacifica_customer_details/);
 assert.match(delivery,/upsert\(\{\.\.\.values,user_id:user\.id\}/);
 assert.match(delivery,/current\.stage="payment"/);
 assert.match(delivery,/Digite o CEP/);
 assert.match(delivery,/lookupCep\(cep\)/);
 assert.match(delivery,/!values\.street\|\|!values\.house_number/);
 assert.match(delivery,/data-checkout="back"/);
});
test("Payment stage is not falsely enabled before Mercado Pago credentials",()=>{
 assert.match(delivery,/Mercado Pago ainda não foi ativado/);
 assert.match(delivery,/Nenhum pagamento ou pedido será gerado/);
 assert.match(delivery,/type="button" disabled>Pagamento online em configuração/);
 assert.doesNotMatch(delivery,/mp_access_token|payment_intent|card_token/);
});
test("Delivery UI and JS syntax are valid",()=>{
 const code=delivery.replace(/^import .*?;\s*$/gm,"").replace(/export async function openDelivery/,"async function openDelivery");
 assert.doesNotThrow(()=>new Function(code));
 assert.match(css,/\.p-delivery-overlay/);
 assert.match(css,/@media\(max-width:520px\)/);
});
