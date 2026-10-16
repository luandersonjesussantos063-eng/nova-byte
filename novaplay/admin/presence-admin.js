(()=>{
'use strict';
const panel=document.getElementById('nplay-presence-admin');if(!panel)return;
const list=document.getElementById('presence-list'),message=document.getElementById('presence-status');let db,busy=false;
function duration(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));return n>=3600?Math.floor(n/3600)+'h '+Math.floor(n%3600/60)+'min':n>=60?Math.floor(n/60)+'min '+n%60+'s':n+'s';}
async function refresh(){
 if(busy||panel.hidden||document.getElementById('dashboard')?.hidden||document.hidden)return;
 if(!window.supabase?.createClient){message.textContent='Aguardando conexão com o painel...';return;}
 busy=true;
 try{
  db??=window.supabase.createClient('https://vajlhodqxskozuxxlujv.supabase.co','sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3');
  const {data,error}=await db.rpc('novaplay_profiles_online');if(error)throw error;
  list.replaceChildren();let online=0;
  for(const row of data||[]){
   const recent=new Date(row.server_now)-new Date(row.last_seen)<=75000;
   const active=recent&&row.is_visible;if(active)online++;
   const card=document.createElement('article');card.className='presence-card';
   const title=document.createElement('strong');title.textContent=row.profile_name;
   const state=document.createElement('span');state.className='presence-state'+(active?' online':'');state.textContent=active?'● Online':recent?'Em segundo plano':'Offline';
   const device=document.createElement('small');device.textContent='Aparelho '+row.user_id.slice(0,8).toUpperCase();
   const times=document.createElement('p');times.textContent='Sessão '+(active?'atual':'anterior')+': '+duration(row.session_seconds)+' · Hoje: '+duration(row.today_seconds);
   const seen=document.createElement('small');seen.textContent='Último sinal: '+new Date(row.last_seen).toLocaleString('pt-BR',{timeZone:'America/Campo_Grande'});
   card.append(title,state,device,times,seen);list.append(card);
  }
  message.textContent=online+' perfil(is) online · '+(data||[]).length+' perfil(is) registrados'+((data||[]).length===500?' · Mostrando os 500 mais recentes':'')+' · Atualizado às '+new Date().toLocaleTimeString('pt-BR');
  if(!data?.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='Nenhum perfil registrado ainda. A contagem começa quando um aparelho abre a versão atualizada e seleciona um perfil.';list.append(empty);}
 }catch{message.textContent='Não foi possível consultar os perfis. Confira sua sessão administrativa e tente atualizar.';}finally{busy=false;}
}
document.getElementById('presence-refresh').addEventListener('click',refresh);
new MutationObserver(refresh).observe(panel,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(refresh).observe(document.getElementById('dashboard'),{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',refresh);setInterval(refresh,30000);refresh();
})();
