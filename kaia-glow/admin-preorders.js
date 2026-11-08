// Pedido por encomenda não cobra e não reserva estoque: gestão autenticada.
let sb=null;
const $=id=>document.getElementById(id);
const lbl={requested:'Aguardando análise',confirmed:'Confirmada',ready:'Disponível para finalizar',declined:'Não atendida',cancelled:'Cancelada pela cliente',closed:'Encerrada'};
const fmt=d=>{try{return new Date(d).toLocaleDateString('pt-BR',{timeZone:'America/Cuiaba'})}catch{return '—'}};
function element(tag,cls,txt){
 const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;
}
export async function loadKaiaPreorders(){
 if(!sb)return;
 const root=$('preorderAdminList'),status=$('preorderAdminStatus');
 status.textContent='Consultando encomendas…';
 const {data,error}=await sb.rpc('kaia_admin_preorder_list');
 if(error){status.textContent='Não foi possível consultar as encomendas: '+error.message;return}
 const filter=$('preorderAdminFilter').value;
 const rows=(Array.isArray(data)?data:[]).filter(r=>
  filter==='all'||filter==='active'&&['requested','confirmed','ready'].includes(r.status)||
  filter==='requested'&&r.status==='requested'||filter==='history'&&['closed','declined','cancelled'].includes(r.status));
 status.textContent=rows.length+' encomenda(s) exibida(s). '+(data||[]).filter(x=>x.status==='requested').length+' aguardando análise.';
 root.replaceChildren();
 if(!rows.length){root.append(element('p','muted','Nenhuma encomenda encontrada neste filtro.'));return}
 for(const r of rows){
  const card=element('article','kaia-preorder-record');
  const heading=element('div','kaia-preorder-row');
  const title=element('h3','',r.product+' × '+r.quantity);
  const marker=element('span','kaia-preorder-status',lbl[r.status]||r.status);
  heading.append(title,marker);card.append(heading);
  card.append(element('p','kaia-preorder-meta',r.customer+' · '+r.email));
  card.append(element('p','kaia-preorder-meta','SKU '+r.sku+' · Solicitada em '+fmt(r.requestedAt)+' · Previsão de disponibilidade '+fmt(r.estimatedAvailableAt)));
  if(r.adminNote)card.append(element('p','kaia-preorder-meta','Resposta da loja: '+r.adminNote));
  if(r.status==='requested'||r.status==='confirmed'||r.status==='ready'){
   const form=element('div','kaia-preorder-review');
   const label=element('label','','Mensagem ou justificativa para a cliente');
   const note=element('textarea');note.maxLength=1000;note.rows=2;
   note.placeholder='Opcional ao confirmar; obrigatória para recusar (mín. 8 caracteres)';
   label.append(note);form.append(label);
   const actions=element('div','kaia-preorder-actions');
   async function move(next){
    const msg=note.value.trim();
    if(next==='declined'&&msg.length<8){alert('Informe o motivo da recusa (pelo menos 8 caracteres).');return}
    const descriptions={confirmed:'Confirmar solicitação de encomenda? Ainda não haverá cobrança.',
     ready:'Marcar o produto como disponível? Confirme primeiro que existe estoque suficiente no painel.',
     declined:'Informar à cliente que a encomenda não poderá ser atendida?',
     closed:'Encerrar a solicitação? Isso não cria uma venda nem recebe pagamento.'};
    if(!confirm(descriptions[next]))return;
    actions.querySelectorAll('button').forEach(x=>x.disabled=true);
    const result=await sb.rpc('kaia_admin_manage_preorder',{
     p_id:r.id,p_status:next,p_note:msg||null
    });
    if(result.error){
     status.textContent='Não foi possível atualizar a encomenda: '+result.error.message;
     actions.querySelectorAll('button').forEach(x=>x.disabled=false);return;
    }
    await loadKaiaPreorders();
   }
   const button=(name,target,primary)=>{
    const b=element('button',primary?'primary-button':'ghost-button',name);
    b.type='button';b.onclick=()=>move(target);actions.append(b);
   };
   if(r.status==='requested'){
    button('Confirmar encomenda','confirmed',true);
    button('Não será possível atender','declined',false);
   }else if(r.status==='confirmed'){
    button('Produto disponível','ready',true);
    button('Não será possível atender','declined',false);
   }else button('Encerrar acompanhamento','closed',false);
   form.append(actions);card.append(form);
  }
  root.append(card);
 }
}
export function setupKaiaPreorders(client){
 sb=client;
 $('preorderRefresh').onclick=loadKaiaPreorders;
 $('preorderAdminFilter').onchange=loadKaiaPreorders;
}
