import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {JSDOM} from "jsdom";

const root=resolve("questoes");
const content=(p)=>readFileSync(resolve(root,p),"utf8");
function createApp(){
 const dom=new JSDOM(content("index.html"),{url:"https://novabytesolucoes.com.br/questoes/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.confirm=()=>true;
 for(const f of ["banco.js","core.js","app.js"])w.eval(content(f));
 return {dom,w,document:w.document,click:(selector)=>{const x=w.document.querySelector(selector);assert.ok(x,"Missing "+selector);x.click();return x;}};
}
test("The PMESP dashboard loads and creates real five-question sessions",()=>{
 const a=createApp(),{document,click,w}=a;
 assert.equal(document.querySelector("#view-home").hidden,false);
 assert.equal(document.querySelector("#view-train").hidden,true);
 click("#daily-start");
 assert.equal(document.querySelector("#view-train").hidden,false);
 assert.equal(document.querySelectorAll(".option").length,5);
 const state=JSON.parse(w.localStorage.getItem("missao-farda-state-v3"));
 assert.equal(state.session.ids.length,5);
 assert.ok(state.session.ids.every(id=>id.startsWith("pmesp")));
 assert.ok(document.querySelector("#question-area").textContent.includes("Enunciado 100% da prova original"));
 w.close();
});
test("Practice grades exactly once and stores real learning history",()=>{
 const a=createApp(),{document,click,w}=a;
 click("#daily-start");
 click(".option");
 let s=JSON.parse(w.localStorage.getItem("missao-farda-state-v3"));
 const first=s.session.ids[0];assert.equal(s.session.picks[first],"A");
 click("#check");
 s=JSON.parse(w.localStorage.getItem("missao-farda-state-v3"));
 assert.equal(s.events.length,1);
 assert.equal(s.session.checked[first],true);
 assert.ok(s.progress[first]?.due);
 assert.equal(document.querySelector("#feedback").hidden,false);
 click("#check");
 s=JSON.parse(w.localStorage.getItem("missao-farda-state-v3"));
 assert.equal(s.events.length,1);
 assert.equal(s.session.index,1);
 w.close();
});
test("Diagnostic does not reveal the key before closing the session",()=>{
 const a=createApp(),{document,click,w}=a;
 click("#diagnostic-home");
 const s=JSON.parse(w.localStorage.getItem("missao-farda-state-v3"));
 assert.equal(s.session.kind,"diagnostic");
 assert.equal(s.session.grading,"exam");
 assert.equal(s.session.ids.length,10);
 assert.equal(document.querySelector("#feedback").hidden,true);
 assert.doesNotMatch(document.querySelector("#question-area").textContent,/Gabarito oficial: alternativa/);
 w.close();
});
test("Syllabus and essay are persisted locally without backend requests",()=>{
 const a=createApp(),{document,click,w}=a;
 click('[data-tab="path"]');
 const first=document.querySelector('.syllabus input[type="checkbox"]');assert.ok(first);first.click();
 const essay=document.querySelector("#essay");essay.value="Começo de uma redação de estudo.";essay.dispatchEvent(new w.Event("input",{bubbles:true}));
 const s=JSON.parse(w.localStorage.getItem("missao-farda-state-v3"));
 assert.ok(Object.values(s.topics).includes(true));
 assert.match(s.essay,/redação/);
 assert.ok(document.querySelector("#topics-complete").textContent.startsWith("1/"));
 w.close();
});
