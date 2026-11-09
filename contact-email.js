export async function sendContactEmail({endpoint,fields,captchaToken,honeypot='',requestKey,fetchImpl=globalThis.fetch,signal}){
 if(endpoint!=='https://kaia-glow.pages.dev/api/novabyte/contact')throw new Error('Configuração de envio indisponível.');
 if(honeypot||typeof captchaToken!=='string'||!captchaToken.trim()||captchaToken.length>2048)throw new Error('Aguarde a verificação automática antes de enviar.');
 if(!fields||typeof fields.name!=='string'||fields.name.length<2||fields.name.length>100||typeof fields.email!=='string'||fields.email.length>160||typeof fields.message!=='string'||fields.message.length<10||fields.message.length>5000)throw new Error('Confira os dados da solicitação.');
 const response=await fetchImpl(endpoint,{
  method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},signal,
  body:JSON.stringify({fields,captchaToken,honeypot,requestKey})
 });
 const result=await response.json();
 if(!response.ok||result?.success!==true)throw new Error('Não foi possível confirmar o envio. Seus dados foram mantidos; você pode tentar pelo WhatsApp.');
 return true;
}
