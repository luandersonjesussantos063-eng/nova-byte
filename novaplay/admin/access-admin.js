(()=>{
'use strict';
const $=id=>document.getElementById(id);
const url='https://vajlhodqxskozuxxlujv.supabase.co',key='sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3';
let db,requests=[],adminIds=new Set(),loading=false;
const labels={pending:'Pendente',approved:'Aprovado',denied:'Recusado',revoked:'Revogado'};
function filterRequests(items,query='',state='all'){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),search=normalize(query).trim();
 return items.filter(item=>(state==='all'||item.status===state)&&(!search||normalize([item.display_name,item.user_id,item.device_label].join(' ')).includes(search)));
}
function deviceName(raw=''){
 const os=/iPad/i.test(raw)?'iPad':/iPhone/i.test(raw)?'iPhone':/Android/i.test(raw)?'Android':/Windows/i.test(raw)?'Windows':/Mac OS|Macintosh/i.test(raw)?'Mac':/Linux/i.test(raw)?'Linux':'Dispositivo';
 const browser=/Edg\//.test(raw)?'Edge':/OPR\//.test(raw)?'Opera':/Firefox\//.test(raw)?'Firefox':/Chrome\/|CriOS\//.test(raw)?'Chrome':/Safari\//.test(raw)?'Safari':'Navegador';
 return os+' · '+browser;
}
function render(){
 const list=$('nplay-access-admin-list');list.replaceChildren();
 const filtered=filterRequests(requests,$('access-search')?.value||'',$('access-filter')?.value||'all');
 $('nplay-access-admin-status').textContent=filtered.length+' de '+requests.length+' solicitações · '+requests.filter(x=>x.status==='pending').length+' pendentes';
 for(const item of filtered){
  const row=document.createElement('article');row.className='admin-access-card';
  const title=document.createElement('strong');title.textContent=item.display_name||'Cadastro sem nome';
  const status=document.createElement('p');status.textContent=(labels[item.status]||'Situação desconhecida')+' · '+(adminIds.has(item.user_id)?'Administrador':'Cliente');
  const info=document.createElement('p');info.textContent=deviceName(item.device_label)+' · '+new Date(item.created_at).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'});
  row.append(title,status,info);
  const actions=document.createElement('div');actions.className='admin-client-actions';
  for(const [state,label] of [['approved','Aprovar'],['denied','Recusar'],['revoked','Revogar']]){
   if(state===item.status||state==='denied'&&item.status!=='pending'||state==='revoked'&&item.status!=='approved')continue;
   const button=document.createElement('button');button.type='button';button.textContent=label;button.className=state==='approved'?'primary':'outline danger';
   button.onclick=async()=>{if(!confirm(label+' acesso de '+(item.display_name||'este cliente')+'?'))return;button.disabled=true;try{const {data,error}=await db.from('novaplay_access_requests').update({status:state,updated_at:new Date().toISOString()}).eq('user_id',item.user_id).select('user_id');if(error)throw error;if(!data?.some(x=>x.user_id===item.user_id))throw Error('A alteração não foi confirmada. Atualize a lista.');await refresh();}catch(error){$('nplay-access-admin-status').textContent='Não foi possível alterar o acesso: '+error.message;button.disabled=false;}};
   actions.append(button);
  }
  row.append(actions);
  const technical=document.createElement('details');technical.className='admin-device-detail';const summary=document.createElement('summary');summary.textContent='Identificação do aparelho';const code=document.createElement('p');code.textContent='Código: '+item.user_id.slice(0,8).toUpperCase();const raw=document.createElement('p');raw.textContent=item.device_label||'Identificação não informada';technical.append(summary,code,raw);row.append(technical);
  if(item.status==='approved'||adminIds.has(item.user_id)){
   const details=document.createElement('details');details.className='admin-device-detail';const heading=document.createElement('summary');heading.textContent='Permissões administrativas';details.append(heading);
   const isAdmin=adminIds.has(item.user_id),toggle=document.createElement('button');toggle.type='button';toggle.className='outline';toggle.textContent=isAdmin?'Retirar ADM':'Tornar ADM';
   toggle.onclick=async()=>{if(!confirm((isAdmin?'Retirar permissão administrativa deste aparelho?':'Conceder acesso ao painel ADM para este aparelho?')+'\nCliente: '+(item.display_name||'Sem nome')+'\nCódigo: '+item.user_id.slice(0,8).toUpperCase()))return;toggle.disabled=true;try{const {error}=await db.rpc('nplay_set_device_admin',{target_user:item.user_id,make_admin:!isAdmin});if(error)throw error;await refresh();}catch(error){$('nplay-access-admin-status').textContent=error.message==='CANNOT_REMOVE_LAST_ADMIN'?'Não é possível retirar o último administrador.':error.message;toggle.disabled=false;}};
   details.append(toggle);row.append(details);
  }
  list.append(row);
 }
 if(!filtered.length){const empty=document.createElement('p');empty.className='admin-empty';empty.textContent=requests.length?'Nenhuma solicitação corresponde a este filtro.':'Nenhuma solicitação de acesso registrada.';list.append(empty);}
}
async function refresh(){
 if(loading)return;loading=true;$('nplay-access-refresh').disabled=true;
 try{
  const {data:{user}}=await db.auth.getUser();if(!user)throw Error('Entre como administrador para visualizar solicitações.');
  const {data:admin,error:adminError}=await db.from('novaplay_admins').select('user_id').eq('user_id',user.id).maybeSingle();if(adminError||!admin)throw Error('Somente administradores podem visualizar esta área.');
  const {data,error}=await db.from('novaplay_access_requests').select('user_id,display_name,device_label,status,created_at').order('created_at',{ascending:false}).limit(200);if(error)throw error;
  const {data:admins,error:roleError}=await db.rpc('nplay_list_device_admins');if(roleError)throw roleError;
  requests=data||[];adminIds=new Set((admins||[]).map(x=>x.user_id));render();
 }catch(error){$('nplay-access-admin-status').textContent=error.message;}
 finally{loading=false;$('nplay-access-refresh').disabled=false;}
}
function start(){if(!window.supabase?.createClient){setTimeout(start,300);return;}db=window.supabase.createClient(url,key);$('nplay-access-refresh')?.addEventListener('click',refresh);$('access-search')?.addEventListener('input',render);$('access-filter')?.addEventListener('change',render);document.querySelector('[data-admin-tab="acessos"]')?.addEventListener('click',refresh);refresh();}
window.NPlayAccessAdmin={filterRequests,deviceName};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
