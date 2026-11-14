import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {JSDOM} from "jsdom";

const root=resolve("questoes");
const content=(p)=>readFileSync(resolve(root,p),"utf8");
function createApp({choose=true,seed={}}={}){
 const dom=new JSDOM(content("index.html"),{url:"https://novabytesolucoes.com.br/questoes/",runScripts:"outside-only",pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.confirm=()=>true;
 for(const [k,v] of Object.entries(seed))w.localStorage.setItem(k,JSON.stringify(v));
 for(const f of ["banco-transcrito.js","core.js","app.js"])w.eval(content(f));
 if(choose)w.document.querySelector('[data-profile="luanderson"]').click();
 return {dom,w,document:w.document,click:(selector)=>{const x=w.document.querySelector(selector);assert.ok(x,"Missing "+selector);x.click();return x;}};
}
test("The PMMG dashboard loads and creates real five-question sessions",()=>{
 const a=createApp(),{document,click,w}=a;
 assert.equal(document.querySelector("#view-home").hidden,false);
 assert.equal(document.querySelector("#view-train").hidden,true);
 click("#daily-start");
 assert.equal(document.querySelector("#view-train").hidden,false);
 assert.equal(document.querySelectorAll(".option").length,4);
 const state=JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"));
 assert.equal(state.session.ids.length,5);
 assert.ok(state.session.ids.every(id=>id.startsWith("pmmg")));
 assert.ok(document.querySelector("#question-area").querySelector(".actual-question"));
 w.close();
});
test("Practice grades exactly once and stores real learning history",()=>{
 const a=createApp(),{document,click,w}=a;
 click("#daily-start");
 click(".option");
 let s=JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"));
 const first=s.session.ids[0];assert.equal(s.session.picks[first],"A");
 click("#check");
 s=JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"));
 assert.equal(s.events.length,1);
 assert.equal(s.session.checked[first],true);
 assert.ok(s.progress[first]?.due);
 assert.equal(document.querySelector("#feedback").hidden,false);
 click("#check");
 s=JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"));
 assert.equal(s.events.length,1);
 assert.equal(s.session.index,1);
 w.close();
});
test("Diagnostic does not reveal the key before closing the session",()=>{
 const a=createApp(),{document,click,w}=a;
 click("#diagnostic-home");
 const s=JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"));
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
 const s=JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"));
 assert.ok(Object.values(s.topics).includes(true));
 assert.match(s.essay,/redação/);
 assert.ok(document.querySelector("#topics-complete").textContent.startsWith("1/"));
 w.close();
});


test("All PMMG editions display real question stems and complete alternatives inside the app",()=>{
 const a=createApp(),{document,click,w}=a;
 const expected=[["pmmg2018","perfil"],["pmmg2024","texto"],["pmmg2023","narrativa"],["pmmg2021","tipos"]];
 for(const [id,word] of expected){
  const select=document.querySelector("#exam");select.value=id;
  select.dispatchEvent(new w.Event("change",{bubbles:true}));
  click("#create-session");
  assert.equal(document.querySelectorAll(".option").length,4,id);
  assert.ok(document.querySelector(".actual-question")?.textContent.length>12,id);
  assert.ok(document.querySelector(".actual-question").textContent.toLowerCase().includes(word),id);
  assert.equal(document.querySelector("#pdf-reader-frame"),null);
  assert.ok(document.querySelectorAll(".option span:last-child").length===4,id);
 }
 w.close();
});
test("Source notes and inline images preserve original layout on mobile",()=>{
 const a=createApp(),{document,click,w}=a;
 click("#daily-start");
 assert.ok(document.querySelector(".actual-question"));
 assert.ok(document.querySelector(".source-passage"));
 assert.equal(document.querySelector("#pdf-reader-frame"),null);
 const selected=document.querySelector(".option");
 const old=selected.textContent;
 selected.click();
 assert.equal(selected.textContent,old);
 assert.equal(document.querySelectorAll(".option.is-picked").length,1);
 w.close();
});
test("2023 annulled questions are excluded from scoring in the complete exam",()=>{
 const a=createApp(),{document,click,w}=a;
 const select=document.querySelector("#exam");select.value="pmmg2023";select.dispatchEvent(new w.Event("change",{bubbles:true}));
 document.querySelector("#mode").value="full";click("#create-session");
 let state=JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"));assert.equal(state.session.ids.length,50);
 const nav=document.querySelectorAll("#question-numbers button");nav[49].click();click(".option");click("#check");
 state=JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"));
 assert.equal(state.progress["pmmg2023-2"].correct,null);
 assert.equal(state.events.some(e=>e.id==="pmmg2023-2"),false);
 w.close();
});
test("PMMG dashboard isolates progress, displays 180 questions and does not invent exam dates",()=>{
 const a=createApp(),{document,click,w}=a;
 assert.equal(document.querySelector("#unique-done").textContent,"0/180");
 assert.match(document.querySelector("#days-left").textContent,/CRS/);
 assert.doesNotMatch(document.body.textContent,/PMESP|VUNESP|28 fev/);
 click('[data-tab="path"]');
 const weights=document.querySelector("#weight-list").textContent;assert.match(weights,/20\/50/);assert.match(weights,/Literatura/);
 assert.equal(w.localStorage.getItem("missao-farda-state-v3"),null);
 w.close();
});

test("Opening requires a profile and creates no history until selection",()=>{
 const {w,document,click}=createApp({choose:false});
 assert.equal(document.querySelector("#profile-picker").hidden,false);
 assert.equal(w.localStorage.length,0);
 click('[data-profile="jackeline"]');
 assert.equal(document.querySelector("#active-profile-name").textContent,"Jackeline Santana");
 assert.ok(w.localStorage.getItem("missao-farda-pmmg-state-v3-jackeline"));
 assert.equal(w.localStorage.getItem("missao-farda-pmmg-state-v3-luanderson"),null);
 w.close();
});
test("Profiles isolate answers, goals, essays, topics and unfinished sessions",()=>{
 const {w,document,click}=createApp();
 click('[data-goal="2"]');click("#daily-start");click(".option");click("#check");
 click('[data-tab="path"]');const essay=document.querySelector("#essay");essay.value="Redação do Luanderson";essay.dispatchEvent(new w.Event("input",{bubbles:true}));
 const tick=document.querySelector('.tick-line input');tick.checked=true;tick.dispatchEvent(new w.Event("change",{bubbles:true}));
 const luKey="missao-farda-pmmg-state-v3-luanderson",jaKey="missao-farda-pmmg-state-v3-jackeline";
 const lu=JSON.parse(w.localStorage.getItem(luKey));
 click("#switch-profile");click('[data-profile="jackeline"]');
 assert.equal(document.querySelector("#home-answered").textContent,"0");
 assert.equal(document.querySelector("#essay").value,"");
 let ja=JSON.parse(w.localStorage.getItem(jaKey));assert.equal(ja.settings.goal,5);assert.equal(ja.session,null);assert.equal(Object.keys(ja.topics).length,0);
 click('[data-goal="10"]');click("#daily-start");click(".option");click("#check");
 click('[data-tab="path"]');essay.value="Redação da Jackeline";essay.dispatchEvent(new w.Event("input",{bubbles:true}));
 assert.deepEqual(JSON.parse(w.localStorage.getItem(luKey)),lu);
 click("#switch-profile");click('[data-profile="luanderson"]');
 assert.equal(document.querySelector("#essay").value,"Redação do Luanderson");
 assert.equal(document.querySelector("#home-answered").textContent,"1");
 assert.equal(document.querySelector('[data-goal="2"]').getAttribute("aria-pressed"),"true");
 assert.equal(document.querySelector(".tick-line input").checked,true);
 click("#resume");assert.equal(document.querySelector("#view-train").hidden,false);
 assert.deepEqual(JSON.parse(w.localStorage.getItem(luKey)).session,lu.session);
 assert.equal(JSON.parse(w.localStorage.getItem(jaKey)).essay,"Redação da Jackeline");w.close();
});
test("Existing history goes only to its first selected owner and legacy copy remains",()=>{
 const legacy={version:3,essay:"Histórico anterior",progress:{},events:[],sessions:[],topics:{},settings:{goal:10,timer:"off"},session:null};
 const {w,document,click}=createApp({choose:false,seed:{"missao-farda-pmmg-state-v3":legacy}});
 assert.equal(document.querySelector("#profile-migration-note").hidden,false);
 click('[data-profile="jackeline"]');assert.equal(document.querySelector("#essay").value,"Histórico anterior");
 click("#switch-profile");click('[data-profile="luanderson"]');assert.equal(document.querySelector("#essay").value,"");
 assert.deepEqual(JSON.parse(w.localStorage.getItem("missao-farda-pmmg-state-v3")),legacy);w.close();
});
test("Backups identify the active owner and cannot overwrite the other profile",async()=>{
 const {w,document,click}=createApp();let payload;w.URL.createObjectURL=b=>{payload=b;return "blob:test";};w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){assert.match(this.download,/luanderson/);};
 click("#export-backup");const text=await new Promise(resolve=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.readAsText(payload);});
 const backup=JSON.parse(text);assert.equal(backup.profile.id,"luanderson");
 click("#switch-profile");click('[data-profile="jackeline"]');const before=w.localStorage.getItem("missao-farda-pmmg-state-v3-jackeline");
 const input=document.querySelector("#import-file");Object.defineProperty(input,"files",{value:[new w.File([text],"backup.json",{type:"application/json"})]});input.dispatchEvent(new w.Event("change",{bubbles:true}));
 await new Promise(resolve=>w.setTimeout(resolve,20));assert.equal(w.localStorage.getItem("missao-farda-pmmg-state-v3-jackeline"),before);assert.match(document.querySelector("#toast").textContent,/pertence a Luanderson/);w.close();
});
