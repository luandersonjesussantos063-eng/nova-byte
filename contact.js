import {sendContactEmail} from './contact-email.js';
/* No automatic transmission. The visitor chooses email or WhatsApp. */
(()=>{
 'use strict';
 const form=document.querySelector('[data-contact-whatsapp]');
 if(form){
  const prepare=form.querySelector('[data-prepare-message]');
  const preview=form.querySelector('[data-contact-preview]');
  const link=form.querySelector('[data-whatsapp-message]');
  const emailButton=form.querySelector('[data-send-email]');
  const emailStatus=form.querySelector('[data-email-status]');
  const config=window.NovaByteContactConfig;
  const emailEnabled=config?.emailEnabled===true&&Boolean(config.accessKey?.trim());
  if(emailEnabled){
   emailButton.hidden=false;
   emailButton.disabled=false;
   document.querySelector('[data-contact-intro]').textContent='Conte o que você precisa e escolha enviar por e-mail ou conversar pelo WhatsApp.';
   document.querySelector('.contact-notice').hidden=true;
   form.querySelector('[data-contact-note]').textContent='* Campos obrigatórios. Para enviar por e-mail, informe seu e-mail. O envio é processado pelo Web3Forms. Se preferir WhatsApp, confira a mensagem e confirme no aplicativo.';
  }
  emailButton.addEventListener('click',async()=>{
   if(!emailEnabled)return;
   const email=form.querySelector('#contact-email');
   email.required=true;
   const valid=form.reportValidity();
   email.required=false;
   if(!valid)return;
   emailButton.disabled=true;prepare.disabled=true;
   emailStatus.hidden=false;emailStatus.dataset.state='pending';
   emailStatus.textContent='Enviando sua solicitação…';
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),15000);
   const value=id=>form.querySelector('#'+id).value.trim();
   try{
    await sendContactEmail({accessKey:config.accessKey,signal:controller.signal,fields:{
     name:value('contact-name'),email:value('contact-email'),phone:value('contact-phone'),
     service:value('contact-service'),message:value('contact-message')
    }});
    emailStatus.dataset.state='success';
    emailStatus.textContent='Solicitação recebida pelo serviço de envio. Obrigado! A NovaByte responderá pelo contato informado.';
   }catch{
    emailStatus.dataset.state='error';
    emailStatus.textContent='Não foi possível confirmar o envio por e-mail. Seus dados continuam aqui. Use “Preparar mensagem para o WhatsApp” para continuar.';
   }finally{
    clearTimeout(timeout);emailButton.disabled=false;prepare.disabled=false;
    emailStatus.focus();
   }
  });
  const resetPreview=()=>{preview.hidden=true;link.removeAttribute('href')};
  form.addEventListener('input',resetPreview);
  form.addEventListener('change',resetPreview);
  form.addEventListener('submit',event=>{
   event.preventDefault();
   if(!form.reportValidity())return;
   const value=id=>form.querySelector('#'+id).value.trim();
   const lines=['Olá, NovaByte! Quero conversar sobre um projeto.','',
    'Nome: '+value('contact-name'),'Serviço: '+value('contact-service')];
   if(value('contact-email'))lines.push('E-mail: '+value('contact-email'));
   if(value('contact-phone'))lines.push('WhatsApp: '+value('contact-phone'));
   lines.push('','Meu projeto:',value('contact-message'));
   const message=lines.join('\n');
   form.querySelector('[data-message-preview]').textContent=message;
   link.href='https://wa.me/5531983771576?text='+encodeURIComponent(message);
   preview.hidden=false;
   form.querySelector('#preview-title').focus();
  });
  prepare.disabled=false;
 }
 const button=document.querySelector('[data-load-map]');
 button?.addEventListener('click',()=>{
  const container=document.querySelector('[data-map-container]');
  const frame=document.createElement('iframe');
  frame.title='Localização da NovaByte Soluções no Google Maps';
  const status=document.querySelector('[data-map-status]');
  status.textContent='Carregando mapa do Google… Se ele não aparecer, use “Abrir no Google Maps”.';
  frame.addEventListener('load',()=>{status.textContent='Mapa do Google carregado. Você também pode usar o link “Abrir no Google Maps”.'});
  frame.src=button.dataset.mapSrc;
  frame.loading='lazy';
  frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.allowFullscreen=true;
  container.replaceChildren(frame);
  container.classList.add('is-loaded');
 });
})();
