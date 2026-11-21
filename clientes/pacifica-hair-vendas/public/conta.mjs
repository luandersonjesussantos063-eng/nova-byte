import {authClient,verifiedUser,emailReady,hasDeliveryDetails} from "/pacifica-auth.mjs";
import {cepDigits,formatCep,lookupCep,cepAddressFields,mergeCepAddress} from "/cep.mjs";
const $=s=>document.querySelector(s),form=$("#authForm"),sb=authClient(true);
const params=new URLSearchParams(location.search);let mode=params.get("modo")==="cadastro"?"signup":"login",recovering=false,user=null;
const status=(t,error=false)=>{$("#accountStatus").textContent=t;$("#accountStatus").classList.toggle("error",error)};
const accountUrl=location.origin+"/conta.html",returnCart=params.get("voltar")==="sacola";
const messages={login:["Que bom ter você aqui.","Entre com seu e-mail e sua senha.","Entrar na minha conta"],signup:["Crie sua conta.","Cadastre-se e confirme seu e-mail.","Criar minha conta"],forgot:["Recuperar senha","Informe o e-mail cadastrado.","Enviar instruções"],reset:["Nova senha","Escolha uma senha segura.","Salvar nova senha"]};
function showMode(m){mode=m;const signup=m==="signup",reset=m==="reset",forgot=m==="forgot";$("#authPanel").hidden=false;$("#memberPanel").hidden=true;$("#nameField").hidden=!signup;$("#emailField").hidden=reset;$("#passwordField").hidden=forgot;$("#confirmField").hidden=!(signup||reset);$("#termsField").hidden=!signup;$("#hint").hidden=!(signup||reset);form.elements.name.required=signup;form.elements.terms.required=signup;form.elements.email.required=!reset;form.elements.password.required=!forgot;form.elements.confirm.required=signup||reset;form.elements.password.autocomplete=signup||reset?"new-password":"current-password";form.elements.password.minLength=signup||reset?10:0;$("#forgot").hidden=m!=="login";$("#resend").hidden=m!=="login";$("#back").hidden=m==="login"||m==="reset";const [title,desc,btn]=messages[m];$("#authTitle").textContent=title;$("#description").textContent=desc;$("#authSubmit").textContent=btn;document.querySelectorAll("[data-mode]").forEach(x=>x.classList.toggle("selected",x.dataset.mode===m));}
function friendly(e){if(e?.code==="email_not_confirmed")return "Confirme seu e-mail antes de entrar.";if(e?.code==="invalid_credentials")return "E-mail ou senha incorretos.";if(e?.status===429)return "Muitas tentativas. Tente novamente mais tarde.";return "Não foi possível concluir. Confira os dados e tente novamente."}
function resume(){if(!returnCart)return false;location.replace("/?sacola=1");return true}
const fields=["full_name","phone","postal_code","street","house_number","complement","neighborhood","city","state"];
const profileForm=$("#profileForm"),cepInput=profileForm.elements.postal_code,cepStatus=$("#cepStatus");
let previousCep="",pendingCep="",cepController=null,cepTimer=null,lastResolvedCep="";
const addressSnapshot=()=>Object.fromEntries(cepAddressFields.map(k=>[k,profileForm.elements[k].value]));
function setCepStatus(message,error=false){cepStatus.textContent=message;cepStatus.classList.toggle("error",error)}
function cancelCepLookup(){clearTimeout(cepTimer);cepTimer=null;cepController?.abort();cepController=null;pendingCep=""}
function resetCepLookup(){cancelCepLookup();previousCep=cepDigits(cepInput.value);lastResolvedCep=previousCep.length===8?previousCep:"";cepInput.value=formatCep(previousCep);setCepStatus("Digite seu CEP para buscar o endereço automaticamente.")}
async function findAddress(){
 const cep=cepDigits(cepInput.value);
 if(cep.length!==8||pendingCep===cep||lastResolvedCep===cep||!user)return;
 cancelCepLookup();
 const controller=new AbortController();cepController=controller;pendingCep=cep;
 const before=addressSnapshot(),ownerId=user.id;
 const timeout=setTimeout(()=>controller.abort(),7000);
 setCepStatus("Buscando endereço…");
 try{
  const address=await lookupCep(cep,{signal:controller.signal});
  if(cepController!==controller||cepDigits(cepInput.value)!==cep||user?.id!==ownerId)return;
  const changes=mergeCepAddress(before,addressSnapshot(),address);
  for(const [name,value] of Object.entries(changes))profileForm.elements[name].value=value;
  lastResolvedCep=cep;
  const incomplete=cepAddressFields.some(k=>!profileForm.elements[k].value.trim());
  setCepStatus(incomplete?"CEP localizado. Complete os campos que faltam.":"Endereço localizado! Confira os dados e informe o número e complemento, se houver.");
 }catch(error){
  if(cepController!==controller||cepDigits(cepInput.value)!==cep||user?.id!==ownerId)return;
  setCepStatus(error.message==="not_found"?"CEP não encontrado. Confira o número ou preencha o endereço manualmente.":"Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente.",true);
 }finally{clearTimeout(timeout);if(cepController===controller){cepController=null;pendingCep=""}}
}
function onCepChange(){
 const cep=cepDigits(cepInput.value);cepInput.value=formatCep(cep);
 if(cep===previousCep)return;
 previousCep=cep;cancelCepLookup();lastResolvedCep="";
 // Clear the previous address so that a failed lookup cannot silently keep an old street.
 for(const k of cepAddressFields)profileForm.elements[k].value="";
 setCepStatus(cep.length===8?"Buscando endereço…":"Informe os oito números do CEP.");
 if(cep.length===8)cepTimer=setTimeout(findAddress,200);
}
cepInput.addEventListener("input",onCepChange);
cepInput.addEventListener("change",()=>{onCepChange();if(cepDigits(cepInput.value).length===8){clearTimeout(cepTimer);void findAddress()}});
cepInput.addEventListener("blur",()=>{if(cepDigits(cepInput.value).length===8){clearTimeout(cepTimer);void findAddress()}});

