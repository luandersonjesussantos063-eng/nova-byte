/* Missão Farda 3 — progresso local, estudo gradual e somente provas PMESP. */
"use strict";
(function(){
const DB=window.EXAM_BANK,C=window.MFCore;
if(!DB||!C){document.body.textContent="Não foi possível carregar o banco de provas. Atualize a página com internet.";return;}
const $=id=>document.getElementById(id),DAY=C.dayDate(),IDS=new Set(DB.questions.map(q=>q.id)),QUESTION=new Map(DB.questions.map(q=>[q.id,q]));
const STATEKEY="missao-farda-state-v3";
const TOPICS={
"Português":["Interpretação de textos literários e não literários","Sinônimos, antônimos e sentidos das palavras","Sentido próprio e figurado","Pontuação","Classes de palavras","Concordância verbal e nominal","Regência verbal e nominal","Colocação pronominal","Crase"],
"Matemática":["Operações com números inteiros","Números racionais, frações e decimais","Mínimo múltiplo comum","Razão e proporção","Porcentagem","Regra de três simples","Média aritmética","Equações de primeiro grau","Sistema de equações de primeiro grau","Medidas e sistema métrico","Interpretação de tabelas e gráficos","Geometria: perímetro, área, volume e Pitágoras"],
"Conhecimentos Gerais":["História Geral","História do Brasil","Geografia Geral","Geografia do Brasil","Atualidades — acontecimentos do período exigido no edital"],
"Informática":["Sistema operacional Windows e arquivos","Ferramentas de edição de texto e planilhas","Correio eletrônico e internet","Ferramentas de comunicação e colaboração"],
"Administração Pública":["Constituição Federal — tópicos exigidos no edital","Constituição do Estado de São Paulo","Lei de Acesso à Informação (LAI)","Decreto paulista nº 68.155/2023"]
};

const LESSONS={
"Português":{title:"Entenda o texto antes de decorar regras",intro:"Na PMESP, interpretar bem o enunciado ajuda até nas questões de gramática. Você precisa identificar o que o autor afirma e distinguir isso do que a alternativa sugere.",steps:["Leia primeiro o comando e marque mentalmente se a banca pede a correta ou a incorreta.","Procure a ideia central de cada parágrafo. Palavras como mas, porém e portanto mudam a relação entre as frases.","Em gramática, revise classes de palavras, concordância, crase e pontuação com exemplos curtos."],practice:"Comece pela prova VUNESP 2026, questões 1 a 5, consultando o texto de apoio original."},
"Matemática":{title:"Raciocine com calma antes de calcular",intro:"Seu ponto de partida são operações, frações e proporções. Não precisa tentar decorar tudo de uma vez: escreva os dados, a pergunta e as unidades.",steps:["Porcentagem significa partes de 100: 25% = 25/100 = 1/4. Entenda a relação antes da fórmula.","Em problemas, identifique o que cresce e o que diminui. Faça uma estimativa do resultado para perceber absurdos.","Aprenda a conferir a resposta: substitua o valor encontrado na relação inicial."],practice:"Revise porcentagem e abra as primeiras questões de Matemática do caderno real, a partir da questão 21."},
"Conhecimentos Gerais":{title:"Organize o conteúdo em tempo, lugar e causa",intro:"História e Geografia ficam mais claras quando você entende o contexto. Atualidades exigem checar o período cobrado no edital e utilizar fontes confiáveis.",steps:["História: separe fato, período histórico, causas e consequências em uma linha do tempo.","Geografia: localize o fenômeno no mapa, identifique agentes e compare indicadores em gráficos.","Atualidades: anote data, acontecimento, contexto e consequências. Evite decorar manchetes sem entender o tema."],practice:"Abra as questões de Conhecimentos Gerais, História, Geografia ou Atualidades de uma prova real."},
"Informática":{title:"Aprenda pela função de cada ferramenta",intro:"Para resolver Informática, diferencie as tarefas que o sistema operacional, o navegador, o e-mail e os aplicativos de escritório realizam.",steps:["Arquivos e pastas: entenda criar, mover, renomear, recuperar e localizar.","Texto e planilha: pratique formatação, tabelas e referências de células em situações simples.","Internet: diferencie endereço, navegador, pesquisa, envio de e-mails e segurança digital."],practice:"Use o bloco de Informática da PMESP 2026, questões 51 a 55."},
"Administração Pública":{title:"Separe princípio, regra e aplicação",intro:"Estude a norma pelo que ela protege e por como aparece em situações concretas. O edital delimita os textos legais exigidos.",steps:["Constituição Federal: identifique direitos fundamentais e princípios da Administração Pública.","Memorize o sentido de legalidade, impessoalidade, moralidade, publicidade e eficiência antes de siglas.","Consulte a Constituição paulista, a LAI e o Decreto nº 68.155/2023, respeitando as versões em vigor."],practice:"Treine nas questões 56 a 60 do caderno PMESP 2026."}
};

const read=(key)=>{try{return JSON.parse(localStorage.getItem(key)||"null");}catch{return null;}};
const defaultState=()=>({version:3,progress:{},events:[],sessions:[],topics:{},essay:"",essayWeek:"",settings:{goal:5,timer:"off"},session:null});
let state=read(STATEKEY)||defaultState();
const old=read("missao-farda-progress-v1");
if(!read(STATEKEY)&&old&&typeof old==="object"){
 for(const [id,p] of Object.entries(old))if(IDS.has(id)&&p&&typeof p==="object"){
 state.progress[id]={...p,due:p.due||C.dayShift(p.day||DAY,p.correct===false?1:3),successStreak:p.correct?1:0};
 if(p.correct!==null&&"ABCDE".includes(p.answer||"")){
 const q=QUESTION.get(id);state.events.push({id,day:p.day||DAY,at:Number(p.at)||Date.now(),answer:p.answer,correct:p.correct,exam:q.exam,subject:C.subjectGroup(q)});
 }
 }
 const oldSession=read("missao-farda-session-v1");
 if(oldSession&&Array.isArray(oldSession.ids)&&oldSession.ids.length&&oldSession.ids.every(id=>IDS.has(id))&&oldSession.exam in DB.exams&&!oldSession.finished)
 state.session={...oldSession,grading:oldSession.grading||"practice",kind:"daily",started:oldSession.created||Date.now(),reviewing:false,finished:false};
}
state={...defaultState(),...state};
state.progress=C.cleanHistory(state.progress,IDS);
state.events=Array.isArray(state.events)?state.events.filter(e=>IDS.has(e.id)&&e&&typeof e==="object").slice(-12000):[];
state.sessions=Array.isArray(state.sessions)?state.sessions.filter(s=>s&&typeof s==="object").slice(-500):[];
if(!state.topics||typeof state.topics!=="object")state.topics={};
if(!state.settings||typeof state.settings!=="object")state.settings={goal:5,timer:"off"};
if(state.session&&(!Array.isArray(state.session.ids)||state.session.ids.some(id=>!IDS.has(id))||!DB.exams[state.session.exam]&&state.session.exam!=="all"))state.session=null;
let activeTab="home",countdown=null,remaining=0,timerPaused=false,toastTimeout=null,readerOpenKey=null;
function save(){try{localStorage.setItem(STATEKEY,JSON.stringify(state));return true;}catch{toast("Armazenamento do navegador indisponível: exporte um backup dos seus dados.");return false;}}
function toast(message){const el=$("toast");el.textContent=message;el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{el.hidden=true;},3900);}
function el(tag,cls,txt){const x=document.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=String(txt);return x;}
function add(parent,tag,cls,txt){const x=el(tag,cls,txt);parent.appendChild(x);return x;}
function button(label,cls,callback){const b=el("button",cls,label);b.type="button";b.addEventListener("click",callback);return b;}
function link(label,href,cls=""){const a=el("a",cls,label);a.href=href;a.target="_blank";a.rel="noopener noreferrer";return a;}
function visible(view){document.querySelectorAll("[data-tab]").forEach(x=>{const on=x.dataset.tab===view;x.classList.toggle("active",on);if(on)x.setAttribute("aria-current","page");else x.removeAttribute("aria-current");});for(const id of ["home","train","path","insights"])$("view-"+id).hidden=id!==view;activeTab=view;window.scrollTo({top:0,behavior:"instant"});}
function show(view){visible(view);renderAll();}
function currentSession(){return state.session&&Array.isArray(state.session.ids)?state.session:null;}
function sessionItems(){return (currentSession()?.ids||[]).map(id=>QUESTION.get(id)).filter(Boolean);}
function totalEvents(){return state.events.filter(e=>e&&"ABCDE".includes(e.answer||"")&&!QUESTION.get(e.id)?.annulled);}
function getDue(){return C.progressCount(state.progress,DB.questions,DAY).due;}
function lastDate(){const d=state.events.map(x=>x.day).sort();return d.at(-1)||null;}
function percent(n,d){return d?Math.round(n/d*100):0;}
function meter(id,percentage){$(id).style.width=Math.max(0,Math.min(100,percentage))+"%";}
function weekGrid(target){const activity=C.weeklyActivity(state.events,DAY),names=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];target.replaceChildren();activity.forEach(d=>{const date=new Date(d.day+"T12:00:00Z"),box=el("div","week-day");const b=add(box,"b",d.count?"done":"",d.count?String(d.count):"·");b.title=d.count+" tentativa(s) em "+d.day;add(box,"small","",names[date.getUTCDay()]);target.appendChild(box);});}
function upcoming(){const days=C.daysBetween(DAY,C.DEFAULT_EXAM_DATE);$("days-left").textContent=days>=0?days+" dias restantes (previsão)":"Data prevista já passou; confira novo edital";$("path-days").textContent=days>=0?String(days):"—";}
function getWeeklyCount(){return new Set(C.weeklyActivity(state.events,DAY).filter(x=>x.count).map(x=>x.day)).size;}
function renderHome(){
 const events=totalEvents(),score=C.score(events,DB.questions),seen=C.progressCount(state.progress,DB.questions,DAY),week=getWeeklyCount();
 $("home-answered").textContent=String(events.length);
 $("home-accuracy").textContent=score.percent===null?"—":score.percent+"%";
 $("unique-done").textContent=seen.seen+"/300";meter("seen-meter",percent(seen.seen,300));
 $("today-count").textContent=String(events.filter(e=>e.day===DAY).length);
 $("due-count").textContent=String(getDue());
 $("weeks-active").textContent=week+"/7";
 $("phase").textContent=C.phase(events.length,C.daysBetween(DAY,C.DEFAULT_EXAM_DATE));
 $("home-review-text").textContent=getDue()?getDue()+" questão(ões) aguardando revisão. Comece por elas se tiver disposição.":"Sem revisões vencidas. Você pode explorar questões novas.";
 const last=lastDate(),gap=last?C.daysBetween(last,DAY):null;
 $("greeting").textContent=gap!==null&&gap>=2?"Um recomeço pequeno já vale.":events.length===0?"Começar é só resolver uma questão.":"Mais um passo na sua preparação.";
 $("daily-copy").textContent=gap!==null&&gap>=2?"Não há nada para recuperar ou compensar. Escolha 2 questões e avance no seu ritmo.":"Hoje vale resolver poucas questões reais, revisar os erros e encerrar sem cobrança.";
 $("resume").hidden=!currentSession()||currentSession().finished;
 $("week-tip").textContent="Sugestão de hoje: "+C.nextSubject(DAY)+". Você pode mudar de matéria sempre que precisar.";
 weekGrid($("week-calendar"));upcoming();
 const chosen=Number(state.settings.goal)||5;
 document.querySelectorAll("[data-goal]").forEach(b=>{const active=+b.dataset.goal===chosen;b.classList.toggle("selected",active);b.setAttribute("aria-pressed",String(active));});
}
function renderSources(){
 const exam=DB.exams[$("exam").value]||DB.exams.pmesp;
 $("exam-note").textContent=exam.note;
 $("paper-link").href=exam.source;
 $("paper-link").textContent=exam.board==="VUNESP"?"Prova na VUNESP ↗":"PDF da prova original ↗";
 $("key-link").href=exam.keySource||exam.source;
}
function fillSubjects(){const exam=$("exam").value,old=$("subject").value;
 const subjects=Array.from(new Set(DB.questions.filter(q=>q.exam===exam).map(q=>C.subjectGroup(q))));
 $("subject").replaceChildren();const a=el("option","","Todas as disciplinas");a.value="all";$("subject").appendChild(a);
 C.GROUPS.filter(s=>subjects.includes(s)).forEach(s=>{const o=el("option","",s);o.value=s;$("subject").appendChild(o);});
 $("subject").value=subjects.includes(old)?old:"all";
}
function timerStop(){if(countdown){clearInterval(countdown);countdown=null;}}
function timerDraw(){if(remaining<=0){timerStop();$("timer-display").textContent="00:00";toast("Seu tempo de foco acabou. Pode continuar ou fazer uma pausa.");return;}
 $("timer-display").textContent=String(Math.floor(remaining/60)).padStart(2,"0")+":"+String(remaining%60).padStart(2,"0");}
