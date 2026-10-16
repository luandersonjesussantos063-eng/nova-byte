(()=>{
const $=id=>document.getElementById(id),core=()=>globalThis.NPlayM3u;
let db,savedChannels=[],rows=[],batchController=null,singleController=null,singleItem=null,running=false,publishing=false,published=new Set();
let selectedListFile=null,savedLimit=60,savedStopReason="";
function parseBatch(offset,signal){
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException('Leitura interrompida.','AbortError'));return;}
  if(!globalThis.Worker){reject(Error('Seu navegador não suporta leitura em segundo plano. Atualize o navegador.'));return;}
  const reader=new Worker(new URL('./m3u-worker.js?v=0.49.6',document.baseURI));
  const finish=(error,result)=>{reader.terminate();signal.removeEventListener('abort',abort);error?reject(error):resolve(result);};
  const abort=()=>finish(new DOMException('Leitura interrompida.','AbortError'));
  signal.addEventListener('abort',abort,{once:true});
  reader.onmessage=event=>event.data.error?finish(Error(event.data.error)):finish(null,event.data.result);
  reader.onerror=()=>finish(Error('Não foi possível ler a lista em segundo plano. Recarregue o painel e tente novamente.'));
  try{reader.postMessage({file:selectedListFile,text:selectedListFile?undefined:$('live-batch-input').value,offset});}catch(error){finish(error);}
 });
}
const fresh=item=>item.state==='passed'&&item.testedAt&&Date.now()-Date.parse(item.testedAt)<30*60*1000;
function message(id,text){$(id).textContent=text;}
function source(raw){
 const iframe=raw.match(/<iframe[^>]+src=["']([^"']+)/i),value=iframe?iframe[1]:raw.trim();
 if(!iframe&&!/^https?:\/\//i.test(value))throw Error('Cole uma URL HTTP/HTTPS de transmissão. Texto Base64 ou uma lista de canais deve ser aberto ou decodificado antes do teste.');
 return core().url(value);
}
function authorized(){if($('live-embed-rights').checked)return true;message('live-embed-message','Confirme a autorização de exibição antes de publicar.');$('live-embed-rights').focus();return false;}
function button(label,fn,style='outline'){const b=document.createElement('button');b.type='button';b.className=style;b.textContent=label;b.onclick=fn;return b;}
function stateLabel(item){return ({idle:'Não testado',testing:'Testando vídeo…',passed:'Vídeo confirmado',failed:'Não confirmado',http:'Inválido para reprodução neste site',list:'Lista M3U · importar conteúdo',unsupported:'Outro formato',cancelled:'Interrompido'})[item.state]||'Não testado';}
function update(item){
 if(!item.dom)return;
 const d=item.dom;d.status.textContent=(item.published?'Publicado · ':'')+stateLabel(item);
 d.status.style.color=item.state==='passed'?'#85e2b4':item.state==='failed'?'#ffc5bd':'#c5d8f5';
 d.detail.textContent=item.detail||'';d.video.hidden=item.state!=='testing';
 d.publish.hidden=!fresh(item)||item.published||!item.playbackUrl?.startsWith('https:');d.publish.disabled=publishing;
 d.retry.disabled=item.state==='testing'||running||publishing;d.retry.textContent=item.state==='idle'?'Testar canal':'Testar novamente';
}
function summary(){
 const ready=rows.filter(x=>fresh(x)&&!x.published&&x.playbackUrl?.startsWith('https:')),passed=rows.filter(x=>x.state==='passed').length;
 const tested=rows.filter(x=>!['idle','testing'].includes(x.state)).length;
 message('live-batch-status',`${rows.length} canais · ${tested} analisados · ${passed} com vídeo confirmado · ${rows.filter(x=>x.published).length} publicados`+(running?' · testes em andamento':''));
 $('live-batch-publish').textContent=`Publicar ${ready.length} aprovados`;
 $('live-batch-publish').disabled=!ready.length||running||publishing;
 const exportButton=$('live-batch-export');if(exportButton)exportButton.disabled=!passed||running;
 $('live-batch-stop').hidden=!running;
}
async function checkItem(item,video,signal){
 item.testedAt=null;item.state='testing';item.detail='Aguardando pelo menos 2 segundos de vídeo em movimento.';update(item);summary();
 try{
  if(item.isPlaylist){item.state='list';item.detail='Este endereço fornece uma lista de canais, não um vídeo. Baixe o arquivo da sua lista e use Abrir arquivo M3U ou cole o conteúdo abaixo. Nenhuma conta foi testada.';return;}
  if(item.unsupported){item.state='unsupported';item.detail='Este formato não é compatível com o testador de transmissões ao vivo.';return;}
  const result=await NPlaySignal.testSource(video,item.url,{signal,audioOnly:/r[aá]dios?/i.test((item.category||'')+' '+item.title),onAttempt:url=>{item.detail=url?'Testando alternativa de reprodução…':'Procurando gateway autorizado…';update(item);}});
  item.playbackUrl=result.playbackUrl;item.published=published.has(item.playbackUrl);
  item.state='passed';item.testedAt=new Date().toISOString();item.detail=`${result.audioOnly?"Áudio recebido":"Imagem recebida: "+result.width+" × "+result.height}. Reprodução confirmada por ${result.seconds.toFixed(1)} segundos. O teste vale por 30 minutos e não garante estabilidade contínua.`;
 }catch(error){item.state=error.name==='AbortError'?'cancelled':error.code==='HTTP_UNRESOLVED'?'http':'failed';item.detail=error.message;}
 finally{update(item);summary();}
}
async function publishItem(item){
 if(!fresh(item))throw Error('Teste este canal novamente antes de publicar.');
 if(!item.playbackUrl.startsWith('https:'))throw Error('HTTP confirmado nesta conexão. A publicação no site HTTPS exige uma alternativa HTTPS ou gateway autorizado.');
 if(item.dom)item.title=item.dom.title.value.trim();
 if(!item.title)throw Error('Informe o nome do canal.');
 const payload={title:item.title.slice(0,140),embed_url:item.playbackUrl,logo_url:item.logo_url||null,category:item.category||'',stream_type:/\.ts$/i.test(new URL(item.playbackUrl).pathname)?'mpegts':'hls',last_tested_at:item.testedAt,rights_confirmed:true,is_published:true};
 const {error}=await db.from('novaplay_live_embeds').upsert(payload,{onConflict:'embed_url'});
 if(error)throw error;
 item.published=true;published.add(item.playbackUrl);update(item);summary();
}
async function publishOne(item){
 if(!authorized()||publishing)return;
 publishing=true;update(item);
 try{await publishItem(item);message('live-embed-message','Canal publicado na aba TV ao vivo.');await refresh();}
 catch(error){message('live-embed-message','Não foi possível publicar: '+error.message);}
 finally{publishing=false;update(item);summary();}
}
async function renderRows(signal){
 const host=$('live-batch-results');host.replaceChildren();
 let count=0;
 for(const item of rows){
  if(signal?.aborted)break;
  const card=document.createElement('article');card.style.cssText='border:1px solid #365075;border-radius:12px;padding:14px;margin:12px 0;overflow-wrap:anywhere;content-visibility:auto;contain-intrinsic-size:auto 250px';
  if(item.logo_url){const image=document.createElement('img');image.src=item.logo_url;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.style.cssText='width:64px;height:44px;object-fit:contain;float:right;background:#172a44;border-radius:6px';image.onerror=()=>image.remove();card.append(image);}
  const label=document.createElement('label');label.textContent='Nome do canal';const title=document.createElement('input');title.value=item.title;title.maxLength=140;label.append(title);
  const status=document.createElement('strong');status.style.cssText='display:block;margin-top:12px';
  const url=document.createElement('p');url.className='muted';const address=core().displayUrl(item.url);url.textContent=item.category?item.category+' · '+address:address;
  const detail=document.createElement('p');
  const video=document.createElement('video');video.hidden=true;video.muted=true;video.playsInline=true;video.style.cssText='width:100%;max-width:420px;max-height:235px;background:#000;border-radius:8px';
  const publish=button('Publicar',()=>publishOne(item),'primary');
  const retry=button('Testar canal',async()=>{retry.disabled=true;const control=new AbortController();await checkItem(item,video,control.signal);update(item);});
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap';actions.append(retry,publish);
  item.dom={card,title,status,detail,video,publish,retry};card.append(label,status,url,detail,video,actions);host.append(card);update(item);
  if(++count%25===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 summary();
}
async function runBatch(){
 if(running||publishing)return;
 try{
  const batch=Number($('live-batch-number').value||1);
  if(!Number.isSafeInteger(batch)||batch<1)throw Error('Informe um número de lote a partir de 1.');
  running=true;batchController=new AbortController();$('live-batch-run').disabled=true;summary();
  message('live-batch-parse','Lendo a lista em segundo plano… Você pode interromper pelo botão Parar testes.');
  const parsed=await parseBatch((batch-1)*500,batchController.signal);
  const batches=Math.max(1,Math.ceil(parsed.total/500));
  if(batch>batches)throw Error(`Esta lista tem ${batches} lotes. Escolha um lote entre 1 e ${batches}.`);
  if(!parsed.entries.length)throw Error('Nenhum endereço de canal encontrado. Cole a lista M3U ou uma URL por linha.');
  rows=parsed.entries.map(x=>({...x,state:'idle',published:published.has(x.url)}));
  message('live-batch-parse',`Lote ${batch} de ${batches}: ${parsed.entries.length} endereços carregados de ${parsed.total}; ${parsed.duplicates} repetidos ignorados; ${parsed.invalid} entradas inválidas.`+(batches>1?' Para testar os demais canais, altere o número do lote. Publique ou exporte os aprovados antes de trocar de lote.':''));
  await renderRows(batchController.signal);
  let next=0;const signal=batchController.signal;
  async function worker(){while(!signal.aborted&&next<rows.length){const item=rows[next++];await checkItem(item,item.dom.video,signal);}}
  await worker();
 }catch(error){message('live-batch-parse',error.name==='AbortError'?'Leitura interrompida.':error.message);}
 finally{running=false;batchController=null;$('live-batch-run').disabled=false;rows.forEach(update);summary();}
}
function exportConfirmed(){
 const approved=rows.filter(item=>fresh(item));
 if(!approved.length)return;
 const lines=['#EXTM3U'];
 for(const item of approved){
  const name=(item.dom?.title.value||item.title).replace(/[\r\n]/g,' ').trim();
  const category=(item.category||'').replace(/"/g,'');
  lines.push('#EXTINF:-1 group-title="'+category+'",'+name,item.playbackUrl);
 }
 const blob=new Blob([lines.join('\n')+'\n'],{type:'audio/x-mpegurl;charset=utf-8'});
 const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='nplay-canais-confirmados.m3u';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),2000);
}
async function publishBatch(){
 if(running||publishing||!authorized())return;
 publishing=true;let done=0,failed=0;
 try{for(const item of rows.filter(x=>fresh(x)&&!x.published&&x.playbackUrl?.startsWith('https:'))){
  try{await publishItem(item);done++;}catch(error){failed++;item.detail='Falha na publicação: '+error.message;update(item);}
  message('live-embed-message',`${done} publicados; ${failed} com erro na publicação.`);
 }await refresh();}
 finally{publishing=false;rows.forEach(update);summary();}
}
async function testSingle(){
 singleController?.abort();singleItem=null;$('live-test-publish').hidden=true;
 try{
  const url=source($('live-embed-url').value);
  if(core().isPlaylist(url))throw Error('Este endereço fornece uma lista. Use Abrir arquivo M3U ou cole o conteúdo M3U no teste em lote.');
  const saved=savedChannels.find(x=>x.embed_url===url);
  const item={logo_url:saved?.logo_url||null,category:saved?.category||'',title:$('live-embed-title').value.trim()||'Canal',url,state:'idle'};
  singleController=new AbortController();
  message('live-test-message','Testando alguns segundos de vídeo…');$('live-test-video').hidden=false;$('live-test-button').disabled=true;
  const result=await NPlaySignal.testSource($('live-test-video'),url,{signal:singleController.signal,onAttempt:target=>message('live-test-message',target?'Testando alternativa de reprodução…':'Procurando gateway autorizado…')});
  item.playbackUrl=result.playbackUrl;item.testedAt=new Date().toISOString();item.state='passed';singleItem=item;
  const publishable=result.playbackUrl.startsWith('https:');
  message('live-test-message',`Vídeo confirmado: ${result.width} × ${result.height}. `+(publishable?'Você pode publicar este canal.':'HTTP funciona nesta conexão; para publicar no site HTTPS, configure um gateway autorizado.'));$('live-test-publish').hidden=!publishable;
 }catch(error){message('live-test-message',error.message);}
 finally{$('live-test-button').disabled=false;$('live-test-video').hidden=true;}
}
function channelGroup(item){
 if(['hls','mpegts'].includes(item.stream_type)||/\.(m3u8?|ts)(?:\?|$)/i.test(item.embed_url||''))return 'm3u';
 try{if(/(^|\.)(rdcanais\.org|reidoscanais\.si)$/.test(new URL(item.embed_url).hostname))return 'legacy';}catch{}
 return 'individual';
}
function filterChannels(items,group,status,query){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const search=normalize(query).trim();
 return items.filter(item=>channelGroup(item)===group&&(status==='all'||(status==='published'?item.is_published:!item.is_published))&&(!search||normalize(item.title).includes(search)||normalize(item.category).includes(search)));
}
let selectedChannelGroup='m3u';
const selectedSaved=new Set();let savedController=null;
function savedVisible(){const family=$('live-list-family')?.value||'all';return filterChannels(savedChannels,selectedChannelGroup,$('live-channel-status').value,$('live-channel-search').value).filter(item=>{const hls=/\/index\.m3u8$/.test(item.embed_url)&&item.embed_url.startsWith('https://nplay-live-gateway.luandersonjesussantos063.workers.dev/');return family==='all'||(family==='new-hls'?hls:!hls);});}
function savedActions(){
 const visible=savedVisible(),drafts=visible.filter(x=>!x.is_published),selected=drafts.filter(x=>selectedSaved.has(x.id));
 const stop=$('live-saved-stop');if(stop)stop.hidden=!publishing;
 $('live-saved-select-all').textContent=visible.length&&visible.every(x=>selectedSaved.has(x.id))?'Desmarcar todos':'Marcar todos';
 $('live-saved-select-all').disabled=!visible.length||publishing;
 $('live-saved-publish-all').textContent='Publicar todos os rascunhos ('+drafts.length+')';
 $('live-saved-publish-all').disabled=!drafts.length||publishing||running;
 $('live-saved-publish-selected').textContent='Publicar selecionados ('+selected.length+')';
 $('live-saved-publish-selected').disabled=!selected.length||publishing||running;
 const active=visible.filter(x=>x.is_published),activeSelected=active.filter(x=>selectedSaved.has(x.id));
 $('live-saved-unpublish-selected').textContent='Retirar selecionados da grade ('+activeSelected.length+')';
 $('live-saved-unpublish-selected').disabled=!activeSelected.length||publishing||running;
 $('live-saved-unpublish-all').textContent='Retirar todos deste filtro ('+active.length+')';
 $('live-saved-unpublish-all').disabled=!active.length||publishing||running;
 $('live-saved-selection').textContent=visible.filter(x=>selectedSaved.has(x.id)).length+' selecionados neste filtro';
}
async function unpublishSaved(onlySelected=false){
 if(publishing||running)return;
 const targets=savedVisible().filter(x=>x.is_published&&(!onlySelected||selectedSaved.has(x.id)));
 if(!targets.length)return;
 publishing=true;renderSaved();let done=0,errorMessage='';
 try{
  for(let offset=0;offset<targets.length;offset+=200){
   const batch=targets.slice(offset,offset+200);
   const {data,error}=await db.from('novaplay_live_embeds').update({is_published:false}).in('id',batch.map(x=>x.id)).select('id');
   if(error)throw error;
   const ids=new Set((data||[]).map(x=>x.id));
   for(const item of batch)if(ids.has(item.id)){item.is_published=false;selectedSaved.delete(item.id);done++;}
   message('live-saved-progress',done+' de '+targets.length+' canais retirados da grade…');
  }
 }catch(error){errorMessage=' '+error.message;}
 finally{
  publishing=false;await refresh();summary();
  message('live-saved-progress',done+' canais retirados da grade. Os cadastros continuam como rascunhos no ADM.'+(targets.length>done?' '+(targets.length-done)+' não foram alterados.':'')+errorMessage);
 }
}
async function publishSaved(onlySelected=false){
 if(publishing||running)return;
 const drafts=savedVisible().filter(x=>!x.is_published&&(!onlySelected||selectedSaved.has(x.id)));
 if(!drafts.length)return;
 if(drafts.some(x=>!x.rights_confirmed)&&!authorized())return;
 publishing=true;savedStopReason='';savedController=new AbortController();renderSaved();summary();
 const host=$('live-saved-preview');host.replaceChildren();
 let done=0,failed=0,consecutiveFailures=0;const failures=[];
 const progress=()=>message('live-saved-progress',`${done} publicados · ${failed} não publicados · ${drafts.length-done-failed} restantes.`+(failures.length?' '+failures.slice(-3).join(' | '):'')+(savedStopReason?' '+savedStopReason:''));
 try{
  const direct=drafts.filter(x=>channelGroup(x)!=='m3u');
  if(direct.length){
   const {data,error}=await db.from('novaplay_live_embeds').update({is_published:true,rights_confirmed:true}).in('id',direct.map(x=>x.id)).select('id');
   if(error){failed+=direct.length;failures.push(error.message);}
   else{const ids=new Set((data||[]).map(x=>x.id));done+=ids.size;failed+=direct.length-ids.size;direct.forEach(x=>{if(ids.has(x.id)){x.is_published=true;selectedSaved.delete(x.id);}});}
   progress();
  }
  const signals=drafts.filter(x=>channelGroup(x)==='m3u');let next=0;
  async function worker(){
   const video=document.createElement('video');video.muted=true;video.playsInline=true;video.style.cssText='width:100%;max-width:360px;background:#000;border-radius:8px';host.append(video);
   while(next<signals.length&&!savedController.signal.aborted){
    const item=signals[next++];
    try{
     message('live-saved-progress','Testando '+item.title+'… '+done+' publicados · '+failed+' não publicados.'+(failures.length?' Último erro: '+failures.at(-1):''));
     const result=await NPlaySignal.testSource(video,item.embed_url,{signal:savedController.signal,audioOnly:/r[aá]dios?/i.test((item.category||'')+' '+item.title)});
     if(!result.playbackUrl.startsWith('https:'))throw Error('A publicação exige HTTPS ou gateway autorizado.');
     const {data,error}=await db.from('novaplay_live_embeds').update({embed_url:result.playbackUrl,is_published:true,rights_confirmed:true,last_tested_at:new Date().toISOString()}).eq('id',item.id).select('id');
     if(error)throw error;if(!data?.length)throw Error('O canal não foi atualizado.');
     item.is_published=true;selectedSaved.delete(item.id);done++;consecutiveFailures=0;
    }catch(error){
     if(error.name==='AbortError')return;
     failed++;consecutiveFailures++;failures.push(item.title+': '+error.message);
     if(error.sharedFailure||consecutiveFailures>=3){savedStopReason=error.sharedFailure?'Lote pausado por falha comum de acesso. Os canais restantes não foram testados e continuam em rascunho.':'Lote pausado após 3 falhas seguidas. Confira o último erro antes de continuar; os demais canais não foram testados.';savedController.abort();}
    }
    progress();
   }
  }
  if(signals.length)await worker();
 }catch(error){failures.push(error.message);}
 finally{publishing=false;savedController=null;host.replaceChildren();await refresh();summary();progress();}
}
async function refresh(){
 const list=$('live-embed-list');if(!list)return;
 const data=[];for(let offset=0;;offset+=500){const page=await db.from('novaplay_live_embeds').select('*').order('created_at',{ascending:false}).order('id').range(offset,offset+499);if(page.error){list.textContent='Não foi possível consultar os canais: '+page.error.message;return;}data.push(...(page.data||[]));if(!page.data||page.data.length<500)break;}
 savedChannels=data;published=new Set(savedChannels.filter(x=>x.is_published).map(x=>x.embed_url));renderSaved();
}
function renderSaved(){
 const list=$('live-embed-list');list.replaceChildren();
 for(const [group,label] of [['m3u','Canais M3U'],['legacy','Canais antigos'],['individual','Outros canais']]){
  const control=$('live-group-'+group),count=savedChannels.filter(item=>channelGroup(item)===group).length;
  control.textContent=label+' ('+count+')';control.setAttribute('aria-pressed',String(group===selectedChannelGroup));control.className=group===selectedChannelGroup?'primary':'outline';
 }
 const visible=savedVisible();
 const visibleIds=new Set(visible.map(x=>x.id));for(const id of selectedSaved)if(!visibleIds.has(id))selectedSaved.delete(id);
 const active=visible.filter(item=>item.is_published).length;
 message('live-channel-count','ADM 0.49.28 · '+savedChannels.length+' canais carregados · '+visible.length+' neste filtro · '+active+' publicados · '+(visible.length-active)+' rascunhos');
 message('live-channel-help',selectedChannelGroup==='m3u'?'As listas estão aqui como rascunhos protegidos. Use o filtro Lista para separar a nova conta HLS da anterior. Pesquise o canal e use Testar para publicar; os canais sem teste continuam fora da grade.':selectedChannelGroup==='legacy'?'Canais antigos do provedor anterior. Os rascunhos ficam fora da grade; o botão Publicar canal antigo permite recuperá-los.':'Canais cadastrados individualmente por iframe, incluindo as emissoras oficiais.');
 for(const item of visible.slice(0,savedLimit)){
  const card=document.createElement('article');card.style.cssText='border:1px solid #365075;border-radius:10px;padding:12px;margin:10px 0';
  const group=channelGroup(item);
  const title=document.createElement('strong');title.textContent=item.title;
  const selection=document.createElement('label');selection.style.cssText='display:flex;align-items:center;gap:10px;margin-bottom:10px';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=selectedSaved.has(item.id);checkbox.disabled=publishing;checkbox.style.width='auto';checkbox.setAttribute('aria-label','Selecionar '+item.title);
  checkbox.onchange=()=>{if(checkbox.checked)selectedSaved.add(item.id);else selectedSaved.delete(item.id);savedActions();};selection.append(checkbox,title);
  const badge=document.createElement('p');badge.textContent=(group==='m3u'?'Lista M3U':group==='legacy'?'Canal antigo · iframe':'Cadastro individual · iframe')+' · '+(item.is_published?'Publicado na grade':'Rascunho no ADM');badge.style.color=group==='legacy'?'#f6c98b':'#96c5ff';
  if(item.logo_url){const image=document.createElement('img');image.src=item.logo_url;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.style.cssText='width:64px;height:44px;object-fit:contain;float:right;background:#172a44;border-radius:6px';image.onerror=()=>image.remove();card.append(image);}
  const detail=document.createElement('details');const caption=document.createElement('summary');caption.textContent='Ver endereço do canal';const address=document.createElement('p');address.className='muted';address.style.overflowWrap='anywhere';address.textContent=item.embed_url;detail.append(caption,address);
  const hls=['hls','mpegts'].includes(item.stream_type)||/\.(m3u8?|ts)(?:\?|$)/i.test(item.embed_url);
  const toggle=button(item.is_published?'Despublicar':hls?'Testar para publicar':group==='legacy'?'Publicar canal antigo':'Publicar',async()=>{
   if(!item.is_published&&group==='legacy'&&!confirm('Este é um canal antigo, retirado da grade. Publicar '+item.title+' novamente?'))return;
   if(!item.is_published&&hls){$('live-embed-title').value=item.title;$('live-embed-url').value=item.embed_url;if(item.rights_confirmed)$('live-embed-rights').checked=true;await testSingle();$('live-test-message').scrollIntoView({behavior:'smooth',block:'center'});return;}
   const {error}=await db.from('novaplay_live_embeds').update({is_published:!item.is_published}).eq('id',item.id);
   message('live-embed-message',error?error.message:'Canal atualizado.');await refresh();
  });
  const remove=button('Excluir',async()=>{if(!confirm('Excluir o canal '+item.title+' do cadastro?'))return;const {error}=await db.from('novaplay_live_embeds').delete().eq('id',item.id);message('live-embed-message',error?error.message:'Canal excluído.');await refresh();});
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap';toggle.disabled=publishing;remove.disabled=publishing;actions.append(toggle,remove);card.append(selection,badge,detail,actions);list.append(card);
 }
 if(visible.length>savedLimit)list.append(button('Mostrar mais 60 canais',()=>{savedLimit+=60;renderSaved();}));
 if(!visible.length)list.textContent='Nenhum canal neste grupo com os filtros selecionados.';
 savedActions();
}
function init(){
 if(!$('live-embed-controls'))return;
 if(!window.supabase||!core()||!globalThis.NPlaySignal){setTimeout(init,300);return;}
 db=window.supabase.createClient('https://vajlhodqxskozuxxlujv.supabase.co','sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3');window.NPlayLiveAdminClient=db;
 $('live-embed-controls').innerHTML=`
 <p>Cole uma lista M3U para testar os canais nesta conexão. Um canal só fica apto a publicar depois de receber imagem e avançar pelo menos dois segundos no navegador.</p>
 <label class="publish-check"><input id="live-embed-rights" type="checkbox"><span>Confirmo autorização para exibir na NPlay os canais que eu publicar.</span></label>
 <section style="border:1px solid #3a6396;border-radius:12px;padding:16px;margin:18px 0">
 <h3>Testar lista M3U e publicar canais</h3><p class="muted">Até 500 canais por lote, dois testes simultâneos. Nomes, capas e categorias são extraídos da lista. Endereços repetidos são ignorados. Para links HTTP, o testador tenta HTTPS e procura gateways autorizados configurados antes de indicar que não conseguiu reproduzir. HTTP direto é testado quando permitido pela página.</p>
 <label>Lista completa<textarea id="live-batch-input" rows="10" maxlength="104857600" placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-logo=&quot;https://exemplo.com/logo.png&quot;,Nome do canal&#10;https://exemplo.com/ao-vivo.m3u8" style="width:100%"></textarea></label>
 <div style="padding:12px;border:1px solid #365075;border-radius:10px;margin:12px 0"><strong>Importação M3U Plus do servidor</strong><p class="muted">Importa a lista cadastrada na Cloudflare como rascunhos privados. É necessário estar conectado como administrador.</p><button id="live-plus-import" type="button" class="outline">Importar M3U Plus</button><p id="live-plus-status" role="status" aria-live="polite"></p></div>
 <label>Abrir arquivo M3U<input id="live-batch-file" type="file" accept=".m3u,.m3u8,.txt"></label><p id="live-batch-file-status" class="muted" role="status"></p><p class="muted">Links get.php baixam listas, não são canais. Importe o arquivo da sua lista ou cole seu conteúdo. Base64 e páginas paste.sh não são sinais de vídeo.</p>
 <label>Lote a testar<input id="live-batch-number" type="number" min="1" step="1" value="1"></label><p class="muted">Arquivos de até 100 MB. Cada lote contém até 500 canais; dois canais são testados por vez.</p>
 <div style="display:flex;gap:10px;flex-wrap:wrap"><button id="live-batch-run" class="primary" type="button">Carregar e testar lista</button><button id="live-batch-stop" class="outline" type="button" hidden>Parar testes</button><button id="live-batch-export" class="outline" type="button" disabled>Baixar M3U dos confirmados</button><button id="live-batch-publish" class="primary" type="button" disabled>Publicar aprovados</button></div>
 <p id="live-batch-parse" class="muted" role="status"></p><p id="live-batch-status" role="status" aria-live="polite"></p><div id="live-batch-results"></div></section>
 <details style="border:1px solid #365075;border-radius:12px;padding:16px"><summary>Testar ou cadastrar um canal individual</summary>
 <form id="live-embed-form" style="display:grid;gap:12px;margin-top:16px;max-width:680px"><label>Nome do canal<input id="live-embed-title" maxlength="140" required></label><label>Link ou código iframe<textarea id="live-embed-url" rows="3" required></textarea></label><label><input id="live-embed-published" type="checkbox"> Publicar imediatamente (somente iframe)</label><button type="submit" class="outline">Salvar canal / rascunho</button></form>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button id="live-test-button" type="button" class="outline">Testar sinal HLS</button><button id="live-test-publish" type="button" class="primary" hidden>Publicar canal testado</button></div><p id="live-test-message" role="status" aria-live="polite"></p><video id="live-test-video" muted playsinline hidden style="width:100%;max-width:520px;background:#000"></video></details>
 <section id="live-pc-tv" style="border:1px solid #365075;border-radius:12px;padding:16px;margin:18px 0"></section><p id="live-embed-message" role="status" aria-live="polite"></p><h3>Canais publicados e rascunhos</h3><p class="muted">Os rascunhos ficam somente no ADM. Use Publicar para colocar um canal na grade TV ao vivo.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0" aria-label="Origem dos canais"><button id="live-group-m3u" type="button" class="primary" aria-pressed="true">Canais M3U</button><button id="live-group-legacy" type="button" class="outline" aria-pressed="false">Canais antigos</button><button id="live-group-individual" type="button" class="outline" aria-pressed="false">Outros canais</button></div><p id="live-channel-help" class="muted"></p>
 <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end"><label style="flex:1;min-width:180px">Buscar canal<input id="live-channel-search" type="search" placeholder="Nome ou categoria" maxlength="140"></label><label>Lista<select id="live-list-family"><option value="all">Todas as listas</option><option value="new-hls">Pulsando · nova lista HLS</option><option value="previous">Lista anterior e outros canais</option></select></label><label>Situação<select id="live-channel-status"><option value="all">Publicados e rascunhos</option><option value="published">Somente publicados</option><option value="draft">Somente rascunhos</option></select></label><button id="live-embed-refresh" type="button" class="outline">Atualizar canais</button></div><p id="live-channel-count" role="status" aria-live="polite"></p>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin:14px 0"><button id="live-saved-stop" type="button" class="outline" hidden>Parar testes</button><button id="live-saved-select-all" type="button" class="outline">Marcar todos</button><button id="live-saved-publish-selected" type="button" class="outline" disabled>Publicar selecionados</button><button id="live-saved-unpublish-selected" type="button" class="outline" disabled>Retirar selecionados da grade</button><button id="live-saved-unpublish-all" type="button" class="outline" disabled>Retirar todos deste filtro</button><button id="live-saved-publish-all" type="button" class="primary" disabled>Publicar todos os rascunhos</button></div>
 <p class="muted">As ações usam o grupo, a busca e a situação selecionados. Canais M3U são testados antes de publicar; os que falharem continuam em rascunho.</p><p id="live-saved-selection" class="muted"></p><p id="live-saved-progress" role="status" aria-live="polite"></p><div id="live-saved-preview" style="display:flex;gap:10px;flex-wrap:wrap"></div><div id="live-embed-list"></div>`;
 $('live-plus-import').onclick=async()=>{
  const button=$('live-plus-import');button.disabled=true;message('live-plus-status','Solicitando importação segura...');
  try{
   const {data:{session},error}=await db.auth.getSession();
   if(error||!session?.access_token)throw Error('Entre novamente com sua conta de administrador da NPlay.');
   const response=await fetch('https://nplay-m3uplus-import.luandersonjesussantos063.workers.dev/import',{method:'POST',headers:{Authorization:'Bearer '+session.access_token}});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||({401:'Sessão inválida.',403:'Conta sem permissão administrativa.',502:'Lista indisponível ou erro no banco.',503:'Servidor ainda não configurado.'}[response.status])||'Falha na importação ('+response.status+').');
   message('live-plus-status',result.imported+' canais recebidos em rascunhos privados. Nenhum publicado.');
  }catch(error){message('live-plus-status','Importação não concluída: '+error.message);}
  finally{button.disabled=false;}
 };
 $('live-batch-run').onclick=runBatch;$('live-batch-stop').onclick=()=>batchController?.abort();$('live-batch-publish').onclick=publishBatch;$('live-batch-export').onclick=exportConfirmed;
 $('live-batch-input').oninput=()=>{selectedListFile=null;message('live-batch-file-status','Usando o texto colado no campo.');};
 $('live-batch-file').onchange=async event=>{
  const input=event.target,file=input.files?.[0];if(!file)return;
  try{
   if(running||publishing)throw Error('Aguarde o teste atual terminar antes de importar outra lista.');
   if(file.size>core().MAX_LIST_BYTES)throw Error('O arquivo excedeu 100 MB. Divida a lista em partes menores.');
   selectedListFile=file;$('live-batch-input').value='';$('live-batch-number').value='1';
   message('live-batch-file-status',`Arquivo selecionado: ${file.name} (${(file.size/1024/1024).toFixed(1)} MB). Ele será lido em segundo plano, sem preencher a caixa de texto.`);
   message('live-batch-parse','Arquivo selecionado. Clique em Carregar e testar lista.');
  }catch(error){message('live-batch-parse',error.message);}finally{input.value='';}
 };
 $('live-test-button').onclick=testSingle;$('live-embed-refresh').onclick=refresh;
 for(const group of ['m3u','legacy','individual'])$('live-group-'+group).onclick=()=>{selectedChannelGroup=group;renderSaved();};
 $('live-saved-select-all').onclick=()=>{const visible=savedVisible(),all=visible.every(x=>selectedSaved.has(x.id));visible.forEach(x=>{if(all)selectedSaved.delete(x.id);else selectedSaved.add(x.id);});renderSaved();};
 $('live-saved-stop').onclick=()=>{savedStopReason='Testes interrompidos por você. Os canais restantes continuam em rascunho.';savedController?.abort();};
 $('live-saved-unpublish-selected').onclick=()=>unpublishSaved(true);$('live-saved-unpublish-all').onclick=()=>unpublishSaved(false);
 $('live-saved-publish-all').onclick=()=>publishSaved(false);$('live-saved-publish-selected').onclick=()=>publishSaved(true);
 $('live-list-family').onchange=()=>{savedLimit=60;selectedSaved.clear();renderSaved();};
 $('live-channel-search').oninput=()=>{savedLimit=60;renderSaved();};$('live-channel-status').onchange=()=>{savedLimit=60;renderSaved();};
 $('live-embed-url').oninput=()=>{singleController?.abort();singleItem=null;$('live-test-publish').hidden=true;};
 $('live-test-publish').onclick=async()=>{if(!singleItem)return;singleItem.title=$('live-embed-title').value.trim();await publishOne(singleItem);if(singleItem?.published)$('live-test-publish').hidden=true;};
 $('live-embed-form').onsubmit=async event=>{
  event.preventDefault();if(!authorized())return;
  try{
   const embed_url=source($('live-embed-url').value),title=$('live-embed-title').value.trim();
   if(!title)throw Error('Informe o nome do canal.');
   const hls=/\.(m3u8?|ts)(?:\?|$)/i.test(embed_url),is_published=$('live-embed-published').checked;
   if(!embed_url.startsWith('https:'))throw Error('O cadastro precisa de HTTPS. Teste o endereço na lista para ver o diagnóstico.');
   if(hls&&is_published)throw Error('Use Testar sinal HLS e depois Publicar canal testado.');
   const {error}=await db.from('novaplay_live_embeds').upsert({title,embed_url,stream_type:hls?(/\.ts(?:\?|$)/i.test(embed_url)?'mpegts':'hls'):'iframe',rights_confirmed:true,is_published},{onConflict:'embed_url'});
   if(error)throw error;message('live-embed-message','Canal salvo.');await refresh();
  }catch(error){message('live-embed-message',error.message);}
 };
 document.querySelector('[data-admin-tab="canais"]')?.addEventListener('click',refresh);
 window.addEventListener('pagehide',()=>{batchController?.abort();singleController?.abort();savedController?.abort();});
 setInterval(()=>{if(rows.length){rows.forEach(update);summary();}},30000);
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
