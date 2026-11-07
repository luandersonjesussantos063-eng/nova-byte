// Kaia Glow multichannel command center.
// No marketplace tokens in browser. All writes call admin-only RPCs and never issue external sync.
let sb=null,afterStockChange=null,stockRows=[],links=[],overview=null,initialized=false,readiness=null;
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
export function initKaiaMarketplaces(client,options={}){
 sb=client;afterStockChange=options.onStockChanged||null;
 if(initialized)return;
 initialized=true;
 $('#mpRefresh').onclick=()=>loadKaiaMarketplaces();
 $('#mpExportWave').onclick=downloadFirstWaveSkuCsv;
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
 await loadMarketplaceReadiness();
}
