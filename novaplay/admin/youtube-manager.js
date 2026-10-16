/* Cadastro de links usando a sessão administrativa e as políticas existentes. */
(function(root){
"use strict";
const categories=Object.freeze(["Filmes completos","Documentários","Humor","Curtas e animações"]);
function payload(values,user,parseId){
 if(!user?.id)throw Error("Entre como administrador para cadastrar vídeos.");
 const id=parseId(values.url),title=String(values.title||"").trim(),channel=String(values.channel||"").trim();
 if(!id)throw Error("Cole um link válido do YouTube.");
 if(title.length<2||title.length>140)throw Error("Informe um título entre 2 e 140 caracteres.");
 if(!categories.includes(values.category))throw Error("Escolha uma das quatro categorias do YouTube.");
 if(!values.rights)throw Error("Confirme a autorização de exibição por incorporação.");
 if(channel.length>120)throw Error("O nome do canal deve ter até 120 caracteres.");
 const description=String(values.description||"").trim();
 if(description.length>3200)throw Error("A sinopse deve ter até 3200 caracteres.");
 const minutes=values.minutes===""||values.minutes==null?null:Number(values.minutes);
 if(minutes!==null&&(!Number.isFinite(minutes)||minutes<=0||minutes>600))throw Error("Informe uma duração entre 1 e 600 minutos ou deixe em branco.");
 return {title,kind:"movie",genre:values.category,youtube_id:id,
  description:[description,channel?"Canal: "+channel:"","Fonte: https://www.youtube.com/watch?v="+id,"Reprodução pelo player oficial do YouTube, sujeita à disponibilidade do canal."].filter(Boolean).join("\n\n"),
  duration_seconds:minutes===null?null:Math.round(minutes*60),created_by:user.id,
  is_published:!!values.publish,rights_reviewed:true,rights_reviewed_at:new Date().toISOString()};
}
function init({client,getUser,parseId,refresh,errorText,isBusy=()=>false,setBusy=()=>{}}){
 const $=id=>document.getElementById(id),form=$("yt-admin-form");if(!form)return;
 let saving=false;
 const message=(text,error=false)=>{const n=$("yt-admin-status");n.textContent=text;n.classList.toggle("error",error);n.classList.toggle("success",!error);};
 function preview(){
  const id=parseId($("yt-admin-url").value);$("yt-admin-preview").hidden=!id;
  const img=$("yt-admin-image");
  if(id){img.src="https://i.ytimg.com/vi/"+id+"/hqdefault.jpg";$("yt-admin-source").href="https://www.youtube.com/watch?v="+id;}
  else {img.removeAttribute("src");$("yt-admin-source").removeAttribute("href");}
 }
 $("yt-admin-url").addEventListener("input",preview);
 form.onsubmit=async event=>{
  event.preventDefault();if(saving||isBusy())return;
  const user=getUser();let row;
  try{row=payload({url:$("yt-admin-url").value,title:$("yt-admin-title").value,category:$("yt-admin-category").value,channel:$("yt-admin-channel").value,description:$("yt-admin-description").value,minutes:$("yt-admin-duration").value,rights:$("yt-admin-rights").checked,publish:$("yt-admin-publish").checked},user,parseId);}catch(e){message(e.message,true);return;}
  saving=true;setBusy(true);$("yt-admin-fields").disabled=true;message("Salvando vídeo...");
  try{
   const existing=await client.from("novaplay_library").select("id,title").eq("youtube_id",row.youtube_id).limit(1);
   if(existing.error)throw existing.error;
   if(existing.data?.length)throw Error("Este vídeo já está cadastrado. Abra Catálogo para editar ou publicar o cadastro existente.");
   if(getUser()?.id!==user.id)throw Error("Sua sessão mudou. Entre novamente antes de salvar.");
   const result=await client.from("novaplay_library").insert(row).select("id,is_published").single();
   if(result.error)throw result.error;
   const category=row.genre;form.reset();$("yt-admin-category").value=category;preview();
   message(result.data.is_published?"Vídeo publicado em YouTube → "+category+". Atualize o aplicativo para ver.":"Vídeo salvo como rascunho. Você pode editar e publicar pela aba Catálogo.");
   try{await refresh();}catch(e){message("Vídeo salvo. Reabra Catálogo para atualizar a lista.");}
  }catch(e){message("Não foi possível cadastrar: "+errorText(e),true);}
  finally{saving=false;setBusy(false);$("yt-admin-fields").disabled=false;}
 };
}
root.NPlayYouTubeAdmin=Object.freeze({categories,payload,init});
})(window);
