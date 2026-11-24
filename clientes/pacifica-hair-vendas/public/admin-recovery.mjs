import {authClient} from "/pacifica-auth.mjs";
const $=s=>document.querySelector(s),client=authClient(true);
const form=$("#adminRecoveryEmailForm"),reset=$("#adminRecoveryPasswordForm"),box=$("#adminRecovery"),forgot=$("#adminForgot"),back=$("#adminRecoveryBack"),config=$("#adminRecoveryConfigForm");
const message=(el,text,err=false)=>{el.textContent=text;el.classList.toggle("error",!!err)};
const recoveryStatus=$("#adminRecoveryStatus"),configStatus=$("#adminRecoveryConfigStatus");
function showRecovery(show){box.hidden=!show;$("#loginForm").hidden=show;forgot.hidden=show;if(!show){reset.hidden=true;form.hidden=false;message(recoveryStatus,"")}}
forgot.onclick=async()=>{showRecovery(true);try{const r=await fetch("/api/admin/status",{cache:"no-store"}),j=await r.json();if(!j.recoveryReady)message(recoveryStatus,"A recuperação ainda não foi ativada. A administradora precisa cadastrar um e-mail em Configurações.",true)}catch{message(recoveryStatus,"Não foi possível conferir a recuperação agora.",true)}};
back.onclick=()=>{history.replaceState(null,"",location.pathname);showRecovery(false)};
form.onsubmit=async e=>{
 e.preventDefault();const button=form.querySelector("button");button.disabled=true;
 try{
  const status=await fetch("/api/admin/status",{cache:"no-store"});const data=await status.json();
  if(!data.recoveryReady)throw Error("O e-mail de recuperação ainda não foi configurado. Entre em contato com a administradora.");
  if(!client)throw Error("O serviço de confirmação por e-mail está indisponível.");
  const email=String(new FormData(form).get("email")||"").trim();
  const {error}=await client.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+"/conta.html"}});
  if(error)throw Error("Não foi possível enviar o link. Confirme que esse e-mail possui uma conta validada na loja.");
  sessionStorage.setItem("pacifica-admin-recovery-pending","1");
  message(recoveryStatus,"Se o e-mail estiver autorizado, você receberá um link. Abra-o no mesmo navegador e retorne para criar a nova senha.");
 }catch(e){message(recoveryStatus,e.message,true)}
 finally{button.disabled=false}
};
reset.onsubmit=async e=>{
 e.preventDefault();const button=reset.querySelector("button");button.disabled=true;
 try{
  const data=new FormData(reset),password=String(data.get("password")||"");
  if(password!==data.get("confirm")||password.length<12||!/[A-Za-z]/.test(password)||!/\d/.test(password))throw Error("Use pelo menos 12 caracteres, letras e números, e confirme a mesma senha.");
  if(!client)throw Error("Autenticação indisponível.");
  const {data:session,error:sessionError}=await client.auth.getSession();
  if(sessionError||!session?.session?.access_token)throw Error("Link expirado. Solicite outro e-mail.");
  const r=await fetch("/api/admin/recover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accessToken:session.session.access_token,password})});
  const j=await r.json();if(!r.ok)throw Error(j.error||"Falha na recuperação");
  reset.reset();await client.auth.signOut();sessionStorage.removeItem("pacifica-admin-recovery-pending");
  message(recoveryStatus,"Senha redefinida. Você já pode entrar com a nova senha.");reset.hidden=true;form.hidden=true;
  history.replaceState(null,"",location.pathname);
 }catch(e){message(recoveryStatus,e.message,true)}
 finally{button.disabled=false}
};
async function showResetOnReturn(){
 if(!new URLSearchParams(location.search).has("recuperar"))return;
 showRecovery(true);form.hidden=true;reset.hidden=false;message(recoveryStatus,"Confirmando o link de recuperação...");
 if(!client){message(recoveryStatus,"Serviço de autenticação indisponível.",true);return}
 try{const {data,error}=await client.auth.getSession();if(error||!data?.session?.access_token)throw Error("Não encontramos uma sessão válida. Solicite novo link.");
 message(recoveryStatus,"Identidade confirmada. Escolha uma nova senha administrativa.");
 }catch(e){reset.hidden=true;form.hidden=false;message(recoveryStatus,e.message,true)}
}
config.onsubmit=async e=>{
 e.preventDefault();const button=config.querySelector("button");button.disabled=true;
 try{
  const d=new FormData(config);
  const r=await fetch("/api/admin/recovery/configure",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:d.get("email"),password:d.get("password")})});
  const j=await r.json();if(!r.ok)throw Error(j.error||"Não foi possível salvar.");
  config.elements.password.value="";
  message(configStatus,"E-mail autorizado salvo. Confira se essa conta já está cadastrada e confirmada na loja.");
 }catch(e){message(configStatus,e.message,true)}
 finally{button.disabled=false}
};
void showResetOnReturn();
