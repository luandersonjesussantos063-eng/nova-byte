/* NovaPlay — Painel de administração protegido por Supabase RLS */
(function(){
"use strict";
const PROJECT="vajlhodqxskozuxxlujv";
const API_URL="https://"+PROJECT+".supabase.co";
const PUBLIC_KEY="sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3";
const VIDEO_BUCKET="novaplay-videos",POSTER_BUCKET="novaplay-posters";
const MAX_VIDEO=50*1024*1024,MAX_POSTER=5*1024*1024;
const $=id=>document.getElementById(id);
let client=null,editing=null,items=[],busy=false,currentUpload=null,sessionUser=null;
const esc=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function status(id,message,isError=false,isSuccess=false){
 const n=$(id);n.textContent=message;n.classList.toggle("error",isError);n.classList.toggle("success",isSuccess);
}
function show(id){
 ["loading","login-view","pending-view","dashboard"].forEach(key=>$(key).hidden=key!==id);
 $("logout").hidden=id!=="dashboard";window.scrollTo(0,0);
}
function disable(submitted){
 busy=submitted;
 ["submit-upload","refresh-list","cancel-edit","video-file","poster-file"].forEach(id=>$(id).disabled=submitted);
 $("submit-upload").textContent=submitted?"Enviando...":"Enviar para a NovaPlay";
}
function errorText(err){
 if(!err)return"Erro desconhecido.";
 const msg=String(err.message||err).replace(/(sb_secret_[A-Za-z0-9_]+|eyJ[A-Za-z0-9._-]+)/g,"[oculto]");
 if(/file size|payload too large|entity too large|exceeds.*limit|maximum file/i.test(msg))return"O arquivo excede o limite de armazenamento. Use até 50 MB neste plano.";
 if(/jwt|token.*expired|invalid refresh token/i.test(msg))return"Sua sessão expirou. Faça login novamente.";
 if(/row.level.security|permission denied|unauthorized|403/i.test(msg))return"Você não tem permissão para enviar esse arquivo. Entre com uma conta autorizada.";
 return msg.slice(0,300);
}
async function hasAdmin(){
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)return null;
 // O servidor concede acesso SOMENTE ao proprietário logado,
 // com e-mail verificado e ID confirmado pelo Supabase Auth.
 // Não há senha de administrador no código nem acesso liberado por e-mail digitado.
 const claim=await client.rpc("novaplay_claim_owner_access");
 if(claim.error)console.warn("NovaPlay: validação de proprietário indisponível.");
 const r=await client.from("novaplay_admins").select("user_id").eq("user_id",user.id).maybeSingle();
 if(r.error)throw r.error;
 return r.data?user:false;
}
async function checkSession(){
 try{
  const u=await hasAdmin();
  sessionUser=u||null;
  if(u){show("dashboard");await loadLibrary();}
  else if(u===false){
   const v=await client.auth.getUser();
   $("pending-email").textContent=v.data.user?.email||"Conta aguardando aprovação";
   show("pending-view");
  }else show("login-view");
 }catch(e){show("login-view");status("auth-message",errorText(e),true)}
}
function fileKind(file,video=true){
 const ext=(file.name.split(".").pop()||"").toLowerCase();
 const map=video?{mp4:"video/mp4",webm:"video/webm",ogv:"video/ogg"}:{jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
 const mime=map[ext];
 if(!mime)return null;
 if(file.type && file.type!==mime && !(mime==="video/ogg"&&file.type==="application/ogg"))return null;
 return {ext,mime};
}
function extForMime(file,video=true){const k=fileKind(file,video);if(!k)throw Error(video?"Formato não permitido. Converta o vídeo para MP4, WebM ou OGV.":"A capa deve ser JPG, PNG ou WebP.");return k;}
function pendingKey(file){return "novaplay-pending-"+[file.name,file.size,file.lastModified,sessionUser.id].join("|");}
function createVideoPath(file){
 const key=pendingKey(file), old=sessionStorage.getItem(key);
 if(old&&new RegExp("^"+sessionUser.id+"/[a-f0-9-]{36}\\.(mp4|webm|ogv)$").test(old))return old;
 const path=sessionUser.id+"/"+crypto.randomUUID()+"."+extForMime(file).ext;
 sessionStorage.setItem(key,path);return path;
}
function progress(label,percent){
 $("progress-box").hidden=false;$("progress-label").textContent=label;
 $("progress").value=Math.max(0,Math.min(100,Math.round(percent)));
 $("progress-value").textContent=Math.round(percent)+"%";
}
async function uploadVideo(file,path){
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session)throw Error("Faça login novamente para continuar o envio.");
 progress("Enviando "+file.name,0);
 if(!window.tus||!window.tus.Upload){
   const r=await client.storage.from(VIDEO_BUCKET).upload(path,file,{upsert:false,contentType:extForMime(file).mime});
   if(r.error)throw r.error;progress("Vídeo enviado",100);return;
 }
 return new Promise((resolve,reject)=>{
  const upload=new window.tus.Upload(file,{
   endpoint:"https://"+PROJECT+".storage.supabase.co/storage/v1/upload/resumable",
   retryDelays:[0,3000,5000,10000,20000],
   headers:{authorization:"Bearer "+session.access_token,apikey:PUBLIC_KEY},
   uploadDataDuringCreation:true,
   removeFingerprintOnSuccess:true,
   metadata:{bucketName:VIDEO_BUCKET,objectName:path,contentType:extForMime(file).mime,cacheControl:"3600"},
   chunkSize:6*1024*1024,
   onProgress:(sent,total)=>progress("Enviando vídeo ("+(sent/(1024*1024)).toFixed(1)+" MB de "+(total/(1024*1024)).toFixed(1)+" MB)",100*sent/total),
   onSuccess:()=>{currentUpload=null;progress("Vídeo enviado",100);resolve();},
   onError:err=>{currentUpload=null;reject(err)}
  });
  currentUpload=upload;
  upload.findPreviousUploads().then(previous=>{
   if(previous.length)upload.resumeFromPreviousUpload(previous[0]);
   upload.start();
  }).catch(reject);
 });
}
async function inspectVideo(file){
 // Obtém a duração e, quando o navegador permite, uma miniatura sem enviar o arquivo a terceiros.
 return new Promise(resolve=>{
  const url=URL.createObjectURL(file),video=document.createElement("video");
  let resolved=false,loaded=false;
  const finish=data=>{
   if(resolved)return;resolved=true;clearTimeout(timeout);
   video.pause();video.removeAttribute("src");video.load();URL.revokeObjectURL(url);
   resolve(data);
  };
  const timeout=setTimeout(()=>finish({duration:null,thumbnail:null}),8500);
  function capture(){
   if(resolved||loaded||!video.videoWidth||!video.videoHeight)return;
   loaded=true;
   try{
    const canvas=document.createElement("canvas");canvas.width=480;canvas.height=720;
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.fillStyle="#091527";ctx.fillRect(0,0,480,720);
    const scale=Math.max(480/video.videoWidth,720/video.videoHeight);
    const w=video.videoWidth*scale,h=video.videoHeight*scale;
    ctx.drawImage(video,(480-w)/2,(720-h)/2,w,h);
    const grad=ctx.createLinearGradient(0,510,0,720);grad.addColorStop(0,"#050a1700");grad.addColorStop(1,"#050a17dd");
    ctx.fillStyle=grad;ctx.fillRect(0,510,480,210);
    canvas.toBlob(blob=>{
     finish({duration:Number.isFinite(video.duration)?Math.round(video.duration):null,
      thumbnail:blob?new File([blob],"capa-automatica.jpg",{type:"image/jpeg"}):null});
    },"image/jpeg",.83);
   }catch(e){finish({duration:Number.isFinite(video.duration)?Math.round(video.duration):null,thumbnail:null})}
  }
  video.muted=true;video.preload="auto";video.playsInline=true;
  video.addEventListener("loadedmetadata",()=>{
   if(Number.isFinite(video.duration)&&video.duration>1){
    try{video.currentTime=Math.min(1.5,video.duration/4)}catch(e){}
   }
  });
  video.addEventListener("loadeddata",capture,{once:true});
  video.addEventListener("seeked",capture,{once:true});
  video.addEventListener("error",()=>finish({duration:null,thumbnail:null}),{once:true});
  video.src=url;video.load();
 });
}
async function uploadCover(file){
 const ext=extForMime(file,false);
 const path=sessionUser.id+"/"+crypto.randomUUID()+"."+ext.ext;
 const {error}=await client.storage.from(POSTER_BUCKET).upload(path,file,{contentType:ext.mime,cacheControl:"3600",upsert:false});
 if(error)throw error;
 return path;
}
async function loadLibrary(){
 const {data,error}=await client.from("novaplay_library").select("id,title,description,kind,series_title,episode_number,genre,production_year,video_path,poster_path,is_published,file_size_bytes,mime_type,created_at").order("created_at",{ascending:false}).limit(200);
 if(error){status("upload-message","Não foi possível ler a biblioteca: "+errorText(error),true);return}
 items=data||[];renderLibrary();
}
function renderLibrary(){
 $("stat-total").textContent=items.length;
 $("stat-live").textContent=items.filter(x=>x.is_published).length;
 $("stat-drafts").textContent=items.filter(x=>!x.is_published).length;
 const filter=$("filter-title").value.trim().toLowerCase();
 const shown=items.filter(x=>(x.title+" "+(x.series_title||"")).toLocaleLowerCase("pt-BR").includes(filter.toLocaleLowerCase("pt-BR")));
 const list=$("library-list");list.replaceChildren();
 if(!shown.length){const p=document.createElement("p");p.className="muted";p.textContent=filter?"Nenhum vídeo encontrado.":"Nenhum vídeo enviado ainda. Comece pelo formulário ao lado.";list.append(p);return}
 shown.forEach(row=>{
  const item=document.createElement("article");item.className="movie-item";
  const poster=row.poster_path?client.storage.from(POSTER_BUCKET).getPublicUrl(row.poster_path).data.publicUrl:"../assets/posters/lua.svg";
  item.innerHTML='<img class="movie-thumb" alt="" loading="lazy" src="'+esc(poster)+'"><div class="movie-main"><strong>'+esc(row.title)+'</strong><small>'+esc(row.kind==="episode"?(row.series_title+" · Ep. "+row.episode_number):"Filme/curta")+' · '+(row.file_size_bytes/(1024*1024)).toFixed(1)+' MB</small><span class="movie-state'+(row.is_published?"":" draft")+'">'+(row.is_published?"PUBLICADO":"RASCUNHO")+'</span><div class="movie-buttons"><button class="edit">Editar</button><button class="publish">'+(row.is_published?"Retirar do catálogo":"Publicar")+'</button><button class="danger delete">Excluir</button></div></div>';
  item.querySelector(".edit").onclick=()=>beginEdit(row);
  item.querySelector(".publish").onclick=()=>togglePublish(row);
  item.querySelector(".delete").onclick=()=>removeItem(row);
  list.append(item);
 });
}
function setKind(){
 const isEpisode=$("kind").value==="episode";
 $("series-fields").hidden=!isEpisode;
 $("series-name").required=isEpisode;$("episode-number").required=isEpisode;
}
function beginEdit(row){
 if(busy)return;
 editing=row;$("form-title").textContent="Editar conteúdo";$("cancel-edit").hidden=false;
 $("title").value=row.title;$("kind").value=row.kind;setKind();
 $("year").value=row.production_year||"";
 $("series-name").value=row.series_title||"";$("episode-number").value=row.episode_number||"";
 $("genre").value=row.genre;$("description").value=row.description||"";
 $("publish").checked=row.is_published;
 $("video-file").value="";$("poster-file").value="";
 $("video-file-label").textContent="Trocar vídeo (opcional)";
 $("poster-file-label").textContent="Trocar capa (opcional)";
 $("submit-upload").textContent="Salvar alterações";
 status("upload-message","Editando “"+row.title+"”. Você pode mudar só o texto ou trocar arquivos.");
 document.querySelector(".editor").scrollIntoView({behavior:"smooth",block:"start"});
}
function resetForm(){
 editing=null;$("upload-form").reset();$("form-title").textContent="Adicionar filme ou episódio";
 $("cancel-edit").hidden=true;$("series-fields").hidden=true;$("series-name").required=false;$("episode-number").required=false;
 $("video-file-label").textContent="Selecionar vídeo do telefone";$("poster-file-label").textContent="Escolher capa (opcional)";
 $("submit-upload").textContent="Enviar para a NovaPlay";$("progress-box").hidden=true;$("publish").checked=false;
}
async function togglePublish(row){
 if(busy)return;
 const publish=!row.is_published;
 if(publish&&!confirm("Publicar “"+row.title+"” para todos os visitantes da NovaPlay?"))return;
 const {error}=await client.from("novaplay_library").update({is_published:publish}).eq("id",row.id);
 if(error)alert("Falha ao alterar publicação: "+errorText(error));
 else await loadLibrary();
}
async function removeItem(row){
 if(busy)return;
 if(!confirm("Excluir “"+row.title+"” definitivamente? O vídeo e a capa também serão removidos. Esta ação não tem volta."))return;
 const {error}=await client.from("novaplay_library").delete().eq("id",row.id);
 if(error){alert("Não foi possível excluir: "+errorText(error));return;}
 const cleanup=[client.storage.from(VIDEO_BUCKET).remove([row.video_path])];
 if(row.poster_path)cleanup.push(client.storage.from(POSTER_BUCKET).remove([row.poster_path]));
 const results=await Promise.allSettled(cleanup);
 if(results.some(x=>x.status==="rejected"||x.value?.error))alert("O conteúdo saiu da biblioteca, mas a limpeza dos arquivos teve uma falha. Confira o Storage depois.");
 if(editing?.id===row.id)resetForm();
 await loadLibrary();
}
async function sendForm(e){
 e.preventDefault();if(busy||!sessionUser)return;
 const video=$("video-file").files[0]||null,cover=$("poster-file").files[0]||null;
 if(!editing&&!video){status("upload-message","Escolha o vídeo do seu telefone para continuar.",true);return}
 if(video){
  if(!fileKind(video)){status("upload-message","Esse formato não é compatível. Use MP4, WebM ou OGV.",true);return}
  if(video.size>MAX_VIDEO){status("upload-message","Este vídeo tem "+(video.size/(1024*1024)).toFixed(1)+" MB. O limite atual é 50 MB. Para filmes maiores, precisaremos aumentar o plano de armazenamento.",true);return}
  if(video.size<1){status("upload-message","O vídeo está vazio.",true);return}
 }
 if(cover){
  if(!fileKind(cover,false)||cover.size>MAX_POSTER){status("upload-message","A capa deve ser JPG, PNG ou WebP, com no máximo 5 MB.",true);return}
 }
 const kind=$("kind").value;
 const payload={
  title:$("title").value.trim(),
  description:$("description").value.trim(),
  kind,
  series_title:kind==="episode"?$("series-name").value.trim():null,
  episode_number:kind==="episode"?Number($("episode-number").value):null,
  production_year:$("year").value?Number($("year").value):null,
  genre:$("genre").value.trim()||"Autoral",
  is_published:$("publish").checked
 };
 if(payload.title.length<2){status("upload-message","Informe um título válido.",true);return}
 if(kind==="episode"&&(!payload.series_title||!payload.episode_number)){status("upload-message","Preencha o nome da série e o número do episódio.",true);return}
 disable(true);status("upload-message","Iniciando upload. Mantenha esta página aberta até terminar.");
 let newVideo=null,newPoster=null;
 try{
  let generated={duration:null,thumbnail:null};
  if(video){status("upload-message","Lendo duração e preparando capa...");generated=await inspectVideo(video);
   if(generated.duration!==null)payload.duration_seconds=generated.duration;
  }
  const selectedCover=cover||generated.thumbnail;
  if(selectedCover){status("upload-message",cover?"Enviando capa...":"Enviando capa gerada automaticamente...");newPoster=await uploadCover(selectedCover)}
  if(video){
   newVideo=createVideoPath(video);
   await uploadVideo(video,newVideo);
  }
  if(newVideo)Object.assign(payload,{video_path:newVideo,mime_type:extForMime(video).mime,file_size_bytes:video.size});
  if(newPoster)payload.poster_path=newPoster;
  if(!editing)payload.created_by=sessionUser.id;
  status("upload-message","Salvando informações no catálogo...");
  let dbResult;
  if(editing)dbResult=await client.from("novaplay_library").update(payload).eq("id",editing.id).select("id").single();
  else dbResult=await client.from("novaplay_library").insert(payload).select("id").single();
  if(dbResult.error)throw dbResult.error;
  // Only clean up originals after database points to the replacements.
  if(editing&&newVideo&&editing.video_path!==newVideo)await client.storage.from(VIDEO_BUCKET).remove([editing.video_path]);
  if(editing&&newPoster&&editing.poster_path&&editing.poster_path!==newPoster)await client.storage.from(POSTER_BUCKET).remove([editing.poster_path]);
  if(video)sessionStorage.removeItem(pendingKey(video));
  resetForm();status("upload-message","Conteúdo salvo! "+(payload.is_published?"Ele já aparece no catálogo público.":"Ele ficou como rascunho."),false,true);
  await loadLibrary();
 }catch(err){
  // If insert/update fails, never remove an upload that may still be resumed.
  status("upload-message","Não foi possível concluir: "+errorText(err)+" Corrija o problema e tente novamente.",true);
 }finally{disable(false);}
}
async function authAction(e){
 e.preventDefault();
 const email=$("email").value.trim(),password=$("password").value;
 $("sign-in").disabled=true;status("auth-message","Verificando acesso...");
 try{
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error)throw error;
  status("auth-message","");await checkSession();
 }catch(e){status("auth-message","Não foi possível entrar: "+errorText(e),true)}
 finally{$("sign-in").disabled=false}
}
async function signUp(){
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||password.length<8){status("auth-message","Informe seu e-mail e escolha uma senha com no mínimo 8 caracteres.",true);return}
 const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
 if(error)status("auth-message",errorText(error),true);
 else{status("auth-message",data.session?"Cadastro criado. Aguardando liberação administrativa.":"Cadastro solicitado. Verifique seu e-mail para confirmar a conta e peça a liberação administrativa.",false,true);if(data.session)await checkSession();}
}
async function forgot(){
 const email=$("email").value.trim();
 if(!email){status("auth-message","Digite seu e-mail primeiro.",true);return}
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
 status("auth-message",error?errorText(error):"Se a conta existir, enviaremos instruções de recuperação para esse e-mail.",!!error,!error);
}
function init(){
 if(!window.supabase?.createClient){show("login-view");status("auth-message","Não foi possível carregar a conexão de armazenamento. Confira a internet e atualize a página.",true);return}
 client=window.supabase.createClient(API_URL,PUBLIC_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
 $("login-form").onsubmit=authAction;$("signup").onclick=signUp;$("forgot").onclick=forgot;
 $("pending-exit").onclick=async()=>{await client.auth.signOut();show("login-view")};
 $("logout").onclick=async()=>{if(busy)return;await client.auth.signOut();sessionUser=null;show("login-view")};
 $("upload-form").onsubmit=sendForm;$("kind").onchange=setKind;
 $("cancel-edit").onclick=()=>{resetForm();status("upload-message","Edição cancelada.")};
 $("refresh-list").onclick=loadLibrary;$("filter-title").oninput=renderLibrary;
 $("video-file").onchange=()=>{$("video-file-label").textContent=$("video-file").files[0]?.name||"Selecionar vídeo do telefone"};
 $("poster-file").onchange=()=>{$("poster-file-label").textContent=$("poster-file").files[0]?.name||"Escolher capa (opcional)"};
 client.auth.onAuthStateChange((event)=>{
  if(event==="PASSWORD_RECOVERY"){setTimeout(async()=>{const pass=prompt("Digite sua nova senha (pelo menos 8 caracteres):");if(pass&&pass.length>=8){const {error}=await client.auth.updateUser({password:pass});alert(error?errorText(error):"Senha alterada. Agora você pode entrar.")}},100)}
 });
 checkSession();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
