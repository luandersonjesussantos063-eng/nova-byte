(()=>{
const $=id=>document.getElementById(id),core=()=>globalThis.NPlayM3u;
let db,savedChannels=[],rows=[],batchController=null,singleController=null,singleItem=null,running=false,publishing=false,published=new Set();
const fresh=item=>item.state==='passed'&&item.testedAt&&Date.now()-Date.parse(item.testedAt)<30*60*1000;
function message(id,text){$(id).textContent=text;}
function source(raw){const iframe=raw.match(/<iframe[^>]+src=["']([^"']+)/i);return core().url(iframe?iframe[1]:raw.trim());}
function authorized(){if($('live-embed-rights').checked)return true;message('live-embed-message','Confirme a autorização de exibição antes de publicar.');$('live-embed-rights').focus();return false;}
function button(label,fn,style='outline'){const b=document.createElement('button');b.type='button';b.className=style;b.textContent=label;b.onclick=fn;return b;}
function stateLabel(item){return ({idle:'Não testado',testing:'Testando vídeo…',passed:'Vídeo confirmado',failed:'Não confirmado',http:'Precisa de HTTPS',unsupported:'Outro formato',cancelled:'Interrompido'})[item.state]||'Não testado';}
function update(item){
 if(!item.dom)return;
 const d=item.dom;d.status.textContent=(item.published?'Publicado · ':'')+stateLabel(item);
 d.status.style.color=item.state==='passed'?'#85e2b4':item.state==='failed'?'#ffc5bd':'#c5d8f5';
 d.detail.textContent=item.detail||'';d.video.hidden=item.state!=='testing';
 d.publish.hidden=!fresh(item)||item.published;d.publish.disabled=publishing;
 d.retry.disabled=item.state==='testing'||running||publishing;d.retry.textContent=item.state==='idle'?'Testar canal':'Testar novamente';
}
function summary(){
 const ready=rows.filter(x=>fresh(x)&&!x.published),passed=rows.filter(x=>x.state==='passed').length;
 const tested=rows.filter(x=>!['idle','testing'].includes(x.state)).length;
 message('live-batch-status',`${rows.length} canais · ${tested} analisados · ${passed} com vídeo confirmado · ${rows.filter(x=>x.published).length} publicados`+(running?' · testes em andamento':''));
 $('live-batch-publish').textContent=`Publicar ${ready.length} aprovados`;
 $('live-batch-publish').disabled=!ready.length||running||publishing;
 $('live-batch-stop').hidden=!running;
}
async function checkItem(item,video,signal){
 item.testedAt=null;item.state='testing';item.detail='Aguardando pelo menos 2 segundos de vídeo em movimento.';update(item);summary();
 try{
  if(item.unsupported){item.state='unsupported';item.detail='Este endereço aponta para um arquivo de vídeo ou FLV. Use o cadastro de vídeos ou um sinal HLS compatível.';return;}
  try{item.playbackUrl=core().playable(item.url);item.published=published.has(item.playbackUrl);}catch(error){item.state='http';item.detail=error.message;return;}
  const result=await NPlaySignal.testSignal(video,item.playbackUrl,{signal});
  item.state='passed';item.testedAt=new Date().toISOString();item.detail=`Imagem recebida: ${result.width} × ${result.height}. Reprodução confirmada por ${result.seconds.toFixed(1)} segundos. O teste vale por 30 minutos e não garante estabilidade contínua.`;
 }catch(error){item.state=error.name==='AbortError'?'cancelled':'failed';item.detail=error.message;}
 finally{update(item);summary();}
}
async function publishItem(item){
 if(!fresh(item))throw Error('Teste este canal novamente antes de publicar.');
 if(item.dom)item.title=item.dom.title.value.trim();
 if(!item.title)throw Error('Informe o nome do canal.');
 const payload={title:item.title.slice(0,140),embed_url:item.playbackUrl,logo_url:item.logo_url||null,category:item.category||'',stream_type:'hls',last_tested_at:item.testedAt,rights_confirmed:true,is_published:true};
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
function renderRows(){
 const host=$('live-batch-results');host.replaceChildren();
 for(const item of rows){
  const card=document.createElement('article');card.style.cssText='border:1px solid #365075;border-radius:12px;padding:14px;margin:12px 0;overflow-wrap:anywhere';
  if(item.logo_url){const image=document.createElement('img');image.src=item.logo_url;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.style.cssText='width:64px;height:44px;object-fit:contain;float:right;background:#172a44;border-radius:6px';image.onerror=()=>image.remove();card.append(image);}
  const label=document.createElement('label');label.textContent='Nome do canal';const title=document.createElement('input');title.value=item.title;title.maxLength=140;label.append(title);
  const status=document.createElement('strong');status.style.cssText='display:block;margin-top:12px';
  const url=document.createElement('p');url.className='muted';url.textContent=item.category?item.category+' · '+item.url:item.url;
  const detail=document.createElement('p');
  const video=document.createElement('video');video.hidden=true;video.muted=true;video.playsInline=true;video.style.cssText='width:100%;max-width:420px;max-height:235px;background:#000;border-radius:8px';
  const publish=button('Publicar',()=>publishOne(item),'primary');
  const retry=button('Testar canal',async()=>{retry.disabled=true;const control=new AbortController();await checkItem(item,video,control.signal);update(item);});
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap';actions.append(retry,publish);
  item.dom={card,title,status,detail,video,publish,retry};card.append(label,status,url,detail,video,actions);host.append(card);update(item);
 }
 summary();
}
async function runBatch(){
 if(running||publishing)return;
 try{
  const parsed=core().parseList($('live-batch-input').value);
  if(!parsed.entries.length)throw Error('Nenhum endereço de canal encontrado. Cole a lista M3U ou uma URL por linha.');
  rows=parsed.entries.map(x=>({...x,state:'idle',published:published.has(x.url)}));
  message('live-batch-parse',`${parsed.entries.length} endereços carregados; ${parsed.duplicates} repetidos ignorados; ${parsed.invalid} entradas inválidas.`+(parsed.truncated?` A lista tem ${parsed.total} canais; este lote contém os primeiros 500. Divida o restante em outro lote.`:''));
  running=true;batchController=new AbortController();$('live-batch-run').disabled=true;renderRows();
  let next=0;const signal=batchController.signal;
  async function worker(){while(!signal.aborted&&next<rows.length){const item=rows[next++];await checkItem(item,item.dom.video,signal);}}
  await Promise.all([worker(),worker()]);
 }catch(error){message('live-batch-parse',error.message);}
 finally{running=false;batchController=null;$('live-batch-run').disabled=false;rows.forEach(update);summary();}
}
async function publishBatch(){
 if(running||publishing||!authorized())return;
 publishing=true;let done=0,failed=0;
 try{for(const item of rows.filter(x=>fresh(x)&&!x.published)){
  try{await publishItem(item);done++;}catch(error){failed++;item.detail='Falha na publicação: '+error.message;update(item);}
  message('live-embed-message',`${done} publicados; ${failed} com erro na publicação.`);
 }await refresh();}
 finally{publishing=false;rows.forEach(update);summary();}
}
async function testSingle(){
 singleController?.abort();singleItem=null;$('live-test-publish').hidden=true;
 try{
  const url=source($('live-embed-url').value);
  if(/\/get\.php(?:\?|$)/i.test(url))throw Error('Este endereço fornece uma lista. Cole o conteúdo M3U no teste em lote.');
  const saved=savedChannels.find(x=>x.embed_url===url);
  const item={logo_url:saved?.logo_url||null,category:saved?.category||'',title:$('live-embed-title').value.trim()||'Canal',url,state:'idle'};
  const playbackUrl=core().playable(url);singleController=new AbortController();
  message('live-test-message','Testando alguns segundos de vídeo…');$('live-test-video').hidden=false;$('live-test-button').disabled=true;
  const result=await NPlaySignal.testSignal($('live-test-video'),playbackUrl,{signal:singleController.signal});
  item.playbackUrl=playbackUrl;item.testedAt=new Date().toISOString();item.state='passed';singleItem=item;
  message('live-test-message',`Vídeo confirmado: ${result.width} × ${result.height}. Você pode publicar este canal.`);$('live-test-publish').hidden=false;
 }catch(error){message('live-test-message',error.message);}
 finally{$('live-test-button').disabled=false;$('live-test-video').hidden=true;}
}
function channelGroup(item){
 if(item.stream_type==='hls'||/\.m3u8?(?:\?|$)/i.test(item.embed_url||''))return 'm3u';
 try{if(/(^|\.)(rdcanais\.org|reidoscanais\.si)$/.test(new URL(item.embed_url).hostname))return 'legacy';}catch{}
 return 'individual';
}
function filterChannels(items,group,status,query){
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
 const search=normalize(query).trim();
 return items.filter(item=>channelGroup(item)===group&&(status==='all'||(status==='published'?item.is_published:!item.is_published))&&(!search||normalize(item.title).includes(search)||normalize(item.category).includes(search)));
}
let selectedChannelGroup='m3u';
const selectedChannelIds=new Set();
async function refresh(){
 const list=$('live-embed-list');if(!list)return;
 const {data,error}=await db.from('novaplay_live_embeds').select('*').order('created_at',{ascending:false});
 if(error){list.textContent='Não foi possível consultar os canais: '+error.message;return;}
 savedChannels=data||[];published=new Set(savedChannels.filter(x=>x.is_published).map(x=>x.embed_url));renderSaved();
}
function renderSaved(){
 const list=$('live-embed-list');list.replaceChildren();
 for(const [group,label] of [['m3u','Canais M3U'],['legacy','Canais antigos'],['individual','Outros canais']]){
  const control=$('live-group-'+group),count=savedChannels.filter(item=>channelGroup(item)===group).length;
  control.textContent=label+' ('+count+')';control.setAttribute('aria-pressed',String(group===selectedChannelGroup));control.className=group===selectedChannelGroup?'primary':'outline';
 }
 const visible=filterChannels(savedChannels,selectedChannelGroup,$('live-channel-status').value,$('live-channel-search').value);
 const selectedBar=$('live-selected-actions');
 if(selectedBar){
  selectedBar.hidden=false;
  const count=visible.filter(item=>selectedChannelIds.has(String(item.id))).length;
  $('live-selected-count').textContent=count+' marcados neste filtro';
  $('live-publish-selected').disabled=!count;
 }
 const active=visible.filter(item=>item.is_published).length;
 message('live-channel-count',visible.length+' canais neste filtro · '+active+' publicados · '+(visible.length-active)+' rascunhos');
 message('live-channel-help',selectedChannelGroup==='m3u'?'Canais das listas M3U e sinais HLS que você cadastrou pelo testador.':selectedChannelGroup==='legacy'?'Canais antigos do provedor anterior. Os rascunhos ficam fora da grade; o botão Publicar canal antigo permite recuperá-los.':'Canais cadastrados individualmente por iframe, incluindo as emissoras oficiais.');
 for(const item of visible){
  const card=document.createElement('article');card.style.cssText='border:1px solid #365075;border-radius:10px;padding:12px;margin:10px 0';
  const group=channelGroup(item);
  const select=document.createElement('input');select.type='checkbox';select.checked=selectedChannelIds.has(String(item.id));select.setAttribute('aria-label','Marcar '+item.title);select.style.cssText='width:20px;height:20px;margin-right:12px;vertical-align:middle';select.onchange=()=>{if(select.checked)selectedChannelIds.add(String(item.id));else selectedChannelIds.delete(String(item.id));renderSaved();};card.append(select);
  const title=document.createElement('strong');title.textContent=item.title;
  const badge=document.createElement('p');badge.textContent=(group==='m3u'?'Lista M3U':group==='legacy'?'Canal antigo · iframe':'Cadastro individual · iframe')+' · '+(item.is_published?'Publicado na grade':'Rascunho no ADM');badge.style.color=group==='legacy'?'#f6c98b':'#96c5ff';
  if(item.logo_url){const image=document.createElement('img');image.src=item.logo_url;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.style.cssText='width:64px;height:44px;object-fit:contain;float:right;background:#172a44;border-radius:6px';image.onerror=()=>image.remove();card.append(image);}
  const detail=document.createElement('details');const caption=document.createElement('summary');caption.textContent='Ver endereço do canal';const address=document.createElement('p');address.className='muted';address.style.overflowWrap='anywhere';address.textContent=item.embed_url;detail.append(caption,address);
  const hls=item.stream_type==='hls'||/\.m3u8?(?:\?|$)/i.test(item.embed_url);
  const toggle=button(item.is_published?'Despublicar':hls?'Testar para publicar':group==='legacy'?'Publicar canal antigo':'Publicar',async()=>{
   if(!item.is_published&&group==='legacy'&&!confirm('Este é um canal antigo, retirado da grade. Publicar '+item.title+' novamente?'))return;
   if(!item.is_published&&hls){$('live-embed-title').value=item.title;$('live-embed-url').value=item.embed_url;if(item.rights_confirmed)$('live-embed-rights').checked=true;await testSingle();$('live-test-message').scrollIntoView({behavior:'smooth',block:'center'});return;}
   const {error}=await db.from('novaplay_live_embeds').update({is_published:!item.is_published}).eq('id',item.id);
   message('live-embed-message',error?error.message:'Canal atualizado.');await refresh();
  });
  const remove=button('Excluir',async()=>{if(!confirm('Excluir o canal '+item.title+' do cadastro?'))return;const {error}=await db.from('novaplay_live_embeds').delete().eq('id',item.id);message('live-embed-message',error?error.message:'Canal excluído.');await refresh();});
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap';actions.append(toggle,remove);card.append(title,badge,detail,actions);list.append(card);
 }
 if(!visible.length)list.textContent='Nenhum canal neste grupo com os filtros selecionados.';
}
function init(){
 if(!$('live-embed-controls'))return;
 if(!window.supabase||!core()||!globalThis.NPlaySignal){setTimeout(init,300);return;}
 db=window.supabase.createClient('https://vajlhodqxskozuxxlujv.supabase.co','sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3');
 $('live-embed-controls').innerHTML=`
 <p>Cole uma lista M3U para testar os canais nesta conexão. Um canal só fica apto a publicar depois de receber imagem e avançar pelo menos dois segundos no navegador.</p>
 <label class="publish-check"><input id="live-embed-rights" type="checkbox"><span>Confirmo autorização para exibir na NPlay os canais que eu publicar.</span></label>
 <section style="border:1px solid #3a6396;border-radius:12px;padding:16px;margin:18px 0">
 <h3>Testar lista M3U e publicar canais</h3><p class="muted">Até 500 canais por lote, dois testes simultâneos. Nomes, capas e categorias são extraídos da lista. Endereços repetidos são ignorados. Links HTTP sem gateway ficam identificados como “Precisa de HTTPS”.</p>
 <label>Lista completa<textarea id="live-batch-input" rows="10" maxlength="2097152" placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-logo=&quot;https://exemplo.com/logo.png&quot;,Nome do canal&#10;https://exemplo.com/ao-vivo.m3u8" style="width:100%"></textarea></label>
 <div style="display:flex;gap:10px;flex-wrap:wrap"><button id="live-batch-run" class="primary" type="button">Carregar e testar lista</button><button id="live-batch-stop" class="outline" type="button" hidden>Parar testes</button><button id="live-batch-publish" class="primary" type="button" disabled>Publicar aprovados</button></div>
 <p id="live-batch-parse" class="muted" role="status"></p><p id="live-batch-status" role="status" aria-live="polite"></p><div id="live-batch-results"></div></section>
 <details style="border:1px solid #365075;border-radius:12px;padding:16px"><summary>Testar ou cadastrar um canal individual</summary>
 <form id="live-embed-form" style="display:grid;gap:12px;margin-top:16px;max-width:680px"><label>Nome do canal<input id="live-embed-title" maxlength="140" required></label><label>Link ou código iframe<textarea id="live-embed-url" rows="3" required></textarea></label><label><input id="live-embed-published" type="checkbox"> Publicar imediatamente (somente iframe)</label><button type="submit" class="outline">Salvar canal / rascunho</button></form>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><button id="live-test-button" type="button" class="outline">Testar sinal HLS</button><button id="live-test-publish" type="button" class="primary" hidden>Publicar canal testado</button></div><p id="live-test-message" role="status" aria-live="polite"></p><video id="live-test-video" muted playsinline hidden style="width:100%;max-width:520px;background:#000"></video></details>
 <p id="live-embed-message" role="status" aria-live="polite"></p><h3>Canais publicados e rascunhos</h3><p class="muted">Os rascunhos ficam somente no ADM. Use Publicar para colocar um canal na grade TV ao vivo.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0" aria-label="Origem dos canais"><button id="live-group-m3u" type="button" class="primary" aria-pressed="true">Canais M3U</button><button id="live-group-legacy" type="button" class="outline" aria-pressed="false">Canais antigos</button><button id="live-group-individual" type="button" class="outline" aria-pressed="false">Outros canais</button></div><p id="live-channel-help" class="muted"></p>
 <div id="live-selected-actions" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0"><button type="button" id="live-select-all" class="outline">Marcar todos do filtro</button><button type="button" id="live-clear-selection" class="outline">Desmarcar</button><button type="button" id="live-publish-selected" class="primary">Publicar marcados</button><span id="live-selected-count" aria-live="polite">0 marcados</span></div>
 <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end"><label style="flex:1;min-width:180px">Buscar canal<input id="live-channel-search" type="search" placeholder="Nome ou categoria" maxlength="140"></label><label>Situação<select id="live-channel-status"><option value="all">Publicados e rascunhos</option><option value="published">Somente publicados</option><option value="draft">Somente rascunhos</option></select></label><button id="live-embed-refresh" type="button" class="outline">Atualizar canais</button></div><p id="live-channel-count" role="status" aria-live="polite"></p><div id="live-embed-list"></div>`;
 $('live-batch-run').onclick=runBatch;$('live-batch-stop').onclick=()=>batchController?.abort();$('live-batch-publish').onclick=publishBatch;
 $('live-test-button').onclick=testSingle;$('live-embed-refresh').onclick=refresh;
 for(const group of ['m3u','legacy','individual'])$('live-group-'+group).onclick=()=>{selectedChannelGroup=group;renderSaved();};
 $('live-select-all').onclick=()=>{for(const item of filterChannels(savedChannels,selectedChannelGroup,$('live-channel-status').value,$('live-channel-search').value))selectedChannelIds.add(String(item.id));renderSaved();};
 $('live-clear-selection').onclick=()=>{selectedChannelIds.clear();renderSaved();};
 $('live-publish-selected').onclick=async()=>{
  const items=filterChannels(savedChannels,selectedChannelGroup,$('live-channel-status').value,$('live-channel-search').value).filter(item=>selectedChannelIds.has(String(item.id))&&!item.is_published);
  if(!items.length){message('live-embed-message','Nenhum rascunho marcado para publicar.');return;}
  if(!confirm('Publicar '+items.length+' canais marcados? Nenhum registro será apagado.'))return;
  const btn=$('live-publish-selected');btn.disabled=true;let ok=0,failed=0;
  for(const item of items){
   const {error}=await db.from('novaplay_live_embeds').update({is_published:true}).eq('id',item.id).eq('is_published',false);
   if(error)failed++;else{ok++;selectedChannelIds.delete(String(item.id));}
  }
  message('live-embed-message',ok+' canais publicados; '+failed+' falharam.');await refresh();
 };
 $('live-channel-search').oninput=renderSaved;$('live-channel-status').onchange=renderSaved;
 $('live-embed-url').oninput=()=>{singleController?.abort();singleItem=null;$('live-test-publish').hidden=true;};
 $('live-test-publish').onclick=async()=>{if(!singleItem)return;singleItem.title=$('live-embed-title').value.trim();await publishOne(singleItem);if(singleItem?.published)$('live-test-publish').hidden=true;};
 $('live-embed-form').onsubmit=async event=>{
  event.preventDefault();if(!authorized())return;
  try{
   const embed_url=source($('live-embed-url').value),title=$('live-embed-title').value.trim();
   if(!title)throw Error('Informe o nome do canal.');
   const hls=/\.m3u8?(?:\?|$)/i.test(embed_url),is_published=$('live-embed-published').checked;
   if(!embed_url.startsWith('https:'))throw Error('O cadastro precisa de HTTPS. Teste o endereço na lista para ver o diagnóstico.');
   if(hls&&is_published)throw Error('Use Testar sinal HLS e depois Publicar canal testado.');
   const {error}=await db.from('novaplay_live_embeds').upsert({title,embed_url,stream_type:hls?'hls':'iframe',rights_confirmed:true,is_published},{onConflict:'embed_url'});
   if(error)throw error;message('live-embed-message','Canal salvo.');await refresh();
  }catch(error){message('live-embed-message',error.message);}
 };
 document.querySelector('[data-admin-tab="canais"]')?.addEventListener('click',refresh);
 window.addEventListener('pagehide',()=>{batchController?.abort();singleController?.abort();});
 setInterval(()=>{if(rows.length){rows.forEach(update);summary();}},30000);
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
