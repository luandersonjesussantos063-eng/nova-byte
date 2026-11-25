import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const app=read("../src/app.js");
const css=read("../src/kaia-pink.css");
const privacy=read("../public/privacidade.html");
const returns=read("../public/entregas-e-trocas.html");
const account=read("../public/conta.html");
const accountLogic=read("../public/conta.mjs");

test("Hero changes image on tap, without arrow or pause controls or autoplay",()=>{
 assert.match(app,/class="p-hero-next-tap"[^']*data-action="hero-next"/);
 assert.doesNotMatch(app,/button data-action="hero-prev"/);
 assert.doesNotMatch(app,/button class="n-hero-pause"/);
 assert.doesNotMatch(app,/^activateHeroAutoplay\(\);$/m);
 assert.match(app,/data-action="hero-dot"/);
 assert.match(css,/\.p-hero-next-tap/);
 assert.match(css,/\.p-hero-body\{z-index:2;pointer-events:none\}/);
});
test("Public website avoids prototype labeling without disguising payment limits",()=>{
 for(const page of [app,privacy,returns,account,accountLogic]){
  assert.doesNotMatch(page,/prévia|protótipo|loja em preparação|modo de demonstração|em desenvolvimento/i);
 }
 assert.match(app,/Pagamento online indisponível/);
 assert.match(returns,/pagamento online não está disponível/i);
 assert.match(account,/pagamento pelo site está temporariamente indisponível/i);
});
test("Privacy explains LGPD rights, CEP service, data providers, contact and cookies",()=>{
 assert.match(privacy,/Política de Privacidade/);
 for(const key of ["Supabase","Cloudflare","ViaCEP","SuperFrete","LGPD","Cookies","WhatsApp","direitos"])assert.ok(privacy.includes(key),key);
 assert.match(privacy,/https:\/\/wa\.me\/553180482304/);
 assert.match(returns,/7 dias/);
});
