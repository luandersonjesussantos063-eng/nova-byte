(()=>{
"use strict";
const url="https://vajlhodqxskozuxxlujv.supabase.co",key="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const $=id=>document.getElementById(id);
let client=null,busy=false,lastState="loading",lastUser=null,hadRestrictedAccess=false,sdkWait=0;
function render(state){
 lastState=state;
 const copy={
  loading:["Preparando seu acesso","Só um instante. Estamos conferindo a liberação deste aparelho.","Conferindo acesso…"],
  new:["Solicite seu acesso","Para assistir, este aparelho precisa ser liberado pelo responsável pela NPlay.","1. Toque em Solicitar acesso.  2. Aguarde a aprovação nesta tela."],
  sending:["Enviando seu pedido","Aguarde um instante. Estamos solicitando a liberação deste aparelho.","Enviando…"],
  pending:["Pedido enviado!","Agora é só aguardar o responsável liberar este aparelho.","A NPlay abre automaticamente quando o acesso for aprovado. Você pode deixar esta tela aberta."],
  denied:["Fale com o responsável","O acesso deste aparelho não foi liberado. Fale com o responsável pela NPlay e informe o código abaixo.","Se a liberação já foi combinada, toque em Conferir liberação."],
  connection:["Não conseguimos conectar agora","Confira sua conexão com a internet e toque em Tentar novamente.","Se continuar, abra este mesmo link no Safari ou no Chrome e tente novamente."]
 }[state];
 $("nplay-access-title").textContent=copy[0];$("nplay-access-status").textContent=copy[1];$("nplay-access-hint").textContent=copy[2];
 $("nplay-access-wall").dataset.state=state;
 $("nplay-access-request").hidden=state!=="new";
 $("nplay-access-request").disabled=busy;
 $("nplay-access-retry").hidden=["loading","sending"].includes(state);
 $("nplay-access-retry").disabled=busy;
 $("nplay-access-retry").textContent=state==="connection"?"Tentar novamente":"Conferir liberação";
 $("nplay-access-code-wrap").hidden=!lastUser;
 if(lastUser)$("nplay-access-code").textContent=lastUser.id.slice(0,8).toUpperCase();
 $("nplay-access-badge").textContent=state==="pending"?"AGUARDANDO LIBERAÇÃO":state==="connection"?"VERIFIQUE A CONEXÃO":"ACESSO POR APARELHO";
}
async function identify(){
 const local=await client.auth.getSession();
 if(local.error)throw local.error;
 if(!local.data?.session){
  const result=await client.auth.signInAnonymously();
  if(result.error||!result.data?.user)throw result.error||Error("Identity unavailable");
  return result.data.user;
 }
 let result=await client.auth.getUser();
 if(!result.data?.user&&(result.error?.status===401||result.error?.status===403)){
  const refreshed=await client.auth.refreshSession();
  if(refreshed.error)throw refreshed.error;
  result=await client.auth.getUser();
 }
 // A temporary network error must not replace an already approved identity.
 if(result.error||!result.data?.user)throw result.error||Error("Identity unavailable");
 return result.data.user;
}
async function readAccess(user){
 const {data:admin,error:adminError}=await client.from("novaplay_admins").select("user_id").eq("user_id",user.id).maybeSingle();
 if(adminError)throw adminError;
 if(admin)return "approved";
 const {data:record,error}=await client.from("novaplay_access_requests").select("status").eq("user_id",user.id).maybeSingle();
 if(error)throw error;
 return record?.status||"new";
}
function applyAccess(state){
 if(state==="approved"){
  $("nplay-access-wall").hidden=true;
  // The catalog may have loaded before the approval existed. Reload once after
  // approval so RLS can return the newly authorized films and channels.
  if(hadRestrictedAccess)location.reload();
  return;
 }
 hadRestrictedAccess=true;
 render(state==="revoked"||state==="denied"?"denied":state==="pending"?"pending":"new");
}
async function check(manual=false){
 if(!client||busy)return;
 busy=true;
 if(manual)render("loading");
 try{lastUser=await identify();applyAccess(await readAccess(lastUser));}
 catch{render("connection");}
 finally{busy=false;$("nplay-access-request").disabled=false;$("nplay-access-retry").disabled=false;}
}
async function requestAccess(){
 if(!client||busy)return;
 busy=true;render("sending");
 try{
  lastUser=await identify();
  const state=await readAccess(lastUser);
  if(state!=="new"){applyAccess(state);return;}
  const {error}=await client.from("novaplay_access_requests").insert({user_id:lastUser.id,device_label:(navigator.userAgent||"Dispositivo").slice(0,110),status:"pending"});
  if(error&&error.code!=="23505")throw error;
  // Duplicate requests are resolved by reading the existing status, never by
  // overwriting a denial or an approval.
  applyAccess(await readAccess(lastUser));
 }catch{render("connection");}
 finally{busy=false;$("nplay-access-request").disabled=false;$("nplay-access-retry").disabled=false;}
}
function start(){
 if(!window.supabase?.createClient){
  if(++sdkWait>40){render("connection");$("nplay-access-retry").onclick=()=>location.reload();return}
  setTimeout(start,250);return;
 }
 client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
 window.NPlayAccessClient=client;
 $("nplay-access-request").onclick=requestAccess;
 $("nplay-access-retry").onclick=()=>check(true);
 check();
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)check()});
 setInterval(()=>{if(!document.hidden&&!$("nplay-access-wall").hidden)check()},15000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