function timerStart(){timerStop();const option=$("timer-setting").value;state.settings.timer=option;$("timer-box").hidden=option==="off";
 if(option==="off")return;remaining=Number(option)*60;timerPaused=false;$("timer-toggle").textContent="Pausar";timerDraw();
 countdown=setInterval(()=>{if(!timerPaused){remaining=Math.max(0,remaining-1);timerDraw();}},1000);
}
function sessionNew(options={}){
 const old=currentSession();
 if(old&&!old.finished&&Object.keys(old.picks||{}).length&&!options.force){
  if(!window.confirm("Você tem um treino em andamento. Começar outro vai substituir a sessão aberta. As respostas já corrigidas continuarão no histórico. Continuar?"))return;
 }
 const kind=options.kind||$("mode").value;
 const grading=kind==="full"||kind==="diagnostic"?"exam":options.grading||$("grading").value;
 const exam=kind==="diagnostic"?"pmesp":options.exam||$("exam").value||"pmesp";
 const subject=kind==="diagnostic"||kind==="full"?"all":options.subject||$("subject").value||"all";
 const count=kind==="diagnostic"?10:kind==="full"?60:Number(options.count||$("quantity").value||5);
 const list=C.choose(DB.questions,state.progress,{kind,exam,subject,count,today:DAY,excludeAnnulled:kind!=="full"});
 if(!list.length){toast(kind==="review"?"Ainda não há revisões vencidas. Faça um treino de questões novas.":"Não há questões disponíveis neste filtro. Tente outra disciplina ou edição.");show("train");return;}
 readerOpenKey=null;
 state.session={ids:list.map(q=>q.id),index:0,picks:{},checked:{},finished:false,reviewing:false,kind,exam,subject,grading,started:Date.now(),finishedAt:null};
 if(DB.exams[exam])$("exam").value=exam;
 fillSubjects();$("subject").value=subject;save();timerStart();show("train");
}
function sourceURL(q){return q.exam==="pmesp"?"https://carreirapublica.com.br/questoes/Q"+(208122+q.number):DB.exams[q.exam].source;}
function gradeOne(q){
 if(!q||!currentSession()||currentSession().checked[q.id])return;
 const s=state.session,choice=s.picks[q.id]||"";
 if(!choice&&!q.annulled)return;
 s.checked[q.id]=true;
 const previous=state.progress[q.id];
 const result=C.grade(q,choice,previous,DAY,previous?.reason||"");
 state.progress[q.id]=result;
 if(result.correct!==null)state.events.push({id:q.id,day:DAY,at:result.at,answer:choice,correct:result.correct,exam:q.exam,subject:C.subjectGroup(q)});
 save();
}
function gradeAll(){
 const s=currentSession();if(!s||s.finished)return;
 const blanks=sessionItems().filter(q=>!q.annulled&&!s.picks[q.id]).length;
 if(blanks&&!window.confirm("Há "+blanks+" questão(ões) em branco. Elas serão exibidas no resultado como não respondidas. Finalizar?"))return;
 sessionItems().forEach(q=>{if(!s.checked[q.id]&&(s.picks[q.id]||q.annulled))gradeOne(q);});
 finish();
}
function finish(){
 const s=currentSession();if(!s||s.finished)return;
 s.finished=true;s.reviewing=false;s.finishedAt=Date.now();
 const scored=sessionItems().filter(q=>!q.annulled&&q.key),correct=scored.filter(q=>s.picks[q.id]&&s.picks[q.id]===q.key).length;
 state.sessions.push({at:s.finishedAt,day:DAY,kind:s.kind,exam:s.exam,total:scored.length,correct,responded:scored.filter(q=>!!s.picks[q.id]).length});
 state.sessions=state.sessions.slice(-500);
 timerStop();save();renderAll();
}
function outcome(){
 const s=currentSession();if(!s)return null;
 const items=sessionItems(),valid=items.filter(q=>!q.annulled&&q.key);
 return {total:items.length,valid:valid.length,correct:valid.filter(q=>s.picks[q.id]===q.key).length,responded:valid.filter(q=>!!s.picks[q.id]).length,annulled:items.filter(q=>q.annulled).length,graded:items.filter(q=>s.checked[q.id]).length};
}
function showSessionResult(area){
 const s=currentSession(),result=outcome();
 $("question-chip").textContent="TREINO CONCLUÍDO";$("question-counter").textContent=result.total+" questões";
 $("question-meta").textContent="Resultado desta sessão · prova(s) da PMESP";
 const title=add(area,"h2","question-title",result.correct+" acerto(s) em "+result.valid+" questão(ões) válidas");
 add(area,"p","dim","Você concluiu seu treino. O que importa agora é descobrir o que revisar, e não buscar uma nota perfeita no primeiro dia.");
 const cards=add(area,"div","metric-grid");cards.style.margin="18px 0";
 for(const [number,label] of [[result.correct,"Acertos"],[result.responded-result.correct,"Erros"],[result.valid-result.responded,"Em branco"],[result.annulled,"Anuladas"]]){
 const card=add(cards,"div","mini-card");add(card,"strong","",number);add(card,"span","",label);
 }
 const p=add(area,"p","support-note","Acerto nas questões corrigíveis: "+(result.valid?percent(result.correct,result.valid)+"%":"—")+". Questões sem gabarito confirmado não entram na nota. Esta taxa não prevê aprovação.");
 const actions=add(area,"div","source-links");
 actions.appendChild(button("Revisar minhas respostas","outline",()=>{s.reviewing=true;s.index=0;save();renderAll();}));
 actions.appendChild(button("Fazer outra sessão","outline light",()=>sessionNew({kind:"daily",exam:s.exam,subject:"all",count:5})));
 actions.appendChild(button("Ir para meu painel","ghost",()=>show("insights")));
 const last=add(area,"p","fine","Se já foi suficiente por hoje, pode encerrar aqui. Sua sessão foi salva.");
}
function renderQuestion(){
 const area=$("question-area");area.replaceChildren();
 const s=currentSession();
 if(!s){$("question-chip").textContent="PMESP · PROVAS REAIS";$("question-counter").textContent="";$("question-meta").textContent="Selecione uma edição e um treino.";
 const empty=add(area,"div","empty-state");add(empty,"div","empty-mark","▤");add(empty,"h2","","Seu treino começa aqui");add(empty,"p","","Escolha uma edição da PMESP. Você responderá às questões reais usando o caderno oficial como referência.");
 $("question-actions").hidden=true;$("question-numbers-wrap").hidden=true;meter("quiz-meter",0);return;}
 if(s.finished&&!s.reviewing){
 $("question-actions").hidden=true;$("question-numbers-wrap").hidden=true;meter("quiz-meter",100);
 showSessionResult(area);return;}
 const items=sessionItems();if(!items.length){state.session=null;save();renderQuestion();return;}
 s.index=Math.max(0,Math.min(items.length-1,Number(s.index)||0));
 const q=items[s.index],info=DB.exams[q.exam],chosen=s.picks[q.id]||"",graded=!!s.checked[q.id]&&s.grading==="practice"||!!s.finished;
 $("question-chip").textContent="PMESP "+info.year+" · "+info.board;
 $("question-counter").textContent=(s.index+1)+" / "+items.length;
 $("question-meta").textContent=C.subjectGroup(q)+" · questão original nº "+q.number+" · "+(info.type||"caderno original");
 meter("quiz-meter",percent(items.filter(x=>s.checked[x.id]).length,items.length));
 const title=add(area,"h2","question-title","Questão "+q.number+" — "+C.subjectGroup(q));
 add(area,"p","actual-question",q.text||"Enunciado em revisão.");
 if(q.support?.text){
  const passage=add(area,"section","source-passage");
  add(passage,"h3","","Texto de apoio original");
  const content=add(passage,"div","passage-content",q.support.text);
  content.setAttribute("aria-label","Texto de apoio para esta questão");
 }
 if(q.visual){
  const figure=add(area,"figure","question-figure");
  const picture=add(figure,"img");
  picture.src=q.visual;
  picture.loading="lazy";
  picture.alt="Trecho visual do caderno original PMESP "+info.year+", questão "+q.number;
  add(figure,"figcaption","","Imagem, gráfico ou alternativa ilustrada da prova original");
 }
 if(q.needsVisual&&!q.visual&&!q.support?.text){
  const note=add(area,"p","support-note","Esta questão menciona um elemento visual. Se ele não aparecer, confira a figura do caderno original antes de responder.");
  note.appendChild(link(" Conferir imagem na prova ↗",info.paperPdf||info.source));
 }
 if(q.key===null&&!q.annulled){
  add(area,"p","question-note","Resposta salva sem nota: este caderno ainda não tem gabarito definitivo conferido nesta versão.");
 }
 if(q.annulled)add(area,"p","support-note","Questão oficialmente anulada. Ela não é contabilizada como acerto ou erro.");
 add(area,"h3","subheading",graded?"Alternativas e correção":"Marque sua resposta (A a E)");
 const opts=add(area,"div","answer-options");
 "ABCDE".split("").forEach(letter=>{
 const b=el("button","option");b.type="button";b.disabled=graded;
 b.setAttribute("aria-pressed",String(chosen===letter));if(chosen===letter)b.classList.add("is-picked");
 if(graded&&!q.annulled&&q.key===letter)b.classList.add("correct");
 if(graded&&!q.annulled&&chosen===letter&&chosen!==q.key)b.classList.add("wrong");
 add(b,"span","letter",letter);add(b,"span","",q.options?.[letter]||"Alternativa "+letter+" — confira o caderno.");
 b.addEventListener("click",()=>{
 if(graded)return;
 s.picks[q.id]=letter;save();
 opts.querySelectorAll(".option").forEach((option,i)=>{
  const picked="ABCDE"[i]===letter;
  option.classList.toggle("is-picked",picked);
  option.setAttribute("aria-pressed",String(picked));
 });
 const action=$("check");
 if(action&&!s.finished)action.disabled=false;
 const navIndex=$("question-numbers")?.children[s.index];
 if(navIndex)navIndex.classList.add("marked");
});
 opts.appendChild(b);
 });
 $("feedback").hidden=true;
 if(graded){
 const f=$("feedback");f.replaceChildren();f.hidden=false;
 f.className="feedback "+(q.annulled?"":chosen===q.key?"good":"bad");
 if(q.annulled){add(f,"strong","","Anulada no gabarito definitivo");add(f,"p","","Não conta como acerto nem erro. Continue estudando as demais questões.");}
 else if(!q.key){add(f,"strong","","Resposta registrada");add(f,"p","","Ainda não há gabarito definitivo conferido nesta versão. Sua escolha não será contada como erro nem acerto.");}
 else {
 add(f,"strong","",chosen===q.key?"✓ Você acertou!":"Gabarito oficial: alternativa "+q.key);
 add(f,"p","",chosen===q.key?"Boa! A banca indicou a mesma alternativa que você marcou.":"Você marcou "+(chosen||"em branco")+". A alternativa oficial deste caderno é "+q.key+".");
 add(f,"p","","O app usa o gabarito da banca; ele não inventa uma explicação para o enunciado.");
 if(chosen&&chosen!==q.key){
 const help=button("Estudar a base de "+C.subjectGroup(q)+" →","small-button",()=>{
  show("path");$("lesson-subject").value=C.subjectGroup(q);renderLesson();$("lesson-hub").scrollIntoView({block:"start",behavior:"smooth"});
 });
 f.appendChild(help);
 add(f,"p","dim small","O que dificultou esta questão? (opcional)");
 const r=add(f,"div","error-reason");
 ["Não sabia o conteúdo","Interpretei errado","Desatenção","Faltou tempo"].forEach(reason=>{
 const b=button(reason,state.progress[q.id]?.reason===reason?"selected":"",()=>{
  if(state.progress[q.id]){state.progress[q.id].reason=reason;save();renderQuestion();}
 });
 r.appendChild(b);
 });
 }
 }
 }
 const actions=$("question-actions");actions.hidden=false;
 $("previous").disabled=s.index===0;
 $("next").disabled=s.index===items.length-1;
 const c=$("check");
 if(s.finished){c.textContent="Voltar ao resultado";c.disabled=false;}
 else if(s.grading==="exam" || s.kind==="diagnostic"||s.kind==="full"){
 c.textContent=s.index===items.length-1?"Finalizar e corrigir":"Salvar e avançar";c.disabled=false;
 }else if(s.checked[q.id]){c.textContent=s.index===items.length-1?"Concluir sessão":"Próxima questão";c.disabled=false;}
 else {c.textContent=q.annulled?"Continuar (anulada)":"Confirmar resposta";c.disabled=!chosen&&!q.annulled;}
 const nav=$("question-numbers");nav.replaceChildren();$("question-numbers-wrap").hidden=false;
 items.forEach((item,i)=>{
 const b=el("button",i===s.index?"current":"",String(i+1));b.type="button";b.title=C.subjectGroup(item)+" — Q"+item.number;
 if(s.picks[item.id])b.classList.add("marked");
 if(s.checked[item.id]&&s.picks[item.id]!==item.key&&!item.annulled)b.classList.add("incorrect");
 b.setAttribute("aria-current",String(i===s.index));
 b.addEventListener("click",()=>{s.index=i;save();renderAll();});
 nav.appendChild(b);
 });
}
function checkClick(){
 const s=currentSession();if(!s)return;
 if(s.finished){s.reviewing=false;save();renderAll();return;}
 const items=sessionItems(),q=items[s.index];if(!q)return;
 if(s.grading==="exam"||s.kind==="diagnostic"||s.kind==="full"){
  if(s.index===items.length-1){gradeAll();return;}
  s.index++;save();renderAll();return;
 }
 if(s.checked[q.id]){if(s.index===items.length-1){finish();return;}s.index++;save();renderAll();return;}
 if(!s.picks[q.id]&&!q.annulled){toast("Marque uma alternativa antes de corrigir, ou pule para a próxima questão.");return;}
 gradeOne(q);renderAll();
}
function renderTraining(){renderSources();renderQuestion();}

