/* O único app de estudo é o antigo PP-MT, agora PMMG. Este acesso só encaminha e preserva backups. */
(function(){
 'use strict';
 const TARGET='https://ppmt.novabytesolucoes.com.br/';
 const PROFILES={luanderson:'Luanderson',jackeline:'Jackeline Santana'};
 function collectBackups(storage){
  const backups=[];
  for(const [id,name] of Object.entries(PROFILES)){
   try{const raw=storage.getItem('missao-farda-pmmg-state-v3-'+id);if(!raw)continue;const state=JSON.parse(raw);if(state&&typeof state==='object'&&!Array.isArray(state))backups.push({name,id,data:{app:'missao-farda-pmmg',version:3,exportedAt:new Date().toISOString(),profile:{id,name},state}})}catch{}
  }
  try{const raw=storage.getItem('missao-farda-pmmg-state-v3');if(raw){const state=JSON.parse(raw);if(state&&typeof state==='object'&&!Array.isArray(state))backups.push({name:'Histórico anterior',id:'anterior',data:{app:'missao-farda-pmmg',version:3,exportedAt:new Date().toISOString(),state}})}}catch{}
  try{const raw=storage.getItem('missao-farda-pmmg-progress-v1');if(raw){const progress=JSON.parse(raw);if(progress&&typeof progress==='object'&&!Array.isArray(progress))backups.push({name:'Histórico inicial',id:'inicial',data:{app:'missao-farda-pmmg',version:3,exportedAt:new Date().toISOString(),state:{version:3,progress,events:[],sessions:[],topics:{},essay:'',settings:{goal:5,timer:'off'},session:null}}})}}catch{}
  return backups;
 }
 function download(backup){
  const blob=new Blob([JSON.stringify(backup.data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='missao-farda-backup-'+backup.id+'-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
 }
 function start({navigate=url=>location.replace(url)}={}){
  if(!document.getElementById('consolidated-access')){navigate(new URL('./?acesso=unificado',location.href).href);return;}
  let storage;try{storage=localStorage}catch{}
  const backups=storage?collectBackups(storage):[];
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js?v=15-unificado',{updateViaCache:'none'}).catch(()=>{});
  const status=document.getElementById('access-status');
  if(!backups.length){status.textContent='Abrindo o único app PMMG…';navigate(TARGET);return;}
  document.getElementById('legacy-backups').hidden=false;status.textContent='Use o botão acima para continuar no aplicativo principal.';
  const buttons=document.getElementById('backup-buttons');buttons.replaceChildren();
  for(const backup of backups){const button=document.createElement('button');button.type='button';button.textContent='Baixar backup — '+backup.name;button.onclick=()=>download(backup);buttons.appendChild(button)}
 }
 window.MFRetirement={collectBackups,start};start();
})();
