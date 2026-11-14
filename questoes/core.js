/* Missão Farda 3 — lógica pura e testável, sem dependências externas. */
(function(root){
"use strict";
const GROUPS=["Português", "Direito Penal", "Direito Constitucional", "Direito Penal Militar", "Direitos Humanos", "Legislação Extravagante", "Estatística", "Literatura", "Inglês", "Noções de Direito e Direitos Humanos", "Raciocínio Lógico-Matemático"];
const TARGETS={"Português": 20, "Direito Penal": 0, "Direito Constitucional": 0, "Direito Penal Militar": 0, "Direitos Humanos": 0, "Legislação Extravagante": 0, "Estatística": 0, "Literatura": 5, "Inglês": 5, "Noções de Direito e Direitos Humanos": 10, "Raciocínio Lógico-Matemático": 10};
const DEFAULT_EXAM_DATE=null;
function dayDate(date){const d=date instanceof Date?date:new Date(date||Date.now());return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function dayShift(iso,n){const [y,m,d]=String(iso).split("-").map(Number);const z=new Date(Date.UTC(y,m-1,d+Number(n||0)));return z.toISOString().slice(0,10);}
function daysBetween(a,b){return Math.round((Date.parse(b+"T12:00:00Z")-Date.parse(a+"T12:00:00Z"))/86400000);}
function subjectGroup(q){return typeof q==="string"?q:q?.subject||"";}
function isReal(q){return q&&/^pmmg(2021|2023|2024)$/.test(q.exam)&&Number.isInteger(q.number)&&q.number>=1&&q.number<=(q.exam==="pmmg2021"?40:50);}
function isValid(q){return isReal(q)&&!q.annulled&&"ABCD".includes(q.key||"-");}
function cleanHistory(state,ids){const out={};Object.keys(state||{}).forEach(id=>{if(!ids.has(id))return;const p=state[id];if(p&&typeof p==="object")out[id]={...p};});return out;}
function reviewDue(p,now){if(!p)return false;return p.due?String(p.due)<=now:p.correct===false;}
function grade(q,choice,old,iso,reason=""){
  if(!isReal(q))throw new Error("Questão não pertence à PMMG");
  if(q.annulled||!/[A-D]/.test(q.key||""))return {answer:choice||"",correct:null,annulled:!!q.annulled,at:Date.now(),day:iso,attempts:(old?.attempts||0)+1,due:null,successStreak:0,reason:""};
  if(!"ABCD".includes(choice||""))throw new Error("Alternativa inválida");
  const hit=q.key===choice,streak=hit?(old?.successStreak||0)+1:0;
  const days=hit?([0,3,7,14,30,45,60][Math.min(6,streak)]):1;
  return {answer:choice,correct:hit,annulled:false,at:Date.now(),day:iso,attempts:(old?.attempts||0)+1,due:dayShift(iso,days),successStreak:streak,reason};
}
function score(events,questions){
 const map=new Map(questions.map(q=>[q.id,q]));const valid=(events||[]).filter(e=>isValid(map.get(e.id))&&(e.answer||"ABCD".includes(e.choice||"")));
 const correct=valid.filter(e=>e.correct===true).length;
 return {attempts:valid.length,correct,wrong:valid.length-correct,percent:valid.length?Math.round(correct/valid.length*100):null};
}
function statsBySubject(events,questions){
 const result=Object.fromEntries(GROUPS.map(s=>[s,{attempts:0,correct:0,percent:null,unique:new Set()}]));
 const map=new Map(questions.map(q=>[q.id,q]));
 for(const ev of events||[]){const q=map.get(ev.id);if(!isValid(q))continue;const t=result[subjectGroup(q)];if(!t)continue;t.attempts++;t.correct+=ev.correct===true?1:0;t.unique.add(q.id);}
 for(const s of GROUPS){const t=result[s];t.percent=t.attempts?Math.round(t.correct/t.attempts*100):null;t.unique=t.unique.size;}
 return result;
}
function weakestSubject(stats){
 return GROUPS.slice().sort((a,b)=>{
  const pa=stats[a]?.attempts>=3?stats[a].percent:65;
  const pb=stats[b]?.attempts>=3?stats[b].percent:65;
  return pa-pb||TARGETS[b]-TARGETS[a];
 })[0];
}
function attemptRank(q,progress,today,kind){
 const p=progress[q.id];
 if(kind==="review")return !p?999:reviewDue(p,today)?0:2;
 if(kind==="diagnostic")return p?3:0;
 if(!p)return 1;
 if(p.correct===false&&reviewDue(p,today))return 0;
 if(reviewDue(p,today))return 1.5;
 return 4;
}
function choose(questions,progress={},options={}){
 const kind=options.kind||"daily",now=options.today||dayDate(),size=Number(options.count||5),exam=options.exam||"all",subject=options.subject||"all";
 let pool=(questions||[]).filter(q=>isReal(q)&&(!options.excludeAnnulled||!q.annulled)&&(!q.annulled||kind==="full"));
 if(exam!=="all")pool=pool.filter(q=>q.exam===exam);
 if(subject!=="all")pool=pool.filter(q=>subjectGroup(q)===subject||q.subject===subject);
 if(kind==="review")pool=pool.filter(q=>progress[q.id]&&reviewDue(progress[q.id],now));
 if(kind==="new")pool=pool.filter(q=>!progress[q.id]);
 if(kind==="full")return pool.sort((a,b)=>a.number-b.number);
 pool.sort((a,b)=>{
  const rank=attemptRank(a,progress,now,kind)-attemptRank(b,progress,now,kind);
  if(rank!==0)return rank;
  if(a.exam!==b.exam){const order=["pmmg2024","pmmg2023","pmmg2021"];return order.indexOf(a.exam)-order.indexOf(b.exam);}
  return a.number-b.number;
 });
 if(subject!=="all"||kind==="review"||kind==="new")return pool.slice(0,size);
 const buckets=new Map(GROUPS.map(s=>[s,[]]));
 pool.forEach(q=>{const b=buckets.get(subjectGroup(q));if(b)b.push(q);});
 const weights=Object.fromEntries(GROUPS.map(s=>[s,TARGETS[s]||5]));
 const picked=[],ids=new Set(); let spins=0;
 while(picked.length<size&&spins<size*10){
  spins++;
  const candidates=GROUPS.filter(s=>buckets.get(s).length);
  if(!candidates.length)break;
  candidates.sort((a,b)=>{
   const currentA=picked.filter(q=>subjectGroup(q)===a).length;
   const currentB=picked.filter(q=>subjectGroup(q)===b).length;
   const balance=(currentA+0.45)/weights[a]-(currentB+0.45)/weights[b];
   return balance||GROUPS.indexOf(a)-GROUPS.indexOf(b);
  });
  let q=buckets.get(candidates[0]).shift();
  if(!ids.has(q.id)){ids.add(q.id);picked.push(q);}
 }
 return picked;
}
function weeklyActivity(events,today){
 const days=Array.from({length:7},(_,i)=>dayShift(today,i-6));
 return days.map(day=>({day,count:(events||[]).filter(e=>e.day===day).length}));
}
function progressCount(progress,qs,today){
 const ids=new Set(qs.map(q=>q.id));
 const entries=Object.entries(progress).filter(([id])=>ids.has(id));
 return {seen:entries.length,wrong:entries.filter(([id,p])=>p.correct===false).length,due:entries.filter(([id,p])=>reviewDue(p,today)).length};
}
function nextSubject(date){const weekday=new Date(date+"T12:00:00Z").getUTCDay();return {0:"Revisão leve",1:"Português",2:"Raciocínio Lógico-Matemático",3:"Noções de Direito e Direitos Humanos",4:"Português e Literatura",5:"Inglês",6:"Revisão dos erros"}[weekday];}
function phase(done,daysLeft){
 const d=Number(done)||0;
 if(typeof daysLeft==="number"&&daysLeft>=0&&daysLeft<=21)return "Reta final";
 return d<30?"Fundação":d<90?"Construção":"Revisão ativa";
}
function exportSafe(state){return JSON.stringify({app:"missao-farda-pmmg",version:3,exportedAt:new Date().toISOString(),state},null,2);}
const API={GROUPS,TARGETS,DEFAULT_EXAM_DATE,dayDate,dayShift,daysBetween,subjectGroup,isReal,isValid,cleanHistory,reviewDue,grade,score,statsBySubject,weakestSubject,choose,weeklyActivity,progressCount,nextSubject,phase,exportSafe};
root.MFCore=API;
})(typeof globalThis!=="undefined"?globalThis:this);
