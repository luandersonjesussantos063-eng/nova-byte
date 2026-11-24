import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const app=read("../src/app.js");
const css=read("../src/kaia-pink.css");
const admin=read("../public/admin.html");
const worker=read("../public/_worker.js");
test("storefront footer does not reveal an administration shortcut",()=>{
 assert.doesNotMatch(app,/href=["']\/admin\.html["']/);
 assert.doesNotMatch(app,/Acessar gestão da loja/);
 assert.doesNotMatch(app,/<a[^>]*>Administração<\/a>/);
 assert.doesNotMatch(app,/function footer\(\)/);
});
test("footer provides real visitor information and a responsive structure",()=>{
 for(const text of ["Atendimento","Minha conta","Informações","Entregas e trocas","Privacidade","WhatsApp","Instagram","Cookies","Navegação protegida"])assert.ok(app.includes(text),text);
 for(const rule of [".p-footer-inner",".p-footer-column",".p-footer-trust",".p-footer-core","@media(max-width:600px)"])assert.ok(css.includes(rule),rule);
 assert.match(app,/pagamentos online ainda não estão ativos/);
 assert.doesNotMatch(app,/function footerPayments\(/);
 assert.doesNotMatch(app,/<div class="p-footer-service"/);
 assert.match(css,/\.n-header\{position:relative\}/);
});
test("administration remains independent and protected server-side",()=>{
 assert.match(admin,/data-tab="overview"/);
 assert.match(worker,/__Host-pacifica_admin/);
 assert.match(worker,/\/api\/admin\/login/);
});
