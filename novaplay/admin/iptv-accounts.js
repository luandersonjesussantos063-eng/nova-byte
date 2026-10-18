(()=>{
'use strict';
const $=id=>document.getElementById(id),server='https://nplay-live-gateway.luandersonjesussantos063.workers.dev';
let db,busy=false,deliveredUser=null;
const message=(text,error=false)=>{const n=$('iptv-status');n.textContent=text;n.classList.toggle('error',error);};
function password(){return [...crypto.getRandomValues(new Uint8Array(18))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function api(action,data){
 const auth=(await db.auth.getSession()).data.session;if(!auth?.access_token)throw Error('Entre como administrador para continuar.');
 const r=await fetch(server+'/admin/iptv',{method:'POST',headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,data})});
 const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||'Não foi possível concluir a ação.');return result.data;
}
function delivery(user,pass){
 deliveredUser=user;
 const query=new URLSearchParams({username:user,password:pass,type:'m3u_plus',output:'ts'});
 $('iptv-credentials').value=`NPlay — acesso IPTV\n\nServidor: ${server}\nUsuário: ${user}\nSenha: ${pass}\n\nLista M3U: ${server}/get.php?${query}\n\nEPG: ${server}/xmltv.php?${new URLSearchParams({username:user,password:pass})}\n\nNo aplicativo, escolha API Xtream / usuário e senha. Use HTTPS.`;
 $('iptv-delivery').hidden=false;
}

async function removeAccount(item,{confirmDelete=globalThis.confirm,request=api}={}){
 if(!confirmDelete('Excluir o acesso '+item.label+' ('+item.username+')? O login e suas sessões serão apagados.'))return false;
 const result=await request('delete',{id:item.id});
 if(result?.ok!==true||result.id!==item.id)throw Error('Não foi possível confirmar a exclusão. Atualize a lista.');
 return true;
}
window.NPlayIptvAdmin={removeAccount};


/* Safe connectivity probe: the username does not exist, so no real user's
   lockout counter, password, account settings or session can be touched. */
async function checkIptvServer(){
 const btn=$('iptv-check-server'),out=$('iptv-health-result');
 if(!btn||!out)return;
 btn.disabled=true;
 out.textContent='Verificando gateway e autenticação IPTV…';
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const health=await fetch(server+'/health',{method:'GET',cache:'no-store',signal:ctrl.signal});
  if(!health.ok){out.textContent='O servidor IPTV respondeu HTTP '+health.status+'. Verifique o gateway Cloudflare.';return;}
  // A nonexistent test user must receive 401 only AFTER the Worker has
  // successfully consulted the protected Supabase backend.
  const probe='/live/diag_gateway_check/SyntheticOnlyNotARealCredential2026/999999.ts';
  const login=await fetch(server+probe,{method:'HEAD',cache:'no-store',signal:ctrl.signal});
  if(login.status===401){
   out.textContent='✓ Gateway Cloudflare acessível.\n✓ Banco e serviço de login responderam corretamente.\nSe um aplicativo IPTV ainda falhar, confira o endereço HTTPS, usuário e senha do acesso. Se o login funcionar mas o vídeo não iniciar, o problema pode estar no receptor ou na fonte do canal.';
  }else if(login.status===503){
   out.textContent='Gateway online, mas houve falha HTTP 503 ao consultar a autenticação no banco. Confira a integração IPTV_BACKEND_KEY e Supabase.';
  }else if(login.status===429){
   out.textContent='O gateway respondeu HTTP 429 (muitas tentativas). Aguarde o limite do servidor e teste novamente.';
  }else{
   out.textContent='Gateway respondeu ao teste, mas o login não retornou o resultado esperado (HTTP '+login.status+'). Informe esse código ao suporte técnico.';
  }
 }catch(error){
  out.textContent=error?.name==='AbortError'?'O teste ultrapassou 12 segundos. Verifique a conexão e o gateway.':'Não foi possível acessar o gateway IPTV neste aparelho. Verifique DNS, HTTPS e conexão com a internet.';
 }finally{clearTimeout(timer);btn.disabled=false;}
}


