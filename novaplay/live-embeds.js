(()=>{
const $=id=>document.getElementById(id);
async function load(){
if(!window.supabase){setTimeout(load,250);return}
const db=window.supabase.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
const {data,error}=await db.from("novaplay_live_embeds").select("id,title,embed_url").eq("is_published",true).order("created_at",{ascending:false});
const list=$("iframe-channel-list");if(!list)return;
if(error){list.textContent="Não foi possível carregar os canais.";return}
list.replaceChildren();
for(const item of data){
const button=document.createElement("button");button.type="button";button.textContent="📺 "+item.title;button.style.cssText="border:1px solid #365075;border-radius:12px;background:#14243c;color:white;padding:16px;text-align:left;cursor:pointer";
button.onclick=()=>{
const u=new URL(item.embed_url);if(u.protocol!=="https:")return;
const player=$("iframe-channel-player");player.replaceChildren();
const frame=document.createElement("iframe");frame.src=u.href;frame.title=item.title;frame.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";frame.allowFullscreen=true;frame.referrerPolicy="strict-origin-when-cross-origin";frame.style.cssText="width:100%;height:100%;border:0";player.append(frame);
$("iframe-channel-heading").textContent=item.title;
$("iframe-channel-viewer").hidden=false;
$("iframe-channel-viewer").scrollIntoView({behavior:"smooth",block:"start"})
};
list.append(button)
}
if(!data.length)list.textContent="Nenhum canal disponível no momento.";
}
function init(){
const button=$("iframe-channels-open");if(!button)return;
const mobile=$("iframe-channels-open-mobile");if(mobile)mobile.onclick=()=>button.click();
button.onclick=()=>{$("iframe-channels-panel").hidden=false;$("iframe-channels-panel").scrollIntoView({behavior:"smooth"});load()};
$("iframe-channel-close").onclick=()=>{$("iframe-channel-player").replaceChildren();$("iframe-channel-viewer").hidden=true};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init()
})();