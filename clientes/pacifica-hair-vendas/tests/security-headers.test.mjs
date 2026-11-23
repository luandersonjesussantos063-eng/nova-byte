import test from "node:test";
import assert from "node:assert/strict";
import worker from "../public/_worker.js";
const mockEnv={ASSETS:{fetch:async()=>new Response("<html><body>ok</body></html>",{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=600","Access-Control-Allow-Origin":"*"}})}};
const get=path=>worker.fetch(new Request("https://novabyte-pacifica-hair-preview.pages.dev"+path),mockEnv);
test("pages cannot be framed and enforce a script policy",async()=>{
 const r=await get("/");
 assert.equal(r.status,200);assert.equal(r.headers.get("X-Frame-Options"),"DENY");
 assert.match(r.headers.get("Content-Security-Policy"),/frame-ancestors 'none'/);
 assert.match(r.headers.get("Content-Security-Policy"),/script-src 'self'/);
 assert.doesNotMatch(r.headers.get("Content-Security-Policy"),/script-src[^;]*'unsafe-inline'/);
 assert.match(r.headers.get("Content-Security-Policy"),/nifvycrvqnzbxgglhlky/);
 assert.equal(r.headers.get("Strict-Transport-Security"),"max-age=31536000");
 assert.equal(r.headers.get("X-Content-Type-Options"),"nosniff");
});
test("client account and admin cannot be cached publicly",async()=>{
 for(const path of ["/conta.html","/admin.html","/conta.mjs","/admin-pacifica.js","/auth-config.mjs"]){
  const r=await get(path);
  assert.equal(r.headers.get("Cache-Control"),"no-store, max-age=0",path);
  assert.equal(r.headers.get("X-Robots-Tag"),"noindex, nofollow",path);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"),null,path);
  assert.equal(r.headers.get("Referrer-Policy"),"no-referrer",path);
 }
});
test("public catalog is read only; admin API fails closed with no database",async()=>{
 const r=await get("/api/admin/products");
 assert.equal(r.status,503);assert.equal(r.headers.get("Cache-Control"),"no-store");
 assert.equal(r.headers.get("X-Frame-Options"),"DENY");
});