/* Account-level diagnostic. Runs only after admin enters the existing client
   password; nothing is stored, logged, exposed in a URL, or changed in the DB.
   Uses POST (form-urlencoded) to avoid putting Xtream credentials in query logs. */
async function diagnoseIptvAccount(username,password,report){
 if(!/^[a-z0-9_]{4,40}$/.test(username)||password.length<12||password.length>128){
  report('Confira o usuário e informe a senha atual deste acesso (mínimo de 12 caracteres).');
  return {ok:false,stage:'input'};
 }
 const call=async action=>{
  const body=new URLSearchParams({username,password});
  if(action)body.set('action',action);
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),20000);
  try{
   const r=await fetch(server+'/player_api.php',{
    method:'POST',body,
    credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',
    cache:'no-store',signal:ctrl.signal
   });
   if(!r.ok)return {status:r.status,data:null};
   return {status:r.status,data:await r.json()};
  }finally{clearTimeout(timeout)}
 };
 try{
  report('1/2 · Verificando a autenticação da conta no servidor NPlay…');
  const login=await call(null);
  if(login.status!==200){
   report('A autenticação retornou HTTP '+login.status+'. O servidor está acessível, mas não concluiu o login da conta.');
   return {ok:false,stage:'login',status:login.status};
  }
  const info=login.data?.user_info;
  if(Number(info?.auth)!==1){
   const expired=info?.status==='Expired';
   report(expired?'A conta está expirada. Confira a validade no ADM.':'A conta não autenticou. Confira a senha atual e se o acesso está liberado.');
   return {ok:false,stage:'login',status:info?.status||'denied'};
  }
  const streamsInUse=Number(info?.active_cons)||0,limit=Number(info?.max_connections)||1;
  report('✓ Conta autenticada no servidor.\n2/2 · Verificando se a grade Xtream retorna os canais ao vivo…');
  const result=await call('get_live_streams');
  if(result.status!==200){
   report('✓ Login aceito.\n✕ Falha ao carregar a grade (HTTP '+result.status+'). O problema está na consulta ao catálogo.');
   return {ok:false,stage:'catalog',status:result.status};
  }
  if(!Array.isArray(result.data)){
   report('✓ Login aceito.\n✕ O servidor retornou uma lista em formato inesperado. O aplicativo IPTV pode não conseguir lê-la.');
   return {ok:false,stage:'catalog-format'};
  }
  const count=result.data.length;
  report('✓ Login da conta confirmado.\n✓ Grade Xtream carregada: '+count+' canais ao vivo.\nTransmissões em uso: '+streamsInUse+'/'+limit+'.'+
    (count?'\nSe os canais ainda não abrirem, a próxima falha está na reprodução do sinal ou na compatibilidade do aplicativo, não no login nem na lista.':'\nA grade veio vazia. Verifique as permissões de canais deste acesso.'));
  return {ok:count>0,stage:count>0?'catalog-ok':'catalog-empty',count};
 }catch(error){
  const timed=error?.name==='AbortError';
  report(timed?'O servidor demorou mais de 20 segundos para responder.':'Não foi possível completar o teste da conta. Verifique a conexão HTTPS com o gateway.');
  return {ok:false,stage:timed?'timeout':'network'};
 }
}

