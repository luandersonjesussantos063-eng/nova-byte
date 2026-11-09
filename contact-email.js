export async function sendContactEmail({accessKey,fields,captchaToken,honeypot='',fetchImpl=globalThis.fetch,signal}){
 if(typeof accessKey!=='string'||!accessKey.trim())throw new Error('Configuração de envio indisponível.');
 if(honeypot||typeof captchaToken!=='string'||!captchaToken.trim()||captchaToken.length>10000)throw new Error('Confirme a verificação de segurança antes de enviar.');
 if(!fields||typeof fields.name!=='string'||fields.name.length<2||fields.name.length>100||typeof fields.email!=='string'||fields.email.length>160||typeof fields.message!=='string'||fields.message.length<10||fields.message.length>5000)throw new Error('Confira os dados da solicitação.');
 const response=await fetchImpl('https://api.web3forms.com/submit',{
  method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},signal,
  body:JSON.stringify({access_key:accessKey,name:fields.name,email:fields.email,
   WhatsApp:fields.phone||'',Serviço:fields.service,message:fields.message,
   subject:'Novo pedido pelo site — NovaByte',from_name:'Site NovaByte',botcheck:false,'h-captcha-response':captchaToken})
 });
 const result=await response.json();
 if(!response.ok||result?.success!==true)throw new Error('Não foi possível confirmar o envio. Seus dados foram mantidos; você pode tentar pelo WhatsApp.');
 return true;
}
