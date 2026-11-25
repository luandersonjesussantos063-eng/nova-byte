import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL(file,import.meta.url),"utf8");
const app=read("../src/app.js");
const offers=read("../src/visitor-offers.mjs");
const headers=read("../public/_headers");
const worker=read("../public/_worker.js");
test("public store does not display demonstration products if API fails",()=>{
 assert.match(app,/return Array\.isArray\(sharedCatalog\)\?sharedCatalog:\[\]/);
 assert.match(app,/catalogLoadError=true/);
 assert.match(app,/data-action="reload-catalog"/);
 assert.match(app,/products: \[\]/);
 assert.doesNotMatch(app,/products: Array\.isArray\(initial\.products\)/);
});
test("public contact and prices cannot be replaced from localStorage config",()=>{
 assert.doesNotMatch(app,/\.\.\.\(initial\.config \|\| \{\}\)/);
 assert.doesNotMatch(app,/initial\.config\?\.whatsapp/);
 assert.match(app,/Consult(ar|ar sacola) pelo WhatsApp/);
 assert.match(app,/Pagamento online indisponível/);
});
test("promotional dialog never interrupts initial visit",()=>{
 assert.match(offers,/return \{showOffer,showSettings\}/);
 assert.doesNotMatch(offers,/if\(!welcome\.seen&&!skipWelcome\)showOffer\(\)/);
});
test("static assets receive defense-in-depth headers and previews noindex",()=>{
 for(const s of ["Content-Security-Policy:","X-Frame-Options: DENY","X-Content-Type-Options: nosniff","Referrer-Policy:","Strict-Transport-Security:","/admin.html","noindex, nofollow"])assert.ok(headers.includes(s),s);
 assert.match(worker,/hostname\.endsWith\("\.pages\.dev"\)/);
});
