/* The form submits directly to FormSubmit; no visitor data is stored in the browser. */
(()=>{
 'use strict';
 const button=document.querySelector('[data-load-map]');
 button?.addEventListener('click',()=>{
  const container=document.querySelector('[data-map-container]');
  const frame=document.createElement('iframe');
  frame.title='Localização da NovaByte Soluções no Google Maps';
  frame.src=button.dataset.mapSrc;
  frame.loading='lazy';
  frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.allowFullscreen=true;
  container.replaceChildren(frame);
  container.classList.add('is-loaded');
  const status=document.querySelector('[data-map-status]');
  status.textContent='Mapa do Google carregado. Você também pode usar o link “Abrir no Google Maps”.';
 });
})();
