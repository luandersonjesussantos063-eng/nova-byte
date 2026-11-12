"use strict";
(function () {
  const bank = window.EXAM_BANK;
  const $ = function (id) { return document.getElementById(id); };
  const keyProgress = "missao-farda-progress-v1";
  const keySession = "missao-farda-session-v1";
  const examOrder = ["pmmg", "pmesp", "gcm"];
  const alphabet = ["A", "B", "C", "D", "E"];
  const today = function () { return new Date().toLocaleDateString("en-CA"); };
  const safeRead = function (key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } };
  const progress = safeRead(keyProgress) || {};
  let session = safeRead(keySession);
  let lengthValue = "5";

  function store() {
    try {
      localStorage.setItem(keySession, JSON.stringify(session));
      localStorage.setItem(keyProgress, JSON.stringify(progress));
    } catch (e) {
      console.warn("O navegador não permitiu salvar o histórico local.");
    }
  }
  function examQuestions() {
    const id = $("exam").value;
    return bank.questions.filter(function (q) { return id === "all" || q.exam === id; });
  }
  function updateSubjects() {
    const selected = $("subject").value;
    const subjects = Array.from(new Set(examQuestions().map(function (q) { return q.subject; }))).sort(function (a,b) { return a.localeCompare(b, "pt-BR"); });
    $("subject").replaceChildren();
    let all = document.createElement("option"); all.value = "all"; all.textContent = "Todas as matérias"; $("subject").appendChild(all);
    subjects.forEach(function (subject) { const o = document.createElement("option"); o.value = subject; o.textContent = subject; $("subject").appendChild(o); });
    $("subject").value = subjects.includes(selected) ? selected : "all";
  }
  function selectLength(value) {
    lengthValue = value;
    document.querySelectorAll("[data-length]").forEach(function (button) {
      const active = button.dataset.length === value; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
    });
  }
  function updateSourceInfo() {
    const exam = bank.exams[$("exam").value];
    const single = !!exam;
    $("exam-notice").textContent = single ? exam.note : "Cada questão apresenta o caderno e o gabarito do concurso correspondente.";
    $("official-source").hidden = !single;
    $("official-key").hidden = !single;
    if (single) {
      $("official-source").href = exam.source;
      $("official-key").href = exam.keySource;
    }
  }
  function uniqueOrder(questions) {
    return questions.sort(function (a, b) {
      const aRank = !progress[a.id] ? 0 : progress[a.id].correct === false ? 1 : 2;
      const bRank = !progress[b.id] ? 0 : progress[b.id].correct === false ? 1 : 2;
      if (aRank !== bRank) return aRank - bRank;
      const ax = examOrder.indexOf(a.exam), bx = examOrder.indexOf(b.exam);
      return ax - bx || a.number - b.number;
    });
  }
  function startSession() {
    const exam = $("exam").value, subject = $("subject").value, filter = $("filter").value, grading = $("grading").value;
    let all = examQuestions().filter(function (q) { return subject === "all" || q.subject === subject; });
    if (filter === "new") all = all.filter(function (q) { return !progress[q.id]; });
    if (filter === "wrong") all = all.filter(function (q) { return progress[q.id] && progress[q.id].correct === false; });
    all = uniqueOrder(all);
    if (lengthValue !== "all") all = all.slice(0, Number(lengthValue));
    session = {ids:all.map(function(q){return q.id;}),index:0,picks:{},checked:{},finished:false,exam,subject,filter,length:lengthValue,grading,created:Date.now()};
    store(); render();
  }
  function currentItems() {
    if (!session) return [];
    const map = new Map(bank.questions.map(function (q) { return [q.id, q]; }));
    return session.ids.map(function (id) { return map.get(id); }).filter(Boolean);
  }
  function currentQuestion() { return currentItems()[session.index]; }
  function correct(q, pick) { return q.annulled ? null : !!pick && pick === q.key; }
  function recordResult(q) {
    const pick = session.picks[q.id] || "";
    if (!pick && !q.annulled) return;
    const was = progress[q.id];
    progress[q.id] = {answer:pick,correct:correct(q,pick),at:Date.now(),day:today(),attempts:(was && was.attempts || 0) + 1};
    session.checked[q.id] = true;
  }
  function gradeAll() {
    if (!session.finished) {
      currentItems().forEach(recordResult);
      session.finished = true;
    }
    store(); render();
  }
  function element(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function openSourceFor(q) {
    if (q.exam === "pmesp") return "https://carreirapublica.com.br/questoes/Q" + String(208122 + q.number);
    return bank.exams[q.exam].source + (q.page ? "#page=" + q.page : "");
  }
  function sourceLinks(body, q) {
    const links = element("div","source-links");
    const view = element("a","","↗ Ver questão original");
    view.href = openSourceFor(q); view.target = "_blank"; view.rel = "noopener noreferrer";
    links.appendChild(view);
    const pdf = element("a","","↗ Caderno completo");
    pdf.href = bank.exams[q.exam].source; pdf.target = "_blank"; pdf.rel = "noopener noreferrer";
    links.appendChild(pdf);
    body.appendChild(links);
  }
  function showQuestion(body, q) {
    const meta = bank.exams[q.exam];
    $("tag").textContent = meta.short + " · " + meta.year;
    $("counter").textContent = "Questão " + (session.index + 1) + " de " + session.ids.length;
    $("qmeta").textContent = q.subject + " · Nº " + q.number + " da prova real · " + meta.board;
    const copy = q.kind === "source" ? "Questão nº " + q.number + " da prova de Soldado PMESP 2026" : q.text;
    body.appendChild(element("h2","question-title",copy));
    if (q.kind === "source") {
      const note = element("div","support");
      note.appendChild(element("strong","","Enunciado na prova original, sem adaptação"));
      note.appendChild(element("p","","Abra a questão pelo link abaixo, leia o texto e as cinco alternativas na fonte e volte para marcar A, B, C, D ou E. O gabarito só aparece após corrigir."));
      body.appendChild(note);
    } else {
      const note = element("p","hint","Se a questão mencionar um texto, quadro, figura ou palavras destacadas, confira o caderno original pelo link abaixo.");
      body.appendChild(note);
    }
    sourceLinks(body,q);
    const answers = element("div","answers");
    const checked = !!session.checked[q.id] && session.grading === "practice" || !!session.finished;
    const chosen = session.picks[q.id];
    (q.exam === "pmesp" ? alphabet : alphabet.slice(0,4)).forEach(function(letter){
      const value = q.options && q.options[letter] ? q.options[letter] : "Alternativa " + letter + " (consulte o enunciado original)";
      const button = element("button","choice");
      button.type = "button";
      button.setAttribute("aria-pressed",String(chosen === letter));
      if(chosen === letter) button.classList.add("selected");
      if(checked && !q.annulled && q.key === letter) button.classList.add("correct");
      if(checked && chosen === letter && !q.annulled && chosen !== q.key) button.classList.add("incorrect");
      if(checked) button.disabled = true;
      button.appendChild(element("span","letter",letter));
      button.appendChild(element("span","choice-text",value));
      button.addEventListener("click",function(){
        if(checked || session.finished) return;
        session.picks[q.id]=letter;store();render();
      });
      answers.appendChild(button);
    });
    body.appendChild(answers);
    if (q.annulled) body.appendChild(element("p","hint","Esta questão teve anulação oficial. Ela é mantida para revisão, mas não conta como acerto nem como erro."));
  }
  function showFeedback(q) {
    const box = $("feedback");
    const isChecked = session.checked[q.id] && session.grading === "practice" || session.finished;
    box.className = "feedback hidden"; box.replaceChildren();
    if(!isChecked)return;
    box.classList.remove("hidden");
    if(q.annulled) {
      box.appendChild(element("strong","","Questão anulada pela banca"));
      box.appendChild(element("p","","Não há alternativa correta válida no gabarito definitivo. Este item não entra no percentual de acertos."));
      return;
    }
    const picked = session.picks[q.id];
    const wasCorrect = picked === q.key;
    box.classList.add(wasCorrect ? "success" : "wrong");
    box.appendChild(element("strong","",wasCorrect ? "✓ Resposta correta!" : "Resposta oficial: alternativa " + q.key));
    let sentence = wasCorrect ? "Você acertou a questão " + q.number + "." : picked ? "Você marcou " + picked + "; o gabarito definitivo da banca indica " + q.key + "." : "Questão não respondida. No gabarito oficial, a resposta é " + q.key + ".";
    if(q.options && q.options[q.key]) sentence += " " + q.key + ") " + q.options[q.key].slice(0,450);
    box.appendChild(element("p","",sentence));
    box.appendChild(element("p","note","Fonte: gabarito definitivo. A explicação detalhada deve ser conferida com o caderno, pois nem todos os itens têm comentário oficial."));
  }
  function sessionCounts() {
    const items = currentItems(); const examined = items.filter(function(q){return session.checked[q.id];});
    const valid = examined.filter(function(q){return !q.annulled;});
    return {total:items.length,answered:Object.keys(session.picks).length,graded:examined.length,valid:valid.length,correct:valid.filter(function(q){return session.picks[q.id]===q.key;}).length,annulled:examined.filter(function(q){return q.annulled;}).length};
  }
  function showFinished(body) {
    const c=sessionCounts();$("tag").textContent="SESSÃO FINALIZADA";$("counter").textContent=c.total+" questões";
    $("qmeta").textContent="Suas respostas foram corrigidas usando os gabaritos finais das provas originais.";
    body.appendChild(element("h2","question-title","Treino concluído. O próximo passo é continuar amanhã."));
    const grid = element("div","result-overview");
    [[c.correct,"Acertos"],[c.valid-c.correct,"Erros"],[c.annulled,"Anuladas"]].forEach(function(it){const b=element("div","");b.appendChild(element("b","",String(it[0])));b.appendChild(element("small","",it[1]));grid.appendChild(b);});
    body.appendChild(grid);
    const percentage = c.valid ? Math.round(c.correct/c.valid*100) : 0;
    body.appendChild(element("p","","Aproveitamento: "+percentage+"% nas questões válidas que você respondeu. Seu desempenho permanece salvo neste aparelho."));
    const rows=element("div","source-links");
    const again=element("button","primary","Começar próximo treino");again.type="button";again.addEventListener("click",startSession);rows.appendChild(again);
    const review=element("button","secondary","Revisar respostas");review.type="button";review.addEventListener("click",function(){session.finished=true;session.reviewing=true;session.index=0;store();render();});rows.appendChild(review);body.appendChild(rows);
  }
  function showStats() {
    const data=Object.values(progress), attempted=data.filter(function(x){return x.correct!==null;});
    const correct=attempted.filter(function(x){return x.correct;}).length;
    $("stat-available").textContent=String(bank.questions.length);
    $("stat-accuracy").textContent=attempted.length ? Math.round(correct/attempted.length*100)+"%" : "—";
    $("stat-today").textContent=String(data.filter(function(x){return x.day===today();}).length);
  }
  function showNavigation() {
    const list=$("question-grid");list.replaceChildren();
    currentItems().forEach(function(q,i){
      const b=element("button","",String(i+1));b.type="button";b.title="Questão "+q.number+" — "+q.subject;
      if(i===session.index)b.classList.add("current");
      if(session.checked[q.id])b.classList.add(session.picks[q.id]===q.key?"answered":"wrong");
      if(q.annulled)b.classList.add("annulled");
      b.addEventListener("click",function(){session.index=i;store();render();});
      list.appendChild(b);
    });
    $("navigation").classList.toggle("hidden",!session.ids.length || (session.finished&&!session.reviewing));
  }
  function render() {
    showStats(); updateSourceInfo();
    const body=$("quiz-body");body.replaceChildren();$("feedback").className="feedback hidden";
    const items=currentItems(); const exists=items.length>0;
    $("action-bar").classList.toggle("hidden",!exists||session.finished&&!session.reviewing);
    if(!exists) {
      $("tag").textContent="SESSÃO VAZIA";$("counter").textContent="0 questões";$("qmeta").textContent="Nenhuma questão corresponde aos filtros escolhidos.";
      const empty=element("div","empty");
      const inner=element("div");
      inner.appendChild(element("h2","","Sem questões para este filtro"));
      inner.appendChild(element("p","","Se você ainda não tem erros registrados, escolha “Todas”. É possível alterar concurso, disciplina e quantidade na lateral."));
      empty.appendChild(inner);body.appendChild(empty);$("session-progress").style.width="0%";showNavigation();return;
    }
    if(session.finished&&!session.reviewing) {
      $("session-progress").style.width="100%";
      showFinished(body);showNavigation();return;
    }
    session.index=Math.min(Math.max(session.index,0),items.length-1);
    const q=items[session.index], c=sessionCounts();
    $("session-progress").style.width=Math.round(c.graded/items.length*100)+"%";
    showQuestion(body,q);showFeedback(q);showNavigation();
    $("previous").disabled=session.index===0;
    $("next").disabled=session.index===items.length-1;
    const handled=!!session.checked[q.id];
    const canSubmit=!!session.picks[q.id]||q.annulled;
    const action=$("check");
    action.disabled=!canSubmit||(handled&&session.grading==="practice"&&!session.finished);
    action.textContent=session.finished?"Resposta corrigida":session.grading==="practice" ? "Corrigir resposta" : session.index===items.length-1?"Finalizar simulado":"Salvar e avançar";
    if(session.finished)action.disabled=true;
  }
  $("check").addEventListener("click",function(){
    const q=currentQuestion();if(!q || !session.picks[q.id] && !q.annulled)return;
    if(session.grading==="practice") {
      recordResult(q);store();render();return;
    }
    if(session.index<session.ids.length-1){session.index++;store();render();return;}
    gradeAll();
  });
  $("previous").addEventListener("click",function(){if(session.index>0){session.index--;store();render();}});
  $("next").addEventListener("click",function(){if(session.index<session.ids.length-1){session.index++;store();render();}});
  document.querySelectorAll("[data-length]").forEach(function(button){button.addEventListener("click",function(){selectLength(button.dataset.length);});});
  $("start").addEventListener("click",startSession);
  $("exam").addEventListener("change",function(){updateSubjects();updateSourceInfo();});
  $("subject").addEventListener("change",function(){});
  $("export").addEventListener("click",function(){
    const lines=[["Prova","Questão","Resposta","Gabarito","Acertou","Data"]];
    Object.entries(progress).forEach(function(entry){const q=bank.questions.find(function(x){return x.id===entry[0];});if(!q)return;
      const p=entry[1]; lines.push([q.exam,q.number,p.answer,q.key||"ANULADA",p.correct===null?"ANULADA":p.correct?"SIM":"NÃO",new Date(p.at).toISOString().slice(0,10)]);});
    const csv=lines.map(function(row){return row.map(function(v){return '"'+String(v===null?"":v).replace(/"/g,'""')+'"';}).join(";");}).join("\r\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),href=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=href;a.download="missao-farda-desempenho.csv";a.click();setTimeout(function(){URL.revokeObjectURL(href);},1500);
  });
  if(session && Array.isArray(session.ids) && session.ids.length) {
    $("exam").value=session.exam||"pmmg";updateSubjects();$("subject").value=session.subject||"all";$("filter").value=session.filter||"all";$("grading").value=session.grading||"practice";selectLength(session.length||"5");
    session.reviewing=!!session.reviewing;
    render();
  } else {
    session=null;updateSubjects();selectLength("5");startSession();
  }
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function(){});
})();
