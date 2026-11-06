const form=document.querySelector('#checkout'),pay=document.querySelector('#pay'),result=document.querySelector('#result');
let attempt=null;
fetch('/api/kaia/mp-test/status').then(async r=>{
 const s=await r.json();pay.disabled=!s.ready;
 document.querySelector('#status').textContent=s.ready?'Ambiente preparado para uma tentativa de teste.':'Homologação bloqueada: banco isolado, credenciais e serviços de teste precisam estar confirmados.';
}).catch(()=>{document.querySelector('#status').textContent='Não foi possível verificar o ambiente de teste.';});
form.addEventListener('input',()=>{attempt=null;});
form.addEventListener('submit',async e=>{
 e.preventDefault();const f=new FormData(form);
 const body={items:[{sku:f.get('sku'),quantity:Number(f.get('quantity'))}],destinoCep:f.get('cep'),serviceId:f.get('service'),coupon:f.get('coupon')};
 if(!attempt)attempt={key:crypto.randomUUID(),body};pay.disabled=true;
 try{
  const r=await fetch('/api/kaia/mp-test/orders',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':attempt.key},body:JSON.stringify(attempt.body)});
  const data=await r.json();if(!r.ok){result.textContent='Tentativa bloqueada: '+data.code;return;}
  if(data.checkout_url){const u=new URL(data.checkout_url);if(u.origin!=='https://www.mercadopago.com.br')throw Error();window.location.assign(u.href);}
  else result.textContent='Pedido '+data.id+': '+data.status;
 }catch{result.textContent='Não foi possível confirmar a resposta. Repetir usará a mesma chave de tentativa.';}
 finally{pay.disabled=false;}
});
