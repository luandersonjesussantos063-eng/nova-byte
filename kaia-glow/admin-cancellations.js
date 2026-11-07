// Cancellation review for authenticated store administrators.
const $=selector=>document.querySelector(selector);
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={requested:'Aguardando análise',approved:'Cancelado',
 approved_refund_pending:'Aceito · aguardando reembolso',denied:'Não aceito'};
let client=null;
export async function loadKaiaCancellations(){
 if(!client)return;
 const box=$('#cancellationAdminList'),note=$('#cancellationAdminStatus');
 note.textContent='Consultando solicitações…';
 const {data,error}=await client.from('kaia_cancellation_requests')
  .select('id,order_number,buyer_name,buyer_email,total_cents,reason,items,status,requested_at,reviewed_at,decision_note,refund_reference')
  .order('requested_at',{ascending:false}).limit(100);
 if(error){note.textContent='Não foi possível consultar as solicitações. Verifique a conexão e o acesso administrativo.';return}
 note.textContent=(data||[]).filter(x=>x.status==='requested').length+' solicitação(ões) aguardando análise.';
 box.replaceChildren();
 for(const r of data||[]){
  const card=document.createElement('article');card.className='coupon-entry';
  const head=document.createElement('div');head.className='head';
  const title=document.createElement('strong');title.textContent='Pedido '+r.order_number;
  const status=document.createElement('span');status.className='status';status.textContent=labels[r.status]||r.status;
  head.append(title,status);card.append(head);
  const content=document.createElement('p');content.className='muted';
  content.textContent=r.buyer_name+' · '+r.buyer_email+' · '+money(r.total_cents)+' · '+new Date(r.requested_at).toLocaleString('pt-BR');
  card.append(content);
  const items=document.createElement('p');items.textContent=(Array.isArray(r.items)?r.items:[]).map(i=>(i.quantity||1)+' × '+i.name).join(', ');
  card.append(items);
  const reason=document.createElement('p');reason.textContent='Motivo: '+r.reason;card.append(reason);
  if(r.decision_note){const reply=document.createElement('p');reply.textContent='Resposta da loja: '+r.decision_note;card.append(reply)}
  if(r.refund_reference){const ref=document.createElement('p');ref.textContent='Referência de reembolso: '+r.refund_reference;card.append(ref)}
  if(r.status==='requested'||r.status==='approved_refund_pending'){
   const label=document.createElement('label');label.textContent=r.status==='approved_refund_pending'?'Referência do reembolso confirmado':'Resposta ou justificativa para o cliente';
   const text=document.createElement('textarea');text.rows=3;text.maxLength=1000;
   text.placeholder=r.status==='approved_refund_pending'?'Informe somente após confirmar no Mercado Pago. Ex.: referência do estorno':'Opcional ao aprovar; obrigatória ao recusar';
   label.append(text);card.append(label);
   const actions=document.createElement('div');actions.className='editor-actions';
   async function action(type){
    const noteText=text.value.trim();
    if(type==='deny'&&noteText.length<10){alert('Informe a justificativa, com pelo menos 10 caracteres. A desistência legal não pode ser recusada.');return}
    if(type==='finish_refund'&&noteText.length<6){alert('Informe a referência real do estorno, após verificá-lo no provedor.');return}
    const promptText=type==='approve'?(r.total_cents===0?'Confirmar o cancelamento da cortesia, sem estorno?':'Aprovar o cancelamento, registrando o reembolso como pendente?'):
      type==='deny'?'Confirmar recusa? Confira antes se existe direito de arrependimento.':'Você já verificou que o reembolso foi concluído no Mercado Pago?';
    if(!confirm(promptText))return;
    actions.querySelectorAll('button').forEach(x=>x.disabled=true);
    const {error}=await client.rpc('kaia_admin_review_cancellation',{p_id:r.id,p_action:type,p_note:noteText||null});
    if(error){alert('Não foi possível registrar a decisão: '+error.message);actions.querySelectorAll('button').forEach(x=>x.disabled=false);return}
    await loadKaiaCancellations();
   }
   if(r.status==='requested'){
    const approve=document.createElement('button');approve.className='primary-button';approve.type='button';approve.textContent='Aceitar cancelamento';approve.onclick=()=>action('approve');
    const deny=document.createElement('button');deny.className='ghost-button';deny.type='button';deny.textContent='Não aceitar (com justificativa)';deny.onclick=()=>action('deny');
    actions.append(approve,deny);
   }else{
    const finish=document.createElement('button');finish.className='primary-button';finish.type='button';finish.textContent='Reembolso confirmado · concluir';finish.onclick=()=>action('finish_refund');
    actions.append(finish);
   }
   card.append(actions);
  }
  box.append(card);
 }
 if(!(data||[]).length)box.textContent='Nenhuma solicitação de cancelamento foi recebida ainda.';
}
export function setupKaiaCancellations(sb){
 client=sb;
 $('#refreshCancellations').onclick=()=>loadKaiaCancellations();
}
