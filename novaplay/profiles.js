(()=>{
"use strict";
const gate=document.getElementById("nplay-profile-gate"),grid=document.getElementById("nplay-profile-grid"),avatar=document.getElementById("profile-trigger");
if(!gate||!grid)return;
const poster=document.querySelector(".nplay-profile-poster");
if(poster){
 const hero=poster.closest(".nplay-profile-hero");
 const showArt=()=>{if(poster.naturalWidth>0)hero?.classList.add("has-poster")};
 const fallback=()=>{poster.hidden=true;hero?.classList.remove("has-poster")};
 poster.addEventListener("load",showArt);poster.addEventListener("error",fallback);
 if(poster.complete){if(poster.naturalWidth)showArt();else fallback()}
}
const key="nplay-profiles-v1",activeKey="nplay-active-profile";
const characters=["Robô cósmico","Navegadora","Raposa aventureira","Dinossauro","Leão","Coelha espacial","Herói futurista","Exploradora","Astronauta"];
const defaults=[{name:"Meu perfil",avatar:0},{name:"Família",avatar:1},{name:"Convidado",avatar:2},{name:"Crianças",avatar:3,kids:true},{name:"Infantil",avatar:4,kids:true}];
const validAvatar=n=>Number.isInteger(n)&&n>=0&&n<characters.length;
let profiles;
try{const stored=JSON.parse(localStorage.getItem(key));profiles=Array.isArray(stored)&&stored.length===defaults.length?stored.map((p,i)=>({...defaults[i],...(p&&typeof p==="object"?p:{}),avatar:validAvatar(p?.avatar)?p.avatar:defaults[i].avatar})):defaults.map(p=>({...p}))}catch{profiles=defaults.map(p=>({...p}))}
function paint(el,id){el.classList.add("nplay-avatar-art");el.style.setProperty("--avatar-x",(id%3)*50+"%");el.style.setProperty("--avatar-y",Math.floor(id/3)*50+"%")}
function activeIndex(){try{const i=Number(localStorage.getItem(activeKey));return Number.isInteger(i)&&profiles[i]?i:0}catch{return 0}}
function updateHeader(i){if(!avatar)return;const p=profiles[i]||profiles[0];avatar.textContent="";paint(avatar,p.avatar);avatar.title="Trocar perfil: "+p.name;avatar.setAttribute("aria-label","Trocar perfil: "+p.name)}
const edit=document.getElementById("nplay-profile-edit"),form=document.getElementById("nplay-profile-form"),slot=document.getElementById("nplay-profile-slot"),name=document.getElementById("nplay-profile-name"),dialog=document.getElementById("nplay-profile-dialog"),picker=document.getElementById("nplay-avatar-picker"),feedback=document.getElementById("nplay-profile-feedback");
const show=()=>{render();gate.hidden=false;document.body.style.overflow="hidden"};
const hide=()=>{gate.hidden=true;document.body.style.overflow=""};
function render(){
 grid.replaceChildren();
 profiles.forEach((p,i)=>{
  const b=document.createElement("button");b.type="button";b.className="nplay-profile-choice";
  const icon=document.createElement("span");icon.className="nplay-profile-picture";icon.setAttribute("aria-hidden","true");paint(icon,p.avatar);
  const label=document.createElement("span");label.className="nplay-profile-name";label.textContent=p.name;
  b.append(icon,label);
  if(p.kids){const small=document.createElement("small");small.textContent="Infantil";icon.append(small)}
  b.onclick=()=>{try{localStorage.setItem(activeKey,String(i));sessionStorage.setItem("nplay-profile-selected","1")}catch{}updateHeader(i);hide()};
  grid.append(b);
 });
 if(edit)grid.append(edit);
}
let draftAvatar=0;
function renderPicker(){
 picker.replaceChildren();
 characters.forEach((label,id)=>{
  const button=document.createElement("button");button.type="button";button.className="nplay-avatar-option";button.setAttribute("aria-label",label);button.setAttribute("aria-pressed",String(id===draftAvatar));
  const picture=document.createElement("span");picture.className="nplay-profile-picture";picture.setAttribute("aria-hidden","true");paint(picture,id);
  const caption=document.createElement("span");caption.textContent=label;button.append(picture,caption);
  button.onclick=()=>{draftAvatar=id;for(const [i,option] of Array.from(picker.children).entries())option.setAttribute("aria-pressed",String(i===id));feedback.textContent="Selecionado: "+label};
  picker.append(button);
 });
}
function loadDraft(){const p=profiles[Number(slot.value)]||profiles[0];name.value=p.name;draftAvatar=p.avatar;feedback.textContent="";renderPicker()}
profiles.forEach((p,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=p.name;slot.append(option)});
edit.onclick=()=>{slot.value=String(activeIndex());loadDraft();dialog.showModal()};
document.getElementById("nplay-profile-cancel").onclick=()=>dialog.close();
slot.onchange=loadDraft;
form.onsubmit=e=>{
 e.preventDefault();const n=name.value.trim();if(!n){name.focus();return}
 const i=Number(slot.value),next=profiles.map((p,j)=>j===i?{...p,name:n,avatar:draftAvatar}:p);
 try{localStorage.setItem(key,JSON.stringify(next))}catch{feedback.textContent="Não foi possível salvar neste navegador. Tente novamente.";return}
 profiles=next;slot.options[i].textContent=n;render();updateHeader(activeIndex());dialog.close();edit.focus();
};
if(avatar){avatar.onclick=show;updateHeader(activeIndex())}
let selected=false;try{selected=sessionStorage.getItem("nplay-profile-selected")==="1"}catch{}
if(!selected)show();
})();
