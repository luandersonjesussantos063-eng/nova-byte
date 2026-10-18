/* Navigation and progressive disclosure for the existing administrator tools. */
(()=>{
'use strict';
function setup(){
 const dash=document.getElementById('dashboard');if(!dash)return;
 const $=id=>document.getElementById(id);
 const groups={catalogo:[dash.querySelector('.workspace .library')],importacoes:[dash.querySelector('.workspace .editor')],youtube:[$('youtube-manager')],canais:[$('live-embed-manager')],online:[$('nplay-presence-admin')],acessos:[$('nplay-access-admin')],iptv:[$('nplay-iptv-admin')],avisos:[$('nplay-news-admin')],destaques:[dash.querySelector('.featured-manager')],ferramentas:[$('admin-diagnostics'),$('portal-auth-manager'),dash.querySelector('.licensed-manager'),dash.querySelector('.issue-manager')]};
 const titles={catalogo:'Catálogo',importacoes:'Importações',youtube:'YouTube',canais:'TV ao vivo',online:'Perfis online',acessos:'Autorizações',iptv:'Acessos IPTV',avisos:'Avisos',destaques:'Destaques',ferramentas:'Ferramentas'};
 const descriptions={catalogo:'Encontre, revise e publique seus filmes e séries.',importacoes:'Acompanhe a fila ou cadastre uma nova importação.',youtube:'Adicione vídeos por link e organize suas categorias.',canais:'Gerencie os canais e abra os testes quando precisar.',online:'Identifique seus clientes e acompanhe o uso da NPlay.',acessos:'Confira os pedidos e gerencie os aparelhos autorizados.',iptv:'Crie acessos e encontre os clientes que precisa gerenciar.',avisos:'Envie comunicados para o sino dos clientes.',destaques:'Escolha até seis títulos para a página inicial.',ferramentas:'Diagnósticos de conexão, cadastro por link e problemas relatados.'};
 dash.querySelector('.workspace')?.classList.add('admin-workspace');
 const buttons=[...dash.querySelectorAll('[data-admin-tab]')],select=$('admin-area-select');
 for(const [name,panels] of Object.entries(groups))panels.forEach((panel,index)=>{if(!panel)return;panel.id||= 'admin-panel-'+name+'-'+index;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','admin-tab-'+name);});
 for(const button of buttons){const name=button.dataset.adminTab;button.id='admin-tab-'+name;button.setAttribute('role','tab');button.setAttribute('aria-controls',groups[name].filter(Boolean).map(p=>p.id).join(' '));}
 function show(name,scroll=false){
  if(!groups[name])name='catalogo';
  for(const [key,panels] of Object.entries(groups))for(const panel of panels)if(panel)panel.hidden=key!==name;
  for(const button of buttons){const active=button.dataset.adminTab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  for(const node of [dash.querySelector('.intro-text'),dash.querySelector('.stats'),$('source-summary')])if(node)node.hidden=name!=='catalogo';
  const drive=dash.querySelector('.intro-text + .stats + #source-summary + .panel');if(drive)drive.hidden=true;
  $('admin-tab-title').textContent=titles[name];$('admin-tab-help').textContent=descriptions[name];select.value=name;
  try{sessionStorage.setItem('nplay-admin-tab',name);}catch{}
  if(scroll)window.scrollTo({top:0,behavior:'instant'});
 }
 for(const [index,button] of buttons.entries()){
  button.addEventListener('click',()=>show(button.dataset.adminTab,true));
  button.addEventListener('keydown',event=>{let next;if(['ArrowRight','ArrowDown'].includes(event.key))next=(index+1)%buttons.length;else if(['ArrowLeft','ArrowUp'].includes(event.key))next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();buttons[next].focus();buttons[next].click();});
 }
 select.addEventListener('change',()=>buttons.find(b=>b.dataset.adminTab===select.value)?.click());
 $('licensed-new')?.addEventListener('click',()=>show('importacoes',true));
 function fold(node,label,id){
  if(!node||node.closest('.admin-fold'))return;
  const details=document.createElement('details'),summary=document.createElement('summary');details.className='admin-fold';details.id=id;summary.textContent=label;node.before(details);details.append(summary,node);return details;
 }
 fold($('batch-cover-files')?.closest('.panel'),'Trocar capas em lote','admin-batch-covers');
 fold($('bulk-mark-reviewed')?.closest('.panel'),'Conferir e publicar em lote','admin-batch-publish');
 fold($('iptv-create'),'＋ Criar acesso IPTV','admin-iptv-create');
 const magnet=$('magnet-import-form'),queue=$('magnet-pending-list')?.parentElement,editor=dash.querySelector('.editor');
 if(queue&&editor){queue.classList.add('admin-import-queue');editor.prepend(queue);queue.style.marginTop='0';queue.style.borderTop='0';queue.style.paddingTop='0';}
 fold(magnet?.closest('section'),'＋ Nova importação por magnet','admin-magnet-form');
 const back=$('admin-back-top');window.addEventListener('scroll',()=>{back.hidden=window.scrollY<700;},{passive:true});back.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
 let saved='catalogo';try{saved=sessionStorage.getItem('nplay-admin-tab')||saved;}catch{}show(saved);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
