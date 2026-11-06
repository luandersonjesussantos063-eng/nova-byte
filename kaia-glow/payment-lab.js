const form=document.querySelector('#checkout'),pay=document.querySelector('#pay'),result=document.querySelector('#result');
let attempt=null,ready=false;
fetch('/api/kaia/mp-test/status').then(async r=>{
 const s=await r.json();ready=!!s.ready;pay.disabled=!ready;
 document.querySelector('#status').textContent=s.missing?.length?'Configuração de teste pendente: '+s.missing.join(', '):s.ready?'Ambiente preparado para uma tentativa de teste.':'Homologação bloqueada: banco isolado, credenciais e serviços de teste precisam estar confirmados.';
}).catch(()=>{document.querySelector('#status').textContent='Não foi possível verificar o ambiente de teste.';});
form.addEventListener('input',()=>{attempt=null;});
form.addEventListener('submit',async e=>{
 e.preventDefault();const f=new FormData(form);
 const body={items:[{sku:f.get('sku'),quantity:Number(f.get('quantity'))}],destinoCep:f.get('cep'),serviceId:f.get('service'),coupon:f.get('coupon')};
 if(!attempt)attempt={key:crypto.randomUUID(),body};pay.disabled=true;
 try{
  const r=await fetch('/api/kaia/mp-test/orders',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':attempt.key},body:JSON.stringify(attempt.body)});
  const data=await r.json();if(!r.ok){result.textContent='Tentativa bloqueada: '+data.code;return;}
  currentOrder=data.id;try{sessionStorage.setItem('kaia-qa-order',data.id);}catch{}
  if(data.checkout_url){const u=new URL(data.checkout_url);if(u.origin!=='https://www.mercadopago.com.br')throw Error();window.location.assign(u.href);}
  else result.textContent='Pedido '+data.id+': '+data.status;
 }catch{result.textContent='Não foi possível confirmar a resposta. Repetir usará a mesma chave de tentativa.';}
 finally{pay.disabled=!ready;}
});
const detail=document.createElement('section');
detail.innerHTML='<h2>Pedido de teste</h2><p id="orderState" role="status">Nenhum pedido selecionado.</p><button id="refreshOrder" type="button" hidden>Consultar pedido</button> <button id="cancelOrder" type="button" hidden>Cancelar pedido de teste</button>';
document.querySelector('main').append(detail);
const orderState=document.querySelector('#orderState'),refresh=document.querySelector('#refreshOrder'),cancel=document.querySelector('#cancelOrder');
let currentOrder=new URL(location.href).searchParams.get('local_order'),polls=0,pollTimer=null,inspectVersion=0;
try{currentOrder=currentOrder||sessionStorage.getItem('kaia-qa-order');}catch{}
async function inspectOrder(){
 if(!currentOrder)return;const version=++inspectVersion;clearTimeout(pollTimer);refresh.hidden=false;
 try{
  const response=await fetch('/api/kaia/mp-test/order?id='+encodeURIComponent(currentOrder));
  const state=await response.json();if(version!==inspectVersion)return;if(!response.ok){orderState.textContent='Consulta bloqueada: '+state.code;cancel.hidden=true;return;}
  orderState.textContent='Pedido '+state.id+': '+state.status+(state.awaitingWebhook?' — resultado no provedor: '+state.providerStatus+'; aguardando webhook validado.':'');
  cancel.hidden=!state.canCancel;
  if(state.status==='pending'&&polls++<12)pollTimer=setTimeout(inspectOrder,5000);
 }catch{orderState.textContent='Não foi possível consultar o pedido. Tente novamente.';}
}
refresh.onclick=()=>{polls=0;inspectOrder();};
cancel.onclick=async()=>{
 cancel.disabled=true;
 try{
  const response=await fetch('/api/kaia/mp-test/order?id='+encodeURIComponent(currentOrder),{method:'POST'});
  const state=await response.json();orderState.textContent=response.ok?'Pedido '+state.id+': '+state.status:'Cancelamento bloqueado: '+state.code;
  if(response.ok)cancel.hidden=true;
 }catch{orderState.textContent='Resposta de cancelamento não confirmada. Consulte novamente antes de repetir.';}
 finally{cancel.disabled=false;}
};
if(currentOrder)inspectOrder();
