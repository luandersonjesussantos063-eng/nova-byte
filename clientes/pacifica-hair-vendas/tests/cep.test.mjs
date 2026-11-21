import test from "node:test";
import assert from "node:assert/strict";
import {formatCep,cepDigits,lookupCep,mergeCepAddress} from "../public/cep.mjs";
const json=data=>({ok:true,json:async()=>data});
test("formats and validates CEP, sending no customer details",async()=>{
 assert.equal(formatCep("30140071"),"30140-071");
 assert.equal(cepDigits("30140-071"),"30140071");
 let url,opts;
 const result=await lookupCep("30140071",{fetcher:async(u,o)=>{url=u;opts=o;return json({cep:"30140-071",logradouro:"Rua dos Testes",bairro:"Centro",localidade:"Belo Horizonte",uf:"MG",complemento:"irrelevante"})}});
 assert.equal(url,"https://viacep.com.br/ws/30140071/json/");
 assert.equal(opts.credentials,"omit");
 assert.deepEqual(result,{street:"Rua dos Testes",neighborhood:"Centro",city:"Belo Horizonte",state:"MG"});
 await assert.rejects(lookupCep("123",{fetcher:()=>{throw Error("should not call")}}),/invalid/);
});
test("handles missing CEP, outages and city-only CEPs",async()=>{
 await assert.rejects(lookupCep("99999999",{fetcher:async()=>json({erro:true})}),/not_found/);
 await assert.rejects(lookupCep("30140071",{fetcher:async()=>({ok:false})}),/unavailable/);
 const a=await lookupCep("30000000",{fetcher:async()=>json({cep:"30000-000",localidade:"Belo Horizonte",uf:"MG",logradouro:"",bairro:""})});
 assert.deepEqual(a,{street:"",neighborhood:"",city:"Belo Horizonte",state:"MG"});
});
test("preserves changes made manually while lookup is running",()=>{
 const before={street:"",neighborhood:"",city:"",state:""};
 assert.deepEqual(mergeCepAddress(before,{...before,street:"Rua digitada"},{street:"Rua automática",neighborhood:"Centro",city:"BH",state:"MG"}),{neighborhood:"Centro",city:"BH",state:"MG"});
});
