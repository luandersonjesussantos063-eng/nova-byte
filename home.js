/* Navegação e melhorias progressivas da vitrine NovaByte. Sem envio de formulários. */
(()=>{
 'use strict';
 const menu=document.getElementById('studio-menu'),toggle=document.querySelector('.menu-toggle');
 const setMenu=open=>{menu?.classList.toggle('is-open',open);toggle?.setAttribute('aria-expanded',String(open));toggle?.setAttribute('aria-label',open?'Fechar menu':'Abrir menu')};
 toggle?.addEventListener('click',()=>setMenu(toggle.getAttribute('aria-expanded')!=='true'));
 menu?.addEventListener('click',event=>{if(event.target.closest('a'))setMenu(false)});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){setMenu(false);toggle.focus()}});
 document.addEventListener('click',event=>{if(!event.target.closest('.studio-nav'))setMenu(false)});
 window.matchMedia('(min-width:901px)').addEventListener('change',event=>{if(event.matches)setMenu(false)});
 const cards=[...document.querySelectorAll('.project-card[data-category]')];
 document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
  const filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>{const active=b===button;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active))});
  for(const card of cards)card.hidden=filter!=='all'&&card.dataset.category!==filter;
  const count=cards.filter(c=>!c.hidden).length;const label=document.getElementById('project-count');if(label)label.textContent=`${count} ${count===1?'projeto apresentado':'projetos apresentados'}`;
 }));
 const motion=window.matchMedia('(prefers-reduced-motion:reduce)'),pause=document.querySelector('.preview-motion');let userPaused=false;
 function updateMotion(){const paused=motion.matches||userPaused;document.body.classList.toggle('previews-paused',paused);if(pause){pause.textContent=paused?'Retomar prévias':'Pausar prévias';pause.setAttribute('aria-pressed',String(paused));pause.disabled=motion.matches;if(motion.matches)pause.textContent='Movimento reduzido'}}
 pause?.addEventListener('click',()=>{userPaused=!userPaused;updateMotion()});motion.addEventListener('change',updateMotion);updateMotion();
 if('IntersectionObserver' in window){
  const reveal=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-visible');reveal.unobserve(e.target)}},{threshold:.08});
  if(!motion.matches)for(const element of document.querySelectorAll('.reveal')){element.classList.add('reveal-wait');reveal.observe(element)}
  const previews=new IntersectionObserver(entries=>{for(const e of entries){const frame=e.target.querySelector('iframe');if(e.isIntersecting&&frame?.dataset.src&&!frame.src){frame.src=frame.dataset.src;frame.addEventListener('load',()=>e.target.classList.add('preview-loaded'),{once:true})}e.target.classList.toggle('preview-running',e.isIntersecting)}},{rootMargin:'150px'});
  document.querySelectorAll('.site-scroll-preview').forEach(e=>previews.observe(e));
 }else for(const frame of document.querySelectorAll('iframe[data-src]'))frame.src=frame.dataset.src;
})();
