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
const key="nplay-profiles-v2",legacyKey="nplay-profiles-v1",activeKey="nplay-active-profile";
const characters=["Robô cósmico","Navegadora","Raposa aventureira","Dinossauro","Leão","Coelha espacial","Herói futurista","Exploradora","Astronauta"];
const defaults=[{name:"Meu perfil",avatar:0}];
const validAvatar=n=>Number.isInteger(n)&&n>=0&&n<characters.length;
const normalize=p=>({id:/^[0-9a-f-]{36}$/i.test(p?.id||"")?p.id:crypto.randomUUID(),name:typeof p?.name==="string"&&p.name.trim()?p.name.trim().slice(0,20):"Meu perfil",avatar:validAvatar(p?.avatar)?p.avatar:0,kids:p?.kids===true});
let profiles;
try{
 const stored=JSON.parse(localStorage.getItem(key));
 if(Array.isArray(stored)&&stored.length)profiles=stored.map(normalize);
 else{
  const legacy=JSON.parse(localStorage.getItem(legacyKey));
  profiles=[normalize(Array.isArray(legacy)?legacy[0]:defaults[0])];
  localStorage.setItem(key,JSON.stringify(profiles));localStorage.setItem(activeKey,"0");
 }
}catch{profiles=defaults.map(normalize)}
try{localStorage.setItem(key,JSON.stringify(profiles))}catch{}
window.NPlayProfiles={current:()=>({...profiles[activeIndex()]})};
function paint(el,id){el.classList.add("nplay-avatar-art");el.style.setProperty("--avatar-x",(id%3)*50+"%");el.style.setProperty("--avatar-y",Math.floor(id/3)*50+"%")}
function activeIndex(){try{const i=Number(localStorage.getItem(activeKey));return Number.isInteger(i)&&profiles[i]?i:0}catch{return 0}}
function updateHeader(i){window.dispatchEvent(new Event("nplay-profile-change"));if(!avatar)return;const p=profiles[i]||profiles[0];avatar.textContent="";paint(avatar,p.avatar);avatar.title="Trocar perfil: "+p.name;avatar.setAttribute("aria-label","Trocar perfil: "+p.name)}
const edit=document.getElementById("nplay-profile-edit"),form=document.getElementById("nplay-profile-form"),slot=document.getElementById("nplay-profile-slot"),name=document.getElementById("nplay-profile-name"),dialog=document.getElementById("nplay-profile-dialog"),picker=document.getElementById("nplay-avatar-picker"),feedback=document.getElementById("nplay-profile-feedback");
let adminLink=null,adminCheck=0;
async function refreshAdminLink(){
 const seq=++adminCheck;if(adminLink)adminLink.hidden=true;
 try{const client=window.NPlayAccessClient;if(!client)return;const session=(await client.auth.getSession()).data?.session;if(!session)return;const result=await client.from("novaplay_admins").select("user_id").eq("user_id",session.user.id).limit(1);if(seq!==adminCheck||result.error||!result.data?.length)return;
 if(!adminLink){adminLink=document.createElement("a");adminLink.href="./admin/";adminLink.textContent="Painel administrativo ↗";adminLink.className="profile-admin-link";document.querySelector(".nplay-profile-body")?.append(adminLink);}adminLink.hidden=false;
 }catch{}
}
const show=()=>{render();gate.hidden=false;document.body.style.overflow="hidden";refreshAdminLink();};
const hide=()=>{gate.hidden=true;document.body.style.overflow=""};
function render(){
 grid.replaceChildren();
 grid.style.gridTemplateColumns="repeat("+Math.min(3,profiles.length+1)+",minmax(0,1fr))";
 grid.style.maxWidth=profiles.length===1?"280px":"450px";
 profiles.forEach((p,i)=>{
  const b=document.createElement("button");b.type="button";b.className="nplay-profile-choice";
  const icon=document.createElement("span");icon.className="nplay-profile-picture";icon.setAttribute("aria-hidden","true");paint(icon,p.avatar);
  const label=document.createElement("span");label.className="nplay-profile-name";label.textContent=p.name;
  b.append(icon,label);
  if(p.kids){const small=document.createElement("small");small.textContent="Infantil";icon.append(small)}
  b.onclick=()=>chooseProfile(i);
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
const add=document.getElementById("nplay-profile-add"),remove=document.getElementById("nplay-profile-remove"),saveButton=form.querySelector('[type="submit"]');
let creating=false;
function options(selected=activeIndex()){
 slot.replaceChildren();
 profiles.forEach((p,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=p.name;slot.append(option)});
 const option=document.createElement("option");option.value="new";option.textContent="＋ Novo perfil";slot.append(option);slot.value=String(selected);
}
function loadDraft(){
 creating=slot.value==="new";
 const p=creating?{name:"",avatar:profiles.length%characters.length}:profiles[Number(slot.value)]||profiles[0];
 name.value=p.name;draftAvatar=p.avatar;feedback.textContent="";saveButton.textContent=creating?"Criar perfil":"Salvar perfil";remove.hidden=creating||profiles.length<=1;renderPicker();
}
function manageProfiles(){options();loadDraft();dialog.showModal();}
edit.onclick=manageProfiles;
document.getElementById("nplay-profile-cancel").onclick=()=>dialog.close();
add.onclick=()=>{slot.value="new";loadDraft();name.focus()};
slot.onchange=loadDraft;
function persist(next){try{localStorage.setItem(key,JSON.stringify(next));return true}catch{feedback.textContent="Não foi possível salvar neste navegador. Tente novamente.";return false}}
form.onsubmit=e=>{
 e.preventDefault();const n=name.value.trim();if(!n){name.focus();return}
 const i=Number(slot.value),next=creating?[...profiles,normalize({name:n,avatar:draftAvatar})]:profiles.map((p,j)=>j===i?{...p,name:n,avatar:draftAvatar}:p);
 if(!persist(next))return;
 profiles=next;render();updateHeader(activeIndex());dialog.close();edit.focus();
};
remove.onclick=()=>{
 if(creating||profiles.length<=1)return;
 const i=Number(slot.value),active=activeIndex(),next=profiles.filter((_,j)=>j!==i);
 if(!persist(next))return;
 profiles=next;
 const nextActive=active===i?0:active>i?active-1:active;
 try{localStorage.setItem(activeKey,String(nextActive))}catch{}
 options(nextActive);loadDraft();render();updateHeader(nextActive);feedback.textContent="Perfil removido.";
};
function chooseProfile(index){
 if(!Number.isInteger(index)||!profiles[index])return false;
 try{localStorage.setItem(activeKey,String(index));sessionStorage.setItem("nplay-profile-selected","1")}catch{}
 updateHeader(index);hide();return true;
}
Object.assign(window.NPlayProfiles,{
 all:()=>profiles.map(profile=>({...profile})),active:activeIndex,select:chooseProfile,manage:manageProfiles,picker:show,
 exit(){try{sessionStorage.removeItem("nplay-profile-selected")}catch{}window.dispatchEvent(new Event("nplay-profile-exit"));show();window.dispatchEvent(new Event("nplay-profile-change"));}
});
if(avatar){
 updateHeader(activeIndex());refreshAdminLink();
 const menu=document.createElement("section");menu.id="nplay-account-menu";menu.hidden=true;
 menu.setAttribute("role","dialog");menu.setAttribute("aria-modal","true");menu.setAttribute("aria-label","Perfil");
 const heading=document.createElement("h2");heading.className="nplay-account-heading";heading.textContent="Perfil";
 const dismiss=document.createElement("button");dismiss.type="button";dismiss.textContent="×";dismiss.setAttribute("aria-label","Fechar perfil");heading.append(dismiss);
 const card=document.createElement("div");card.className="nplay-account-current";
 const currentAvatar=document.createElement("span");currentAvatar.className="nplay-profile-picture";currentAvatar.setAttribute("aria-hidden","true");
 const currentName=document.createElement("strong");card.append(currentAvatar,currentName);
 const choices=document.createElement("div");choices.className="nplay-account-profiles";
 const button=(label,handler,className="nplay-account-row")=>{const el=document.createElement("button");el.type="button";el.className=className;el.textContent=label;el.addEventListener("click",handler);return el;};
 const manage=button("Gerenciar perfis",()=>{close(false);manageProfiles();},"nplay-account-manage");
 function close(focus=true){menu.hidden=true;document.body.classList.remove("nplay-account-open");avatar.setAttribute("aria-expanded","false");if(focus)avatar.focus();}
 function open(){
  currentName.textContent=profiles[activeIndex()].name;paint(currentAvatar,profiles[activeIndex()].avatar);choices.replaceChildren();
  profiles.forEach((profile,index)=>{
   if(index===activeIndex())return;
   const choice=button("",()=>{close(false);chooseProfile(index);},"nplay-account-choice");
   const picture=document.createElement("span");picture.className="nplay-profile-picture";picture.setAttribute("aria-hidden","true");paint(picture,profile.avatar);
   const label=document.createElement("span");label.textContent=profile.name;choice.append(picture,label);choices.append(choice);
  });
  menu.hidden=false;document.body.classList.add("nplay-account-open");avatar.setAttribute("aria-expanded","true");dismiss.focus();
 }
 const paths={settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 3v4l3 1 2 3 4-1 3 1 2-3 3-1v-4l2-3-2-3-3-1-1-3z"/>',account:'<circle cx="12" cy="7" r="4"/><path d="M3 22v-3a9 9 0 0 1 18 0v3"/>',help:'<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 0 1 6 0c0 3-3 2-3 6m0 3v1"/>',exit:'<path d="M9 3H3v18h6m6-14 5 5-5 5m-8-5h13"/>'};
 function action(label,symbol,handler){
  const el=button("",handler),svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("aria-hidden","true");svg.innerHTML=paths[symbol];
  const text=document.createElement("strong");text.textContent=label;const chevron=document.createElement("span");chevron.textContent="›";el.append(svg,text,chevron);return el;
 }
 const settings=page=>{close(false);window.NPlaySettings?.open(page,{onClose:open});};
 menu.append(heading,card,choices,manage,action("Configurações do aplicativo","settings",()=>settings("main")),action("Conta e perfil","account",()=>settings("account")),action("Ajuda","help",()=>settings("help")),action("Sair do perfil","exit",()=>{close(false);window.NPlayProfiles.exit();}));
 document.body.append(menu);avatar.setAttribute("aria-haspopup","dialog");avatar.setAttribute("aria-expanded","false");
 avatar.onclick=e=>{e.stopPropagation();if(menu.hidden)open();else close();};dismiss.onclick=()=>close();
 document.addEventListener("click",e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==avatar)close(false);});
 menu.addEventListener("keydown",e=>{
  if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();}
  if(e.key==="Tab"){
   const elements=Array.from(menu.querySelectorAll("button")),first=elements[0],last=elements[elements.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 });
}
let selected=false;try{selected=sessionStorage.getItem("nplay-profile-selected")==="1"}catch{}
if(!selected)show();
})();
