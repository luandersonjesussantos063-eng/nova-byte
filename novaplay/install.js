(()=>{
"use strict";
const banner=document.getElementById("nplay-install-banner"),action=document.getElementById("nplay-install-action"),dismiss=document.getElementById("nplay-install-dismiss"),description=document.getElementById("nplay-install-description");
if(!banner||!action||!dismiss)return;
let pending=null;
const standalone=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const dismissed=()=>{try{return sessionStorage.getItem("nplay-install-dismissed")==="1"}catch{return false}};
const hide=()=>{banner.hidden=true};
const show=()=>{if(standalone()||dismissed()||!mobile)return;banner.hidden=false};
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();pending=event;action.textContent="Instalar NPlay";description.textContent="Adicione a NPlay à tela inicial do celular.";show()});
window.addEventListener("appinstalled",()=>{pending=null;hide()});
dismiss.addEventListener("click",()=>{try{sessionStorage.setItem("nplay-install-dismissed","1")}catch{}hide()});
action.addEventListener("click",async()=>{
 if(pending){const prompt=pending;pending=null;hide();try{await prompt.prompt();await prompt.userChoice}catch{}return}
 if(ios){description.textContent="No Safari, toque em Compartilhar (□↑) e escolha Adicionar à Tela de Início.";action.textContent="Entendi";action.onclick=hide;return}
 description.textContent="No Chrome, abra o menu ⋮ e escolha Instalar app ou Adicionar à tela inicial.";action.textContent="Entendi";action.onclick=hide;
});
if(ios&&!standalone()){action.textContent="Como instalar no iPhone";description.textContent="No Safari, adicione a NPlay à Tela de Início.";show()}
else if(/Android/i.test(navigator.userAgent)&&!standalone()){action.textContent="Como instalar no Android";description.textContent="Use Instalar app no Chrome para abrir a NPlay sem abas.";show()}
})();