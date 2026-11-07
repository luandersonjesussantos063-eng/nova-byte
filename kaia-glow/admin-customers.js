let client=null,customers=[],coupons=[];
const $=id=>document.getElementById(id);
const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const time=s=>Math.floor((Number(s)||0)/60)+' min '+Math.round((Number(s)||0)%60)+' s';
const labelFor=key=>(window.KAIA_CATALOG||[]).find(p=>(p.sku||'legacy:'+p.id)===key)?.name||key||'Produto';
const el=(tag,cls,txt)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;
};
const customerNote=(txt,err=false)=>{
 const n=$('customerAdminStatus');n.textContent=txt;n.classList.toggle('error',err);
};
function visibleRows(){
 const segment=$('customerSegment').value;
 return customers.filter(c=>
  segment==='all'||segment==='opted'&&c.offersEmail||
  segment==='interest'&&c.namedAnalytics||
  segment==='orders'&&Number(c.orders)>0||
  segment==='new'&&Number(c.orders)===0
 );
}
function render(){
 const root=$('customerAdminList');root.replaceChildren();
 const list=visibleRows();
 if(!list.length){root.append(el('p','muted','Nenhum cliente corresponde aos filtros.'));return;}
 for(const c of list){
  const card=el('article','customer-insight-card');
  const head=el('div','customer-insight-head');
  const main=el('div');main.append(el('h3','',c.name||'Cliente'),el('p','muted',c.email));
  const marker=el('span','customer-status',c.offersEmail?'Aceita ofertas':'Sem autorização para e-mail');
  head.append(main,marker);card.append(head);
  const stats=el('div','customer-insight-stats');
  for(const [text,value] of [
   ['Pedidos',String(c.orders||0)],
   ['Total em pedidos',brl(c.totalCents||0)],
   ['Visitas identificadas',c.namedAnalytics?String(c.visits||0):'Sem autorização'],
   ['Tempo nos produtos',c.namedAnalytics?time(c.attentionSeconds):'Sem autorização']
  ]){
   const item=el('div','');item.append(el('span','muted',text),el('strong','',value));stats.append(item);
  }card.append(stats);
  const content=el('div','customer-insight-products');
  if(c.namedAnalytics){
   const strong=el('strong','','Produtos observados com autorização');
   content.append(strong);
   const products=Array.isArray(c.products)?c.products:[];
   if(!products.length)content.append(el('p','muted','Ainda não há visualizações registradas desde o aceite.'));
   else{
    const ul=el('ul','');
    for(const p of products){
     ul.append(el('li','',labelFor(p.product_key)+' · '+Number(p.views||0)+' visualização(ões) · '+time(p.seconds)));
    }content.append(ul);
   }
  }else content.append(el('p','muted','O cliente não autorizou associar suas visualizações à conta.'));
  card.append(content);
  const offer=el('div','customer-coupon-send');
  const label=el('label','','Enviar um cupom ativo');
  const select=el('select','');const placeholder=el('option','','Selecione o cupom');
  placeholder.value='';select.append(placeholder);
  for(const coupon of coupons){
   const option=el('option','',coupon.code+' · '+coupon.discount_value+'% e frete grátis');option.value=coupon.code;select.append(option);
  }
  label.append(select);offer.append(label);
  const send=el('button','primary-button','Enviar cupom por e-mail');
  send.type='button';send.disabled=!c.offersEmail||!coupons.length;
  const notice=el('p','muted',!c.offersEmail?'Sem autorização para receber promoções.':'O código será enviado por e-mail, sem envio automático para outros clientes.');
  send.onclick=async()=>{
   if(!select.value)return customerNote('Selecione um cupom ativo.',true);
   if(!confirm('Enviar o cupom '+select.value+' para '+c.name+' pelo e-mail autorizado?'))return;
   send.disabled=true;customerNote('Registrando o envio do cupom…');
   const {error}=await client.rpc('kaia_admin_queue_customer_coupon',{
    p_user_id:c.userId,p_coupon_code:select.value
   });
   customerNote(error?'Não foi possível enviar: '+error.message:
    'Cupom colocado na fila de e-mails. O servidor enviará ao destinatário autorizado.',!!error);
   send.disabled=!c.offersEmail||!coupons.length;
  };
  offer.append(send,notice);card.append(offer);root.append(card);
 }
}
export async function loadKaiaCustomers(){
 if(!client)return;
 customerNote('Carregando clientes cadastrados e consentimentos…');
 const term=$('customerSearch').value.trim();
 const [result,active]=await Promise.all([
  client.rpc('kaia_admin_customer_insights',{p_search:term}),
  client.from('kaia_admin_coupons').select('code,active,discount_type,discount_value')
   .eq('active',true).eq('discount_type','percent').eq('discount_value',100)
 ]);
 if(result.error){customerNote('Não foi possível carregar os clientes. Confira as permissões.',true);return;}
 customers=Array.isArray(result.data)?result.data:[];
 coupons=active.error?[]:active.data||[];
 customerNote(customers.length+' cliente(s) encontrado(s). Somente dados de navegação autorizados estão vinculados a pessoas.');
 render();
}
export function setupKaiaCustomers(sb){
 client=sb;
 $('refreshCustomers').onclick=()=>loadKaiaCustomers();
 $('customerSegment').onchange=render;
 let pending=null;
 $('customerSearch').oninput=()=>{
  clearTimeout(pending);
  pending=setTimeout(()=>loadKaiaCustomers(),350);
 };
}
