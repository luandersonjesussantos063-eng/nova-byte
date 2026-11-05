import { digits, validateCustomer } from './customer-validation.js';
import { KAIA_AUTH } from './auth-config.js';
const $ = s => document.querySelector(s);
const all = s => [...document.querySelectorAll(s)];
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params = new URLSearchParams(location.search);
const validCode = code => /^[a-f0-9]{20}$/.test(code||'');
const REF_KEY = 'kaia-pending-referral-v1';
let pendingCode = params.get('indicacao');
try {
 if(validCode(pendingCode)) localStorage.setItem(REF_KEY,JSON.stringify({code:pendingCode,at:Date.now()}));
 else {const saved=JSON.parse(localStorage.getItem(REF_KEY)||'null');pendingCode=saved&&Date.now()-saved.at<30*86400000?saved.code:null;}
} catch {}
if(!validCode(pendingCode))pendingCode=null;
const status = (text='',error=false) => {$('#accountStatus').textContent=text;$('#accountStatus').classList.toggle('error',error);};
const supa = window.supabase?.createClient(KAIA_AUTH.url,KAIA_AUTH.publishableKey,{auth:{storageKey:'kaia-glow-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const stagingEmailBlocked = KAIA_AUTH.isStaging && !KAIA_AUTH.stagingEmailRedirectReady;
if(stagingEmailBlocked){const note=document.createElement('p');note.setAttribute('role','note');note.textContent='Homologação: novos cadastros e e-mails de recuperação ficam pausados até validar os retornos no Supabase. O login de contas existentes permanece disponível.';note.style.cssText='padding:12px 16px;border:1px solid #ddbdcb;border-radius:10px;background:#f8eef2;color:#6b354e;line-height:1.5';document.querySelector('.account-heading')?.appendChild(note);}
let mode=params.get('modo')==='cadastro'?'signup':'login', user=null, customer=null, sequence=0, recovery=params.get('redefinir')==='1',authBusy=false,initializing=true,profileRequired=false;
function friendly(error){
 const code=error?.code||'';
 if(code==='unexpected_failure'||error?.status>=500)return 'Não conseguimos enviar ou concluir sua solicitação agora. Tente novamente em alguns minutos ou fale com a Kaia.';
 if(code==='invalid_credentials')return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
 if(code==='email_not_confirmed'){$('#resendConfirmation').hidden=false;return 'Confirme seu e-mail antes de entrar. Verifique também a caixa de spam.';}
 if(code.includes('rate_limit')||error?.status===429)return 'Aguarde alguns minutos antes de tentar novamente.';
 if(code==='user_already_exists')return 'Este e-mail já tem cadastro. Entre ou recupere sua senha.';
 if(code==='weak_password')return 'Escolha uma senha mais forte, com pelo menos 10 caracteres, letras e números.';
 if(code==='email_address_not_authorized')return 'O serviço de e-mail não autorizou o envio para este endereço. Fale com a Kaia para concluir o acesso.';
 if(code==='signup_disabled')return 'Novos cadastros estão temporariamente indisponíveis. Fale com a Kaia.';
 if(error?.message?.includes('fetch')||error?.name==='TypeError')return 'Não foi possível conectar. Confira sua internet e tente novamente.';
 return 'Não foi possível concluir agora. Tente novamente ou fale com a Kaia.';
}
function setMode(next,clear=true){
 mode=next;$('#termsField').hidden=next!=='signup';$('#termsAccepted').required=next==='signup';$('#termsAccepted').checked=false;$('#authPanel').hidden=false;$('#memberPanel').hidden=true;
 $('#authPanel .auth-switch').hidden=!['login','signup'].includes(next);
 all('[data-auth-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.authMode===next);b.setAttribute('aria-pressed',String(b.dataset.authMode===next));});
 const withName=['signup','complete'].includes(next),withPassword=['login','signup','newpassword'].includes(next);
 $('#nameField').hidden=!withName;$('#accountName').required=withName;
 $('#emailField').hidden=['newpassword','complete'].includes(next);$('#accountEmail').required=!$('#emailField').hidden;
 $('#passwordField').hidden=!withPassword;$('#accountPassword').required=withPassword;
 $('#accountPassword').autocomplete=next==='login'?'current-password':'new-password';$('#accountPassword').minLength=next==='login'?1:10;
 $('#passwordHint').hidden=!['signup','newpassword'].includes(next);
 $('#accountPassword').value='';$('#accountPassword').type='password';$('#togglePassword').textContent='Mostrar';$('#togglePassword').setAttribute('aria-pressed','false');
 $('#backToLogin').hidden=next!=='reset';$('#forgotPassword').hidden=next!=='login';$('#resendConfirmation').hidden=true;
 const titles={login:'Que bom ter você aqui.',signup:'Seu primeiro cuidado começa aqui.',reset:'Vamos recuperar seu acesso.',newpassword:'Escolha uma nova senha.',complete:'Como podemos chamar você?'};
 const descriptions={login:'Entre com seu e-mail e sua senha.',signup:'Etapa 1 de 2: crie seu acesso e confirme o e-mail. Depois, complete CPF, nascimento, telefone e endereço de entrega.',reset:'Enviaremos um link para você redefinir sua senha.',newpassword:'Use uma senha que você ainda não utiliza em outros sites.',complete:'Complete seu nome para criar seu espaço na Kaia Glow.'};
 const labels={login:'Entrar na minha conta',signup:'Criar minha conta',reset:'Enviar link de recuperação',newpassword:'Salvar nova senha',complete:'Salvar e continuar'};
 $('#authTitle').textContent=titles[next];$('#authDescription').textContent=descriptions[next];$('#authSubmit').textContent=labels[next];
 if(clear)status(pendingCode&&next==='signup'?'Você chegou por uma indicação. Confirme seu cadastro para registrá-la.':'');
}
all('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode)));
$('#forgotPassword').addEventListener('click',()=>setMode('reset'));
$('#backToLogin').addEventListener('click',()=>setMode('login'));
$('#togglePassword').addEventListener('click',()=>{const show=$('#accountPassword').type==='password';$('#accountPassword').type=show?'text':'password';$('#togglePassword').textContent=show?'Ocultar':'Mostrar';$('#togglePassword').setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');$('#togglePassword').setAttribute('aria-pressed',String(show));});
function activateTab(tab){
 const target=profileRequired?'dados':(['indicacoes','pedidos','dados'].includes(tab)?tab:'dados');
 $('#referralsPanel').hidden=target!=='indicacoes';$('#ordersPanel').hidden=target!=='pedidos';$('#detailsPanel').hidden=target!=='dados';
 all('[data-account-tab]').forEach(b=>{if(b.dataset.accountTab===target)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 const url=new URL(location.href);url.searchParams.set('aba',target);history.replaceState(null,'',url.pathname+url.search);
}
all('[data-account-tab]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.accountTab)));
const referralLabels={registered:'Cadastro confirmado · em análise',validated:'Indicação validada',reward_ready:'Brinde liberado',reward_sent:'Brinde enviado'};
const orderLabels={received:'Recebido',confirmed:'Confirmado',preparing:'Em preparação',shipped:'Enviado',delivered:'Entregue',cancelled:'Cancelado'};
const date=s=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(s));
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
async function loadAccount(){
 const seq=++sequence;
 $('#memberPanel').hidden=true;$('#authPanel').hidden=true;customer=null;
 status('Carregando sua conta…');
 const {data:auth,error:authError}=await supa.auth.getUser();
 if(seq!==sequence)return;
 if(authError||!auth.user||auth.user.is_anonymous){user=null;setMode('login',false);status(authError&&authError.name!=='AuthSessionMissingError'?'Sua sessão expirou. Entre novamente.':'');return;}
 if(!auth.user.email_confirmed_at){
  const email=auth.user.email||'';await supa.auth.signOut({scope:'local'});
  if(seq!==sequence&&user)return;user=null;setMode('login',false);$('#accountEmail').value=email;$('#resendConfirmation').hidden=false;status('Confirme seu e-mail para liberar sua conta. Use Reenviar confirmação se precisar de outro link.',true);return;
 }
 user=auth.user;
 if(recovery){setMode('newpassword');return;}
 let {data:profile,error}=await supa.from('kaia_customers').select('*').eq('user_id',user.id).maybeSingle();
 if(seq!==sequence)return;
 if(error){status(friendly(error),true);setMode('login',false);return;}
 if(!profile){
  const name=user.user_metadata?.kaia_name;
  if(typeof name==='string'&&name.trim().length>=2){
   const result=await supa.from('kaia_customers').insert({user_id:user.id,full_name:name.trim().slice(0,100)}).select().single();
   if(seq!==sequence)return;
   if(result.error){status(friendly(result.error),true);setMode('complete',false);return;}profile=result.data;
  }else{setMode('complete');return;}
 }
 customer=profile;
 const detailResult=await supa.from('kaia_customer_details').select('*').eq('user_id',user.id).maybeSingle();
 if(seq!==sequence)return;
 if(detailResult.error){setMode('login',false);status('Não foi possível carregar seu cadastro. Tente entrar novamente.',true);return;}
 const details=detailResult.data;profileRequired=!details;
 fillCustomerDetails(details);
 all('[data-account-tab]').forEach(b=>b.disabled=profileRequired&&b.dataset.accountTab!=='dados');
 $('#profileSetupNote').textContent=profileRequired?'Etapa 2 de 2: complete seus dados pessoais e de entrega para concluir o cadastro. Confira seus dados antes de concluir uma compra.':'Seu cadastro está completo. Confira ou atualize seus dados antes das próximas compras.';
 let claimMessage='';
 const code=pendingCode||(validCode(user.user_metadata?.kaia_ref)?user.user_metadata.kaia_ref:null);
 if(code){
  const result=await supa.rpc('kaia_claim_referral',{code});
  if(seq!==sequence)return;
  if(result.error){claimMessage='Seu cadastro está pronto. Não foi possível registrar a indicação agora; tente atualizar a página.';}
  else {claimMessage=({registered:'Indicação registrada! A equipe vai validar a participação e o brinde.',self:'Seu próprio link não conta como indicação.',invalid:'Este convite não está disponível. Confira o link com quem indicou você.'})[result.data]||'';pendingCode=null;try{localStorage.removeItem(REF_KEY)}catch{}}
 }
 const [referrals,orders]=await Promise.all([
  supa.from('kaia_referrals').select('id,status,created_at').order('created_at',{ascending:false}).limit(100),
  supa.from('kaia_orders').select('id,order_number,status,total_cents,items,created_at').order('created_at',{ascending:false}).limit(100)
 ]);
 if(seq!==sequence)return;
 $('#memberName').textContent=profile.full_name;$('#memberEmail').textContent=user.email;
 $('#profileName').value=profile.full_name;$('#profileEmail').value=user.email;
 $('#personalReferralLink').value=new URL('/?indicacao='+encodeURIComponent(profile.referral_code),KAIA_AUTH.accountUrl).toString();
 if(referrals.error){$('#referralsList').textContent='Não foi possível carregar suas indicações. Use Atualizar para tentar novamente.';all('.account-stats strong').forEach(s=>s.textContent='—');}
 else{
  const rows=referrals.data||[];
  $('#referralTotal').textContent=rows.length>=100?'100+':rows.length;
  $('#referralValidated').textContent=rows.filter(r=>r.status!=='registered').length;
  $('#referralGifts').textContent=rows.filter(r=>['reward_ready','reward_sent'].includes(r.status)).length;
  $('#referralsList').innerHTML=rows.length?rows.map((r,i)=>`<article class="account-record"><h3>Indicação ${rows.length-i}</h3><time datetime="${esc(r.created_at)}">${date(r.created_at)}</time><span class="account-badge">${esc(referralLabels[r.status]||r.status)}</span></article>`).join(''):'<div class="account-empty"><h3>Seu primeiro convite começa aqui.</h3><p>Compartilhe seu link. Os cadastros confirmados por ele aparecerão nesta lista.</p></div>';
 }
 if(orders.error)$('#ordersList').textContent='Não foi possível carregar seus pedidos. Atualize a página para tentar novamente.';
 else{
  $('#ordersList').innerHTML=orders.data.length?orders.data.map(o=>`<article class="account-record"><h3>Pedido ${esc(o.order_number)} · ${money(o.total_cents)}</h3><time datetime="${esc(o.created_at)}">${date(o.created_at)}</time><span class="account-badge">${esc(orderLabels[o.status]||o.status)}</span><ul>${(Array.isArray(o.items)?o.items:[]).filter(i=>i&&typeof i==='object').map(i=>`<li>${esc(i.quantity||1)} × ${esc(i.name||'Produto')}</li>`).join('')}</ul></article>`).join(''):'<div class="account-empty"><h3>Você ainda não tem pedidos por aqui.</h3><p>Quando a equipe vincular um pedido à sua conta, você poderá acompanhar a situação nesta área.</p><a href="./" class="account-text-button">Explorar a coleção ↗</a></div>';
 }
 $('#authPanel').hidden=true;$('#memberPanel').hidden=false;
 activateTab(new URLSearchParams(location.search).get('aba')||'dados');status((profileRequired?'Confirme seus dados abaixo para concluir o cadastro. ':'' )+ (claimMessage||((referrals.error||orders.error)?'Algumas informações não carregaram. Tente atualizar.':'')));
}
$('#authForm').addEventListener('submit',async event=>{
 event.preventDefault();if(!supa)return;const button=$('#authSubmit');button.disabled=true;authBusy=true;status('Aguarde…');
 const email=$('#accountEmail').value.trim(),password=$('#accountPassword').value,name=$('#accountName').value.trim();
 try{
  if(stagingEmailBlocked&&['signup','reset'].includes(mode)){status('Os e-mails de confirmação e recuperação precisam ser liberados para o endereço temporário no Supabase antes de testar cadastros.',true);return;}
  if(['signup','complete'].includes(mode)&&!/^\S+\s+\S+/.test(name)){status('Informe seu nome completo, com sobrenome.',true);return;}
  if(['signup','newpassword'].includes(mode)&&(!/[a-zA-Z]/.test(password)||!/[0-9]/.test(password))){status('Use uma senha com letras e números e pelo menos 10 caracteres.',true);return;}
  if(mode==='signup'){
   if(!$('#termsAccepted').checked){status('Leia os Termos de uso e confirme o aceite antes de criar a conta.',true);return;}
   const {data,error}=await supa.auth.signUp({email,password,options:{emailRedirectTo:KAIA_AUTH.accountUrl,data:{kaia_name:name,kaia_terms_version:'2026-11-05',kaia_terms_accepted_at:new Date().toISOString(),...(pendingCode?{kaia_ref:pendingCode}:{})}}});
   if(error)throw error;
   $('#accountPassword').value='';
   if(data.session){await loadAccount();}else{setMode('login',false);status('Se este for um novo cadastro, enviaremos o link de confirmação ao seu e-mail. O acesso só será liberado após confirmar. Se você já possui uma conta confirmada, entre com sua senha ou use Esqueci minha senha; um novo cadastro não envia outra confirmação.');$('#resendConfirmation').hidden=false;}
  }else if(mode==='login'){
   const {error}=await supa.auth.signInWithPassword({email,password});if(error)throw error;$('#accountPassword').value='';await loadAccount();
  }else if(mode==='reset'){
   const {error}=await supa.auth.resetPasswordForEmail(email,{redirectTo:KAIA_AUTH.accountUrl+'?redefinir=1'});if(error)throw error;status('Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique também a caixa de spam.');
  }else if(mode==='newpassword'){
   const {error}=await supa.auth.updateUser({password});if(error)throw error;recovery=false;const url=new URL(location.href);url.searchParams.delete('redefinir');history.replaceState(null,'',url.pathname+url.search);await loadAccount();status('Sua senha foi atualizada.');
  }else if(mode==='complete'){
   const {error}=await supa.from('kaia_customers').insert({user_id:user.id,full_name:name});if(error)throw error;await loadAccount();
  }
 }catch(error){status(friendly(error),true);}finally{button.disabled=false;authBusy=false;}
});
$('#resendConfirmation').addEventListener('click',async()=>{
 if(stagingEmailBlocked){status('O retorno de confirmação da homologação ainda não foi autorizado no Supabase.',true);return;}
 const email=$('#accountEmail').value.trim();if(!email||!$('#accountEmail').reportValidity())return;
 const b=$('#resendConfirmation');b.disabled=true;const {error}=await supa.auth.resend({type:'signup',email,options:{emailRedirectTo:KAIA_AUTH.accountUrl}});status(error?friendly(error):'Se houver uma confirmação pendente, enviaremos um novo e-mail.',!!error);b.disabled=false;
});
const customerFields={cpf:'profileCpf',birth_date:'profileBirth',phone:'profilePhone',postal_code:'profilePostal',street:'profileStreet',street_number:'profileNumber',complement:'profileComplement',neighborhood:'profileNeighborhood',city:'profileCity',state:'profileState'};
function fillCustomerDetails(details){for(const [key,id] of Object.entries(customerFields))$('#'+id).value=details?.[key]||'';$('#profileBirth').max=new Date().toISOString().slice(0,10);}
$('#profileForm').addEventListener('submit',async event=>{
 event.preventDefault();const b=event.submitter;
 const details={full_name:$('#profileName').value.trim()};
 for(const [key,id] of Object.entries(customerFields))details[key]=$('#'+id).value.trim();
 for(const key of ['cpf','phone','postal_code'])details[key]=digits(details[key]);
 const message=validateCustomer(details);const feedback=$('#profileSaveStatus');
 if(message){feedback.textContent=message;return;}
 b.disabled=true;feedback.textContent='Salvando seu cadastro…';
 try{
  const {error}=await supa.rpc('kaia_save_customer_details',{details});if(error)throw error;
  profileRequired=false;all('[data-account-tab]').forEach(button=>button.disabled=false);
  $('#memberName').textContent=details.full_name;
  $('#profileSetupNote').textContent='Seu cadastro está completo. Você pode atualizar seus dados aqui quando precisar.';
  feedback.textContent='Cadastro completo salvo! Você pode conferir ou atualizar seus dados antes de comprar.';
  status('Seu cadastro foi concluído.');
 }catch{feedback.textContent='Não foi possível salvar. Confira os dados e sua conexão e tente novamente.';}
 finally{b.disabled=false;}
});
$('#requestNewPassword').addEventListener('click',async()=>{
 if(stagingEmailBlocked){status('A recuperação por e-mail na homologação depende de liberar o endereço temporário no Supabase.',true);return;}
 const b=$('#requestNewPassword');b.disabled=true;const {error}=await supa.auth.resetPasswordForEmail(user.email,{redirectTo:KAIA_AUTH.accountUrl+'?redefinir=1'});status(error?friendly(error):'Enviamos as instruções de alteração de senha para o seu e-mail.',!!error);b.disabled=false;
});
$('#signOut').addEventListener('click',async()=>{
 const b=$('#signOut');b.disabled=true;const {error}=await supa.auth.signOut({scope:'local'});
 if(error){status(friendly(error),true);}else{sequence++;user=null;customer=null;$('#personalReferralLink').value='';$('#referralsList').replaceChildren();$('#ordersList').replaceChildren();$('#profileForm').reset();setMode('login');status('Você saiu da sua conta.');}b.disabled=false;
});
$('#refreshAccount').addEventListener('click',()=>loadAccount());
async function copyLink(){
 const input=$('#personalReferralLink');let copied=false;
 try{await navigator.clipboard.writeText(input.value);copied=true;}catch{input.select();try{copied=document.execCommand('copy')}catch{}}
 status(copied?'Seu link foi copiado! Envie para quem você deseja convidar.':'Selecione e copie seu link de indicação no campo acima.');
}
$('#copyPersonalReferral').addEventListener('click',copyLink);
$('#sharePersonalReferral').addEventListener('click',async()=>{
 if(!customer)return;const url=$('#personalReferralLink').value;
 if(navigator.share){try{await navigator.share({title:'Meu convite Kaia Glow',text:'Vem conhecer a Kaia Glow! Crie sua conta pelo meu convite e descubra essa seleção de beleza e autocuidado.',url});status('Convite compartilhado! Você poderá acompanhar os cadastros confirmados nesta área.');return;}catch(error){if(error.name==='AbortError')return;}}
 await copyLink();
});
if(!supa){status('Não foi possível carregar o acesso. Atualize a página ou fale com a Kaia.',true);}
else{
 supa.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){recovery=true;queueMicrotask(()=>setMode('newpassword'));}
  else if(event==='SIGNED_OUT'){sequence++;user=null;customer=null;setMode('login');}
  else if(event==='SIGNED_IN'&&!authBusy&&!initializing&&session?.user?.id!==user?.id){setTimeout(()=>loadAccount(),0);}
 });
 const {data,error}=await supa.auth.getSession();
 if(error){setMode('login');status(friendly(error),true);}
 else if(data.session){await loadAccount();}
 else{recovery=false;setMode(mode);if(params.get('redefinir')==='1')status('Abra o link mais recente enviado ao seu e-mail para redefinir a senha.',true);}
 initializing=false;
 if(params.has('error')||new URLSearchParams(location.hash.slice(1)).has('error'))status('Este link expirou ou já foi utilizado. Solicite um novo e-mail de confirmação ou recuperação.',true);
}
