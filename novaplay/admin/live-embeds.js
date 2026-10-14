(()=>{
const $=id=>document.getElementById(id);
const client=()=>window.supabase.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
let db, testedUrl=null, testPassed=false;
const SPTV_HTTP_ORIGIN="http://95.211.149.215:8081/look/sptv/playlist.m3u8";
const SPTV_HTTPS_PROXY="https://nplay-sptv-hls.luandersonjesussantos063.workers.dev/look/sptv/playlist.m3u8";
function playableUrl(url){if(url.startsWith("https://"))return url;if(url===SPTV_HTTP_ORIGIN)return SPTV_HTTPS_PROXY;throw Error("Link HTTP aceito, mas ainda não há um gateway HTTPS configurado para este servidor. Navegadores bloqueiam testes HTTP diretos em páginas HTTPS.");}
const isHls=u=>/\.m3u8(?:\?|$)/i.test(u);
function testStatus(msg){const el=$("live-test-message");if(el)el.textContent=msg;}
async function testLink(){
 const raw=$("live-embed-url").value.trim();let url;
 try{url=parse(raw)}catch(e){testStatus("❌ "+e.message);return}
 let playbackUrl;try{playbackUrl=playableUrl(url)}catch(e){testStatus("⚠️ "+e.message);return}
 testedUrl=null;testPassed=false;$("live-test-publish").disabled=true;
 if(!isHls(url)){testStatus("Links iframe não permitem verificar o sinal automaticamente. Use a prévia no site antes de publicar.");return}
 testStatus("Verificando playlist e reprodução do sinal...");
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(playbackUrl,{cache:"no-store",signal:controller.signal});
  if(!res.ok)throw Error("Servidor retornou HTTP "+res.status);
  const body=await res.text();
  if(!body.trim().startsWith("#EXTM3U"))throw Error("Resposta não é uma playlist M3U8 válida.");
  if(!body.includes("#EXTINF")&&!body.includes("#EXT-X-STREAM-INF"))throw Error("Playlist sem segmentos ou variantes de vídeo.");
  const video=$("live-test-video");video.hidden=false;video.muted=true;video.playsInline=true;
  if(window.nplayAdminTestHls){window.nplayAdminTestHls.destroy();window.nplayAdminTestHls=null}
  video.removeAttribute("src");video.load();
  await new Promise((resolve,reject)=>{
   let done=false;const timer=setTimeout(()=>finish(Error("Nenhum vídeo recebido em 18 segundos.")),18000);
   function finish(error){if(done)return;done=true;clearTimeout(timer);video.removeEventListener("playing",onPlay);video.removeEventListener("error",onError);if(error)reject(error);else resolve()}
   const onPlay=()=>finish(),onError=()=>finish(Error("O navegador não conseguiu reproduzir o sinal."));
   video.addEventListener("playing",onPlay);video.addEventListener("error",onError);
   if(video.canPlayType("application/vnd.apple.mpegurl")){video.src=playbackUrl;video.play().catch(onError)}
   else if(window.Hls?.isSupported()){
    const hls=new window.Hls({enableWorker:true});window.nplayAdminTestHls=hls;
    hls.on(window.Hls.Events.ERROR,(_,d)=>{if(d.fatal)finish(Error("HLS: "+d.details))});
    hls.attachMedia(video);hls.loadSource(playbackUrl);hls.on(window.Hls.Events.MANIFEST_PARSED,()=>video.play().catch(onError));
   }else finish(Error("Biblioteca HLS indisponível neste navegador."));
  });
  testedUrl=playbackUrl;testPassed=true;$("live-test-publish").disabled=false;
  testStatus("✅ Sinal confirmado: vídeo reproduzido. Agora você pode publicar o canal.");
 }catch(e){testStatus("❌ Sinal não confirmado: "+(e.name==="AbortError"?"servidor demorou mais de 12 segundos":e.message)+". Não publique este endereço.")}
 finally{clearTimeout(timeout)}
}

function parse(raw){const m=raw.match(/<iframe[^>]+src=["']([^"']+)/i);const u=new URL(m?m[1]:raw.trim());if(!["http:","https:"].includes(u.protocol))throw Error("Use um endereço HTTP ou HTTPS.");if(u.username||u.password)throw Error("Endereços com usuário ou senha não são aceitos.");return u.href}
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
$("live-embed-controls").innerHTML='<form id="live-embed-form" style="display:grid;gap:12px;max-width:680px"><label>Nome do canal<input id="live-embed-title" required></label><label>Link HTTP/HTTPS ou código iframe<textarea id="live-embed-url" required rows="3"></textarea></label><label><input id="live-embed-rights" type="checkbox" required> Confirmo autorização para exibição na NPlay</label><label><input id="live-embed-published" type="checkbox"> Publicar imediatamente</label><button class="primary" type="submit">Salvar canal</button></form><div style="padding:16px;border:1px solid #3a6396;border-radius:12px"><h3>Testador de sinal HLS</h3><p>Informe nome e link HTTP ou HTTPS .m3u8 acima, clique em testar e aguarde a reprodução. Um retorno HTTP 200 sozinho não comprova sinal.</p><button id="live-test-button" type="button" class="outline">🔎 Testar sinal</button> <button id="live-test-publish" type="button" class="primary" disabled>✓ Publicar canal testado</button><p id="live-test-message" role="status" aria-live="polite"></p><video id="live-test-video" controls muted playsinline hidden style="display:block;width:100%;max-width:600px;max-height:330px;background:#000;border-radius:10px"></video><small>Links HTTP são aceitos para diagnóstico. A reprodução no site HTTPS exige um gateway HTTPS; o endereço SPTV já possui um gateway de teste.</small></div><p id="live-embed-message"></p><h3>Canais cadastrados</h3><div id="live-embed-list"></div>';
$("live-test-button").onclick=testLink;
$("live-embed-url").addEventListener("input",()=>{testedUrl=null;testPassed=false;$("live-test-publish").disabled=true;testStatus("Link alterado. Teste novamente.")});
$("live-test-publish").onclick=async()=>{if(!testPassed||!testedUrl)return;const title=$("live-embed-title").value.trim();if(!title){testStatus("Informe o nome do canal.");return}if(!$("live-embed-rights").checked){testStatus("Confirme a autorização de exibição.");return}const btn=$("live-test-publish");btn.disabled=true;const {error}=await db.from("novaplay_live_embeds").insert({title,embed_url:testedUrl,rights_confirmed:true,is_published:true});if(error){testStatus("Erro ao publicar: "+error.message);btn.disabled=false;return}testStatus("✅ Canal publicado na NPlay.");$("live-embed-form").reset();testPassed=false;testedUrl=null;refresh()};
$("live-embed-form").onsubmit=async e=>{e.preventDefault();try{
const title=$("live-embed-title").value.trim(),rawUrl=parse($("live-embed-url").value),embed_url=isHls(rawUrl)?playableUrl(rawUrl):rawUrl;
if(!isHls(rawUrl)&&!rawUrl.startsWith("https://"))throw Error("Iframes devem utilizar HTTPS.");
if(!title)throw Error("Informe o nome.");
if(isHls(embed_url)&&$("live-embed-published").checked)throw Error("Para publicar um canal HLS, use Testar sinal e depois Publicar canal testado.");
const {error}=await db.from("novaplay_live_embeds").insert({title,embed_url,rights_confirmed:true,is_published:$("live-embed-published").checked});
if(error)throw error;$("live-embed-message").textContent="Canal salvo.";$("live-embed-form").reset();refresh()
}catch(err){$("live-embed-message").textContent="Erro: "+err.message}};
document.querySelector('[data-admin-tab="canais"]')?.addEventListener("click",refresh);
refresh()
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init()
})();