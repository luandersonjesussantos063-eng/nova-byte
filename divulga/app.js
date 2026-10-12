(()=>{
'use strict';
const KEY='novabyte-divulga-v1';
const VERSION='1.0.0';
const CITIES=['Lucas do Rio Verde','Sorriso','Sinop','Nova Mutum','Tapurah','Cuiabá','Outra cidade'];
const SERVICES=['Criação de sites','Landing pages','Cardápio digital','Aplicativos','Sistemas personalizados','Outro serviço'];
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'d'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const nowISO=()=>new Date().toISOString();
const fmt=iso=>{if(!iso)return 'Nunca';const dt=new Date(iso);return Number.isNaN(+dt)?'—':dt.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});};
const onlyDay=iso=>new Date(iso).toLocaleDateString('pt-BR');
const hoursElapsed=iso=>(Date.now()-Date.parse(iso||0))/3600000;
const isToday=iso=>new Date(iso).toDateString()===new Date().toDateString();
const emptyState=()=>({groups:[],campaigns:[],history:[],queue:null,settings:{reminders:false,intervalHours:1,quietStart:'22:00',quietEnd:'08:00',lastReminder:nowISO()}});
let state=load(),tab='inicio',filterCity='',searchGroups='',filterHistory='',imageDraft='',toaster=null,reminderTimer=null;
function load(){
 try{
  const data=JSON.parse(localStorage.getItem(KEY));
  if(!data||typeof data!=='object'||!Array.isArray(data.groups)||!Array.isArray(data.campaigns)||!Array.isArray(data.history))return emptyState();
  const blank=emptyState();
  return {groups:data.groups,campaigns:data.campaigns,history:data.history,queue:data.queue||null,settings:{...blank.settings,...(data.settings||{})}};
 }catch{return emptyState();}
}
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(state));return true}
 catch{toast('O aparelho está sem espaço para salvar. Exporte um backup.');return false}
}
function toast(msg){const el=$('#toast');if(!el)return;clearTimeout(toaster);el.textContent=msg;el.hidden=false;toaster=setTimeout(()=>{el.hidden=true},3800)}
function button(action,label,extra,variant){
 return '<button type="button" class="btn '+(variant||'btn-outline')+'" data-action="'+E(action)+'" '+(extra||'')+'>'+label+'</button>';
}
function title(name,desc,action){
 return '<div class="section-head"><div><p class="eyebrow">NOVABYTE SOLUÇÕES · DIVULGA</p><h1>'+name+'</h1><p class="muted">'+desc+'</p></div>'+(action||'')+'</div>';
}
function empty(icon,heading,desc,action){
 return '<div class="empty"><div class="empty-icon">'+icon+'</div><h3>'+heading+'</h3><p>'+desc+'</p>'+(action||'')+'</div>';
}
function escapeUrl(input){
 try{
  const url=new URL(String(input||'').trim());
  if(url.protocol!=='https:'&&url.protocol!=='http:')return null;
  const h=url.hostname.toLowerCase();
  if(!['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com','mbasic.facebook.com','fb.com','www.fb.com'].includes(h))return null;
  if(!/^\/groups\/[^/]+/.test(url.pathname))return null;
  return 'https://www.facebook.com'+url.pathname.replace(/\/+$/,'');
 }catch{return null;}
}
function simpleUrl(input){
 try{const url=new URL(String(input||'').trim());return ['http:','https:'].includes(url.protocol)?url.href:null}catch{return null}
}
function lastPost(id){
 for(let i=state.history.length-1;i>=0;i--){
  const h=state.history[i];if(h.groupId===id&&h.type==='published')return h.date;
 }
 return '';
}
function nextEligible(g){
 const dt=lastPost(g.id);
 return !dt||hoursElapsed(dt)>=Math.max(1,Number(g.cooldown)||24);
}
function dueString(g){
 const last=lastPost(g.id);
 if(!last)return 'Pronto para divulgação';
 const hours=Math.max(1,Number(g.cooldown)||24)-hoursElapsed(last);
 if(hours<=0)return 'Pronto para divulgação';
 return 'Aguardar mais '+Math.ceil(hours)+' h (intervalo definido)';
}
function adVariants(service,city){
 const place=city?' em '+city:'';
 const samples={
  'Criação de sites':[
   'Sua empresa merece ser encontrada também na internet. A NovaByte Soluções cria sites profissionais, modernos e adaptados para celular'+place+'. Solicite uma proposta sem compromisso.',
   'Você recebe clientes pelo WhatsApp, mas ainda não tem um site? A NovaByte Soluções desenvolve páginas rápidas e profissionais para apresentar seus serviços'+place+'. Conheça nosso trabalho.',
   'Transforme suas ideias em um site que represente bem seu negócio. Projetos personalizados pela NovaByte Soluções, com integração ao WhatsApp e visual profissional.',
   'Um site bem apresentado ajuda o cliente a conhecer seu negócio antes do primeiro contato. Conte com a NovaByte Soluções para criar sua presença digital.'
  ],
  'Landing pages':[
   'Divulgando um serviço específico? Uma landing page pode organizar sua oferta, benefícios e botão de contato. A NovaByte Soluções desenvolve páginas personalizadas.',
   'Seu anúncio merece uma página dedicada. Criamos landing pages com visual moderno e acesso direto ao WhatsApp. NovaByte Soluções.',
   'Uma única página, uma proposta clara e um contato fácil: conheça as landing pages da NovaByte Soluções.',
   'Vai lançar uma promoção ou serviço? Apresente tudo em uma landing page profissional feita pela NovaByte Soluções.'
  ],
  'Cardápio digital':[
   'Facilite o pedido dos seus clientes com um cardápio digital organizado, acessível pelo celular. A NovaByte Soluções cria soluções para restaurantes e lanchonetes.',
   'Seu cardápio pode estar a um clique do cliente. Tenha fotos, categorias e contato por WhatsApp com a NovaByte Soluções.',
   'Para restaurantes, pizzarias e petiscarias: criamos cardápios digitais modernos que facilitam a consulta pelo telefone.',
   'Atualize a apresentação de seus pratos e bebidas com um cardápio digital personalizado pela NovaByte Soluções.'
  ],
  'Aplicativos':[
   'Tem uma ideia de aplicativo para o seu negócio? A NovaByte Soluções desenvolve soluções digitais personalizadas. Converse com a nossa equipe.',
   'Sua empresa precisa de um aplicativo? Vamos transformar sua necessidade em um projeto digital sob medida. NovaByte Soluções.',
   'Da ideia à interface: desenvolvemos aplicativos voltados às necessidades reais do seu negócio. Conheça a NovaByte Soluções.',
   'Quer oferecer mais praticidade aos seus clientes pelo celular? Solicite um orçamento de aplicativo com a NovaByte Soluções.'
  ],
  'Sistemas personalizados':[
   'Planilhas já não dão conta da sua rotina? A NovaByte Soluções desenvolve sistemas personalizados para organizar processos do seu negócio.',
   'Cada empresa tem seu jeito de trabalhar. Criamos sistemas adaptados ao seu fluxo de atendimento e gestão. NovaByte Soluções.',
   'Precisa digitalizar um processo interno? Desenvolvemos sistemas sob medida com a NovaByte Soluções.',
   'Organização e praticidade: conheça os sistemas personalizados que a NovaByte Soluções pode desenvolver para sua empresa.'
  ],
  'Outro serviço':[
   'A NovaByte Soluções transforma necessidades de empresas em projetos digitais: sites, aplicativos e sistemas personalizados. Entre em contato.',
   'Procurando soluções digitais para o seu negócio? Conheça os serviços da NovaByte Soluções.',
   'Seu próximo projeto digital pode começar por uma conversa. Conheça a NovaByte Soluções.',
   'Tecnologia feita para negócios reais: fale com a NovaByte Soluções e apresente sua ideia.'
  ]
 };
 return samples[service]||samples['Outro serviço'];
}
function adText(c){
 let text=String(c?.text||'').trim();
 if(c?.link)text+='\n\n'+c.link;
 return text;
}
function selectOptions(arr,selected){
 return arr.map(c=>'<option value="'+E(c)+'"'+(c===selected?' selected':'')+'>'+E(c)+'</option>').join('');
}
function tabTo(name){
 if(!['inicio','grupos','campanhas','fila','historico','config'].includes(name))name='inicio';
 tab=name;
 $$('.screen').forEach(x=>x.hidden=x.id!==tab);
 $$('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
 history.replaceState(null,'','#'+tab);
 render();window.scrollTo({top:0,behavior:'instant'});
}
function sectionStats(){
 const today=state.history.filter(h=>h.type==='published'&&isToday(h.date)).length;
 const all=state.history.filter(h=>h.type==='published').length;
 const ready=state.groups.filter(nextEligible).length;
 return {today,all,ready};
}
function stat(label,value,note,icon){
 return '<div class="stat"><div class="stat-top"><span>'+label+'</span><span class="stat-icon">'+icon+'</span></div><strong>'+value+'</strong><small>'+note+'</small></div>';
}
function renderHome(){
 const s=sectionStats();
 const steps='<div class="step-row"><span class="step-index">1</span><div><strong>Cadastre os grupos</strong><p>Adicione seus links e as regras permitidas pelos administradores.</p></div></div>'+
 '<div class="step-row"><span class="step-index">2</span><div><strong>Prepare um anúncio</strong><p>Use modelos de texto e personalize o serviço da NovaByte.</p></div></div>'+
 '<div class="step-row"><span class="step-index">3</span><div><strong>Inicie a divulgação assistida</strong><p>Copie, abra o grupo e confirme a publicação, um por vez.</p></div></div>';
 $('#inicio').innerHTML=
 '<div class="hero"><p class="eyebrow">SEU CENTRO DE DIVULGAÇÃO</p><h1>Mais organização.<br><em>Mais presença digital.</em></h1><p>Tenha suas campanhas, grupos de venda e publicações organizados em um único lugar. Você confirma cada postagem diretamente no Facebook.</p><div class="hero-actions">'+button('start-queue','➤ Iniciar divulgação','','btn-primary')+button('group-new','＋ Adicionar grupo','','btn-outline')+'</div></div>'+
 '<div class="stats">'+stat('Grupos cadastrados',state.groups.length,'Links guardados no aparelho','♧')+stat('Grupos disponíveis',s.ready,'Conforme intervalo configurado','◎')+stat('Divulgações hoje',s.today,'Confirmadas por você','↗')+stat('Total registrado',s.all,'Publicações confirmadas','◷')+'</div>'+
 '<div class="grid2"><div class="card"><div class="card-header"><h2>Como começar</h2><span class="tag">3 passos</span></div>'+steps+'</div>'+
 '<div class="card"><div class="card-header"><h2>Próxima divulgação</h2><span class="tag orange">Assistida</span></div>'+
 (state.groups.length===0?empty('♧','Nenhum grupo cadastrado','Adicione o primeiro grupo de vendas para preparar sua fila.',button('group-new','Cadastrar grupo','','btn-blue')):
 state.campaigns.length===0?empty('✦','Campanha necessária','Prepare um texto antes de iniciar a divulgação.',button('campaign-new','Criar campanha','','btn-blue')):
 '<p class="subhead">Você tem <strong>'+s.ready+'</strong> grupos disponíveis para organizar sua próxima divulgação.</p>'+
 '<p class="muted">A central abre cada grupo e oferece o texto pronto. Ela não envia posts sem sua confirmação.</p>'+button('start-queue','Começar agora','','btn-primary'))+
 '<div class="hint">🔒 Os grupos e o histórico ficam armazenados apenas neste navegador/aparelho. Exporte um backup se trocar de celular.</div></div></div>';
}
function renderGroups(){
 const cities=[...new Set(state.groups.map(g=>g.city).filter(Boolean))].sort();
 $('#grupos').innerHTML=title('Meus grupos','Organize os grupos de compra e venda por cidade e regras.',
 button('group-import','↥ Importar links','','btn-outline')+button('group-new','＋ Novo grupo','','btn-primary'))+
 '<div class="filters"><input id="groupSearch" class="control" type="search" placeholder="Buscar grupo ou cidade" value="'+E(searchGroups)+'" aria-label="Buscar grupos"><select id="cityFilter" class="control" aria-label="Filtrar por cidade"><option value="">Todas as cidades</option>'+selectOptions(cities,filterCity)+'</select></div>'+
 '<div id="groupList"></div>'+
 '<p class="footer-note">Adicione apenas grupos que permitam anúncios comerciais. O Facebook poderá exigir aprovação do administrador.</p>';
 showGroups();
}
function showGroups(){
 const groups=state.groups.filter(g=>(!filterCity||g.city===filterCity)&&(!searchGroups||(g.name+' '+g.city+' '+g.url).toLocaleLowerCase('pt-BR').includes(searchGroups.toLocaleLowerCase('pt-BR'))));
 const el=$('#groupList');if(!el)return;
 el.innerHTML=groups.length?'<div class="list">'+groups.map(g=>{
 const ready=nextEligible(g);
 return '<div class="item"><div class="item-main"><div class="inline-label"><h3>'+E(g.name)+'</h3><span class="tag '+(ready?'green':'orange')+'">'+(ready?'Disponível':'Aguardar')+'</span></div><p>'+E(g.city||'Cidade não informada')+' · '+E(dueString(g))+'</p><p>Intervalo mínimo configurado: '+Math.max(1,Number(g.cooldown)||24)+' h</p><p><a href="'+E(g.url)+'" target="_blank" rel="noopener noreferrer" class="queue-url">'+E(g.url)+'</a></p>'+ (g.rules?'<p>Regras: '+E(g.rules)+'</p>':'')+'</div><div class="item-actions">'+button('group-edit','Editar','data-id="'+E(g.id)+'"','btn-outline')+button('group-delete','Excluir','data-id="'+E(g.id)+'"','btn-quiet')+'</div></div>';
 }).join('')+'</div>':
 empty('♧','Nenhum grupo neste filtro',state.groups.length?'Tente outra cidade ou termo de busca.':'Cadastre o primeiro grupo ou importe vários links de uma vez.',button('group-new','＋ Adicionar grupo','','btn-blue'));
}
function renderCampaigns(){
 $('#campanhas').innerHTML=title('Campanhas','Crie anúncios naturais e reutilize o texto em vários grupos.',button('campaign-new','＋ Nova campanha','','btn-primary'))+
 (state.campaigns.length?'<div class="list">'+state.campaigns.map(c=>{
 return '<article class="card"><div class="card-header"><div><h2>'+E(c.name)+'</h2><span class="tag">'+E(c.service)+'</span></div><div class="toolbar">'+button('campaign-edit','Editar','data-id="'+E(c.id)+'"','btn-outline')+button('campaign-delete','Excluir','data-id="'+E(c.id)+'"','btn-quiet')+'</div></div>'+
 '<div class="preview">'+(c.image?'<img src="'+E(c.image)+'" alt="Imagem do anúncio">':'')+E(adText(c))+'</div>'+
 '<div class="btn-row" style="margin-top:14px">'+button('campaign-copy','⧉ Copiar anúncio','data-id="'+E(c.id)+'"','btn-outline')+button('campaign-start','➤ Divulgar esta campanha','data-id="'+E(c.id)+'"','btn-blue')+'</div></article>';
 }).join('')+'</div>':
 empty('✦','Seu primeiro anúncio começa aqui','Prepare um texto profissional sobre os serviços da NovaByte e depois escolha os grupos.',button('campaign-new','Criar minha campanha','','btn-blue')));
}
function renderQueue(){
 const q=state.queue;
 if(!q||q.index>=q.ids.length){
  const counts=sectionStats();
  $('#fila').innerHTML=title('Divulgação assistida','Um fluxo simples para preparar cada publicação sem perder o controle.')+
   '<div class="grid2"><div class="card"><h2>Preparar nova fila</h2><p class="muted">Apenas grupos cujo intervalo configurado já terminou entram na fila. As regras dos grupos devem ser conferidas por você.</p>'+
   '<label class="field">Campanha<select id="queueCampaign" class="control">'+(state.campaigns.length?state.campaigns.map(c=>'<option value="'+E(c.id)+'">'+E(c.name)+'</option>').join(''):'<option value="">Nenhuma campanha criada</option>')+'</select></label>'+
   button('start-queue','➤ Iniciar divulgação','', 'btn-primary')+'<p class="muted" style="margin-top:13px">'+counts.ready+' grupo(s) disponível(is) atualmente.</p></div>'+
   '<div class="card"><h2>Como funciona</h2><div class="step-row"><span class="step-index">1</span><div><strong>Copiar anúncio</strong><p>Seu texto está pronto para colar.</p></div></div><div class="step-row"><span class="step-index">2</span><div><strong>Abrir grupo</strong><p>O Facebook abre no navegador ou aplicativo.</p></div></div><div class="step-row"><span class="step-index">3</span><div><strong>Confirmar publicação</strong><p>Registre apenas depois de postar realmente.</p></div></div></div></div>';
  return;
 }
 const g=state.groups.find(x=>x.id===q.ids[q.index]);
 const c=state.campaigns.find(x=>x.id===q.campaignId);
 if(!g||!c){state.queue=null;save();renderQueue();return}
 const pct=Math.round(q.index/q.ids.length*100);
 $('#fila').innerHTML=title('Divulgação em andamento','Copie o anúncio, abra o grupo e confirme somente após publicar.')+
 '<div class="queue-card"><div class="inline-label"><span class="queue-count">GRUPO '+(q.index+1)+' DE '+q.ids.length+'</span><span class="tag">'+pct+'% percorrido</span></div><div class="queue-progress"><span style="width:'+pct+'%"></span></div>'+
 '<h2>'+E(g.name)+'</h2><p class="subhead">'+E(g.city||'Cidade não informada')+' · '+E(c.name)+'</p>'+
 (g.rules?'<div class="hint warning">Regras informadas: '+E(g.rules)+'</div>':'<div class="hint warning">Confira se este grupo permite publicidade antes de postar.</div>')+
 '<div class="campaign-hero"><span class="tag orange">ANÚNCIO PREPARADO</span><div class="preview" style="margin-top:11px">'+(c.image?'<img src="'+E(c.image)+'" alt="Imagem do anúncio">':'')+E(adText(c))+'</div></div>'+
 '<div class="queue-actions">'+button('queue-copy','⧉ Copiar anúncio','','btn-outline')+button('queue-open','↗ Abrir grupo no Facebook','','btn-blue')+
 (c.image?button('queue-share','Compartilhar anúncio/imagem','','btn-outline'):'')+
 button('queue-done','✓ Já publiquei neste grupo','','btn-primary wide')+
 button('queue-skip','Pular grupo','','btn-quiet')+button('queue-end','Encerrar fila','','btn-quiet')+'</div>'+
 '<p class="muted" style="font-size:12px;margin-top:16px">A confirmação é manual. Nenhuma publicação é enviada automaticamente aos grupos.</p></div>';
}
function renderHistory(){
 const entries=state.history.filter(h=>h.type==='published'&&(!filterHistory||h.groupName.toLowerCase().includes(filterHistory.toLowerCase())||h.campaignName.toLowerCase().includes(filterHistory.toLowerCase())));
 $('#historico').innerHTML=title('Histórico','Somente publicações confirmadas por você aparecem aqui.',button('export','↧ Fazer backup','','btn-outline'))+
 '<div class="filters"><input class="control" id="historyFilter" type="search" value="'+E(filterHistory)+'" placeholder="Buscar grupo ou campanha"></div>'+
 (entries.length?'<div class="list">'+entries.slice().reverse().map(h=>'<div class="item"><div class="item-main"><h3>'+E(h.groupName)+'</h3><p>'+E(h.campaignName)+' · '+E(fmt(h.date))+'</p><span class="tag green">Confirmado manualmente</span></div></div>').join('')+'</div>':
 empty('◷','Nada registrado ainda','Quando você confirmar que publicou em um grupo, esse registro aparecerá aqui.'));
}
function renderConfig(){
 const s=state.settings;
 $('#config').innerHTML=title('Configurações','Controle lembretes, backups e privacidade dos seus dados.')+
 '<div class="grid2"><div class="card"><h2>Lembretes de divulgação</h2><p class="muted">Avisa quando chegar a próxima hora de conferir a central, enquanto ela estiver aberta. Notificações em segundo plano não estão disponíveis nesta versão web.</p>'+
 '<label class="checkboxline"><input id="remindersToggle" type="checkbox" '+(s.reminders?'checked':'')+'> Ativar lembretes locais</label>'+
 '<div class="field" style="margin-top:15px"><label for="remindersInterval">Intervalo (horas)</label><select id="remindersInterval" class="control">'+[1,2,3,4,6,12,24].map(h=>'<option value="'+h+'"'+(Number(s.intervalHours)===h?' selected':'')+'>'+h+' hora'+(h>1?'s':'')+'</option>').join('')+'</select></div>'+
 button('request-notif','Permitir avisos no Android','','btn-outline')+'</div>'+
 '<div class="card"><h2>Meus dados</h2><p class="muted">Tudo é salvo apenas no armazenamento deste navegador. Nenhum grupo, senha ou histórico é enviado para servidores da NovaByte.</p><div class="btn-row">'+button('export','↧ Exportar backup','','btn-blue')+button('import-backup','↥ Importar backup','','btn-outline')+'</div><div class="divider"></div>'+button('clear-all','Excluir todos os dados','','btn-danger')+'</div></div>'+
 '<div class="card" style="margin-top:18px"><h2>Sobre a divulgação</h2><p class="muted">O NovaByte Divulga prepara campanhas e abre grupos do Facebook, mas não faz postagem automática em grupos de terceiros. O botão de confirmação registra somente sua declaração. Respeite as regras dos grupos e evite publicações repetitivas.</p><p class="muted">Você não precisa fornecer senha ou token do Facebook. O aplicativo só abre links; o login continua no Facebook que já estiver instalado no seu aparelho.</p><p class="muted">Versão '+VERSION+' · NovaByte Soluções</p></div>';
}
function render(){
 if(tab==='inicio')renderHome();
 if(tab==='grupos')renderGroups();
 if(tab==='campanhas')renderCampaigns();
 if(tab==='fila')renderQueue();
 if(tab==='historico')renderHistory();
 if(tab==='config')renderConfig();
}
function openModal(html){
 $('#modalBody').innerHTML=html;
 $('#modal').hidden=false;
 document.body.style.overflow='hidden';
 $('#modalBody input:not([type=hidden]),#modalBody select,#modalBody textarea')?.focus();
}
function closeModal(){
 $('#modal').hidden=true;$('#modalBody').innerHTML='';document.body.style.overflow='';
 imageDraft='';
}
function groupForm(id){
 const g=state.groups.find(g=>g.id===id)||{id:'',name:'',url:'',city:'Lucas do Rio Verde',cooldown:24,rules:'',notes:''};
 openModal('<form id="groupForm"><h2>'+(g.id?'Editar grupo':'Cadastrar grupo')+'</h2><input type="hidden" name="id" value="'+E(g.id)+'">'+
 '<div class="field"><label>Nome do grupo *</label><input name="name" required maxlength="130" value="'+E(g.name)+'" placeholder="Ex.: Classificados Lucas do Rio Verde"></div>'+
 '<div class="field"><label>Link do Facebook *</label><input name="url" required type="url" value="'+E(g.url)+'" placeholder="https://www.facebook.com/groups/..."><small>Use o link direto de um grupo de compra e venda.</small></div>'+
 '<div class="field-grid"><div class="field"><label>Cidade</label><input name="city" list="citiesList" value="'+E(g.city)+'" maxlength="90"><datalist id="citiesList">'+CITIES.map(c=>'<option value="'+E(c)+'">').join('')+'</datalist></div>'+
 '<div class="field"><label>Intervalo mínimo neste grupo (horas)</label><input name="cooldown" type="number" min="1" max="720" value="'+E(g.cooldown)+'"></div></div>'+
 '<div class="field"><label>Regras do grupo</label><textarea name="rules" maxlength="1200" placeholder="Ex.: Publicidade somente às sextas-feiras">'+E(g.rules||'')+'</textarea></div>'+
 '<div class="field"><label>Observações</label><input name="notes" maxlength="200" value="'+E(g.notes||'')+'" placeholder="Opcional"></div>'+
 '<div class="modal-actions">'+button('modal-close','Cancelar','','btn-quiet')+'<button type="submit" class="btn btn-primary">Salvar grupo</button></div></form>');
}
function campaignForm(id){
 const c=state.campaigns.find(c=>c.id===id)||{id:'',name:'',service:'Criação de sites',text:adVariants('Criação de sites','Lucas do Rio Verde')[0],link:'https://novabytesolucoes.com.br/',image:''};
 imageDraft=c.image||'';
 openModal('<form id="campaignForm"><h2>'+(c.id?'Editar campanha':'Criar campanha')+'</h2><input type="hidden" name="id" value="'+E(c.id)+'">'+
 '<div class="field"><label>Nome da campanha *</label><input name="name" maxlength="100" required value="'+E(c.name)+'" placeholder="Ex.: Sites para empresas locais"></div>'+
 '<div class="field-grid"><div class="field"><label>Serviço</label><select name="service">'+selectOptions(SERVICES,c.service)+'</select></div>'+
 '<div class="field"><label>Cidade para personalização</label><input name="city" maxlength="90" value="'+E(c.city||'Lucas do Rio Verde')+'"></div></div>'+
 '<div class="field"><label>Texto do anúncio *</label><textarea name="text" required minlength="15" maxlength="2200" style="min-height:175px">'+E(c.text)+'</textarea>'+
 '<div class="btn-row">'+button('generate-ad','✦ Gerar outra sugestão','','btn-outline btn-sm')+'<small>Modelos prontos; não utiliza serviço de IA pago.</small></div></div>'+
 '<div class="field"><label>Link do site/contato</label><input type="url" name="link" value="'+E(c.link||'')+'" placeholder="https://novabytesolucoes.com.br/"></div>'+
 '<div class="field"><label>Imagem do anúncio (opcional)</label><input id="campaignImage" type="file" accept="image/*"><small>A imagem será reduzida para caber no armazenamento local.</small><div id="imageStatus">'+(c.image?'<img class="image-mini" alt="Prévia" src="'+E(c.image)+'">':'')+'</div>'+
 button('image-remove','Remover imagem','','btn-quiet btn-sm')+'</div>'+
 '<div class="modal-actions">'+button('modal-close','Cancelar','','btn-quiet')+'<button type="submit" class="btn btn-primary">Salvar campanha</button></div></form>');
}
function importGroupsModal(){
 openModal('<form id="bulkGroupForm"><h2>Importar links de grupos</h2><p class="muted">Cole um grupo por linha. Se quiser, use <strong>Nome | Link | Cidade</strong>. Links repetidos serão ignorados.</p>'+
 '<div class="field"><textarea required name="bulk" style="min-height:240px" placeholder="Classificados Lucas | https://www.facebook.com/groups/123456 | Lucas do Rio Verde&#10;https://www.facebook.com/groups/987654"></textarea></div>'+
 '<div class="modal-actions">'+button('modal-close','Cancelar','','btn-quiet')+'<button type="submit" class="btn btn-primary">Importar grupos</button></div></form>');
}
function startQueue(id){
 const campaignId=id||$('#queueCampaign')?.value||state.campaigns[0]?.id;
 if(!state.groups.length){tabTo('grupos');toast('Cadastre ao menos um grupo.');return}
 if(!campaignId||!state.campaigns.some(c=>c.id===campaignId)){tabTo('campanhas');toast('Crie uma campanha primeiro.');return}
 const eligible=state.groups.filter(nextEligible).map(g=>g.id);
 if(!eligible.length){toast('Nenhum grupo está disponível. Confira os intervalos configurados.');return}
 state.queue={campaignId,ids:eligible,index:0,startedAt:nowISO()};
 save();tabTo('fila');
}
function queueStep(published){
 const q=state.queue;if(!q)return;
 const g=state.groups.find(x=>x.id===q.ids[q.index]);
 const c=state.campaigns.find(x=>x.id===q.campaignId);
 if(published&&g&&c){
  state.history.push({id:uuid(),type:'published',groupId:g.id,groupName:g.name,campaignId:c.id,campaignName:c.name,date:nowISO()});
 }
 q.index++;
 if(q.index>=q.ids.length){state.queue=null;save();tabTo('historico');toast('Fila concluída. Histórico atualizado.');return}
 save();renderQueue();toast(published?'Publicação registrada. Próximo grupo.':'Grupo pulado. Próximo da fila.');
}
async function copyText(content){
 if(!content){toast('Selecione um anúncio primeiro.');return}
 try{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(content);}
  else{
   const el=document.createElement('textarea');el.value=content;el.style.position='fixed';el.style.opacity='0';document.body.append(el);el.select();
   if(!document.execCommand('copy'))throw Error('copy');el.remove();
  }
  toast('Anúncio copiado. Agora cole no grupo.');
 }catch{toast('Não foi possível copiar automaticamente. Selecione o texto na prévia.')}
}
async function shareCampaign(c){
 if(!c)return;
 const text=adText(c);
 try{
  if(navigator.share){
   const payload={title:c.name,text};
   if(c.image&&navigator.canShare){
    try{const response=await fetch(c.image);const blob=await response.blob();const file=new File([blob],'novabyte-anuncio.jpg',{type:'image/jpeg'});
     if(navigator.canShare({files:[file]}))payload.files=[file];}catch{}
   }
   await navigator.share(payload);
  }else await copyText(text);
 }catch(e){if(e?.name!=='AbortError')toast('Compartilhamento não disponível. Use Copiar anúncio.')}
}
function safeFilename(){return 'novabyte-divulga-backup-'+new Date().toISOString().slice(0,10)+'.json'}
function downloadBackup(){
 const backup={format:'novabyte-divulga-backup',version:1,exportedAt:nowISO(),data:state};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=safeFilename();a.click();
 setTimeout(()=>URL.revokeObjectURL(url),2500);
 toast('Backup gerado. Salve o arquivo em lugar seguro.');
}
function imageResize(file){
 return new Promise((resolve,reject)=>{
  if(!file||!file.type.startsWith('image/')){reject(Error('Escolha uma imagem.'));return}
  if(file.size>15*1024*1024){reject(Error('A imagem é muito grande (máximo 15 MB).'));return}
  const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{
   try{
    const canvas=document.createElement('canvas');
    const ratio=Math.min(1,900/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    resolve(canvas.toDataURL('image/jpeg',.72));
   }catch(e){reject(e)}finally{URL.revokeObjectURL(url)}
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Imagem não pode ser aberta.'))};
  img.src=url;
 });
}
function isQuiet(){
 const s=state.settings;
 const dt=new Date(),time=String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
 const begin=s.quietStart,end=s.quietEnd;
 if(!begin||!end||begin===end)return false;
 return begin<end?time>=begin&&time<end:time>=begin||time<end;
}
function reminderCheck(){
 if(!state.settings.reminders||document.hidden||isQuiet())return;
 if(hoursElapsed(state.settings.lastReminder)<Number(state.settings.intervalHours||1))return;
 state.settings.lastReminder=nowISO();save();
 const ready=state.groups.filter(nextEligible).length;
 const message='Hora de conferir o NovaByte Divulga. '+ready+' grupo(s) disponível(is).';
 toast(message);
 if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
  try{new Notification('NovaByte Divulga',{body:message,icon:'./icon.svg'})}catch{}
 }
}
function handleAction(action,id){
 if(action==='modal-close'){closeModal();return}
 if(action==='group-new'||action==='group-edit'){groupForm(id);return}
 if(action==='group-import'){importGroupsModal();return}
 if(action==='group-delete'){
  const group=state.groups.find(g=>g.id===id);if(!group)return;
  if(!confirm('Excluir o grupo "'+group.name+'"? O histórico já registrado será mantido.'))return;
  state.groups=state.groups.filter(g=>g.id!==id);state.queue=null;save();render();toast('Grupo excluído.');return;
 }
 if(action==='campaign-new'||action==='campaign-edit'){campaignForm(id);return}
 if(action==='campaign-delete'){
  const campaign=state.campaigns.find(c=>c.id===id);if(!campaign)return;
  if(!confirm('Excluir a campanha "'+campaign.name+'"?'))return;
  state.campaigns=state.campaigns.filter(c=>c.id!==id);state.queue=null;save();render();toast('Campanha excluída.');return;
 }
 if(action==='campaign-copy'){copyText(adText(state.campaigns.find(c=>c.id===id)));return}
 if(action==='start-queue'||action==='campaign-start'){startQueue(id);return}
 if(action==='queue-copy'){
  const q=state.queue;copyText(adText(state.campaigns.find(c=>c.id===q?.campaignId)));return;
 }
 if(action==='queue-open'){
  const q=state.queue,g=state.groups.find(g=>g.id===q?.ids[q.index]);
  if(!g||!escapeUrl(g.url)){toast('Link inválido. Edite este grupo.');return}
  window.open(g.url,'_blank','noopener,noreferrer');toast('Confirme a publicação no Facebook antes de marcar como feita.');return;
 }
 if(action==='queue-share'){shareCampaign(state.campaigns.find(c=>c.id===state.queue?.campaignId));return}
 if(action==='queue-done'){queueStep(true);return}
 if(action==='queue-skip'){queueStep(false);return}
 if(action==='queue-end'){if(confirm('Encerrar a fila? As publicações já registradas serão mantidas.')){state.queue=null;save();tabTo('fila')}return}
 if(action==='export'){downloadBackup();return}
 if(action==='import-backup'){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
  input.onchange=async()=>{
   try{
    const txt=await input.files[0].text();
    if(txt.length>5*1024*1024)throw Error('Arquivo de backup muito grande.');
    const parsed=JSON.parse(txt),data=parsed?.data;
    if(parsed.format!=='novabyte-divulga-backup'||!Array.isArray(data?.groups)||!Array.isArray(data?.campaigns)||!Array.isArray(data?.history))throw Error('Arquivo não é um backup do NovaByte Divulga.');
    if(!confirm('Substituir os dados deste aparelho pelos dados do backup?'))return;
    const groups=data.groups.filter(g=>g&&escapeUrl(g.url)&&typeof g.id==='string').slice(0,1500).map(g=>({...g,url:escapeUrl(g.url)}));
    const campaigns=data.campaigns.filter(c=>c&&typeof c.id==='string').slice(0,300).map(c=>({...c,image:typeof c.image==='string'&&c.image.startsWith('data:image/')?c.image:''}));
    const history=data.history.filter(h=>h&&typeof h.groupId==='string'&&h.type==='published').slice(-10000);
    state={groups,campaigns,history,queue:null,settings:{...emptyState().settings,...(data.settings||{})}};
    if(save()){tabTo('inicio');toast('Backup restaurado.');}
   }catch(e){toast('Falha ao importar: '+(e.message||'arquivo inválido'))}
  };input.click();return;
 }
 if(action==='clear-all'){
  if(!confirm('ATENÇÃO: apagar todos os grupos, campanhas e histórico DESTE aparelho? Exporte seu backup antes.'))return;
  if(!confirm('Confirmar exclusão definitiva dos dados locais?'))return;
  state=emptyState();save();tabTo('inicio');toast('Dados locais apagados.');return;
 }
 if(action==='generate-ad'){
  const form=$('#campaignForm');if(!form)return;
  const service=form.elements.service.value,city=form.elements.city.value;
  const variants=adVariants(service,city);
  const current=form.elements.text.value;
  const index=variants.findIndex(v=>v===current);
  form.elements.text.value=variants[(index+1+variants.length)%variants.length];
  toast('Nova sugestão preparada. Personalize antes de publicar.');return;
 }
 if(action==='image-remove'){
  imageDraft='';const status=$('#imageStatus');if(status)status.innerHTML='';
  const el=$('#campaignImage');if(el)el.value='';toast('Imagem removida desta campanha.');return;
 }
 if(action==='request-notif'){
  if(typeof Notification==='undefined'){toast('Seu navegador não oferece notificações nesta tela. Use lembretes com a central aberta.');return}
  try{
   Notification.requestPermission().then(p=>toast(p==='granted'?'Avisos permitidos com o aplicativo aberto.':'Notificações não autorizadas.'));
  }catch{toast('Notificações não disponíveis.')}
 }
}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-tab]');if(nav){tabTo(nav.dataset.tab);return}
 const btn=e.target.closest('[data-action]');if(btn){handleAction(btn.dataset.action,btn.dataset.id||'');return}
 if(e.target.id==='modal'){closeModal()}
});
$('#settingsTop').onclick=()=>tabTo('config');
document.addEventListener('submit',e=>{
 if(e.target.id==='groupForm'){
  e.preventDefault();
  const f=e.target,data=new FormData(f),url=escapeUrl(data.get('url')),id=String(data.get('id')||'');
  if(!url){toast('Informe um link válido de grupo do Facebook.');return}
  if(state.groups.some(g=>g.url===url&&g.id!==id)){toast('Esse grupo já está cadastrado.');return}
  const group={id:id||uuid(),name:String(data.get('name')||'').trim().slice(0,130),url,city:String(data.get('city')||'').trim().slice(0,90),cooldown:Math.min(720,Math.max(1,Number(data.get('cooldown'))||24)),rules:String(data.get('rules')||'').trim().slice(0,1200),notes:String(data.get('notes')||'').trim().slice(0,200)};
  if(!group.name){toast('Informe o nome do grupo.');return}
  if(id)state.groups=state.groups.map(g=>g.id===id?group:g);else state.groups.push(group);
  if(save()){closeModal();tabTo('grupos');toast('Grupo salvo com sucesso.');}
 }
 if(e.target.id==='campaignForm'){
  e.preventDefault();const data=new FormData(e.target),id=String(data.get('id')||''),link=String(data.get('link')||'').trim();
  if(link&&!simpleUrl(link)){toast('O link da campanha precisa começar com https://');return}
  const c={id:id||uuid(),name:String(data.get('name')||'').trim().slice(0,100),service:String(data.get('service')||'Outro serviço'),city:String(data.get('city')||'').slice(0,90),text:String(data.get('text')||'').trim().slice(0,2200),link:link?simpleUrl(link):'',image:imageDraft};
  if(!c.name||c.text.length<15){toast('Informe o nome e um anúncio com ao menos 15 caracteres.');return}
  if(id)state.campaigns=state.campaigns.map(x=>x.id===id?c:x);else state.campaigns.push(c);
  if(save()){closeModal();tabTo('campanhas');toast('Campanha salva.');}
 }
 if(e.target.id==='bulkGroupForm'){
  e.preventDefault();
  const lines=String(new FormData(e.target).get('bulk')||'').split(/\r?\n/).filter(Boolean).slice(0,500);
  let added=0,invalid=0;
  for(const line of lines){
   const chunks=line.split('|').map(s=>s.trim());const url=escapeUrl(chunks.find(x=>x.includes('facebook.com/')||x.includes('fb.com/'))||'');
   if(!url){invalid++;continue}
   if(state.groups.some(g=>g.url===url))continue;
   const idpart=url.split('/').filter(Boolean).pop();
   const g={id:uuid(),name:chunks.length>=2&&!chunks[0].startsWith('http')?chunks[0].slice(0,130):'Grupo '+idpart,url,city:(chunks.length>=3?chunks[2]:'Lucas do Rio Verde').slice(0,90),cooldown:24,rules:'',notes:''};
   state.groups.push(g);added++;
  }
  if(save()){closeModal();tabTo('grupos');toast(added+' grupo(s) importado(s). '+invalid+' linha(s) inválida(s).');}
 }
});
document.addEventListener('input',e=>{
 if(e.target.id==='groupSearch'){searchGroups=e.target.value;showGroups()}
 if(e.target.id==='historyFilter'){filterHistory=e.target.value;renderHistory();$('#historyFilter')?.focus()}
});
document.addEventListener('change',async e=>{
 if(e.target.id==='cityFilter'){filterCity=e.target.value;showGroups()}
 if(e.target.id==='remindersToggle'||e.target.id==='remindersInterval'){
  state.settings.reminders=$('#remindersToggle')?.checked||false;
  state.settings.intervalHours=Number($('#remindersInterval')?.value||1);
  state.settings.lastReminder=nowISO();save();toast(state.settings.reminders?'Lembretes ativados enquanto a central estiver aberta.':'Configuração salva.');
 }
 if(e.target.id==='campaignImage'){
  const file=e.target.files?.[0];if(!file)return;
  $('#imageStatus').textContent='Preparando imagem…';
  try{imageDraft=await imageResize(file);$('#imageStatus').innerHTML='<img class="image-mini" alt="Prévia" src="'+E(imageDraft)+'">';toast('Imagem pronta para salvar.')}
  catch(err){$('#imageStatus').textContent='';toast(err.message||'Não foi possível ler a imagem.')}
 }
});
window.addEventListener('hashchange',()=>tabTo(location.hash.slice(1)||'inicio'));
window.addEventListener('storage',e=>{if(e.key===KEY){state=load();render()}});
const starting=location.hash.slice(1)||'inicio';tabTo(starting);
reminderTimer=setInterval(reminderCheck,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){state=load();render();reminderCheck()}});
if('serviceWorker' in navigator&&!window.Capacitor?.isNativePlatform?.()){
 window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v='+VERSION,{updateViaCache:'none'}).catch(()=>{}));
}
})();