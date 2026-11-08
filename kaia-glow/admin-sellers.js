let client=null,sellers=[];
const byId=id=>document.getElementById(id);
const fmt=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100);
const node=(tag,cl,txt)=>{const x=document.createElement(tag);if(cl)x.className=cl;if(txt!==undefined)x.textContent=String(txt);return x};
const status=(message,fail=false)=>{const n=byId('sellerAdminStatus');n.textContent=message;n.classList.toggle('error',fail)};
async function copy(text){
 try{await navigator.clipboard.writeText(text);status('Link copiado para compartilhar.');}
 catch{prompt('Copie o link:',text);}
}
function sellerCard(s){
 const card=node('article','seller-admin-card');
 const head=node('div','seller-admin-card-head'),body=node('div');
 body.append(node('h3','',s.email));
 body.append(node('p','muted','Código '+s.code+' · 10% nos produtos · desde '+new Date(s.since).toLocaleDateString('pt-BR')));
 const badge=node('span','seller-admin-badge',s.active?'Ativo':'Pausado');
 badge.dataset.active=String(s.active);
 head.append(body,badge);
 const metrics=node('div','seller-admin-metrics');
 for(const [label,value] of [
  ['Vendas aprovadas',String(s.approvedSales||0)],
  ['Vendas aguardando pagamento',String(s.pendingSales||0)],
  ['Comissão confirmada',fmt(s.earnedCents)],
  ['Saldo a receber',fmt(s.dueCents)]
 ]){
  const item=node('div');item.append(node('small','',label),node('strong','',value));metrics.append(item);
 }
 const url=node('div','seller-admin-referral');
 const input=node('input');input.readOnly=true;input.value=s.link;input.setAttribute('aria-label','Link do vendedor');
 const cp=node('button','ghost-button','Copiar link');cp.type='button';cp.onclick=()=>copy(s.link);
 url.append(input,cp);
 const actions=node('div','seller-admin-actions');
 const toggle=node('button','ghost-button',s.active?'Pausar vendedor':'Reativar vendedor');
 toggle.type='button';
 toggle.onclick=async()=>{
  if(!confirm((s.active?'Pausar':'Reativar')+' o vendedor '+s.email+'?'))return;
  toggle.disabled=true;status('Atualizando vendedor…');
  const {error}=await client.rpc('kaia_admin_set_seller',{p_email:s.email,p_active:!s.active});
  if(error){status('Falha ao atualizar o vendedor: '+error.message,true);toggle.disabled=false;return;}
  await loadKaiaSellers();status('Acesso do vendedor atualizado.');
 };
 const invite=node('button','ghost-button','Copiar convite');invite.type='button';
 invite.onclick=()=>copy('Você foi autorizado(a) a vender pela Kaia Glow! Acesse seu painel em https://usekaiaglow.com.br/vendedor.html, entre com seu e-mail cadastrado e senha e compartilhe seu link exclusivo: '+s.link+'. Comissão de 10% sobre produtos pagos, sem frete, após descontos.');
 actions.append(toggle,invite);
 if(Number(s.dueCents)>0){
  const payout=node('div','seller-admin-payout');
  const label=node('label','','Registrar repasse JÁ REALIZADO (R$)');
  const inputAmount=node('input');inputAmount.type='number';inputAmount.min='0.01';inputAmount.step='0.01';
  inputAmount.max=(Number(s.dueCents)/100).toFixed(2);
  inputAmount.placeholder=(Number(s.dueCents)/100).toFixed(2);
  inputAmount.setAttribute('aria-label','Valor do repasse efetuado');
  label.append(inputAmount);
  const paid=node('button','ghost-button','Registrar pagamento feito');paid.type='button';
  paid.onclick=async()=>{
   const amount=Math.round(Number(inputAmount.value)*100);
   if(!Number.isSafeInteger(amount)||amount<1||amount>Number(s.dueCents)){
    status('Informe um valor válido, não superior ao saldo a receber.',true);return;
   }
   if(!confirm('Confirma que o valor de '+fmt(amount)+' JÁ foi transferido para '+s.email+'? Este botão só registra um repasse externo; ele NÃO transfere dinheiro.'))return;
   paid.disabled=true;status('Registrando repasse realizado…');
   const {error}=await client.rpc('kaia_admin_record_seller_payout',{
    p_seller:s.userId,p_amount_cents:amount,p_note:'Repasse externo informado pelo administrador'
   });
   if(error){status('Não foi possível registrar o repasse: '+error.message,true);paid.disabled=false;return;}
   await loadKaiaSellers();status('Repasse registrado no histórico. Nenhuma transferência bancária foi executada.');
  };
  payout.append(label,paid);actions.append(payout);
 }
 card.append(head,metrics,url,actions);return card;
}
export async function loadKaiaSellers(){
 if(!client)return;
 status('Carregando vendedores e comissões…');
 const {data,error}=await client.rpc('kaia_admin_seller_list');
 if(error||!Array.isArray(data)){
  status('Não foi possível consultar vendedores. Verifique sua autorização.',true);return;
 }
 sellers=data;
 const root=byId('sellerAdminList');root.replaceChildren();
 const active=sellers.filter(s=>s.active).length;
 const pending=sellers.reduce((a,s)=>a+Number(s.pendingSales||0),0);
 const due=sellers.reduce((a,s)=>a+Number(s.dueCents||0),0);
 const summary=byId('sellerAdminSummary');summary.replaceChildren();
 for(const [text,value] of [['Vendedores ativos',active],['Pedidos aguardando pagamento',pending],['Comissões a receber',fmt(due)]]){
  const card=node('div','seller-admin-summary-card');card.append(node('small','',text),node('strong','',value));summary.append(card);
 }
 if(!sellers.length)root.append(node('p','muted','Ainda não há vendedores cadastrados. Autorize o primeiro pelo formulário acima.'));
 else for(const seller of sellers)root.append(sellerCard(seller));
 status(sellers.length+' vendedor(es) cadastrado(s). Os saldos consideram somente pagamentos confirmados e não cancelados.');
}
export function setupKaiaSellers(sb){
 client=sb;const form=byId('sellerAdminForm');
 if(!form)return;
 byId('sellerAdminRefresh').onclick=loadKaiaSellers;
 form.onsubmit=async ev=>{
  ev.preventDefault();
  const email=byId('sellerAdminEmail').value.trim().toLowerCase();
  const button=byId('sellerAdminAdd');
  if(!email||!email.includes('@')){status('Informe o e-mail do vendedor.',true);return;}
  if(!confirm('Autorizar '+email+' como vendedor Kaia Glow, com comissão de 10% sobre vendas aprovadas?'))return;
  button.disabled=true;status('Conferindo cadastro e e-mail…');
  const {data,error}=await client.rpc('kaia_admin_set_seller',{p_email:email,p_active:true});
  button.disabled=false;
  if(error){status(error.message?.includes('CADASTRE_E_CONFIRME')?
   'Essa pessoa precisa criar uma conta na Kaia Glow e confirmar o e-mail antes da autorização.':
   'Falha na autorização: '+error.message,true);return;}
  form.reset();await loadKaiaSellers();
  status('Vendedor autorizado! Link exclusivo: '+data.link+'. Copie-o na ficha do vendedor.');
 };
}
