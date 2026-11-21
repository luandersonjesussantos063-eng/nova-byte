import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {REVISTA_LINKS,REVISTA_REFERENCES} from "../src/revista-references.mjs";
test("somente ciclo 18 e fotos locais",()=>{assert.equal(REVISTA_REFERENCES.length,47);assert.equal(REVISTA_LINKS.length,2);for(const p of REVISTA_REFERENCES){assert.equal(p.cycle,"18/2026");assert.ok(p.priceCents>0);assert.equal(p.stock,0);assert.ok(p.image.startsWith("/assets/catalogo18/"));assert.ok(existsSync(fileURLToPath(new URL("../public"+p.image,import.meta.url))),p.image);}assert.equal(new Set(REVISTA_REFERENCES.map(p=>p.id)).size,47);});
