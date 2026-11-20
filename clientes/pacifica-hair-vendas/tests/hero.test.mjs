import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve,dirname } from "node:path";
import { HERO_INTERVAL_MS, HERO_SLIDES, nextHeroIndex } from "../src/hero.mjs";

test("carrossel com três fotos e intervalo de 3 segundos", () => {
  assert.equal(HERO_INTERVAL_MS,3000);
  assert.equal(HERO_SLIDES.length,3);
  assert.equal(new Set(HERO_SLIDES.map(s=>s.src)).size,3);
});
test("cada banner possui imagem real e texto alternativo", () => {
 const dir=dirname(fileURLToPath(import.meta.url));
 for(const slide of HERO_SLIDES){
   assert.ok(slide.alt.length>20);
   assert.ok(existsSync(resolve(dir,"../public",slide.src.slice(1))),"Falta imagem: "+slide.src);
 }
});
test("navegação circular no carrossel", () => {
 assert.equal(nextHeroIndex(0),1);
 assert.equal(nextHeroIndex(2),0);
 assert.equal(nextHeroIndex(0,-1),2);
 assert.equal(nextHeroIndex(5,1),0);
});
