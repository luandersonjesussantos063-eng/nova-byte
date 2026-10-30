export async function sendContactEmail({accessKey,fields,fetchImpl=globalThis.fetch,signal}){
 if(typeof accessKey!=='string'||!accessKey.trim())throw new Error('Configuração de envio indisponível.');
 const response=await fetchImpl('https://api.web3forms.com/submit',{
  method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},signal,
  body:JSON.stringify({access_key:accessKey,name:fields.name,email:fields.email,
   WhatsApp:fields.phone||'',Serviço:fields.service,message:fields.message,
   subject:'Novo pedido pelo site — NovaByte',from_name:'Site NovaByte',botcheck:false})
 });
 const result=await response.json();
 if(!response.ok||result?.success!==true)throw new Error('Não foi possível confirmar o envio. Seus dados foram mantidos; você pode tentar pelo WhatsApp.');
 return true;
}
