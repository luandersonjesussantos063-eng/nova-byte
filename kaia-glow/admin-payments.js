// Kaia Glow financial readiness. Queries authenticated, read-only server diagnostics.
// No payment is created, no credentials are exposed and no payment is inferred
// from a free order or from the mere presence of an environment secret.
let sb=null;
const $=selector=>document.querySelector(selector);
const set=(id,value)=>{const node=$(id);if(node)node.textContent=String(value);};
function recommendations(lines){
 const list=$('#mpNextChecks');list.replaceChildren();
 for(const line of lines){
  const item=document.createElement('p');item.className='payment-next-item';
  item.textContent=line;list.append(item);
 }
}
function reset(){
 for(const id of ['#mpPaymentProduction','#mpPaymentWebhook','#mpPaymentPilot',
  '#mpPaymentRealOrders','#mpPaymentCheckout','#mpReleasedProducts',
  '#mpEligibleProducts','#mpFreeOrder'])set(id,'Não verificado');
}
export async function loadKaiaPayments(){
 if(!sb)return;
 const button=$('#mpPaymentRefresh');
 button.disabled=true;
 const banner=$('#mpReadinessBanner');banner.dataset.state='loading';
 set('#mpReadinessHeadline','Conferindo o Mercado Pago…');
 set('#mpReadinessExplanation','Consultando as configurações e os registros da loja.');
 set('#mpPaymentStatus','Verificando a integração sem iniciar nenhuma cobrança…');
 try{
  const {data,error}=await sb.auth.getSession();
  const token=data?.session?.access_token;
  if(error||!token)throw new Error('Entre novamente com uma conta administradora.');
  const result=await fetch('/api/kaia/admin-payment-readiness',{
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   cache:'no-store'
  });
  const p=await result.json().catch(()=>({code:'RESPOSTA_INVALIDA'}));
  if(!result.ok)throw new Error('Falha na consulta protegida: '+(p.code||result.status));
  const c=p.configuration||{};
  const credentials=!!c.productionAccess&&!!c.secureDatabase;
  const webhook=!!c.webhookSignature;
  set('#mpPaymentProduction',credentials?'Configuradas':'Pendentes');
  set('#mpPaymentWebhook',webhook?'Configurada':'Pendente');
  set('#mpPaymentPilot',p.pilotPaymentApproved===null?'Não verificado':
   p.pilotPaymentApproved?'Aprovado':'Sem aprovação');
  set('#mpPaymentRealOrders',p.storePaidOrderApproved===null?'Não verificado':
   p.storePaidOrderApproved?'Aprovada':'Ainda não registrada');
  set('#mpPaymentCheckout',p.checkoutConfigured?'Configurado':'Configuração pendente');
  set('#mpReleasedProducts',p.releasedProducts===null?'Não verificado':p.releasedProducts);
  set('#mpEligibleProducts',p.checkoutEligibleProducts===null?'Não verificado':p.checkoutEligibleProducts);
  set('#mpFreeOrder',p.freeOrderApproved===null?'Não verificado':
   p.freeOrderApproved?'Confirmado':'Não registrado');
  const ready=p.checkoutConfigured&&Number(p.checkoutEligibleProducts)>0;
  banner.dataset.state=ready?'configured':'attention';
  set('#mpReadinessHeadline',ready?'Estrutura do checkout configurada':
   'Atenção à configuração de pagamentos');
  set('#mpReadinessExplanation',ready?
   'Credenciais de produção, assinatura do webhook, frete e produtos elegíveis foram encontrados. A confirmação de uma venda paga na loja é verificada separadamente.':
   'Existe pelo menos uma pendência de configuração ou liberação de produtos. Veja os detalhes abaixo antes de aceitar cobranças reais.');
  const checks=[];
  if(!credentials)checks.push('Verifique as credenciais de produção e o acesso protegido ao banco na Cloudflare.');
  if(!webhook)checks.push('Configure a assinatura do webhook de produção do Mercado Pago.');
  if(!p.shippingReady)checks.push('Confira a configuração de frete de produção e o CEP de origem.');
  if(p.checkoutEligibleProducts===0)checks.push('Nenhum produto está elegível para compra. Verifique a liberação, os preços, o estoque e as embalagens.');
  if(p.pilotPaymentApproved===false)checks.push('Ainda não há teste-piloto pago aprovado registrado.');
  if(p.pilotPaymentApproved===true)checks.push('O teste-piloto de R$ 5,00 consta como aprovado no registro da loja.');
  if(p.storePaidOrderApproved===false)checks.push('Ainda falta validar uma compra comercial paga de ponta a ponta, incluindo confirmação do provedor e e-mails.');
  else if(p.storePaidOrderApproved===true)checks.push('Uma compra comercial paga está registrada como aprovada. Continue conferindo reembolsos, pedidos e notificações.');
  if(p.freeOrderApproved===true)checks.push('O pedido gratuito foi confirmado; ele não equivale a uma cobrança aprovada.');
  recommendations(checks.length?checks:['Nenhuma pendência encontrada nesta consulta. Monitore os pedidos e o provedor de pagamentos.']);
  set('#mpPaymentLastCheck',p.checkedAt?
   'Última verificação: '+new Date(p.checkedAt).toLocaleString('pt-BR'):
   'Última verificação não informada');
  set('#mpPaymentStatus','Consulta concluída. O painel reflete a configuração e os pedidos registrados, sem iniciar transações.');
 }catch(e){
  reset();banner.dataset.state='attention';
  set('#mpReadinessHeadline','Não foi possível verificar a integração');
  set('#mpReadinessExplanation','O painel não conseguiu consultar o servidor de forma autenticada. Isso não significa que os pagamentos foram desligados.');
  recommendations(['Confira sua sessão administrativa e tente novamente. Nenhuma configuração foi alterada.']);
  set('#mpPaymentStatus',e.message||'Consulta indisponível.');
  set('#mpPaymentLastCheck','Verificação indisponível');
 }finally{button.disabled=false;}
}
export function initKaiaPayments(client){
 sb=client;
 $('#mpPaymentRefresh').onclick=loadKaiaPayments;
}
