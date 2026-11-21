import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
const fn=source.slice(source.indexOf("function cartProductPhoto("),source.indexOf("function cartDrawer()"));
const state={products:[{id:"a",image:"/api/photos/abc"},{id:"b",images:["/images/kit.webp"]},{id:"c",image:"javascript:alert(1)"},{id:"d",image:"https://example.com/p.webp"}]};
const render=new Function("state","esc",fn+"return cartProductPhoto;")(state,x=>String(x).replaceAll('&','&amp;').replaceAll('"','&quot;'));
test("cart uses the current catalog photo, also for existing cart IDs",()=>{assert.match(render("a"),/src="\/api\/photos\/abc"/);assert.match(render("b"),/src="\/images\/kit.webp"/);assert.match(render("d"),/src="https:\/\/example.com\/p.webp"/);assert.doesNotMatch(render("c"),/<img/);assert.doesNotMatch(render("unknown"),/<img/);assert.match(render("unknown"),/cart-photo-fallback/);assert.match(source,/cartProductPhoto\(p\.id\)/);});
