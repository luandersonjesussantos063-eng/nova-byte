(()=>{
const $=id=>document.getElementById(id);
const client=()=>window.supabase.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
let db;
function parse(raw){const m=raw.match(/<iframe[^>]+src=["']([^"']+)/i);const u=new URL(m?m[1]:raw.trim());if(u.protocol!=="https:")throw Error("O endereço precisa ser HTTPS.");return u.href}
async function refresh(){
const list=$("live-embed-list");if(!list)return;
const {data,error}=await db.from("novaplay_live_embeds").select("*").order("created_at",{ascending:false});
if(error){list.textContent=error.message;return}list.replaceChildren();
for(const item of data){
const box=document.createElement("div");box.style.cssText="border:1px solid #365075;border-radius:10px;padding:12px;margin:8px 0";
const title=document.createElement("strong");title.textContent=item.title+" — "+(item.is_published?"Publicado":"Rascunho");box.append(title);
const toggle=document.createElement("button");toggle.type="button";toggle.textContent=item.is_published?"Despublicar":"Publicar";toggle.style.marginLeft="12px";
toggle.onclick=async()=>{const {error}=await db.from("novaplay_live_embeds").update({is_published:!item.is_published}).eq("id",item.id);$("live-embed-message").textContent=error?error.message:"Atualizado";refresh()};
const del=document.createElement("button");del.type="button";del.textContent="Excluir";del.style.marginLeft="8px";
del.onclick=async()=>{if(!confirm("Excluir canal?"))return;const {error}=await db.from("novaplay_live_embeds").delete().eq("id",item.id);$("live-embed-message").textContent=error?error.message:"Excluído";refresh()};
box.append(toggle,del);list.append(box)
}
if(!data.length)list.textContent="Nenhum canal cadastrado.";
}
function init(){
if(!$("live-embed-controls"))return;
if(!window.supabase){setTimeout(init,300);return}
db=client();
$("live-embed-controls").innerHTML='<form id="live-embed-form" style="display:grid;gap:12px;max-width:680px"><label>Nome do canal<input id="live-embed-title" required></label><label>Link HTTPS ou código iframe<textarea id="live-embed-url" required rows="3"></textarea></label><label><input id="live-embed-rights" type="checkbox" required> Confirmo autorização para exibição na NPlay</label><label><input id="live-embed-published" type="checkbox"> Publicar imediatamente</label><button class="primary" type="submit">Salvar canal</button></form><p id="live-embed-message"></p><h3>Canais cadastrados</h3><div id="live-embed-list"></div>';
$("live-embed-form").onsubmit=async e=>{e.preventDefault();try{
const title=$("live-embed-title").value.trim(),embed_url=parse($("live-embed-url").value);
if(!title)throw Error("Informe o nome.");
const {error}=await db.from("novaplay_live_embeds").insert({title,embed_url,rights_confirmed:true,is_published:$("live-embed-published").checked});
if(error)throw error;$("live-embed-message").textContent="Canal salvo.";$("live-embed-form").reset();refresh()
}catch(err){$("live-embed-message").textContent="Erro: "+err.message}};
document.querySelector('[data-admin-tab="canais"]')?.addEventListener("click",refresh);
refresh()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init()
})();