function renderLesson(){
 const key=$("lesson-subject").value,lesson=LESSONS[key]||LESSONS.Português;
 const target=$("lesson-content");target.replaceChildren();
 add(target,"h3","",lesson.title);
 add(target,"p","dim",lesson.intro);
 const list=add(target,"ol","lesson-steps");
 lesson.steps.forEach(step=>add(list,"li","",step));
 add(target,"p","support-note",lesson.practice);
}
function renderPath(){
 renderLesson();upcoming();const total=Object.values(TOPICS).reduce((a,b)=>a+b.length,0);
 const done=Object.keys(state.topics).filter(k=>state.topics[k]===true).length;
 $("topics-complete").textContent=done+"/"+total;meter("topics-meter",percent(done,total));
 const target=$("weight-list");target.replaceChildren();
 C.GROUPS.forEach(s=>{const row=add(target,"div","weight-line");add(row,"span","",s);add(row,"strong","",C.TARGETS[s]+"/60");const m=add(row,"div","meter");const fill=add(m,"span");fill.style.width=(C.TARGETS[s]/60*100)+"%";});
 const sy=$("syllabus");sy.replaceChildren();
 C.GROUPS.forEach(group=>{
 const details=add(sy,"details");const summary=add(details,"summary","",""+group+" · "+TOPICS[group].filter((_,i)=>state.topics[group+"|"+i]).length+"/"+TOPICS[group].length);
 const list=add(details,"div","topic-list");
 TOPICS[group].forEach((topic,index)=>{
 const id=group+"|"+index,line=add(list,"label","tick-line");
 const checkbox=el("input");checkbox.type="checkbox";checkbox.checked=!!state.topics[id];checkbox.addEventListener("change",()=>{state.topics[id]=checkbox.checked;save();summary.textContent=group+" · "+TOPICS[group].filter((_,i)=>state.topics[group+"|"+i]).length+"/"+TOPICS[group].length;const n=Object.keys(state.topics).filter(k=>state.topics[k]).length;$("topics-complete").textContent=n+"/"+total;meter("topics-meter",percent(n,total));});
 line.appendChild(checkbox);add(line,"span","",topic);
 });
 });
 $("essay").value=state.essay||"";$("essay-status").textContent=(state.essay||"").trim().split(/\s+/).filter(Boolean).length+" palavras no rascunho · salvo localmente";
 const weekStart=C.dayShift(DAY,-((new Date(DAY+"T12:00:00Z").getUTCDay()+6)%7));
 $("essay-week").checked=state.essayWeek===weekStart;
}
function renderInsights(){
 const events=totalEvents(),total=C.score(events,DB.questions),groups=C.statsBySubject(events,DB.questions);
 $("insight-attempts").textContent=String(total.attempts);
 $("insight-accuracy").textContent=total.percent===null?"—":total.percent+"%";
 $("insight-due").textContent=String(getDue());
 $("insight-sessions").textContent=String(state.sessions.length);
 weekGrid($("insight-calendar"));
 const last=lastDate();$("last-activity").textContent=last?"Última atividade: "+last.split("-").reverse().join("/")+". Um intervalo não apaga seu progresso.":"Nenhum treino registrado ainda.";
 const list=$("subject-progress");list.replaceChildren();
 C.GROUPS.forEach(group=>{
 const t=groups[group],row=add(list,"div","subject-line");
 add(row,"span","",group);add(row,"strong","",t.percent===null?"—":t.percent+"%");
 const box=add(row,"div","meter");const bar=add(box,"span");bar.style.width=(t.percent||0)+"%";
 add(row,"small","",t.attempts+" tentativa(s) • "+t.unique+" questão(ões) diferentes");
 });
 const weak=C.weakestSubject(groups);
 $("next-recommendation").textContent=total.attempts<10?"Faça seu diagnóstico de 10 questões":"Prioridade sugerida: "+weak;
 $("next-recommendation-detail").textContent=total.attempts<10?"Use questões da prova 2026 para conhecer seu ponto de partida, sem pressão.":"O destaque considera seu aproveitamento por disciplina quando há pelo menos 3 tentativas. É uma sugestão, não um diagnóstico definitivo.";
}
function renderAll(){if(activeTab==="home")renderHome();if(activeTab==="train")renderTraining();if(activeTab==="path")renderPath();if(activeTab==="insights")renderInsights();}
function download(name,text,type){
 const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function backupExport(){download("missao-farda-backup-"+DAY+".json",C.exportSafe(state),"application/json;charset=utf-8");toast("Backup gerado. Guarde o arquivo em um lugar seguro.");}
function csvExport(){
 const lines=[["Data","Prova","Disciplina","Questão","Resposta","Acertou"]];
 for(const ev of state.events){const q=QUESTION.get(ev.id);if(!q)continue;lines.push([ev.day,DB.exams[q.exam].year,C.subjectGroup(q),q.number,ev.answer,ev.correct?"SIM":"NÃO"]);}
 const csv=lines.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\r\n");download("missao-farda-tentativas-"+DAY+".csv","\ufeff"+csv,"text/csv;charset=utf-8");
}
function restore(file){
 if(!file)return; if(file.size>6*1024*1024){toast("Arquivo maior que o limite permitido (6 MB).");return;}
 const reader=new FileReader();
 reader.onload=()=>{try{
 const parsed=JSON.parse(String(reader.result));if(parsed.app!=="missao-farda"||parsed.version!==3||!parsed.state||typeof parsed.state!=="object")throw Error("Arquivo não é um backup do Missão Farda");
 if(!window.confirm("Restaurar este backup substituirá o progresso salvo neste aparelho. Continuar?"))return;
 const incoming=parsed.state;const safe=defaultState();safe.progress=C.cleanHistory(incoming.progress||{},IDS);
 safe.events=Array.isArray(incoming.events)?incoming.events.filter(e=>e&&IDS.has(e.id)&&"ABCDE".includes(e.answer||"")).slice(-12000):[];
 safe.sessions=Array.isArray(incoming.sessions)?incoming.sessions.filter(x=>x&&typeof x==="object").slice(-500):[];
 safe.topics=incoming.topics&&typeof incoming.topics==="object"?Object.fromEntries(Object.entries(incoming.topics).filter(([k,v])=>Object.entries(TOPICS).some(([group,l])=>l.some((_,i)=>k===group+"|"+i))&&typeof v==="boolean")):{};
 safe.essay=typeof incoming.essay==="string"?incoming.essay.slice(0,20000):"";
 safe.essayWeek=typeof incoming.essayWeek==="string"?incoming.essayWeek.slice(0,10):"";
 safe.settings={goal:[2,5,10].includes(Number(incoming.settings?.goal))?Number(incoming.settings.goal):5,timer:"off"};
 state=safe;save();toast("Backup restaurado com sucesso.");show("insights");
 }catch(e){toast("Não foi possível restaurar: formato do backup inválido.");}};
 reader.readAsText(file);
}
function shortcuts(e){if(activeTab!=="train"||!currentSession()||currentSession().finished||["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)||e.altKey||e.ctrlKey||e.metaKey)return;
 const key=e.key.toUpperCase();if("ABCDE".includes(key)&&key.length===1){const s=currentSession(),q=sessionItems()[s.index];if(s.checked[q.id]&&s.grading==="practice")return;s.picks[q.id]=key;save();renderQuestion();e.preventDefault();}
}
function initEvents(){
 document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.tab)));
 document.querySelectorAll("[data-goal]").forEach(b=>b.addEventListener("click",()=>{state.settings.goal=Number(b.dataset.goal);save();renderHome();}));
 $("daily-start").addEventListener("click",()=>sessionNew({kind:"daily",exam:"all",subject:"all",count:state.settings.goal||5,grading:"practice"}));
 $("two-questions").addEventListener("click",()=>sessionNew({kind:"daily",exam:"all",subject:"all",count:2,grading:"practice"}));
 $("resume").addEventListener("click",()=>show("train"));
 $("diagnostic-home").addEventListener("click",()=>sessionNew({kind:"diagnostic",count:10}));
 $("review-shortcut").addEventListener("click",()=>sessionNew({kind:"review",exam:"all",subject:"all",count:5,grading:"practice"}));
 $("exam").addEventListener("change",()=>{fillSubjects();renderSources();});
 $("create-session").addEventListener("click",()=>sessionNew());
 $("mode").addEventListener("change",()=>{const mode=$("mode").value;if(mode==="full"||mode==="diagnostic")$("grading").value="exam";});
 $("check").addEventListener("click",checkClick);
 $("previous").addEventListener("click",()=>{if(!currentSession()||currentSession().index<=0)return;state.session.index--;save();renderAll();});
 $("next").addEventListener("click",()=>{const s=currentSession();if(!s||s.index>=s.ids.length-1)return;s.index++;save();renderAll();});
 $("timer-setting").value=state.settings.timer||"off";
 $("timer-setting").addEventListener("change",()=>{state.settings.timer=$("timer-setting").value;save();timerStart();});
 $("timer-toggle").addEventListener("click",()=>{timerPaused=!timerPaused;$("timer-toggle").textContent=timerPaused?"Continuar":"Pausar";});
 $("timer-reset").addEventListener("click",timerStart);
 $("lesson-subject").addEventListener("change",renderLesson);
 $("lesson-practice").addEventListener("click",()=>{const subject=$("lesson-subject").value;$("exam").value="pmesp";fillSubjects();sessionNew({kind:"daily",exam:"pmesp",subject,count:5,grading:"practice"});});
 $("essay").addEventListener("input",()=>{state.essay=$("essay").value;save();$("essay-status").textContent=state.essay.trim().split(/\s+/).filter(Boolean).length+" palavras no rascunho · salvo localmente";});
 $("essay-week").addEventListener("change",()=>{
 const offset=(new Date(DAY+"T12:00:00Z").getUTCDay()+6)%7;
 state.essayWeek=$("essay-week").checked?C.dayShift(DAY,-offset):"";save();
 });
 $("next-step").addEventListener("click",()=>{
 const stats=C.statsBySubject(totalEvents(),DB.questions),weak=C.weakestSubject(stats);
 if(totalEvents().length<10){sessionNew({kind:"diagnostic"});return;}
 $("exam").value="pmesp";fillSubjects();$("subject").value=weak;
 sessionNew({kind:"daily",exam:"pmesp",subject:weak,count:5,grading:"practice"});
 });
 $("export-backup").addEventListener("click",backupExport);
 $("export-csv").addEventListener("click",csvExport);
 $("import-trigger").addEventListener("click",()=>$("import-file").click());
 $("import-file").addEventListener("change",()=>{restore($("import-file").files?.[0]);$("import-file").value="";});
 document.addEventListener("keydown",shortcuts);
 window.addEventListener("online",updateOnline);
 window.addEventListener("offline",updateOnline);
}
function updateOnline(){
 const label=$("connection-status");label.textContent=navigator.onLine?"● Provas reais":"○ Sem conexão";
 if(!navigator.onLine)label.title="O aplicativo pode abrir sem internet, mas o caderno original de questões exige conexão.";
}
function boot(){
 if(DAY>"2026-12-22"){$("registration-title").textContent="Confira as publicações do concurso atual no portal da VUNESP.";$("registration-subtitle").textContent="O prazo de inscrição da edição divulgada em novembro de 2026 terminou. Consulte as atualizações oficiais.";}
 initEvents();fillSubjects();renderSources();show("home");updateOnline();
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
 save();
}
boot();
})();