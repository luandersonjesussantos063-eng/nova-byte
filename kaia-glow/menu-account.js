import { KAIA_AUTH } from './auth-config.js';
const label=document.querySelector('#menuAccountLabel');
const greeting=document.querySelector('#menuAccountGreeting');
const footer=document.querySelector('#footerAccountLabel');
const exit=document.querySelector('#menuSignOut');
const status=document.querySelector('#menuAccountStatus');
const menu=document.querySelector('#kaiaMenuDialog');
// Use precisely the same persisted session as the account page.
const client=window.supabase?.createClient(KAIA_AUTH.url,KAIA_AUTH.publishableKey,{auth:{storageKey:'kaia-glow-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let revision=0;
function render(user,name=''){
 const connected=!!user?.email_confirmed_at&&!user.is_anonymous;
 label.textContent=connected?'Acessar minha conta':'Entrar ou criar conta';
 footer.textContent=connected?'Acessar minha conta':'Minha conta · Entrar / Criar conta';
 greeting.textContent=connected?(name?'Olá, '+name.split(/\s+/)[0]+'. Sua conta está conectada.':'Sua conta está conectada.'):'Pedidos, perfil e indicações';
 exit.hidden=!connected;
}
async function refresh(){
 const request=++revision;
 try{
  const {data:{session},error}=await client.auth.getSession();
  if(request!==revision)return;
  if(error||!session){render(null);return;}
  const {data,error:authError}=await client.auth.getUser();
  if(request!==revision)return;
  const user=data?.user;
  if(authError||!user?.email_confirmed_at||user.is_anonymous){render(null);return;}
  render(user);
  const {data:profile}=await client.from('kaia_customers').select('full_name').eq('user_id',user.id).maybeSingle();
  if(request===revision)render(user,profile?.full_name?.trim()||'');
 }catch{
  if(request===revision){label.textContent='Minha conta';footer.textContent='Minha conta';greeting.textContent='Acesse seus pedidos, perfil e indicações';exit.hidden=true;}
 }
}
if(client){
 client.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT'){revision++;render(null);}
  else setTimeout(refresh,0);
 });
 window.addEventListener('pageshow',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 new MutationObserver(()=>{if(menu.open)refresh()}).observe(menu,{attributes:true,attributeFilter:['open']});
 exit.addEventListener('click',async()=>{
  exit.disabled=true;status.textContent='';
  try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;revision++;render(null);status.textContent='Você saiu da sua conta.';}
  catch{status.textContent='Não foi possível sair agora. Tente novamente.';}
  finally{exit.disabled=false;}
 });
 refresh();
}
