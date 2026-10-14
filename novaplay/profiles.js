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
const defaults=[{name:"Meu perfil",emoji:"🙂",bg:"#1478eb"},{name:"Família",emoji:"🎬",bg:"#db3a91"},{name:"Convidado",emoji:"🦊",bg:"#4c9c73"},{name:"Crianças",emoji:"🧸",bg:"#25b47d",kids:true},{name:"Infantil",emoji:"⭐",bg:"#e6a400",kids:true}];
let profiles;
try{const stored=JSON.parse(localStorage.getItem(key));profiles=Array.isArray(stored)&&stored.length===defaults.length?stored:defaults.map(p=>({...p}))}catch{profiles=defaults.map(p=>({...p}))}
const save=()=>{try{localStorage.setItem(key,JSON.stringify(profiles))}catch{}};
const show=()=>{render();gate.hidden=false;document.body.style.overflow="hidden"};
const hide=()=>{gate.hidden=true;document.body.style.overflow="";};
function render(){
 grid.replaceChildren();
 profiles.forEach((p,i)=>{
  const b=document.createElement("button");b.type="button";b.className="nplay-profile-choice";
  const icon=document.createElement("span");icon.className="nplay-profile-picture";icon.style.background=p.bg||defaults[i].bg;icon.textContent=p.emoji||defaults[i].emoji;
  const name=document.createElement("span");name.className="nplay-profile-name";name.textContent=p.name;
  b.append(icon,name);
  if(p.kids){const small=document.createElement("small");small.textContent="Infantil";b.append(small)}
  b.onclick=()=>{try{localStorage.setItem(activeKey,String(i));sessionStorage.setItem("nplay-profile-selected","1")}catch{}if(avatar){avatar.textContent=(p.name||"NP").slice(0,2).toUpperCase();avatar.title="Trocar perfil: "+p.name}hide()};
  grid.append(b);
 });
}
if(avatar){avatar.onclick=show;avatar.setAttribute("aria-label","Trocar perfil")}
const edit=document.getElementById("nplay-profile-edit"),form=document.getElementById("nplay-profile-form"),slot=document.getElementById("nplay-profile-slot"),name=document.getElementById("nplay-profile-name");
profiles.forEach((p,i)=>{const opt=document.createElement("option");opt.value=String(i);opt.textContent=p.name;slot.append(opt)});
edit.onclick=()=>{form.hidden=!form.hidden;if(!form.hidden){slot.value="0";name.value=profiles[0].name;name.focus()}};
slot.onchange=()=>{name.value=profiles[Number(slot.value)].name};
form.onsubmit=e=>{e.preventDefault();const n=name.value.trim();if(!n)return;const i=Number(slot.value);profiles[i].name=n;save();slot.options[i].textContent=n;form.hidden=true;render()};
let selected=false;try{selected=sessionStorage.getItem("nplay-profile-selected")==="1"}catch{}
if(!selected)show();
else{let i=0;try{i=Number(localStorage.getItem(activeKey))||0}catch{}const p=profiles[i]||profiles[0];if(avatar)avatar.textContent=p.name.slice(0,2).toUpperCase()}
})();