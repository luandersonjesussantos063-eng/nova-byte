(()=>{
'use strict';
const $=id=>document.getElementById(id),server='https://nplay-live-gateway.luandersonjesussantos063.workers.dev';
let db,busy=false;
const message=(text,error=false)=>{const n=$('iptv-status');n.textContent=text;n.classList.toggle('error',error);};
function password(){return [...crypto.getRandomValues(new Uint8Array(18))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function api(action,data){
 const auth=(await db.auth.getSession()).data.session;if(!auth?.access_token)throw Error('Entre como administrador para continuar.');
 const r=await fetch(server+'/admin/iptv',{method:'POST',headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,data})});
 const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||'Não foi possível concluir a ação.');return result.data;
}
function delivery(user,pass){
 const query=new URLSearchParams({username:user,password:pass,type:'m3u_plus',output:'ts'});
 $('iptv-credentials').value=`NPlay — acesso IPTV\n\nServidor: ${server}\nUsuário: ${user}\nSenha: ${pass}\n\nLista M3U: ${server}/get.php?${query}\n\nEPG: ${server}/xmltv.php?${new URLSearchParams({username:user,password:pass})}\n\nNo aplicativo, escolha API Xtream / usuário e senha. Use HTTPS.`;
 $('iptv-delivery').hidden=false;
}
async function update(item,data){await api('update',{id:item.id,...data});await refresh();}
async function refresh(){
 try{
 const items=await api('list');$('iptv-list').replaceChildren();
 for(const x of items){
  const row=document.createElement('article');row.style.cssText='border:1px solid #365075;border-radius:14px;padding:16px;margin:12px 0';
  const title=document.createElement('h3');title.textContent=x.label+' · '+x.username;
  const info=document.createElement('p');const expired=Date.parse(x.expires_at)<Date.now();info.textContent=(x.enabled?(expired?'Expirado':'Ativo'):'Bloqueado')+' · validade '+new Date(x.expires_at).toLocaleDateString('pt-BR')+' · '+x.active_connections+'/'+x.max_connections+' transmissões';
  row.append(title,info);
  const add=(label,handler)=>{const b=document.createElement('button');b.type='button';b.className='outline';b.style.margin='4px';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await handler();}catch(e){message(e.message,true);}finally{b.disabled=false;}};row.append(b);};
  add(x.enabled?'Bloquear':'Desbloquear',()=>update(x,{enabled:!x.enabled}));
  add('Renovar 30 dias',()=>{const base=Math.max(Date.now(),Date.parse(x.expires_at));return update(x,{expires_at:new Date(base+30*86400000).toISOString(),enabled:true});});
  add('Redefinir senha',async()=>{if(!confirm('A senha anterior deixará de funcionar. Redefinir o acesso de '+x.username+'?'))return;const pass=password();await update(x,{password:pass});delivery(x.username,pass);});
  const label=document.createElement('label');label.textContent='Transmissões simultâneas';const select=document.createElement('select');for(const n of [1,2,3]){const o=document.createElement('option');o.value=n;o.textContent=n;select.append(o);}select.value=x.max_connections;select.onchange=async()=>{select.disabled=true;try{await update(x,{max_connections:Number(select.value)});}catch(e){message(e.message,true);}finally{select.disabled=false;}};label.append(select);row.append(label);
  $('iptv-list').append(row);
 }
 message(items.length+' acessos IPTV cadastrados.');
 }catch(e){message(e.message,true);}
}
function start(){
 if(!window.supabase?.createClient){setTimeout(start,300);return;}
 db=window.supabase.createClient('https://vajlhodqxskozuxxlujv.supabase.co','sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3');
 const username=$('iptv-username');
 const normalizeUsername=()=>{
  const position=username.selectionStart,next=username.value.toLowerCase();
  if(next!==username.value){username.value=next;if(position!==null)username.setSelectionRange(position,position);}
  username.setCustomValidity('');
 };
 username.addEventListener('input',normalizeUsername);
 username.addEventListener('blur',()=>{username.value=username.value.trim();normalizeUsername();});
 username.addEventListener('invalid',()=>{if(username.validity.patternMismatch||username.validity.tooShort)username.setCustomValidity('Use de 4 a 40 letras, números ou sublinhado (_), sem espaços ou acentos.');});
 $('iptv-expiry').value=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 $('iptv-generate').onclick=()=>{$('iptv-password').value=password();message('Senha gerada. Ela será mostrada na entrega após criar o acesso.');};
 $('iptv-hide').onclick=()=>{$('iptv-credentials').value='';$('iptv-delivery').hidden=true;};
 $('iptv-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('iptv-credentials').value);message('Acesso copiado.');}catch{$('iptv-credentials').select();message('Selecione e copie os dados acima.');}};
 $('iptv-refresh').onclick=refresh;
 $('iptv-create').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;$('iptv-save').disabled=true;
 try{const user=$('iptv-username').value.trim().toLowerCase(),pass=$('iptv-password').value;
 await api('create',{username:user,password:pass,label:$('iptv-label').value.trim(),expires_at:new Date($('iptv-expiry').value+'T23:59:59-04:00').toISOString(),max_connections:Number($('iptv-screens').value),allow_live:$('iptv-live').checked,allow_vod:$('iptv-vod').checked});
 $('iptv-password').value='';delivery(user,pass);await refresh();message('Acesso criado. Copie os dados e cadastre no aplicativo IPTV.');
 }catch(e){message(e.message,true);}finally{busy=false;$('iptv-save').disabled=false;}};
 document.querySelector('[data-admin-tab="iptv"]')?.addEventListener('click',refresh);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
