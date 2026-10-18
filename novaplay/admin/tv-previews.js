/* Admin curation: a new preview can be added only after moving video is confirmed. */
(()=>{
'use strict';
function eligible(item){try{const u=new URL(item.embed_url);return item.is_published!==false&&u.protocol==='https:'&&!u.username&&!u.password&&(item.stream_type==='hls'||/\.m3u8?(?:\?|$)/i.test(u.href));}catch{return false;}}
function canAdd(item,proof,now=Date.now()){return !!item&&eligible(item)&&proof?.url===item.embed_url&&Number.isFinite(proof.at)&&now-proof.at>=0&&now-proof.at<30*60*1000;}
async function verify(video,item,{signal,test=globalThis.NPlaySignal?.testSignal}={}){
 if(!eligible(item)||!test)throw Error('Escolha um canal publicado com sinal HLS para testar a prévia.');
 let playback;
 try{
  await window.NPlayLiveAuth?.waitForRelease?.();
  if(signal?.aborted)throw new DOMException('Teste interrompido.','AbortError');
  playback=await window.NPlayLiveAuth?.authorize(item.embed_url)||item.embed_url;
  const result=await test(video,playback,{signal,seconds:2,audioOnly:false});
  if(signal?.aborted)throw new DOMException('Teste interrompido.','AbortError');
  if(!(result.width>0&&result.height>0&&result.seconds>=2))throw Error('A prévia precisa mostrar pelo menos dois segundos de imagem em movimento.');
  return {at:Date.now(),url:item.embed_url};
 }finally{if(playback)window.NPlayLiveAuth?.release(playback);await window.NPlayLiveAuth?.waitForRelease?.();}
}
async function persist(client,ids){
 if(!Array.isArray(ids)||ids.length>24||new Set(ids).size!==ids.length)throw Error('Escolha até 24 canais diferentes.');
 const {data,error}=await client.from('novaplay_featured').update({tv_spotlight_ids:ids}).eq('id',1).select('tv_spotlight_ids').single();
 if(error)throw error;
 if(!data||JSON.stringify(data.tv_spotlight_ids)!==JSON.stringify(ids))throw Error('Não foi possível confirmar o salvamento. Entre com uma conta administrativa.');
 return data.tv_spotlight_ids;
}
window.NPlayTvPreviewAdmin={eligible,canAdd,verify,persist};
const $=id=>document.getElementById(id);if(!$('tv-preview-admin'))return;
let db,channels=[],chosen=[],saved=new Set(),proofs=new Map(),failures=new Set(),controller=null,loading=false,saving=false,loaded=false,initialized=false,limit=24;
const message=text=>{$('tv-preview-message').textContent=text;};
function button(label,action,disabled=false){const node=document.createElement('button');node.type='button';node.className='outline compact';node.textContent=label;node.disabled=disabled;node.onclick=action;return node;}
function render(){
 const busy=!!controller||saving;
 $('tv-preview-save').disabled=!loaded||loading||busy;$('tv-preview-refresh').disabled=loading||busy;$('tv-preview-stop').hidden=!controller;
 $('tv-preview-count').textContent=chosen.length+'/24 canais selecionados';
 const list=$('tv-preview-selected');list.replaceChildren();
 if(!chosen.length){const p=document.createElement('p');p.className='muted';p.textContent='Sem canais selecionados, a faixa fica oculta para os clientes.';list.append(p);}
 chosen.forEach((id,index)=>{
  const item=channels.find(x=>x.id===id),row=document.createElement('div');row.className='tv-preview-row';
  const name=document.createElement('strong');name.textContent=(index+1)+'. '+(item?.title||'Canal fora da grade');
  row.append(name,button('↑',()=>{[chosen[index-1],chosen[index]]=[chosen[index],chosen[index-1]];render();},busy||index===0),button('Retirar',()=>{chosen=chosen.filter(x=>x!==id);render();},busy));list.append(row);
 });
 const query=$('tv-preview-search').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=channels.filter(x=>(x.title+' '+(x.category||'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
 const results=$('tv-preview-results');results.replaceChildren();
 for(const item of matches.slice(0,limit)){
  const row=document.createElement('div');row.className='tv-preview-row';
  const info=document.createElement('div'),name=document.createElement('strong'),note=document.createElement('small');name.textContent=item.title;
  note.textContent=failures.has(item.id)?'Prévia não confirmada':canAdd(item,proofs.get(item.id))?'✓ Imagem em movimento confirmada':chosen.includes(item.id)?'Selecionado · pode testar novamente':'Teste a imagem antes de adicionar';
  info.append(name,note);
  row.append(info,button('Testar prévia',()=>testChannel(item),busy),button(chosen.includes(item.id)?'Selecionado':'+ Adicionar',()=>{if(canAdd(item,proofs.get(item.id))&&!chosen.includes(item.id)&&chosen.length<24){chosen.push(item.id);render();}},busy||chosen.includes(item.id)||chosen.length>=24||!canAdd(item,proofs.get(item.id))));results.append(row);
 }
 $('tv-preview-more').hidden=matches.length<=limit;
}
async function testChannel(item){
 if(controller||saving)return;
 controller=new AbortController();proofs.delete(item.id);failures.delete(item.id);render();$('tv-preview-video').hidden=false;
 message('Testando a prévia de '+item.title+'… Aguardando imagem em movimento.');
 try{const proof=await verify($('tv-preview-video'),item,{signal:controller.signal});proofs.set(item.id,proof);message('✓ Prévia de '+item.title+' confirmada. Clique em Adicionar e depois Salvar seleção.');}
 catch(error){failures.add(item.id);message(error.name==='AbortError'?'Teste interrompido.':'Prévia não confirmada: '+error.message);}
 finally{controller=null;$('tv-preview-video').hidden=true;render();}
}
async function load(){
 if(loading||saving||controller)return;loading=true;loaded=false;$('tv-preview-save').disabled=true;
 try{
  const auth=await db.auth.getUser();if(!auth.data?.user){message('Entre como administrador para escolher as prévias.');return;}
  const admin=await db.from('novaplay_admins').select('user_id').eq('user_id',auth.data.user.id).limit(1);
  if(admin.error||!admin.data?.length)throw Error('Sua conta não possui permissão administrativa.');
  const preferences=await db.from('novaplay_featured').select('tv_spotlight_ids').eq('id',1).single();if(preferences.error)throw preferences.error;
  const rows=[];for(let offset=0;;offset+=500){const page=await db.from('novaplay_live_embeds').select('id,title,category,embed_url,stream_type,is_published').eq('is_published',true).order('title').order('id').range(offset,offset+499);if(page.error)throw page.error;rows.push(...page.data||[]);if((page.data||[]).length<500)break;}
  channels=rows.filter(eligible);chosen=preferences.data.tv_spotlight_ids||[];saved=new Set(chosen);proofs.clear();failures.clear();loaded=true;render();message('Busque um canal, teste a prévia, adicione e salve. A ordem define a rotação dos destaques.');
 }catch(error){message('Não foi possível carregar a seleção: '+error.message);}
 finally{loading=false;render();}
}
async function save(){
 if(!loaded||saving||controller||loading)return;
 try{
  for(const id of chosen){const item=channels.find(x=>x.id===id);if(!item||failures.has(id)||(!saved.has(id)&&!canAdd(item,proofs.get(id))))throw Error('Teste novamente ou retire da seleção o canal sem prévia confirmada.');}
  saving=true;render();message('Salvando seleção de canais…');
  const ids=chosen.slice();await persist(db,ids);saved=new Set(ids);message('✓ Seleção salva! Os clientes verão esses canais ao entrar novamente em TV ao vivo. Se nenhum canal estiver disponível, a faixa ficará oculta.');
 }catch(error){message('Não foi possível salvar: '+error.message);}
 finally{saving=false;render();}
}
function init(){
 if(initialized)return;
 db=window.NPlayLiveAdminClient;
 if(!db||!window.NPlayLiveAuth||!globalThis.NPlaySignal){setTimeout(init,300);return;}
 initialized=true;$('tv-preview-search').oninput=()=>{limit=24;render();};$('tv-preview-save').onclick=save;$('tv-preview-refresh').onclick=load;$('tv-preview-more').onclick=()=>{limit+=24;render();};$('tv-preview-stop').onclick=()=>controller?.abort();
 window.addEventListener('pagehide',()=>controller?.abort());document.querySelector('[data-admin-tab="canais"]')?.addEventListener('click',load);
 db.auth.onAuthStateChange?.(()=>setTimeout(()=>{controller?.abort();void load();},0));
 const dashboard=$('dashboard');if(dashboard)new MutationObserver(()=>{if(dashboard.hidden)controller?.abort();else void load();}).observe(dashboard,{attributes:true,attributeFilter:['hidden']});
 void load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