async function update(item,data){await api('update',{id:item.id,...data});await refresh();}
async function refresh(){
 try{
 const items=await api('list');$('iptv-list').replaceChildren();
 for(const x of items){
  const row=document.createElement('article');row.style.cssText='border:1px solid #365075;border-radius:14px;padding:16px;margin:12px 0';
  const title=document.createElement('h3');title.textContent=x.label+' · '+x.username;
  const info=document.createElement('p');const expired=Date.parse(x.expires_at)<Date.now();info.textContent=(x.enabled?(expired?'Expirado':'Ativo'):'Bloqueado')+' · validade '+new Date(x.expires_at).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'})+' · '+x.active_connections+'/'+x.max_connections+' transmissões';
  row.append(title,info);
  const add=(label,handler)=>{const b=document.createElement('button');b.type='button';b.className='outline';b.style.margin='4px';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await handler();}catch(e){message(e.message,true);}finally{b.disabled=false;}};row.append(b);};
  add(x.enabled?'Bloquear':'Desbloquear',()=>update(x,{enabled:!x.enabled}));
  add('Excluir acesso',async()=>{if(!await removeAccount(x))return;if(deliveredUser===x.username){$('iptv-credentials').value='';$('iptv-delivery').hidden=true;deliveredUser=null;}await refresh();message('Acesso '+x.username+' excluído.');});
  add('Renovar 30 dias',()=>{const base=Math.max(Date.now(),Date.parse(x.expires_at));return update(x,{expires_at:new Date(base+30*86400000).toISOString(),enabled:true});});
  add('Redefinir senha',async()=>{if(!confirm('A senha anterior deixará de funcionar. Redefinir o acesso de '+x.username+'?'))return;const pass=password();await update(x,{password:pass});delivery(x.username,pass);});
  const label=document.createElement('label');label.textContent='Transmissões simultâneas';const select=document.createElement('select');for(const n of [1,2,3]){const o=document.createElement('option');o.value=n;o.textContent=n;select.append(o);}select.value=x.max_connections;select.onchange=async()=>{select.disabled=true;try{await update(x,{max_connections:Number(select.value)});}catch(e){message(e.message,true);}finally{select.disabled=false;}};label.append(select);row.append(label);
  const check=document.createElement('details');
  check.style.cssText='margin:14px 0 0;border-top:1px solid #365075;padding-top:12px';
  const labelCheck=document.createElement('summary');
  labelCheck.textContent='Verificar login e canais deste acesso';
  labelCheck.style.cssText='cursor:pointer;font-weight:700;margin-bottom:8px';
  const help=document.createElement('p');help.className='muted';
  help.textContent='Digite a senha atual para testar a conta, sem redefini-la. A senha não é salva nem aparece no resultado.';
  const secret=document.createElement('input');
  secret.type='password';secret.placeholder='Senha atual do acesso';
  secret.autocomplete='off';secret.autocapitalize='off';
  secret.spellcheck=false;secret.minLength=12;secret.maxLength=128;
  secret.setAttribute('aria-label','Senha atual de '+x.username);
  secret.style.cssText='width:100%;margin:4px 0 10px';
  const runCheck=document.createElement('button');
  runCheck.type='button';runCheck.className='outline';runCheck.textContent='Testar login e grade Xtream';
  const checkResult=document.createElement('p');
  checkResult.setAttribute('role','status');checkResult.setAttribute('aria-live','polite');
  checkResult.style.cssText='white-space:pre-line;overflow-wrap:anywhere;margin:10px 0;font-size:13px';
  runCheck.onclick=async()=>{
   if(runCheck.disabled)return;
   const entered=secret.value;secret.value='';
   runCheck.disabled=true;
   try{await diagnoseIptvAccount(x.username,entered,text=>{checkResult.textContent=text})}
   finally{runCheck.disabled=false}
  };
  check.append(labelCheck,help,secret,runCheck,checkResult);
  row.append(check);
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
 $('iptv-check-server').onclick=checkIptvServer;
 $('iptv-create').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;$('iptv-save').disabled=true;
 try{const user=$('iptv-username').value.trim().toLowerCase(),pass=$('iptv-password').value;
 await api('create',{username:user,password:pass,label:$('iptv-label').value.trim(),expires_at:new Date($('iptv-expiry').value+'T23:59:59-04:00').toISOString(),max_connections:Number($('iptv-screens').value),allow_live:$('iptv-live').checked,allow_vod:$('iptv-vod').checked});
 $('iptv-password').value='';delivery(user,pass);await refresh();message('Acesso criado. Copie os dados e cadastre no aplicativo IPTV.');
 }catch(e){message(e.message,true);}finally{busy=false;$('iptv-save').disabled=false;}};
 document.querySelector('[data-admin-tab="iptv"]')?.addEventListener('click',refresh);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
