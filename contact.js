/* Contact details stay in memory until the visitor explicitly opens WhatsApp. */
(()=>{
 'use strict';
 const form=document.querySelector('[data-contact-whatsapp]');
 if(form){
  const prepare=form.querySelector('[data-prepare-message]');
  const preview=form.querySelector('[data-contact-preview]');
  const link=form.querySelector('[data-whatsapp-message]');
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
