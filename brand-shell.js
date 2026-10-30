/* Native disclosure navigation shared by articles and service pages. */
(()=>{
 'use strict';
 const menu=document.querySelector('.nb-site-menu');
 if(!menu)return;
 document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false});
 menu.addEventListener('click',event=>{if(event.target.closest('a'))menu.open=false});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus()}});
})();
