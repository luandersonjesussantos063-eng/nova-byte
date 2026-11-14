import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import vm from "node:vm";
const root=resolve("questoes");
const ctx={Date,Math,Set,Map,Object,String,Number,Array,JSON};vm.runInNewContext(readFileSync(resolve(root,"core.js"),"utf8"),ctx);
const C=ctx.MFCore;
const examples=[
 {id:"pmmg2024-1",exam:"pmmg2024",number:1,subject:"Português",key:"C",annulled:false},
 {id:"pmmg2023-1",exam:"pmmg2023",number:1,subject:"Literatura",key:"A",annulled:false},
 {id:"pmmg2021-1",exam:"pmmg2021",number:1,subject:"Inglês",key:"B",annulled:false},
 {id:"pmmg2021-19",exam:"pmmg2021",number:19,subject:"Português",key:null,annulled:true}
];
test("Only real PMMG exams are included and subject groups normalize",()=>{
 assert.equal(C.isReal(examples[0]),true);
 assert.equal(C.isReal({...examples[0],exam:"pmesp"}),false);
 assert.equal(C.subjectGroup(examples[2]),"Inglês");
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
 const progress={ "pmmg2024-1":{correct:false,due:"2026-11-12"},"pmmg2023-1":{correct:true,due:"2026-12-01"} };
 assert.deepEqual(C.choose(examples,progress,{kind:"review",today:"2026-11-12",count:10}).map(x=>x.id),["pmmg2024-1"]);
 assert.equal(C.choose(examples,{}, {kind:"daily",count:3}).length,3);
 assert.equal(C.choose(examples,{}, {kind:"full",exam:"pmmg2021"}).length,2);
 assert.equal(C.choose(examples,{}, {kind:"daily",exam:"pmesp"}).length,0);
});
test("Scores exclude annulled and stats match valid attempts",()=>{
 const events=[{id:"pmmg2024-1",correct:true,day:"2026-11-12"},{id:"pmmg2023-1",correct:false,day:"2026-11-12"},{id:"pmmg2021-19",correct:true,day:"2026-11-12"}];
 const v=C.score(events,examples);
 assert.deepEqual(JSON.parse(JSON.stringify(v)),{attempts:2,correct:1,wrong:1,percent:50});
 assert.equal(C.statsBySubject(events,examples).Português.attempts,1);
});
test("Dates and seven-day activity are stable",()=>{
 assert.equal(C.dayShift("2026-12-31",1),"2027-01-01");
 assert.equal(C.daysBetween("2026-11-12","2027-02-28"),108);
 assert.equal(C.weeklyActivity([{id:"a",day:"2026-11-12"}],"2026-11-12").length,7);
});
test("PMMG bank exists and contains valid original-key records",()=>{
 const p=readFileSync(resolve(root,"banco-transcrito.js"),"utf8");
 const db=JSON.parse(p.split("window.EXAM_BANK=")[1].trim().replace(/;\s*$/,""));
 assert.equal(db.questions.length,180);
 assert.equal(Object.keys(db.exams).length,4);
 assert.equal(new Set(db.questions.map(q=>q.id)).size,180);
 for(const q of db.questions){
  assert.ok(C.isReal(q),q.id);
  assert.ok(q.key===null||q.annulled||"ABCD".includes(q.key),q.id);
  assert.ok(db.exams[q.exam],q.id);
  assert.equal(q.kind,"inline");
  assert.ok(q.text&&q.text.length>=7,q.id);
  assert.deepEqual(Object.keys(q.options).sort(),["A","B","C","D"],q.id);
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

test("Source passages, diagrams and continuations are complete for PMMG",()=>{
 const raw=readFileSync(resolve(root,"banco-transcrito.js"),"utf8");
 const db=JSON.parse(raw.split("window.EXAM_BANK=")[1].trim().replace(/;\s*$/,""));
 const q=db.questions.find(q=>q.id==="pmmg2021-40");
 assert.equal(q.originalImages.length,2);
 assert.match(q.text,/gráfico/);
 const adjusted=db.questions.find(q=>q.id==="pmmg2024-1");assert.equal(adjusted.key,"C");
 for(const n of [6,14,16])assert.equal(db.questions.find(q=>q.id==="pmmg2024-"+n).annulled,true);
 for(const q of db.questions)for(const src of [...q.supportImages,...q.originalImages])assert.ok(existsSync(resolve(root,src)),src);
 for(const [exam,count] of [["pmmg2021",40],["pmmg2023",50],["pmmg2024",50]])assert.equal(C.choose(db.questions,{}, {kind:"full",exam}).length,count);
 assert.equal(C.grade(adjusted,"C",null,"2026-11-13").correct,true);
 assert.throws(()=>C.grade({...adjusted,exam:"pmesp"},"C",null,"2026-11-13"));
 assert.throws(()=>C.grade(adjusted,"E",null,"2026-11-13"));
});

test("2018 Type A includes 40 questions and applies appeal annulment to Q27",()=>{
 const db=JSON.parse(readFileSync(resolve(root,"banco-transcrito.js"),"utf8").split("window.EXAM_BANK=")[1].trim().replace(/;\s*$/,""));
 const qs=db.questions.filter(q=>q.exam==="pmmg2018");assert.equal(qs.length,40);
 assert.equal(C.choose(db.questions,{}, {exam:"pmmg2018",kind:"full"}).length,40);
 const q=qs.find(q=>q.number===27);assert.equal(q.annulled,true);assert.equal(q.key,null);
 assert.equal(C.grade(q,"D",null,"2026-11-13").correct,null);
 assert.equal(qs[0].key,"D");assert.equal(qs[39].key,"B");
 assert.ok(qs[0].supportImages.length===2);
 for(const q of qs)for(const src of [...q.supportImages,...q.originalImages])assert.ok(existsSync(resolve(root,src)));
});
