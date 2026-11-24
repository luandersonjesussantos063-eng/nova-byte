import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const html=read("../index.html");
const sitemap=read("../public/sitemap.xml");
const robots=read("../public/robots.txt");
const footer=read("../src/app.js");
const info=[read("../public/privacidade.html"),read("../public/entregas-e-trocas.html")];
test("purchased accented IDN domain has canonical and social metadata",()=>{
 assert.match(html,/rel="canonical" href="https:\/\/xn--pacficahair-qcb\.com\.br\/"/);
 assert.match(html,/property="og:url" content="https:\/\/xn--pacficahair-qcb\.com\.br\/"/);
 assert.match(html,/rel="icon" href="\/favicon\.svg"/);
});
test("sitemap and robots use commercial domain without demo URL",()=>{
 assert.match(robots,/Sitemap: https:\/\/xn--pacficahair-qcb\.com\.br\/sitemap\.xml/);
 assert.match(sitemap,/https:\/\/xn--pacficahair-qcb\.com\.br\//);
 assert.doesNotMatch(sitemap,/pages\.dev/);
 assert.doesNotMatch(sitemap,/https:\/\/pacificahair\.com\.br/);
});
test("policy pages exist and storefront has clear links",()=>{
 for(const item of info){assert.match(item,/<html lang="pt-BR">/);assert.match(item,/Pacífica Hair/);}
 assert.match(footer,/href="\/privacidade\.html"/);
 assert.match(footer,/href="\/entregas-e-trocas\.html"/);
});
test("prelaunch language stays honest about payment readiness",()=>{
 assert.match(footer,/pagamentos online ainda não estão ativos/);
 assert.match(info[1],/não representa pedido confirmado/);
});
