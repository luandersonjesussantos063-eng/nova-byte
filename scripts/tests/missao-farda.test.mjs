import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import vm from "node:vm";
const root=resolve("questoes");
const ctx={Date,Math,Set,Map,Object,String,Number,Array,JSON};vm.runInNewContext(readFileSync(resolve(root,"core.js"),"utf8"),ctx);
const C=ctx.MFCore;
const examples=[
 {id:"pmesp-1",exam:"pmesp",number:1,subject:"Português",key:"C",annulled:false},
 {id:"pmesp25-1",exam:"pmesp25",number:1,subject:"Matemática",key:"A",annulled:false},
 {id:"pmesp24-1",exam:"pmesp24",number:1,subject:"História",key:"E",annulled:false},
 {id:"pmesp24-19",exam:"pmesp24",number:19,subject:"Português",key:null,annulled:true}
];
test("Only real PMESP exams are included and subject groups normalize",()=>{
 assert.equal(C.isReal(examples[0]),true);
 assert.equal(C.isReal({...examples[0],exam:"pmmg"}),false);
 assert.equal(C.subjectGroup(examples[2]),"Conhecimentos Gerais");
 assert.equal(C.isValid(examples[3]),false);
});
test("Spaced review never rewards wrong answers as correct",()=>{
 const first=C.grade(examples[0],"A",null,"2026-11-12");
 assert.equal(first.correct,false);assert.equal(first.due,"2026-11-13");
 const second=C.grade(examples[0],"C",first,"2026-11-13");
 assert.equal(second.correct,true);assert.equal(second.due,"2026-11-16");
 const third=C.grade(examples[0],"C",second,"2026-11-16");
 assert.equal(third.due,"2026-11-23");
});
test("Wrong-answer review, full exam, and diagnostic use only appropriate records",()=>{
 const progress={ "pmesp-1":{correct:false,due:"2026-11-12"},"pmesp25-1":{correct:true,due:"2026-12-01"} };
 assert.deepEqual(C.choose(examples,progress,{kind:"review",today:"2026-11-12",count:10}).map(x=>x.id),["pmesp-1"]);
 assert.equal(C.choose(examples,{}, {kind:"daily",count:3}).length,3);
 assert.equal(C.choose(examples,{}, {kind:"full",exam:"pmesp24"}).length,2);
 assert.equal(C.choose(examples,{}, {kind:"daily",exam:"pmmg"}).length,0);
});
test("Scores exclude annulled and stats match valid attempts",()=>{
 const events=[{id:"pmesp-1",correct:true,day:"2026-11-12"},{id:"pmesp25-1",correct:false,day:"2026-11-12"},{id:"pmesp24-19",correct:true,day:"2026-11-12"}];
 const v=C.score(events,examples);
 assert.deepEqual(JSON.parse(JSON.stringify(v)),{attempts:2,correct:1,wrong:1,percent:50});
 assert.equal(C.statsBySubject(events,examples).Português.attempts,1);
});
test("Dates and seven-day activity are stable",()=>{
 assert.equal(C.dayShift("2026-12-31",1),"2027-01-01");
 assert.equal(C.daysBetween("2026-11-12","2027-02-28"),108);
 assert.equal(C.weeklyActivity([{id:"a",day:"2026-11-12"}],"2026-11-12").length,7);
});
test("PMESP bank exists and contains valid original-key records",()=>{
 const p=readFileSync(resolve(root,"banco-transcrito.js"),"utf8");
 const db=JSON.parse(p.split("window.EXAM_BANK=")[1].trim().replace(/;\s*$/,""));
 assert.equal(db.questions.length,300);
 assert.equal(Object.keys(db.exams).length,5);
 assert.equal(new Set(db.questions.map(q=>q.id)).size,300);
 for(const q of db.questions){
  assert.ok(C.isReal(q),q.id);
  assert.ok(q.key===null||q.annulled||"ABCDE".includes(q.key),q.id);
  assert.ok(db.exams[q.exam],q.id);
  assert.equal(q.kind,"inline");
  assert.ok(q.text&&q.text.length>=7,q.id);
  assert.deepEqual(Object.keys(q.options).sort(),["A","B","C","D","E"],q.id);
 }
 for(const f of ["index.html","app.js","core.js","banco-transcrito.js","sw.js","manifest.webmanifest","icon.svg"]){
  assert.ok(existsSync(resolve(root,f)),f);
 }
});

test("Unverified answer is saved without being graded as incorrect",()=>{
 const noKey={...examples[0],key:null};
 const outcome=C.grade(noKey,"A",null,"2026-11-12");
 assert.equal(outcome.correct,null);
 assert.equal(outcome.due,null);
 assert.equal(C.isValid(noKey),false);
});

// Regression: issue reported by student, original PMESP 2026 Q21 was cut mid-sentence.
test("PMESP 2026 stems are complete and question 21 includes all four transactions",()=>{
 const raw=readFileSync(resolve(root,"banco-transcrito.js"),"utf8");
 const db=JSON.parse(raw.split("window.EXAM_BANK=")[1].trim().replace(/;\s*$/,""));
 const qs=db.questions.filter(q=>q.exam==="pmesp");
 assert.equal(qs.length,60);
 assert.deepEqual(qs.filter(q=>q.text.trim().endsWith("…")).map(q=>q.number),[]);
 const q=qs.find(q=>q.number===21);
 assert.match(q.text,/1\) Em 01\.04\.26/);
 assert.match(q.text,/2\) Em 02\.04\.26/);
 assert.match(q.text,/3\) Em 15\.04\.26/);
 assert.match(q.text,/4\) Em 16\.04\.26/);
 assert.match(q.text,/2\/3/);
 assert.match(q.text,/3\/10/);
 assert.match(q.text,/3\/5/);
 assert.match(q.text,/após essas movimentações/);
});
