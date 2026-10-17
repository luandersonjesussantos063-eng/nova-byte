(()=>{
"use strict";
const $=id=>document.getElementById(id);
const url="https://vajlhodqxskozuxxlujv.supabase.co",key="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
let db;
async function refresh(){
 const list=$("nplay-access-admin-list");if(!list)return;
 const {data:{user}}=await db.auth.getUser();
 if(!user){$("nplay-access-admin-status").textContent="Entre como administrador para visualizar solicitações.";return}
 const {data:admin}=await db.from("novaplay_admins").select("user_id").eq("user_id",user.id).maybeSingle();
 if(!admin){$("nplay-access-admin-status").textContent="Somente administradores podem visualizar esta área.";return}
 const {data,error}=await db.from("novaplay_access_requests").select("user_id,display_name,device_label,status,created_at").order("created_at",{ascending:false}).limit(200);
 if(error){$("nplay-access-admin-status").textContent=error.message;return}
 const {data:adminDevices,error:adminDevicesError}=await db.rpc("nplay_list_device_admins");
 if(adminDevicesError){$("nplay-access-admin-status").textContent="Não foi possível conferir administradores: "+adminDevicesError.message;return}
 const admins=new Set((adminDevices||[]).map(x=>x.user_id));
 $("nplay-access-admin-status").textContent=(data||[]).length+" solicitações encontradas.";
 list.replaceChildren();
 for(const item of data||[]){
  const row=document.createElement("div");row.style.cssText="border:1px solid #365075;border-radius:10px;padding:12px;margin:9px 0";
  const title=document.createElement("strong");title.textContent=(item.display_name||"Sem nome")+" · "+item.status+" · "+item.user_id.slice(0,8).toUpperCase();
  const info=document.createElement("p");info.textContent=item.device_label+" · "+new Date(item.created_at).toLocaleString("pt-BR");info.style.overflowWrap="anywhere";
  row.append(title,info);
  const role=document.createElement("p");role.textContent=admins.has(item.user_id)?"🔐 Administrador":"👤 Usuário";role.style.cssText="font-weight:700;color:#b7d3ff;margin:7px 0";row.append(role);
  if(item.status==="approved"||admins.has(item.user_id)){
   const isAdmin=admins.has(item.user_id);
   const toggle=document.createElement("button");toggle.type="button";toggle.className=isAdmin?"outline":"primary";toggle.style.margin="4px";toggle.textContent=isAdmin?"Retirar ADM":"Tornar ADM";
   toggle.onclick=async()=>{
    if(!confirm((isAdmin?"Retirar permissão administrativa deste aparelho?":"Conceder acesso ao painel ADM para este aparelho?")+"\\nCódigo: "+item.user_id.slice(0,8).toUpperCase()))return;
    toggle.disabled=true;
    const {error}=await db.rpc("nplay_set_device_admin",{target_user:item.user_id,make_admin:!isAdmin});
    if(error)alert(error.message==="CANNOT_REMOVE_LAST_ADMIN"?"Não é possível retirar o último administrador.":error.message);
    await refresh();
   };row.append(toggle);
  }
  for(const [status,label] of [["approved","Aprovar"],["denied","Recusar"],["revoked","Revogar"]]){
   if(status===item.status)continue;
   const button=document.createElement("button");button.type="button";button.textContent=label;button.className=status==="approved"?"primary":"outline";button.style.margin="4px";
   button.onclick=async()=>{if(!confirm(label+" acesso "+item.user_id.slice(0,8)+"?"))return;button.disabled=true;const {error}=await db.from("novaplay_access_requests").update({status,updated_at:new Date().toISOString()}).eq("user_id",item.user_id);if(error)alert(error.message);await refresh()};
   row.append(button);
  }
  list.append(row);
 }
}
function start(){if(!window.supabase?.createClient){setTimeout(start,300);return}db=window.supabase.createClient(url,key);$("nplay-access-refresh")?.addEventListener("click",refresh);refresh()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();