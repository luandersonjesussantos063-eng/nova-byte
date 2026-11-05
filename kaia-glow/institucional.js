// Only optional, public Kaia preferences. Never clear authentication or another site.
document.querySelectorAll('[data-clear-kaia-preferences]').forEach(button=>button.addEventListener('click',()=>{
 const status=document.querySelector('[data-kaia-preferences-status]');
 try{localStorage.removeItem('kaia-demo-favorites');localStorage.removeItem('kaia-pending-referral-v1');sessionStorage.removeItem('kaia-referral-seen-v1');if(status)status.textContent='Favoritos e convite removidos deste navegador. Sua conta e seus pedidos não foram alterados.';}
 catch{if(status)status.textContent='O navegador não permitiu limpar os dados. Você pode gerenciar os dados do site nas configurações do navegador.';}
}));
