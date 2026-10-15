(()=>{
"use strict";
const url="https://vajlhodqxskozuxxlujv.supabase.co",key="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const $=id=>document.getElementById(id);
let client=null;
function status(text){$("nplay-access-status").textContent=text}
function showRequest(show){$("nplay-access-request").hidden=!show}
async function check(){
 if(!client)return;
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){status("Não foi possível identificar este dispositivo.");showRequest(true);return}
 const {data:admin}=await client.from("novaplay_admins").select("user_id").eq("user_id",user.id).maybeSingle();
 if(admin){$("nplay-access-wall").hidden=true;return}
 const {data:record,error:queryError}=await client.from("novaplay_access_requests").select("status").eq("user_id",user.id).maybeSingle();
 if(queryError){status("Erro ao verificar acesso: "+queryError.message);$("nplay-access-retry").hidden=false;return}
 $("nplay-access-code").textContent="Código do dispositivo: "+user.id.slice(0,8).toUpperCase();
 if(record?.status==="approved"){$("nplay-access-wall").hidden=true;return}
 if(record?.status==="pending"){status("Solicitação enviada. Aguarde a aprovação do administrador.");showRequest(false)}
 else if(record?.status==="revoked"||record?.status==="denied"){status("Acesso não autorizado. Entre em contato com o administrador.");showRequest(false)}
 else{status("Solicite sua autorização para acessar o aplicativo.");showRequest(true)}
 $("nplay-access-retry").hidden=false;
}
async function start(){
 if(!window.supabase?.createClient){setTimeout(start,250);return}
 client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}});
 window.NPlayAccessClient=client;
 let {data:{user}}=await client.auth.getUser();
 if(!user){
  const {error}=await client.auth.signInAnonymously();
  if(error){status("A autenticação anônima precisa estar ativada no Supabase: "+error.message);return}
 }
 $("nplay-access-request").onclick=async()=>{
  showRequest(false);status("Enviando solicitação…");
  const {data:{user}}=await client.auth.getUser();
  if(!user){status("Falha ao identificar dispositivo.");showRequest(true);return}
  const {error}=await client.from("novaplay_access_requests").insert({user_id:user.id,device_label:(navigator.userAgent||"Dispositivo").slice(0,110),status:"pending"});
  if(error){status("Não foi possível enviar solicitação: "+error.message);showRequest(true);return}
  await check();
 };
 $("nplay-access-retry").onclick=check;
 await check();
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)check()});
 setInterval(()=>{if(!$("nplay-access-wall").hidden)check()},15000);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();