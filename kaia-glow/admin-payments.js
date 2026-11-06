// Mercado Pago readiness viewer. Reads only nonsecret server booleans; never triggers payments.
const $=s=>document.querySelector(s);
const set=(id,value)=>{const el=$(id);if(el)el.textContent=value;};
export async function loadKaiaPayments(){
 set('#mpPaymentStatus','Verificando configuração protegida no servidor da loja...');
 const button=$('#mpPaymentRefresh');button.disabled=true;
 try{
  const response=await fetch('/api/kaia/status',{headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('Não foi possível consultar o status do servidor');
  const payload=await response.json(),p=payload.pagamentos||{};
  set('#mpPaymentTestCredential',p.credenciaisTesteConfiguradas?'Configurada':'Não configurada');
  set('#mpPaymentWebhook',p.webhookAssinaturaConfigurada?'Configurada':'Não configurada');
  set('#mpPaymentCheckout',payload.checkoutAtivo&&p.pedidosTransacionaisProntos?'Ativo':'Desativado');
  set('#mpPaymentStatus',payload.checkoutAtivo?
   'O servidor informa checkout ativo. Verifique os testes de compras e pedidos antes de aceitar pagamentos.':
   'Cobranças bloqueadas no site. As etapas pendentes precisam ser concluídas na conta Mercado Pago da titular e no servidor.');
 }catch{
  set('#mpPaymentTestCredential','Indisponível');set('#mpPaymentWebhook','Indisponível');
  set('#mpPaymentCheckout','Não verificado');
  set('#mpPaymentStatus','Não foi possível verificar a configuração. Não considere o checkout habilitado.');
 }finally{button.disabled=false;}
}
export function initKaiaPayments(){
 $('#mpPaymentRefresh').onclick=loadKaiaPayments;
}
