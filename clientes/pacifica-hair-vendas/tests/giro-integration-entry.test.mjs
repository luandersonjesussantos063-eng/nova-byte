import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=x=>readFileSync(new URL(x,import.meta.url),"utf8");
const html=read("../public/admin.html");
const js=read("../public/admin-pacifica.js");
const css=read("../public/admin-pacifica.css");
const storefront=read("../src/app.js");
test("Giro is accessible from authenticated ADM dashboard and sidebar",()=>{
 assert.match(html,/data-tab="integrations"/);
 assert.match(html,/id="integrations" hidden/);
 assert.match(js,/"integrations"/);
 assert.match(html,/Mercado Livre/);
 assert.match(html,/Shopee/);
 assert.match(html,/TikTok Shop/);
});
test("Giro URLs are external safe links, not a fake integration",()=>{
 assert.match(html,/href="https:\/\/painel-estoque\.novabytesolucoes\.com\.br\/" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"/);
 assert.match(html,/href="https:\/\/painel-estoque\.novabytesolucoes\.com\.br\/cadastro"/);
 assert.match(html,/Acesso ao Giro não significa integração ativa/);
 assert.match(css,/\.giro-connection/);
});
test("public storefront does not include integrations or admin access",()=>{
 assert.doesNotMatch(storefront,/painel-estoque\.novabytesolucoes\.com\.br/);
 assert.doesNotMatch(storefront,/href=["']\/admin\.html/);
});
