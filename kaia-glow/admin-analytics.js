// Dashboard aggregates only. Never lists or reveals individual visitor identifiers.
let client=null;
const $=selector=>document.querySelector(selector);
const fmt=new Intl.NumberFormat('pt-BR');
const number=n=>fmt.format(Number(n||0));
const readableTime=seconds=>{
 const s=Math.max(0,Math.round(Number(seconds)||0));
 return s<60?s+' s':Math.floor(s/60)+' min '+(s%60)+' s';
};
const productLabel=key=>{
 const product=(window.KAIA_CATALOG||[]).find(x=>(x.sku||'legacy:'+x.id)===key);
 return product?.name||key||'Produto não identificado';
};
const text=(selector,value)=>{const n=$(selector);if(n)n.textContent=value;};
function renderBars(items){
 const root=$('#analyticsBars');root.replaceChildren();
 const days=Array.isArray(items)?items:[];
 const peak=Math.max(1,...days.map(x=>Number(x.visitors||0)));
 if(!days.length){root.textContent='Ainda não há visitas registradas.';return;}
 days.forEach(day=>{
  const col=document.createElement('div');col.className='analytics-bar-column';
  const count=document.createElement('span');count.className='analytics-bar-value';count.textContent=number(day.visitors||0);
  const bar=document.createElement('div');bar.className='analytics-bar';bar.style.height=Math.max(3,Math.round((Number(day.visitors||0)/peak)*110))+'px';
  const label=document.createElement('span');label.className='analytics-bar-date';label.textContent=String(day.day||'').slice(5).split('-').reverse().join('/');
  col.title=label.textContent+': '+(day.visitors||0)+' visitantes';
  col.append(count,bar,label);root.append(col);
 });
}
function renderProducts(products){
 const root=$('#analyticsProducts');root.replaceChildren();
 if(!Array.isArray(products)||!products.length){
  const row=document.createElement('tr'),cell=document.createElement('td');
  cell.colSpan=4;cell.textContent='Aguardando primeiras visualizações autorizadas.';
  row.append(cell);root.append(row);return;
 }
 for(const p of products){
  if(!(p.views>0))continue;
  const tr=document.createElement('tr');
  const vals=[productLabel(p.product_key),number(p.views),readableTime(Number(p.seconds||0)/Math.max(1,Number(p.views))),number(p.cart_adds)];
  vals.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i===0)td.title=String(p.product_key);tr.append(td);});root.append(tr);
 }
}
export async function loadKaiaAnalytics(sb){
 client=sb||client;
 if(!client)return;
 const days=Number($('#analyticsDays').value)||7;
 text('#analyticsStatus','Carregando métricas autorizadas…');
 const {data,error}=await client.rpc('kaia_admin_interest_dashboard',{p_days:days});
 if(error){text('#analyticsStatus','Não foi possível consultar os dados. Confira sua autorização administrativa.');return;}
 const d=data||{};
 text('#analyticsVisitors',number(d.visitors));
 text('#analyticsSessions',number(d.sessions));
 text('#analyticsProductViews',number(d.product_views));
 text('#analyticsCartAdds',number(d.cart_adds));
 text('#analyticsAvgTime',readableTime(Number(d.attention_seconds||0)/Math.max(1,Number(d.product_views||0))));
 const before=Number(d.previous_visitors||0),current=Number(d.visitors||0);
 text('#analyticsDelta',before===0?(current===0?'—':'Primeiras visitas'):((current-before)>=0?'+':'')+Math.round(((current-before)/before)*100)+'%');
 renderBars(d.daily);
 renderProducts(d.products);
 text('#analyticsStatus','Dados agregados e aproximados, somente de visitantes que autorizaram métricas. Não mostram identidade nem contatos. Histórico retido por até cerca de 90 dias, com limpeza periódica.');
}
export function initKaiaAnalytics(sb){
 client=sb;
 $('#analyticsDays').onchange=()=>loadKaiaAnalytics();
 $('#refreshAnalytics').onclick=()=>loadKaiaAnalytics();
}