async function loadProfile(){const {data,error}=await sb.from("pacifica_customer_details").select(fields.join(",")).eq("user_id",user.id).maybeSingle();if(error){status("Não conseguimos carregar os dados de entrega.",true);return false;}const f=$("#profileForm");for(const k of fields)f.elements[k].value=data?.[k]||(k==="full_name"?user.user_metadata?.pacifica_name||"":"");resetCepLookup();return !!data&&/^\d{8}$/.test(data.postal_code||"")}
async function loadAccount(){if(recovering)return;user=await verifiedUser();if(!user){showMode(mode==="signup"?"signup":"login");return;}$("#authPanel").hidden=true;$("#memberPanel").hidden=false;$("#memberName").textContent=user.user_metadata?.pacifica_name||"Sua conta";$("#memberEmail").textContent=user.email||"";status("");if(params.get("aba")==="pedidos")document.querySelector('[data-tab="orders"]')?.click();const ready=await loadProfile();if(ready)resume();else if(returnCart)status("Complete seus dados de entrega antes de continuar o pedido.")}
function checkEmailReady(){if(!emailReady()){status("O envio de e-mails ainda está em configuração. O cadastro e a recuperação ficarão disponíveis após a validação do serviço.",true);return false}return true}
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{status("");showMode(b.dataset.mode)});
$("#back").onclick=()=>showMode("login");$("#forgot").onclick=()=>showMode("forgot");
$("#togglePassword").onclick=()=>{const f=form.elements.password,b=$("#togglePassword"),show=f.type==="password";f.type=show?"text":"password";b.textContent=show?"Ocultar":"Mostrar";b.setAttribute("aria-pressed",String(show))};
form.onsubmit=async e=>{e.preventDefault();if(!sb){status("O acesso ainda está em configuração. Tente novamente após a ativação do serviço.",true);return;}const f=new FormData(form),email=String(f.get("email")||"").trim(),password=String(f.get("password")||""),name=String(f.get("name")||"").trim();if((mode==="signup"||mode==="forgot")&&!checkEmailReady())return;if((mode==="signup"||mode==="reset")&&(password.length<10||!/[A-Za-z]/.test(password)||!/\d/.test(password)||password!==f.get("confirm"))){status("Use no mínimo 10 caracteres, com letras e números, e confirme a mesma senha.",true);return;}const b=$("#authSubmit");b.disabled=true;try{
 if(mode==="login"){const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;form.elements.password.value="";await loadAccount();}
 else if(mode==="signup"){const {error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:accountUrl+(returnCart?"?voltar=sacola":""),data:{pacifica_name:name,pacifica_notice_accepted_at:new Date().toISOString()}}});if(error)throw error;form.reset();showMode("login");form.elements.email.value=email;status("Se o cadastro puder ser criado, você receberá um e-mail para confirmação. Confira também o spam.");}
 else if(mode==="forgot"){const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:accountUrl+"?redefinir=1"});if(error)throw error;status("Se o e-mail estiver cadastrado, você receberá as instruções para recuperar a senha.");}
 else if(mode==="reset"){if(!recovering)throw Error("Sessão de recuperação inválida");const {error}=await sb.auth.updateUser({password});if(error)throw error;recovering=false;history.replaceState(null,"","/conta.html");form.reset();await loadAccount();status("Sua senha foi atualizada.");}
 }catch(err){status(friendly(err),true)}finally{b.disabled=false}};
