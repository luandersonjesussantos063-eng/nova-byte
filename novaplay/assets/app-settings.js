/* Preferências deste aparelho e configurações do aplicativo NPlay. */
(()=>{
"use strict";
const KEY="nplay-app-settings-v1",defaults=Object.freeze({videoData:"auto",notifications:true,resume:true,statistics:true});
function normalize(value){
 const source=value&&typeof value==="object"?value:{};
 return {videoData:["auto","economy","maximum"].includes(source.videoData)?source.videoData:"auto",
  notifications:source.notifications!==false,resume:source.resume!==false,statistics:source.statistics!==false};
}
function createStore(storage,changed=()=>{}){
 const get=()=>{try{return normalize(JSON.parse(storage.getItem(KEY)||"null"));}catch{return {...defaults};}};
 return {get,set(patch){const next=normalize({...get(),...patch});try{storage.setItem(KEY,JSON.stringify(next));}catch{return false;}changed(next);return true;}};
}
function effectiveDataMode(preferences,connection){return preferences.videoData==="auto"&&connection?.saveData?"economy":preferences.videoData;}
function configureHls(hls,preferences,connection){
 if(!hls)return;
 const mode=effectiveDataMode(preferences,connection),levels=hls.levels||[];
 // O limite por tamanho da tela também escreve em autoLevelCapping.
 // No modo econômico, só o limite escolhido aqui deve controlar a qualidade.
 hls.capLevelToPlayerSize=mode==="auto";
 if(mode!=="economy"){hls.autoLevelCapping=-1;return;}
 let selected=-1,best=-1;
 levels.forEach((level,index)=>{
  const height=Number(level.height)||0,bitrate=Number(level.bitrate)||0;
  const score=height>0?height*1000000000+bitrate:bitrate;
  if((height>0?height<=480:bitrate>0&&bitrate<=1000000)&&score>best){selected=index;best=score;}
 });
 if(selected<0&&levels.length)selected=levels.reduce((index,level,i)=>(Number(level.bitrate)||Number(level.height)||Infinity)<(Number(levels[index].bitrate)||Number(levels[index].height)||Infinity)?i:index,0);
 hls.autoLevelCapping=selected;
}
async function storageInfo(storage,cacheStorage){
 const estimate=storage?.estimate?await storage.estimate():null;
 const names=cacheStorage?await cacheStorage.keys():[];
 let files=0;for(const name of names.filter(n=>n.startsWith("novaplay-")))files+=(await (await cacheStorage.open(name)).keys()).length;
 return {usage:Number.isFinite(estimate?.usage)?estimate.usage:null,quota:Number.isFinite(estimate?.quota)?estimate.quota:null,files};
}
async function clearCache(cacheStorage){
 if(!cacheStorage)throw Error("O armazenamento do app não está disponível neste navegador.");
 const names=(await cacheStorage.keys()).filter(n=>n.startsWith("novaplay-"));
 const deleted=await Promise.all(names.map(name=>cacheStorage.delete(name)));
 return deleted.filter(Boolean).length;
}
function bytes(value){
 if(!Number.isFinite(value))return "Não informado";
 return value>=1024**3?(value/1024**3).toFixed(1)+" GB":(value/1024**2).toFixed(value<1024**2?2:1)+" MB";
}
async function networkCheck({fetchFn=fetch,base=location.href,signal,now=()=>performance.now()}={}){
 const url=new URL("./manifest.webmanifest",base);url.searchParams.set("nplay-diagnostic",String(Date.now()));
 const start=now(),response=await fetchFn(url.href,{cache:"no-store",signal});
 if(!response.ok)throw Error("A NPlay respondeu com erro "+response.status+".");
 const data=await response.json();if(!data.name)throw Error("A resposta da NPlay não pôde ser confirmada.");
 return {latency:Math.max(1,Math.round(now()-start))};
}
async function speedCheck({fetchFn=fetch,base=location.href,signal,now=()=>performance.now(),onProgress=()=>{}}={}){
 let transferred=0,requests=0;const start=now();
 // O arquivo existente tem 528.168 bytes: no máximo 15 transferências (<8 MB).
 for(let i=0;i<15;i++){
  const url=new URL("./assets/profile-hero-wide-v04515.webp",base);url.searchParams.set("nplay-diagnostic","speed-"+Date.now()+"-"+i);
  const response=await fetchFn(url.href,{cache:"no-store",signal});
  if(!response.ok)throw Error("Não foi possível medir a transferência agora.");
  const data=await response.arrayBuffer();transferred+=data.byteLength;requests++;onProgress(transferred);
  if(now()-start>=1500)break;
 }
 const elapsed=now()-start;
 if(!transferred||elapsed<=0)throw Error("Não foi possível obter uma medição válida.");
 return {mbps:transferred*8/(elapsed/1000)/1000000,bytes:transferred,requests,elapsed};
}
const store=createStore({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},settings=>window.dispatchEvent(new CustomEvent("nplay-settings-change",{detail:{settings}})));
const api={get:store.get,set:store.set,effectiveDataMode:()=>effectiveDataMode(store.get(),navigator.connection),configureHls:hls=>configureHls(hls,store.get(),navigator.connection)};
window.NPlaySettings=api;
window.NPlaySettingsCore=Object.freeze({KEY,defaults,normalize,createStore,effectiveDataMode,configureHls,storageInfo,clearCache,bytes,networkCheck,speedCheck});
function init(){
 const make=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
 const icons={settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 3v4l3 1 2 3 4-1 3 1 2-3 3-1v-4l2-3-2-3-3-1-1-3z"/>',video:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',bell:'<path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5zM10 21h4"/>',storage:'<path d="M4 5h16v14H4zM4 10h16M7 15h3"/>',phone:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',account:'<circle cx="12" cy="7" r="4"/><path d="M3 22v-3a9 9 0 0 1 18 0v3"/>',wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r="1"/>',speed:'<path d="M4 20a10 10 0 1 1 16 0M12 14l5-7"/><circle cx="12" cy="14" r="1"/>',trash:'<path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 10v7M12 6v1"/>',shield:'<path d="m12 2 9 4v6c0 5-5 9-9 10-4-1-9-5-9-10V6zM8 12l3 3 5-6"/>',help:'<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 0 1 6 0c0 3-3 2-3 6m0 3v1"/>',exit:'<path d="M9 3H3v18h6m6-14 5 5-5 5m-8-5h13"/>'};
 const icon=name=>{const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");svg.innerHTML=icons[name]||icons.info;return svg;};
 const layer=make("section",undefined,"nplay-settings");layer.id="nplay-settings";layer.hidden=true;layer.setAttribute("role","dialog");layer.setAttribute("aria-modal","true");layer.setAttribute("aria-labelledby","nplay-settings-title");
 const shell=make("div",undefined,"nplay-settings-shell"),header=make("header"),back=make("button"),title=make("h1","Configurações do aplicativo");
 back.type="button";back.setAttribute("aria-label","Voltar");back.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 4-8 8 8 8M4 12h17"/></svg>';title.id="nplay-settings-title";
 const content=make("div",undefined,"nplay-settings-content"),feedback=make("p","","nplay-settings-feedback");feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 header.append(back,title);shell.append(header,content,feedback);layer.append(shell);document.body.append(layer);
 let page="main",returnFocus=null,controller=null,job=0,ownsHistory=false,afterClose=null;
 function stopJob(){job++;controller?.abort();controller=null;}
 function close(fromHistory=false,returnToMenu=true){
  if(layer.hidden)return;stopJob();layer.hidden=true;document.body.classList.remove("nplay-settings-open");
  if(ownsHistory&&!fromHistory){ownsHistory=false;history.back();}else ownsHistory=false;
  const done=afterClose;afterClose=null;if(returnToMenu&&done)done();else returnFocus?.focus();
 }
 function section(label){const wrap=make("section",undefined,"nplay-settings-group");wrap.append(make("h2",label));content.append(wrap);return wrap;}
 function row(parent,label,detail,{symbol="info",action,href,toggle}={}){
  const el=make(href?"a":toggle?"label":action?"button":"div",undefined,"nplay-settings-row");
  if(href){el.href=href;el.target="_blank";el.rel="noopener noreferrer";}else if(action){el.type="button";el.addEventListener("click",action);}
  const copy=make("span",undefined,"nplay-settings-row-copy");copy.append(make("strong",label));if(detail)copy.append(make("small",detail));el.append(icon(symbol),copy);
  if(toggle){
   const input=make("input");input.type="checkbox";input.checked=toggle.value;input.setAttribute("role","switch");input.setAttribute("aria-label",label);
   input.addEventListener("change",()=>{if(toggle.change(input.checked)===false){input.checked=!input.checked;feedback.textContent="Não foi possível salvar. Confira se o navegador permite guardar dados.";}});el.append(input);
  }else if(action||href)el.append(make("span",href?"↗":"›","nplay-settings-chevron"));
  parent.append(el);return el;
 }
 async function addAdminAccess(parent,token){
  // Only verified, logged-in administrators can see this shortcut.
  // All privileged operations remain protected independently by Supabase RLS.
  const client=window.NPlayAccessClient;
  if(!client)return;
  try{
   const {data,error}=await client.auth.getUser();
   const user=data?.user;
   if(error||!user?.email||!user.email_confirmed_at||user.is_anonymous)return;
   // Follow the owner-claim flow of the existing protected admin screen.
   await client.rpc("novaplay_claim_owner_access");
   const {data:admin,error:accessError}=await client.from("novaplay_admins").select("user_id").eq("user_id",user.id).maybeSingle();
   if(accessError||!admin||token!==job||layer.hidden||page!=="main"||!parent.isConnected)return;
   row(parent,"Painel ADM","Gerenciar o aplicativo · "+user.email,{symbol:"shield",action:()=>location.assign(new URL("./admin/",location.href).href)});
  }catch{
   // Fail closed if the identity or role cannot be verified.
  }
 }
 const deviceCode=()=>document.getElementById("nplay-device-code")?.textContent?.replace(/^Aparelho:\s*/,"").trim()||document.getElementById("nplay-access-code")?.textContent||"Não informado";
 const version=()=>document.querySelector('meta[name="nplay-version"]')?.content||"";
 const dataLabels={auto:"Automático",economy:"Economizar dados",maximum:"Melhor qualidade"};
 function selectPreference(key,label,options,description){
  const group=section(label);if(description)group.append(make("p",description,"nplay-settings-note"));
  for(const [value,name,detail] of options){
   const choice=make("button",undefined,"nplay-settings-choice");choice.type="button";choice.setAttribute("aria-pressed",String(store.get()[key]===value));
   const copy=make("span");copy.append(make("strong",name),make("small",detail));choice.append(copy,make("span",store.get()[key]===value?"✓":""));
   choice.onclick=()=>{if(!store.set({[key]:value})){feedback.textContent="Não foi possível salvar a preferência.";return;}render("main");};group.append(choice);
  }
 }
 async function loadStorage(target,token){
  try{
   const data=await storageInfo(navigator.storage,window.caches);if(token!==job||layer.hidden)return;
   target.replaceChildren();const bar=make("div",undefined,"nplay-storage-bar"),used=make("span");
   used.style.width=data.quota?Math.max(0,Math.min(100,(data.usage||0)/data.quota*100))+"%":"0%";bar.append(used);
   target.append(make("p","Armazenamento deste site no navegador"),bar,make("p","Usado: "+bytes(data.usage)+" · Disponível: "+bytes(data.quota!==null&&data.usage!==null?Math.max(0,data.quota-data.usage):null)),make("small",data.files+" arquivos temporários da NPlay. O total do site pode incluir outras páginas da NovaByte."));
  }catch{if(token===job)target.textContent="Não foi possível consultar o espaço neste navegador.";}
 }
 async function runDiagnostic(kind,target,button){
  stopJob();const token=job;controller=new AbortController();const active=controller;
  const timeout=setTimeout(()=>active.abort(),12000);button.disabled=true;target.textContent=kind==="speed"?"Medindo transferência…":"Verificando a conexão…";
  try{
   const result=kind==="speed"?await speedCheck({signal:active.signal,onProgress:n=>{if(token===job)target.textContent="Recebido: "+bytes(n)+"…";}}):await networkCheck({signal:active.signal});
   if(token!==job)return;
   target.textContent=kind==="speed"?result.mbps.toFixed(1)+" Mbps · velocidade aproximada até a NPlay · "+bytes(result.bytes)+" usados":"NPlay acessível · resposta em "+result.latency+" ms.";
  }catch(error){if(token===job)target.textContent=error.name==="AbortError"?"O teste demorou demais. Tente novamente quando a conexão estiver estável.":"Não foi possível completar o teste. Confira a internet e tente novamente.";}
  finally{clearTimeout(timeout);if(token===job){button.disabled=false;controller=null;}}
 }
 function diagnostic(parent,label,kind){
  const box=make("div",undefined,"nplay-diagnostic-result");box.setAttribute("role","status");box.setAttribute("aria-live","polite");
  const button=row(parent,label,kind==="speed"?"Medição aproximada; usa até 8 MB da conexão.":"Confere se este aparelho consegue alcançar a NPlay.",{symbol:kind==="speed"?"speed":"wifi",action:()=>runDiagnostic(kind,box,button)});parent.append(box);
 }
 function render(next="main"){
  stopJob();page=next;content.replaceChildren();feedback.textContent="";
  title.textContent={main:"Configurações do aplicativo",data:"Uso de dados",device:"Aparelho",account:"Conta e perfil",network:"Diagnóstico",specs:"Especificação de reprodução",licenses:"Licenças de código aberto",privacy:"Privacidade e dados",help:"Ajuda",clear:"Limpar arquivos temporários"}[page]||"Configurações";
  if(page==="main"){
   const prefs=store.get(),video=section("Reprodução de vídeo");
   row(video,"Uso de dados",dataLabels[prefs.videoData],{symbol:"video",action:()=>render("data")});
   row(video,"Retomar de onde parei","Abrir filmes e episódios na posição salva.",{symbol:"video",toggle:{value:prefs.resume,change:value=>store.set({resume:value})}});
   row(video,"Som da abertura","Tocar o som da NPlay ao iniciar.",{symbol:"video",toggle:{value:!!window.NPlayIntroAudio?.enabled?.(),change:value=>{window.NPlayIntroAudio?.setEnabled(value);return !!window.NPlayIntroAudio?.enabled?.()===value;}}});
   row(video,"Ouvir som da abertura",null,{symbol:"video",action:()=>{void window.NPlayIntroAudio?.preview?.();}});
   const alerts=section("Notificações");row(alerts,"Avisos no aplicativo","Mostrar o contador de novidades no sino.",{symbol:"bell",toggle:{value:prefs.notifications,change:value=>store.set({notifications:value})}});
   const storage=section("Armazenamento");row(storage,"Local de armazenamento","Neste aparelho · navegador da NPlay",{symbol:"storage"});
   row(storage,"Limpar arquivos temporários","Libera o cache do app; mantém perfis, favoritos e acesso.",{symbol:"trash",action:()=>render("clear")});
   const meter=make("div","Consultando espaço…","nplay-storage-summary");storage.append(meter);void loadStorage(meter,job);
   const about=section("Sobre");row(about,"Aparelho","NPlay "+version()+" · informações deste navegador",{symbol:"phone",action:()=>render("device")});row(about,"Conta e perfil",window.NPlayProfiles?.current?.()?.name||"Meu perfil",{symbol:"account",action:()=>render("account")});void addAdminAccess(about,job);
   const diagnostics=section("Diagnóstico");row(diagnostics,"Verifique a rede","Conexão e acesso à NPlay",{symbol:"wifi",action:()=>render("network")});row(diagnostics,"Especificação de reprodução","Formatos de vídeo e modo do aplicativo",{symbol:"video",action:()=>render("specs")});diagnostic(diagnostics,"Teste a velocidade da internet","speed");
   const legal=section("Informações e privacidade");row(legal,"Licenças de código aberto",null,{action:()=>render("licenses")});row(legal,"Privacidade e dados",null,{symbol:"shield",action:()=>render("privacy")});row(legal,"Política de privacidade da NovaByte",null,{symbol:"shield",href:"/privacidade.html"});row(legal,"Termos de uso do portal NovaByte",null,{href:"/termos.html"});
   content.append(make("p","NPlay "+version()+" · NovaByte Soluções","nplay-settings-signature"));
  }else if(page==="data"){
   selectPreference("videoData","Uso de dados do vídeo",[["auto","Automático","Ajusta a qualidade à conexão e ao tamanho da tela."],["economy","Economizar dados","Prefere até 480p quando o vídeo oferece outras qualidades."],["maximum","Melhor qualidade","Permite as maiores qualidades disponíveis, conforme a conexão."]],"A mudança vale para os próximos trechos de vídeos com qualidade adaptativa. Vídeos de qualidade única e players externos mantêm a qualidade da fonte.");
  }else if(page==="device"){
   const info=section("Este aparelho");row(info,"Versão do aplicativo",version(),{symbol:"info"});row(info,"Código do aparelho",deviceCode(),{symbol:"phone"});
   row(info,"Navegador",navigator.userAgent||"Não informado",{symbol:"info"});row(info,"Tela",screen.width+" × "+screen.height+" · escala "+(window.devicePixelRatio||1),{symbol:"phone"});
   row(info,"Modo de uso",window.matchMedia("(display-mode: standalone)").matches||navigator.standalone?"Aplicativo instalado":"Navegador",{symbol:"phone"});
  }else if(page==="account"){
   const account=section("Sua NPlay");row(account,"Perfil",window.NPlayProfiles?.current?.()?.name||"Meu perfil",{symbol:"account"});row(account,"Aparelho",deviceCode(),{symbol:"phone"});
   const access=document.documentElement.dataset.nplayAccess;row(account,"Situação do acesso",access==="approved"?"Aparelho liberado":access==="pending"?"Aguardando liberação":"Consulte a liberação do aparelho",{symbol:"shield"});
   row(account,"Gerenciar perfis",null,{symbol:"account",action:()=>{close(false,false);window.NPlayProfiles?.manage?.();}});row(account,"Sair do perfil","Voltar à escolha de perfis.",{symbol:"exit",action:()=>{close(false,false);window.NPlayProfiles?.exit?.();}});
  }else if(page==="network"){
   const net=section("Conexão");row(net,"Rede do aparelho",navigator.onLine===false?"Sem conexão detectada":"Conexão detectada",{symbol:"wifi"});
   if(navigator.connection?.effectiveType)row(net,"Conexão estimada",navigator.connection.effectiveType.toUpperCase(),{symbol:"wifi"});
   diagnostic(net,"Verificar acesso à NPlay","network");diagnostic(net,"Medir velocidade até a NPlay","speed");
  }else if(page==="specs"){
   const v=document.createElement("video"),spec=section("Recursos de reprodução");
   row(spec,"Vídeo HLS",window.Hls?.isSupported?.()?"Disponível pelo player da NPlay":v.canPlayType("application/vnd.apple.mpegurl")?"Disponível pelo navegador":"Não informado como compatível",{symbol:"video"});
   row(spec,"Vídeo MP4",v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')?"Compatível":"Compatibilidade não informada",{symbol:"video"});
   row(spec,"Transmitir para TV","Google Cast, AirPlay ou seletor nativo, conforme aparelho e vídeo.",{symbol:"video"});row(spec,"Qualidade preferida",dataLabels[store.get().videoData],{symbol:"video"});
  }else if(page==="licenses"){
   const libs=section("Bibliotecas utilizadas");
   for(const [name,license,url] of [["hls.js 1.7.3","Apache 2.0","https://github.com/video-dev/hls.js/blob/master/LICENSE"],["mpegts.js 1.7.3","Apache 2.0","https://github.com/xqq/mpegts.js/blob/master/LICENSE"],["Supabase JS 2.58.0","MIT","https://github.com/supabase/supabase-js/blob/master/LICENSE"]])row(libs,name,license,{href:url});
  }else if(page==="privacy"){
   const data=section("Suas preferências");row(data,"Estatísticas opcionais","Permitir o envio de aberturas de títulos e tentativas de reprodução.",{symbol:"shield",toggle:{value:store.get().statistics,change:value=>store.set({statistics:value})}});
   data.append(make("p","Perfis, favoritos, posição dos vídeos e preferências ficam salvos neste navegador. A liberação do aparelho e o acompanhamento de sessões pelo responsável continuam necessários para o acesso.","nplay-settings-note"));
   row(data,"Política de privacidade da NovaByte",null,{symbol:"shield",href:"/privacidade.html"});
  }else if(page==="clear"){
   const clear=section("Arquivos temporários");clear.append(make("p","O app baixa novamente suas imagens e arquivos quando precisar. Seus perfis, favoritos, posições salvas e a liberação deste aparelho continuam guardados.","nplay-settings-note"));
   const button=row(clear,"Limpar cache da NPlay",null,{symbol:"trash",action:async()=>{button.disabled=true;try{await clearCache(window.caches);render("main");feedback.textContent="Arquivos temporários da NPlay removidos.";}catch{feedback.textContent="Não foi possível limpar todos os arquivos agora.";button.disabled=false;}}});
  }else if(page==="help"){
   const help=section("Como podemos ajudar?");row(help,"Verificar conexão",null,{symbol:"wifi",action:()=>render("network")});row(help,"Identificação do aparelho",deviceCode(),{symbol:"phone",action:()=>render("account")});
   row(help,"Falar com a NovaByte Soluções","Abrir atendimento no WhatsApp.",{symbol:"help",href:"https://wa.me/5531983771576"});
   help.append(make("p","Se o vídeo parar, tente abrir novamente e confira a conexão. Para informar um problema de acesso, envie ao responsável o código deste aparelho.","nplay-settings-note"));
  }
  content.scrollTop=0;back.focus();
 }
 api.open=(initial="main",{onClose=null}={})=>{
  afterClose=onClose;
  if(layer.hidden){returnFocus=document.activeElement;layer.hidden=false;document.body.classList.add("nplay-settings-open");try{history.pushState({nplaySettings:true},"",location.href);ownsHistory=true;}catch{ownsHistory=false;}}
  render(initial);
 };
 api.close=()=>close();
 document.getElementById("nplay-settings-access")?.addEventListener("click",()=>api.open());
 back.onclick=()=>{if(page!=="main")render("main");else close();};
 window.addEventListener("popstate",()=>{if(!layer.hidden)close(true);});
 window.addEventListener("storage",e=>{if(e.key===KEY||e.key===null){window.dispatchEvent(new CustomEvent("nplay-settings-change",{detail:{settings:store.get()}}));if(!layer.hidden)render(page);}});
 layer.addEventListener("keydown",e=>{
  if(e.key==="Escape"){e.preventDefault();e.stopPropagation();if(page!=="main")render("main");else close();}
  if(e.key==="Tab"){
   const focus=Array.from(layer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')),first=focus[0],last=focus[focus.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
