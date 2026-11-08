// Kaia Glow multichannel command center.
// No marketplace tokens in browser. All writes call admin-only RPCs and never issue external sync.
let sb=null,afterStockChange=null,stockRows=[],links=[],overview=null,initialized=false,readiness=null,olistStatus=null,olistOwner=false;
const $=s=>document.querySelector(s);
const labelChannel=channel=>channel==='shopee'?'Shopee':'TikTok Shop';
const labelStatus=s=>({
 disconnected:'Não conectado',awaiting_authorization:'Aguardando autorização',
 connected:'Conectado',paused:'Pausado',error:'Erro na conexão',
 pending_verification:'Aguardando conferência',verified:'Verificado',
 waiting_connection:'Aguardando conexão',waiting_mapping:'Aguardando conferir vínculo',
 pending:'Pendente de envio',in_progress:'Enviando',synced:'Sincronizado'
})[s]||s||'—';
const pt=x=>new Intl.NumberFormat('pt-BR').format(Number(x||0));
const date=x=>x?new Date(x).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
const text=(s,v)=>{const n=$(s);if(n)n.textContent=String(v??'');};
const skuTitle=sku=>{
 const product=(window.KAIA_CATALOG||[]).find(p=>p.sku===sku);
 return product?product.name:sku;
};
function field(tag,cls,value){
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(value!==undefined&&value!==null)el.textContent=String(value);
 return el;
}
function td(tr,s){
 const cell=field('td','',s);tr.append(cell);return cell;
}
function emptyRow(tbody,cols,msg){
 tbody.replaceChildren();
 const row=field('tr');const cell=td(row,msg);cell.colSpan=cols;tbody.append(row);
}
function renderConnections(connections){
 const root=$('#mpChannelCards');root.replaceChildren();
 const platforms=[{id:'shopee',name:'Shopee',url:'https://open.shopee.com/'},
  {id:'tiktok',name:'TikTok Shop',url:'https://partner.tiktokshop.com/'}];
 for(const p of platforms){
  const c=(connections||[]).find(x=>x.channel===p.id)||{status:'disconnected'};
  const card=field('article','mp-channel-card');
  const top=field('div','mp-channel-top');
  top.append(field('strong','',p.name));
  const badge=field('span','mp-connection-status '+(c.status==='connected'?'mp-connected':'mp-disconnected'),labelStatus(c.status));
  top.append(badge);card.append(top);
  if(c.external_shop_id)card.append(field('p','mp-note','Loja autorizada: '+c.external_shop_id));
  const sync=c.last_synced_at?'Último sincronismo: '+date(c.last_synced_at):
   'Nenhuma sincronização com a plataforma foi realizada.';
  card.append(field('p','mp-note',sync));
  const mapped=links.filter(x=>x.channel===p.id).length;
  card.append(field('p','mp-link-count',mapped+' '+(mapped===1?'anúncio vinculado':'anúncios vinculados')));
  if(c.last_error)card.append(field('p','mp-error','Erro: '+c.last_error));
  if(c.status!=='connected'){
   card.append(field('p','mp-hint','Conexão programada para depois da autorização da conta e configuração das credenciais oficiais. Nenhum estoque será enviado antes disso.'));
   const link=field('a','mp-partner-link','Abrir portal oficial');
   link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
  }
  root.append(card);
 }
}
function renderSkuOptions(){
 const sorted=[...stockRows].sort((a,b)=>skuTitle(a.sku).localeCompare(skuTitle(b.sku),'pt-BR'));
 for(const selector of ['#mpStockSku','#mpMapSku']){
  const el=$(selector),previous=el.value;el.replaceChildren();
  const start=field('option','', 'Selecione um produto');start.value='';el.append(start);
  for(const item of sorted){
   const option=field('option','',skuTitle(item.sku)+' · '+item.sku);
   option.value=item.sku;el.append(option);
  }
  if(sorted.some(item=>item.sku===previous))el.value=previous;
 }
 renderCurrent();
}
function renderCurrent(){
 const sku=$('#mpStockSku').value;
 const product=stockRows.find(x=>x.sku===sku);
 text('#mpSelectedStock',product?
  'Saldo disponível: '+pt(product.available_units)+' unidade(s). SKU: '+sku:
  'Selecione um produto para ver seu saldo.');
}
function renderLinks(){
 const root=$('#mpLinksBody');
 if(!links.length){emptyRow(root,5,'Nenhum anúncio vinculado. Faça o primeiro vínculo quando tiver os IDs reais.');text('#mpLinksCount','0 vínculos');return;}
 root.replaceChildren();text('#mpLinksCount',pt(links.length)+' vínculos');
 for(const item of links){
  const tr=field('tr');td(tr,labelChannel(item.channel));
  const product=td(tr,skuTitle(item.sku));
  product.append(field('small','mp-sku',item.sku));
  const ref=td(tr,item.remote_product_id+' / '+item.remote_variant_id);
  if(item.remote_sku)ref.append(field('small','mp-sku','SKU externo: '+item.remote_sku));
  td(tr,labelStatus(item.status));
  const last=td(tr,'');const del=field('button','mp-remove-link','Desvincular');
  del.type='button';del.title='Desvincular anúncio, sem excluir o produto central';
  del.onclick=()=>removeLink(item);last.append(del);
  root.append(tr);
 }
}
function renderMovements(data){
 const root=$('#mpMovementBody');
 if(!data.length){emptyRow(root,4,'Nenhuma movimentação registrada.');return;}
 root.replaceChildren();
 for(const m of data){
  const tr=field('tr');td(tr,date(m.event_at));
  const cell=td(tr,skuTitle(m.sku));cell.append(field('small','mp-sku',m.sku));
  const delta=m.delta>=0?'+ '+pt(m.delta):'− '+pt(Math.abs(m.delta));
  const qty=td(tr,pt(m.before_units)+' → '+pt(m.after_units));qty.append(field('small','mp-sku',delta));
  const info=td(tr,m.source==='initial'?'Saldo inicial':m.source==='admin'?'Ajuste manual':m.source==='admin_product'?'Edição do produto':m.source);
  if(m.reason)info.title=m.reason;
  root.append(tr);
 }
}
function renderOrders(data){
 const root=$('#mpOrdersBody');
 if(!data.length){emptyRow(root,3,'Nenhum pedido importado. As contas ainda não estão conectadas.');return;}
 root.replaceChildren();
 for(const order of data){
  const tr=field('tr');td(tr,labelChannel(order.channel));td(tr,order.remote_order_id);
  const state=td(tr,order.remote_status);state.append(field('small','mp-sku','Estoque: '+labelStatus(order.inventory_status)));
  root.append(tr);
 }
}
function renderOutbox(data){
 const root=$('#mpQueueBody');
 if(!data.length){emptyRow(root,5,'Sem atualizações pendentes. Não há anúncios sincronizados.');return;}
 root.replaceChildren();
 for(const item of data){
  const tr=field('tr');td(tr,labelChannel(item.channel));
  const sku=td(tr,skuTitle(item.sku));sku.append(field('small','mp-sku',item.sku));
  td(tr,pt(item.desired_qty));td(tr,labelStatus(item.status));
  td(tr,date(item.last_attempt_at));
  root.append(tr);
 }
}
async function removeLink(item){
 if(!confirm('Desvincular '+item.remote_product_id+' do SKU '+item.sku+'? Esta ação não altera o anúncio externo.'))return;
 text('#mpMapStatus','Desvinculando...');
 const {data,error}=await sb.rpc('kaia_admin_unmap_listing',{p_id:item.id});
 if(error){text('#mpMapStatus','Erro ao desvincular: '+error.message);return;}
 text('#mpMapStatus',data?.removed?'Vínculo removido.':'Vínculo não encontrado.');
 await loadKaiaMarketplaces();
}
async function saveStock(ev){
 ev.preventDefault();
 const sku=$('#mpStockSku').value,mode=$('#mpStockMode').value;
 const qty=Number($('#mpStockQty').value),reason=$('#mpStockReason').value.trim();
 if(!sku||!['set','add','subtract'].includes(mode)||!Number.isSafeInteger(qty)||qty<0||qty>100000||reason.length<4){
  text('#mpStockStatus','Selecione o produto e informe quantidade e motivo válidos.');return;
 }
 const current=stockRows.find(x=>x.sku===sku)?.available_units??0;
 const next=mode==='set'?qty:mode==='add'?current+qty:current-qty;
 if(next<0||next>100000){text('#mpStockStatus','Quantidade inválida para o saldo disponível.');return;}
 const button=$('#mpSaveStock');button.disabled=true;text('#mpStockStatus','Registrando movimentação...');
 try{
  const {data,error}=await sb.rpc('kaia_admin_adjust_stock',{
   p_sku:sku,p_value:qty,p_mode:mode,p_reason:reason
  });
  if(error)throw error;
  text('#mpStockStatus',data.changed?
   'Estoque atualizado: '+pt(data.before)+' → '+pt(data.after)+' unidades. Nenhum envio externo foi realizado.':
   'Sem mudança de saldo; nenhuma movimentação adicional registrada.');
  $('#mpStockQty').value='';$('#mpStockReason').value='';
  await loadKaiaMarketplaces();
  if(typeof afterStockChange==='function')await afterStockChange();
 }catch(error){text('#mpStockStatus','Não foi possível atualizar: '+error.message);}
 finally{button.disabled=false;}
}
async function saveMapping(ev){
 ev.preventDefault();
 const channel=$('#mpMapChannel').value,sku=$('#mpMapSku').value;
 const product=$('#mpRemoteProductId').value.trim(),variant=$('#mpRemoteVariantId').value.trim();
 const remoteSku=$('#mpRemoteSku').value.trim();
 if(!sku||!['shopee','tiktok'].includes(channel)||!product||!variant){
  text('#mpMapStatus','Preencha os campos de anúncio e variação da plataforma.');return;
 }
 const button=$('#mpSaveMapping');button.disabled=true;text('#mpMapStatus','Salvando vínculo...');
 try{
  const {data,error}=await sb.rpc('kaia_admin_map_listing',{
   p_channel:channel,p_sku:sku,p_remote_product_id:product,
   p_remote_variant_id:variant,p_remote_sku:remoteSku||null
  });
  if(error)throw error;
  text('#mpMapStatus','Vínculo '+data.id+' salvo e aguardando conferência. Nenhum estoque foi enviado à plataforma.');
  $('#mpRemoteProductId').value='';$('#mpRemoteVariantId').value='';$('#mpRemoteSku').value='';
  await loadKaiaMarketplaces();
 }catch(error){text('#mpMapStatus','Não foi possível vincular: '+error.message);}
 finally{button.disabled=false;}
}
async function loadMarketplaceReadiness(){
 const area=$('#mpIntegrationReadiness');
 if(!area||!sb)return;
 area.textContent='Conferindo as autorizações das duas plataformas…';
 try{
  const {data,error}=await sb.auth.getSession();
  if(error||!data?.session?.access_token)throw Error('Faça login novamente para consultar as integrações.');
  const r=await fetch('/api/kaia/marketplace-readiness',{
   headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});
  const info=await r.json();
  if(!r.ok)throw Error(info.code||'Não foi possível consultar as conexões.');
  readiness=info;
  const parts=(info.channels||[]).map(ch=>{
   const title=labelChannel(ch.id);
   const state=ch.authorized?'loja autorizada':'loja ainda não autorizada';
   const credentials=ch.appCredentialsConfigured?'aplicativo cadastrado':'credenciais do aplicativo pendentes';
   return title+': '+state+' · '+credentials+' · '+ch.verifiedSkuCount+' anúncios conferidos';
  });
  area.replaceChildren();
  const strong=field('strong','','Preparo: '+info.activeSiteSkuCount+' SKUs na primeira etapa, '+info.skuCount+' no catálogo.');
  area.append(strong);
  for(const item of parts)area.append(field('p','',item));
  area.append(field('p','','A sincronização de estoque e pedidos permanece desativada até a autorização e os testes oficiais.'));
 }catch(e){
  readiness=null;area.textContent='Não foi possível verificar a integração: '+e.message;
 }
}
function cleanCsv(value){
 const raw=String(value??'');
 const safe=/^[=+\-@\t\r]/.test(raw)?'\''+raw:raw;
 return '"'+safe.replace(/"/g,'""')+'"';
}
async function downloadFirstWaveSkuCsv(){
 const button=$('#mpExportWave');if(!button)return;
 button.disabled=true;
 try{
  if(!readiness)await loadMarketplaceReadiness();
  const skus=readiness?.firstWaveSkus;
  if(!Array.isArray(skus)||skus.length===0)throw Error('A lista da primeira etapa não foi carregada.');
  const rows=[[
   'SKU Kaia Glow','Produto Kaia Glow','Estoque central (consulta)',
   'Shopee ID do produto','Shopee ID da variação','Shopee SKU externo',
   'TikTok ID do produto','TikTok ID da variação','TikTok SKU externo'
  ]];
  for(const sku of skus){
   const row=stockRows.find(x=>x.sku===sku);
   if(!row)throw Error('O SKU '+sku+' não está disponível no painel. Atualize a lista.');
   rows.push([sku,skuTitle(sku),row.available_units,'','','','','','']);
  }
  const csv='\ufeff'+rows.map(row=>row.map(cleanCsv).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='kaia-glow-29-skus-marketplaces.csv';document.body.append(a);a.click();a.remove();
  URL.revokeObjectURL(url);
  text('#mpDashboardStatus','Planilha gerada com '+skus.length+' produtos da primeira etapa. Preencha somente os IDs reais de Shopee e TikTok Shop após autorizá-las.');
 }catch(e){text('#mpDashboardStatus','Não foi possível gerar a planilha: '+e.message);}
 finally{button.disabled=false;}
}

async function adminOlistRequest(endpoint,method='GET'){
 const {data,error}=await sb.auth.getSession();
 const token=data?.session?.access_token;
 if(error||!token)throw Error('A sessão expirou. Entre novamente no painel.');
 const r=await fetch(endpoint,{
  method,headers:{Authorization:'Bearer '+token,...(method==='POST'?{'content-type':'application/json'}:{})},
  ...(method==='POST'?{body:'{}'}:{}),cache:'no-store'
 });
 const body=await r.json().catch(()=>({code:'RESPOSTA_INVALIDA'}));
 if(!r.ok)throw Error(body.code||'Não foi possível acessar a Olist.');
 return body;
}
function olistAutoCanEnable(){
 const verifiedAt=Date.parse(olistStatus?.lastVerifiedAt||'');
 const valid=Number.isFinite(verifiedAt)&&Date.now()-verifiedAt<30*60*1000&&
   Number(olistStatus?.verifiedSkus)>=30;
 return valid&&$('#mpTiktokOrdersConfirmed').checked&&
  $('#mpOlistStockRuleConfirmed').checked;
}
function syncOlistAutoControls(){
 const panel=$('#mpOlistAutoPanel'),button=$('#mpOlistAutoToggle'),
  status=$('#mpOlistAutoStatus'),preconditions=$('#mpOlistAutoPreconditions');
 if(!panel||!button)return;
 panel.hidden=!olistOwner;
 if(!olistOwner)return;
 const enabled=olistStatus?.autoSync===true;
 const allowed=olistStatus?.authorized===true;
 button.textContent=enabled?'Pausar sincronização':'Ativar sincronização';
 button.disabled=!allowed||(!enabled&&!olistAutoCanEnable());
 preconditions.hidden=enabled;
 if(enabled){
  status.textContent='Sincronização ativa · a cada '+(olistStatus.everyMinutes||5)+
   ' minutos · somente reduções. Último sucesso: '+date(olistStatus.lastSuccessAt)+
   (olistStatus.lastError?' · Alerta: '+olistStatus.lastError:'')+'.';
 }else if(!allowed){
  status.textContent='Aguardando autorização da Olist. Nenhuma baixa automática será aplicada.';
 }else{
  const verifiedAt=Date.parse(olistStatus?.lastVerifiedAt||'');
  const canEnable=Number.isFinite(verifiedAt)&&Date.now()-verifiedAt<30*60*1000&&
   Number(olistStatus.verifiedSkus)>=30;
  status.textContent=canEnable?
   'Prévia de '+olistStatus.verifiedSkus+' produtos validada em '+date(olistStatus.lastVerifiedAt)+
    '. Confirme os dois itens para ativar a consulta automática.':
   'Sincronização pausada. Confira todos os produtos ativos na Olist; a prévia precisa ser validada nos últimos 30 minutos.';
 }
}
async function toggleOlistAuto(){
 if(!sb||!olistOwner)return;
 const button=$('#mpOlistAutoToggle'),enabled=olistStatus?.autoSync===true;
 if(!enabled&&!olistAutoCanEnable())return;
 const prompt=enabled?
  'Pausar a atualização automática de estoque da Olist? As vendas continuarão nas plataformas.':
  'Ativar consulta à Olist a cada 5 minutos? Somente reduções confirmadas no saldo da Olist serão aplicadas. Nenhum pedido será abatido duas vezes e estoques não serão aumentados automaticamente.';
 if(!confirm(prompt))return;
 button.disabled=true;
 const {data,error}=await sb.rpc('kaia_owner_set_olist_auto_stock',{
  p_enabled:!enabled,
  p_tiktok_imports_confirmed:!enabled&&$('#mpTiktokOrdersConfirmed').checked,
  p_olist_stock_rule_confirmed:!enabled&&$('#mpOlistStockRuleConfirmed').checked
 });
 if(error){
  $('#mpOlistAutoStatus').textContent='Não foi possível alterar: '+error.message;
  syncOlistAutoControls();return;
 }
 $('#mpOlistAutoStatus').textContent=data.enabled?'Ativada. Próxima verificação agendada.':'Sincronização pausada.';
 await loadOlistConnection();
}
async function loadOlistConnection(){
 const node=$('#mpOlistStatus'),button=$('#mpOlistAuthorize'),
  test=$('#mpOlistTest'),compare=$('#mpOlistCompare');
 if(!node||!button||!test||!compare)return;
 node.textContent='Conferindo o acesso protegido à Olist…';
 try{
  const [info,owner]=await Promise.all([
   adminOlistRequest('/api/kaia/olist/status'),
   sb.rpc('kaia_is_store_owner')
  ]);
  olistStatus=info;olistOwner=owner.data===true&&!owner.error;
  button.disabled=!info.configured;
  if(!info.configured){
   node.textContent='As credenciais da Olist ainda não estão completas na Cloudflare.';
   test.hidden=true;compare.hidden=true;syncOlistAutoControls();return;
  }
  if(info.authorized){
   node.textContent='Olist autorizada em '+date(info.authorizedAt)+
    '. Atualização de estoque na Kaia: '+(info.autoSync?'automática, somente reduções.':'pausada.');
   button.textContent='Reautorizar Olist';test.hidden=false;compare.hidden=false;
  }else{
   node.textContent='Credenciais cadastradas. Falta a autorização da conta Olist para consultar os produtos.';
   button.textContent='Conectar Olist';test.hidden=true;compare.hidden=true;
  }
  syncOlistAutoControls();
 }catch(e){
  olistStatus=null;node.textContent='Não foi possível verificar a Olist: '+e.message;
  test.hidden=true;compare.hidden=true;syncOlistAutoControls();
 }
}
async function startOlistAuthorization(){
 const button=$('#mpOlistAuthorize'),node=$('#mpOlistStatus');
 button.disabled=true;node.textContent='Preparando autorização segura…';
 try{
  const info=await adminOlistRequest('/api/kaia/olist/start','POST');
  const url=new URL(info.authorizationUrl);
  if(url.protocol!=='https:'||url.hostname!=='accounts.tiny.com.br'||
    url.pathname!=='/realms/tiny/protocol/openid-connect/auth')
   throw Error('O endereço de autenticação recebido não é válido.');
  window.location.assign(url.href);
 }catch(e){node.textContent='Não foi possível iniciar a autorização: '+e.message;button.disabled=false;}
}
async function testOlistProducts(){
 const button=$('#mpOlistTest'),node=$('#mpOlistStatus');
 button.disabled=true;node.textContent='Testando apenas leitura de produtos na Olist…';
 try{
  const info=await adminOlistRequest('/api/kaia/olist/status','POST');
  if(!info.ok)throw Error(info.code||'A consulta não foi concluída.');
  node.textContent='Consulta de produtos autorizada. Nenhuma quantidade, pedido ou preço foi alterado. Sincronização automática permanece desligada.';
 }catch(e){node.textContent='A leitura não foi validada: '+e.message;}
 finally{button.disabled=false;}
}

async function compareOlistStock(){
 const button=$('#mpOlistCompare'),status=$('#mpOlistStatus');
 const pane=$('#mpOlistPreview'),summary=$('#mpOlistPreviewSummary');
 const body=$('#mpOlistPreviewBody'),note=$('#mpOlistPreviewNote');
 button.disabled=true;pane.hidden=true;
 status.textContent='Conferindo os produtos ativos e reservas locais com a Olist (somente leitura)…';
 try{
  const data=await adminOlistRequest('/api/kaia/olist/stock-preview','POST');
  if(data.mode!=='preview_only'||!Array.isArray(data.rows))
   throw Error('Resposta de conferência incompleta.');
  const s=data.summary;
  if(!s||typeof s.different!=='number'||data.siteSkuCount<30)
   throw Error('A quantidade de produtos não corresponde ao catálogo esperado.');
  summary.textContent=data.siteSkuCount+' SKUs no site · '+s.matched+
   ' encontrados na Olist · '+s.different+' saldos divergentes · '+
   s.missing+' não encontrados · '+s.duplicate+' duplicados · '+s.invalid+
   ' inválidos · '+s.reservedSiteUnits+' unidades reservadas em pagamentos pendentes.';
  const exceptional=data.rows.filter(x=>x.state!=='equal');
  body.replaceChildren();
  if(!exceptional.length)emptyRow(body,5,'Nenhuma diferença encontrada. Os saldos consultados coincidem com o site.');
  for(const item of exceptional){
   const tr=field('tr');
   const prod=td(tr,skuTitle(item.sku));
   prod.append(field('small','mp-sku',item.sku));
   td(tr,pt(item.local));
   td(tr,item.olistAvailable===undefined?'Não encontrado / verificar':pt(item.olistAvailable));
   td(tr,pt(item.reservation));
   td(tr,item.suggested===undefined?'Exige conferência':pt(item.suggested));
   body.append(tr);
  }
  note.textContent='Prévia consultada em '+date(data.checkedAt)+
   '. Nenhuma alteração foi realizada. A quantidade proposta considera o disponível na Olist menos reservas locais ainda não enviadas para a Olist. O próximo passo é validar como registrar pedidos aprovados antes de ativar alterações automáticas.';
  pane.hidden=false;
  status.textContent=data.verifiedForAutomatic?
   'Conferência completa validada. Siga as confirmações de integração TikTok → Olist para ativar o sincronismo.':
   'Conferência concluída com pendências. Resolva produtos ausentes, duplicados ou inválidos antes da ativação.';
  await loadOlistConnection();
 }catch(e){status.textContent='A conferência não foi concluída: '+e.message;}
 finally{button.disabled=false;}
}
export function initKaiaMarketplaces(client,options={}){
 sb=client;afterStockChange=options.onStockChanged||null;
 if(initialized)return;
 initialized=true;
 $('#mpRefresh').onclick=()=>loadKaiaMarketplaces();
 $('#mpExportWave').onclick=downloadFirstWaveSkuCsv;
 $('#mpOlistAuthorize').onclick=startOlistAuthorization;
 $('#mpOlistTest').onclick=testOlistProducts;
 $('#mpOlistCompare').onclick=compareOlistStock;
 $('#mpOlistAutoToggle').onclick=toggleOlistAuto;
 $('#mpTiktokOrdersConfirmed').onchange=syncOlistAutoControls;
 $('#mpOlistStockRuleConfirmed').onchange=syncOlistAutoControls;
 $('#mpStockSku').onchange=renderCurrent;
 $('#mpStockForm').onsubmit=saveStock;
 $('#mpMappingForm').onsubmit=saveMapping;
}
export async function loadKaiaMarketplaces(){
 if(!sb)return;
 text('#mpDashboardStatus','Atualizando saldos, pedidos e filas...');
 const [summary,stock,mappings,history,orders,outbox]=await Promise.all([
  sb.rpc('kaia_admin_marketplace_overview'),
  sb.from('kaia_sale_inventory').select('sku,available_units').order('sku').limit(1000),
  sb.from('kaia_marketplace_links').select('id,channel,sku,remote_product_id,remote_variant_id,remote_sku,status,last_remote_qty,last_synced_at').order('updated_at',{ascending:false}).limit(300),
  sb.from('kaia_stock_movements').select('id,sku,before_units,after_units,delta,source,reason,event_at').order('event_at',{ascending:false}).limit(35),
  sb.from('kaia_marketplace_orders').select('id,channel,remote_order_id,remote_status,inventory_status,imported_at').order('imported_at',{ascending:false}).limit(35),
  sb.from('kaia_marketplace_sync_queue').select('sku,channel,desired_qty,status,last_attempt_at,updated_at').order('updated_at',{ascending:false}).limit(60)
 ]);
 const error=[summary,stock,mappings,history,orders,outbox].find(r=>r.error)?.error;
 if(error){text('#mpDashboardStatus','Não foi possível carregar a central. '+error.message);return;}
 overview=summary.data||{};
 stockRows=stock.data||[];links=mappings.data||[];
 text('#mpSkuCount',pt(overview.skus));text('#mpUnits',pt(overview.available_units));
 text('#mpLowCount',pt(overview.low_stock));text('#mpMappedCount',pt(overview.mapped_skus));
 text('#mpOrdersCount',pt(overview.imported_orders));text('#mpQueueCount',pt(overview.pending_outbox));
 text('#mpReservationCount','Reservas ativas: '+pt(overview.active_reservations));
 renderSkuOptions();renderConnections(overview.connections);renderLinks();
 renderMovements(history.data||[]);renderOrders(orders.data||[]);renderOutbox(outbox.data||[]);
 text('#mpDashboardStatus','Dados do estoque central atualizados. A integração com Shopee e TikTok Shop está desligada até a autorização das contas e a validação de pedidos e anúncios.');
 await Promise.all([loadMarketplaceReadiness(),loadOlistConnection()]);
}