$("#resend").onclick=async()=>{if(!sb||!checkEmailReady())return;const email=form.elements.email.value.trim();if(!form.elements.email.checkValidity()){form.elements.email.reportValidity();return;}const b=$("#resend");b.disabled=true;try{const {error}=await sb.auth.resend({type:"signup",email,options:{emailRedirectTo:accountUrl}});if(error)throw error;status("Se houver confirmação pendente, será enviado um novo e-mail.")}catch(e){status(friendly(e),true)}finally{b.disabled=false}};
$("#signOut").onclick=async()=>{if(!sb)return;const {error}=await sb.auth.signOut({scope:"local"});if(error){status(friendly(error),true);return;}cancelCepLookup();user=null;showMode("login");status("Você saiu da sua conta.")};
$("#changePassword").onclick=async()=>{if(!user||!checkEmailReady())return;const {error}=await sb.auth.resetPasswordForEmail(user.email,{redirectTo:accountUrl+"?redefinir=1"});status(error?friendly(error):"Confira seu e-mail para alterar a senha.",!!error)};
$("#profileForm").onsubmit=async e=>{e.preventDefault();if(!user||!sb)return;cancelCepLookup();const f=new FormData(e.target),row={user_id:user.id};for(const k of fields)row[k]=String(f.get(k)||"").trim();row.postal_code=row.postal_code.replace(/\D/g,"");row.phone=row.phone.replace(/\D/g,"");row.state=row.state.toUpperCase();if(!/^\d{8}$/.test(row.postal_code)||!/^\d{10,11}$/.test(row.phone)||!/^[A-Z]{2}$/.test(row.state)){status("Confira CEP, telefone e UF.",true);return;}const b=e.target.querySelector("button");b.disabled=true;try{const {error}=await sb.from("pacifica_customer_details").upsert(row,{onConflict:"user_id"});if(error)throw error;status("Dados salvos com sucesso.");resume()}catch(err){status(friendly(err),true)}finally{b.disabled=false}};
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{for(const k of ["details","orders"])$("#"+k).hidden=k!==b.dataset.tab;document.querySelectorAll("[data-tab]").forEach(x=>x.setAttribute("aria-current",x===b?"page":"false"));});
showMode(mode);
if(!sb){status("Área de acesso em preparação. O cadastro será liberado após a configuração do servidor.",true);$("#authSubmit").disabled=true;$("#resend").disabled=true;}else{
 sb.auth.onAuthStateChange((event)=>{if(event==="PASSWORD_RECOVERY"){recovering=true;showMode("reset");status("Escolha sua nova senha.");}else if(event==="SIGNED_IN"&&!recovering&&!params.has("redefinir"))setTimeout(loadAccount,0);});
 if(params.has("redefinir")){status("Validando o link de recuperação…");setTimeout(()=>{if(!recovering){showMode("forgot");status("Link inválido ou expirado. Solicite outro e-mail.",true)}},3000);}else{loadAccount().then(()=>{if(!user&&!emailReady())status("A confirmação de e-mail ainda está em configuração.");else if(!user)status("");}).catch(()=>status("Serviço de acesso indisponível.",true));}
}
