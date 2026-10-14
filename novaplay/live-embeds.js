(()=>{
const $=id=>document.getElementById(id);
const DASH_URL="https://otte.live.fly.ww.aiv-cdn.net/gru-nitro/live/clients/dash/enc/nelfyucw9a/out/v1/6ffb2c365ad14f88b154591beb43d1f6/cenc.mpd";
let dashPlayer=null;
async function stopDash(){if(dashPlayer){try{await dashPlayer.destroy()}catch(e){}dashPlayer=null}}
function shakaReady(){
 if(window.shaka?.Player)return Promise.resolve();
 return new Promise((resolve,reject)=>{
 const script=document.createElement("script");script.src="https://cdnjs.cloudflare.com/ajax/libs/shaka-player/4.12.8/shaka-player.compiled.js";
 script.onload=()=>window.shaka?.Player?resolve():reject(Error("Biblioteca indisponível"));
 script.onerror=()=>reject(Error("Não foi possível carregar o player DASH"));document.head.append(script)
 })
}
async function playDash(){
 await stopDash();const player=$("iframe-channel-player");player.replaceChildren();
 const video=document.createElement("video");video.controls=true;video.autoplay=true;video.playsInline=true;video.muted=true;
 video.style.cssText="width:100%;height:100%;background:#000;object-fit:contain";
 const status=document.createElement("p");status.style.cssText="color:#fff;padding:8px;font-size:13px";
 status.textContent="Conectando ao sinal DASH autorizado...";
 player.append(video,status);
 $("iframe-channel-heading").textContent="Premiere Clubes · Player NPlay (teste)";
 $("iframe-channel-viewer").hidden=false;$("iframe-channel-viewer").scrollIntoView({behavior:"smooth",block:"start"});
 try{
 await shakaReady();window.shaka.polyfill.installAll();
 if(!window.shaka.Player.isBrowserSupported())throw Error("Este navegador não suporta reprodução DASH");
 const instance=new window.shaka.Player();dashPlayer=instance;
 await instance.attach(video);
 instance.addEventListener("error",event=>{status.textContent="Falha na reprodução DASH (código "+(event.detail?.code||"desconhecido")+"). Pode haver DRM, codec incompatível ou segmentos indisponíveis."});
 await instance.load(DASH_URL);
 const tracks=instance.getVariantTracks();
 if(!tracks.length){status.textContent="Manifesto recebido, mas nenhuma faixa de vídeo compatível foi encontrada. Pode haver codec incompatível ou DRM.";return}
 status.textContent="Sinal carregado. Use o botão de reprodução se necessário.";
 try{await video.play();status.textContent="Aguardando imagem do canal...";setTimeout(()=>{if(dashPlayer===instance&&video.currentTime===0)status.textContent="Manifesto recebido, mas sem imagem. Possível bloqueio dos segmentos, codec incompatível ou DRM. O player incorporado continua disponível.";else if(dashPlayer===instance)status.textContent=""},12000)}catch(e){status.textContent="Clique em reproduzir para iniciar o canal (teste inicialmente sem áudio)."}
 }catch(e){status.textContent="Não foi possível reproduzir o sinal diretamente ("+(e.code||e.message||"erro desconhecido")+"). Utilize a opção de incorporação original."}
}
async function load(){
if(!window.supabase){setTimeout(load,250);return}
const db=window.supabase.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
const {data,error}=await db.from("novaplay_live_embeds").select("id,title,embed_url").eq("is_published",true).order("created_at",{ascending:false});
const list=$("iframe-channel-list");if(!list)return;
if(error){list.textContent="Não foi possível carregar os canais cadastrados. O canal de teste continua disponível.";}
list.replaceChildren();
const channels=[{id:"premiere-clubes-dash",title:"Premiere Clubes · Player NPlay (teste)",dash:true},{id:"premiere-clubes-embed",title:"Premiere Clubes · teste de incorporação",embed_url:"https://rdcanais.org/premiereclubes",restricted:true},...(data||[])];
for(const item of channels){
const button=document.createElement("button");button.type="button";button.textContent="📺 "+item.title;button.style.cssText="border:1px solid #365075;border-radius:12px;background:#14243c;color:white;padding:16px;text-align:left;cursor:pointer";
button.onclick=async()=>{
if(item.dash){await playDash();return}
await stopDash();
const u=new URL(item.embed_url);if(u.protocol!=="https:")return;
const player=$("iframe-channel-player");player.replaceChildren();
const frame=document.createElement("iframe");frame.src=u.href;frame.title=item.title;frame.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";frame.allowFullscreen=true;
// Restrict only this test embed: no popups or top-level navigation permissions.
// The remote provider may refuse framing or require permissions we cannot grant safely.
// The source blocks sandboxed embedding. Do not bypass its player checks.
frame.referrerPolicy="strict-origin-when-cross-origin";frame.style.cssText="width:100%;height:100%;border:0";player.append(frame);
$("iframe-channel-heading").textContent=item.title;
$("iframe-channel-viewer").hidden=false;
$("iframe-channel-viewer").scrollIntoView({behavior:"smooth",block:"start"})
};
list.append(button)
}
if(!channels.length)list.textContent="Nenhum canal disponível no momento.";
}
function init(){
const button=$("iframe-channels-open");if(!button)return;
const mobile=$("iframe-channels-open-mobile");if(mobile)mobile.onclick=()=>button.click();
button.onclick=()=>{$("iframe-channels-panel").hidden=false;$("iframe-channels-panel").scrollIntoView({behavior:"smooth"});load()};
$("iframe-channel-close").onclick=async()=>{await stopDash();if(window.nplaySptvHls){window.nplaySptvHls.destroy();window.nplaySptvHls=null}$("iframe-channel-player").replaceChildren();$("iframe-channel-viewer").hidden=true};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init()
})();