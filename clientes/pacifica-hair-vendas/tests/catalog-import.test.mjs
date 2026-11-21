import test from "node:test";
import assert from "node:assert/strict";
import {parseCatalog,mergeCatalog} from "../src/catalog-import.mjs";
const opt={brand:"Avon",cycle:"18/2026",source:"Revista teste"};
const data="codigo;nome;categoria;preco;foto\n001;Produto teste;Perfumes;39,90;";
test("preço exato, código e estoque zero",()=>{const [p]=parseCatalog(data,opt);assert.equal(p.priceCents,3990);assert.equal(p.code,"001");assert.equal(p.stock,0);});
test("atualiza sem duplicar e preserva estoque",()=>{const [p]=parseCatalog(data,opt);const out=mergeCatalog([{...p,stock:4}],parseCatalog(data.replace("39,90","49,90"),{...opt,cycle:"19/2026"}));assert.equal(out.length,1);assert.equal(out[0].stock,4);assert.equal(out[0].priceCents,4990);});
test("rejeita duplicidade e preço inválido",()=>{assert.throws(()=>parseCatalog(data+"\n001;Outro;Perfumes;10,00;",opt));assert.throws(()=>parseCatalog(data.replace("39,90","xxx"),opt));});
test("marcas não conflitam",()=>assert.equal(mergeCatalog(parseCatalog(data,opt),parseCatalog(data,{...opt,brand:"Natura"})).length,2));
