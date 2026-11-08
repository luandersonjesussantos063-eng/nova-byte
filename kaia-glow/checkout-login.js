/* Checkout identification gate. Real login is delegated to Supabase Auth;
   no password, CPF, cart price, delivery value or payment is stored here. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const RESUME_KEY='kaia-checkout-resume-v1';
 let client=null,config=null,active=false,needsProfile=false,postal='',callback=null,seq=0;
 const mail=$('kgLoginEmail'),password=$('kgLoginPassword'),message=$('kgLoginStatus');
 const modal=$('kgCheckoutLoginDialog'),form=$('kgLoginForm');
 function status(text='',failure=false){
  if(!message)return;
  message.textContent=text;message.dataset.error=String(failure);
 }
 function notify(){
  if(typeof callback==='function')callback(active);
  window.dispatchEvent(new Event('kaia:checkout-auth-changed'));
 }
 function accountRedirect(mode='login'){
  try{localStorage.setItem(RESUME_KEY,JSON.stringify({created:Date.now()}));}catch{}
  const url=new URL('/conta.html',location.origin);
  url.searchParams.set('voltar','sacola');
  if(mode==='signup')url.searchParams.set('modo','cadastro');
  else if(mode==='details')url.searchParams.set('aba','dados');
  location.assign(url.pathname+url.search);
 }
 async function ensureClient(){
  if(client)return client;
  if(!window.supabase)throw Error('O serviço de acesso está temporariamente indisponível.');
  if(!config){const m=await import('./auth-config.js');config=m.KAIA_AUTH;}
  client=window.supabase.createClient(config.url,config.publishableKey,{
   auth:{storageKey:'kaia-glow-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
  });
  return client;
 }
 async function refresh(){
  const current=++seq;
  try{
   const sb=await ensureClient();
   const {data,error}=await sb.auth.getUser();
   if(error||!data?.user||data.user.is_anonymous||!data.user.email_confirmed_at){
    if(current!==seq)return false;
    active=false;needsProfile=false;postal='';notify();return false;
   }
   const {data:details,error:profileError}=await sb.from('kaia_customer_details')
    .select('postal_code').eq('user_id',data.user.id).maybeSingle();
   if(current!==seq)return false;
   if(profileError){active=false;needsProfile=false;status('Não conseguimos confirmar seus dados de entrega. Tente novamente.',true);notify();return false;}
   if(!details){
    active=false;needsProfile=true;postal='';
    if(modal?.open){status('Falta concluir seus dados de entrega. Vamos abrir seu cadastro.');accountRedirect('details');}
    notify();return false;
   }
   postal=String(details.postal_code||'').replace(/\D/g,'');
   active=true;needsProfile=false;
   if(modal?.open){modal.close();password.value='';}
   notify();
   return true;
  }catch{
   if(current===seq){active=false;notify();status('Não foi possível verificar a conta. Confira sua conexão e tente novamente.',true);}
   return false;
  }
 }
 function showLogin(){
  if(!modal)return accountRedirect('login');
  status('');
  $('kgLoginRecovery').hidden=true;
  form.hidden=false;
  $('kgLoginTitle').textContent='Faça login';
  if(!modal.open)modal.showModal();
  mail.focus();
 }
 async function promptLogin(){
  const ready=await refresh();
  if(ready)return;
  if(needsProfile){accountRedirect('details');return;}
  showLogin();
 }
 function closeLogin(){if(modal?.open)modal.close();}
 $('kgLoginClose').onclick=closeLogin;
 $('kgLoginBack').onclick=closeLogin;
 $('kgLoginToggle').onclick=()=>{
  const reveal=password.type==='password';
  password.type=reveal?'text':'password';
  $('kgLoginToggle').textContent=reveal?'Ocultar':'Mostrar';
  $('kgLoginToggle').setAttribute('aria-pressed',String(reveal));
 };
 form.onsubmit=async event=>{
  event.preventDefault();
  const button=$('kgLoginSubmit'),email=mail.value.trim(),pass=password.value;
  if(!email||!pass){status('Informe seu e-mail e senha.',true);return;}
  button.disabled=true;status('Conferindo seu acesso…');
  try{
   const sb=await ensureClient();
   const {error}=await sb.auth.signInWithPassword({email,password:pass});
   if(error)throw error;
   password.value='';
   const ok=await refresh();
   if(!ok&&!modal.open)showLogin();
   else if(!ok)status('Confirme seu e-mail e complete seu cadastro para continuar. Se necessário, use Criar conta ou Recuperar senha.',true);
  }catch(error){
   status(error?.code==='email_not_confirmed'?
    'Confirme seu e-mail antes de continuar. Verifique a caixa de entrada e o spam.':
    error?.status===429?'Muitas tentativas. Aguarde alguns minutos.':
    'E-mail ou senha incorretos. Confira seus dados ou recupere a senha.',true);
  }finally{button.disabled=false;}
 };
 $('kgLoginForgot').onclick=()=>{
  form.hidden=true;$('kgLoginRecovery').hidden=false;
  $('kgLoginTitle').textContent='Recupere seu acesso';
  $('kgRecoveryEmail').value=mail.value.trim();
  status('Enviaremos um link de redefinição para o e-mail cadastrado.');
 };
 $('kgLoginRecoveryBack').onclick=()=>{
  $('kgLoginRecovery').hidden=true;form.hidden=false;
  $('kgLoginTitle').textContent='Faça login';status('');
 };
 $('kgLoginRecovery').onsubmit=async event=>{
  event.preventDefault();
  const email=$('kgRecoveryEmail').value.trim();
  if(!email)return;
  const b=$('kgRecoverySubmit');b.disabled=true;status('Solicitando recuperação…');
  try{
   const sb=await ensureClient();
   const {error}=await sb.auth.resetPasswordForEmail(email,{
    redirectTo:config.accountUrl+'?redefinir=1'
   });
   if(error)throw error;
   status('Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha. Confira também o spam.');
  }catch{status('Não foi possível enviar o link. Tente novamente.',true);}
  finally{b.disabled=false;}
 };
 $('kgLoginSignup').onclick=()=>accountRedirect('signup');
 $('kgLoginDetails').onclick=()=>accountRedirect('details');
 $('kgLoginRefresh').onclick=async()=>{
  status('Verificando sua conta…');
  if(!await refresh())status('Ainda não identificamos um acesso completo. Faça login ou conclua o cadastro.',true);
 };
 window.kaiaCheckoutGate={
  isAuthenticated:()=>active,
  promptLogin,
  onChange(fn){callback=fn;},
  refresh,postal:()=>postal,
  resumeCheckout:()=>accountRedirect('details')
 };
 ensureClient().then(sb=>{
  sb.auth.onAuthStateChange((event)=>{
   if(['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
    setTimeout(()=>refresh(),0);
   }
  });
  return refresh();
 }).catch(()=>{active=false;notify();});
})();
