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
 for(const text of ["Institucional","Ajuda e informações","Minha conta","Entregas, trocas e devoluções","Política de privacidade","Fale conosco","Preferências de cookies"])assert.ok(app.includes(text),text);
 for(const rule of [".p-footer-inner",".p-footer-column",".p-footer-service","@media(max-width:650px)"])assert.ok(css.includes(rule),rule);
 assert.match(app,/Pagamentos pelo site ainda indisponíveis/);
});
test("administration remains independent and protected server-side",()=>{
 assert.match(admin,/data-tab="overview"/);
 assert.match(worker,/__Host-pacifica_admin/);
 assert.match(worker,/\/api\/admin\/login/);
});
