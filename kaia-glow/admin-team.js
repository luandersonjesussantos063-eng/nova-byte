let client=null,owner=false;
const $=id=>document.getElementById(id);
const note=(txt,err=false)=>{const n=$('teamStatus');if(n){n.textContent=txt;n.classList.toggle('error',err)}};
export async function loadKaiaTeam(){
 if(!owner||!client)return;
 const {data,error}=await client.rpc('kaia_owner_list_admins');
 if(error){note('Não foi possível consultar a equipe. Confira o acesso do proprietário.',true);return;}
 const root=$('teamList');root.replaceChildren();
 for(const person of data||[]){
  const card=document.createElement('article');card.className='coupon-entry';
  const head=document.createElement('div');head.className='head';
  const mail=document.createElement('strong');mail.textContent=person.email;
  const badge=document.createElement('span');badge.className='status';
  badge.textContent=person.owner?'Proprietário':person.verified?'Administrador':'Aguardando cadastro e confirmação';
  head.append(mail,badge);card.append(head);
  const date=document.createElement('p');date.className='muted';
  date.textContent='Autorização registrada em '+new Date(person.addedAt).toLocaleDateString('pt-BR');
  card.append(date);
  if(!person.owner){
   const revoke=document.createElement('button');revoke.type='button';revoke.className='ghost-button';
   revoke.textContent='Remover acesso';
   revoke.onclick=async()=>{
    if(!confirm('Retirar o acesso administrativo de '+person.email+'?'))return;
    revoke.disabled=true;
    const {error}=await client.rpc('kaia_owner_set_admin',{p_email:person.email,p_enabled:false});
    if(error){note(error.message||'Não foi possível remover o acesso.',true);revoke.disabled=false;return}
    note('Acesso removido com sucesso.');await loadKaiaTeam();
   };
   card.append(revoke);
  }
  root.append(card);
 }
 if(!(data||[]).length)root.textContent='Não há contas autorizadas.';
}
export async function setupKaiaTeam(sb,ownerStatus){
 client=sb;owner=ownerStatus===true;
 const btn=document.querySelector('[data-tab="team"]');if(btn)btn.hidden=!owner;
 if(!owner)return;
 $('teamForm').onsubmit=async e=>{
  e.preventDefault();
  const email=$('teamEmail').value.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){note('Confira o e-mail.',true);return}
  const button=$('teamForm').querySelector('button[type=submit]');
  button.disabled=true;note('Verificando a conta e o e-mail confirmado…');
  const {error}=await client.rpc('kaia_owner_set_admin',{p_email:email,p_enabled:true});
  if(error){note(error.message?.includes('CADASTRE_E_CONFIRME')?
   'Essa pessoa ainda precisa cadastrar a conta e confirmar o e-mail no site antes de receber acesso.':
   'Não foi possível autorizar: '+error.message,true);}
  else{$('teamEmail').value='';note('Administrador autorizado com sucesso.');await loadKaiaTeam()}
  button.disabled=false;
 };
 await loadKaiaTeam();
}
