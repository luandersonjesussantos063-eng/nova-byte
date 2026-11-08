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
  const offer=el('section','customer-coupon-send');
  const available=coupons.filter(x=>!x.customer_user_id||x.customer_user_id===c.userId);
  const label=el('label','','Enviar cupom ativo para esta cliente');
  const select=el('select','');
  const placeholder=el('option','','Selecione um cupom');placeholder.value='';select.append(placeholder);
  const discountText=x=>x.discount_type==='percent'?x.discount_value+'% de desconto':brl(x.discount_value/100);
  for(const cp of available){
   const personal=cp.customer_user_id?' · Exclusivo desta cliente':'';
   const option=el('option','',cp.code+' · '+discountText(cp)+(cp.discount_type==='percent'&&cp.discount_value===100?' + frete grátis':'')+personal);
   option.value=cp.code;select.append(option);
  }
  label.append(select);offer.append(label);
  const send=el('button','primary-button','Enviar cupom selecionado');
  send.type='button';send.disabled=!c.offersEmail||!available.length;
  const notice=el('p','muted',!c.offersEmail?'Cliente sem autorização para receber promoções.':
   !available.length?'Nenhum cupom ativo disponível para esta cliente.':
    'O código selecionado será enviado somente à cliente escolhida.');
  send.onclick=async()=>{
   if(!select.value)return customerNote('Selecione um cupom ativo.',true);
   if(!confirm('Enviar o cupom '+select.value+' para '+c.name+' no e-mail autorizado?'))return;
   send.disabled=true;customerNote('Preparando o envio do cupom…');
   try{
    const {error}=await client.rpc('kaia_admin_queue_customer_coupon',{
     p_user_id:c.userId,p_coupon_code:select.value
    });
    if(error)throw error;
    customerNote('Cupom '+select.value+' registrado na fila de e-mails para '+c.email+'.');
   }catch(err){customerNote('Não foi possível enviar: '+(err.message||'erro'),true);}
   finally{send.disabled=!c.offersEmail||!available.length;}
  };
  offer.append(send,notice);
  const special=el('div','customer-personal-coupon');
  special.append(el('h4','','Criar cupom exclusivo para esta cliente'));
  special.append(el('p','muted','Código individual, limitado à conta selecionada. Não aparece na vitrine nem na lista pública de ofertas.'));
  const fields=el('div','customer-personal-fields');
  const typeLabel=el('label','','Tipo de desconto');
  const type=el('select','');
  for(const [value,text] of [['percent','Porcentagem (%)'],['fixed','Valor fixo (R$)']]){
   const opt=el('option','',text);opt.value=value;type.append(opt);
  }
  typeLabel.append(type);
  const amountLabel=el('label','','Valor do desconto');
  const amount=el('input','');amount.type='number';amount.min='1';amount.max='100';amount.step='1';
  amount.placeholder='Ex.: 15';amountLabel.append(amount);
  type.onchange=()=>{
   const isPercent=type.value==='percent';
   amount.max=isPercent?'100':'100000';
   amount.step=isPercent?'1':'0.01';
   amount.placeholder=isPercent?'Ex.: 15':'Ex.: 25,00';
   amount.value='';
  };
  const minLabel=el('label','','Pedido mínimo (R$)');
  const minimum=el('input','');minimum.type='number';minimum.min='0';minimum.step='0.01';
  minimum.value='0';minLabel.append(minimum);
  const expiryLabel=el('label','','Válido até (opcional)');
  const expiry=el('input','');expiry.type='date';expiryLabel.append(expiry);
  fields.append(typeLabel,amountLabel,minLabel,expiryLabel);special.append(fields);
  const create=el('button','primary-button','Criar e enviar cupom exclusivo');
  create.type='button';create.disabled=!c.offersEmail;
  create.onclick=async()=>{
   const value=type.value==='percent'?Number(amount.value):Math.round(Number(amount.value)*100);
   const min=Math.round(Number(minimum.value||0)*100);
   if(!Number.isSafeInteger(value)||value<1||
    (type.value==='percent'&&value>100)||
    !Number.isSafeInteger(min)||min<0){
    customerNote('Confira o tipo, o desconto e o pedido mínimo.',true);return;
   }
   const label=type.value==='percent'?value+'%':brl(value/100);
   if(!confirm('Criar e enviar um cupom exclusivo de '+label+' para '+c.name+' ('+c.email+')? Ninguém mais poderá utilizá-lo.'))return;
   create.disabled=true;customerNote('Criando o cupom individual e preparando o e-mail…');
   try{
    const {data,error}=await client.rpc('kaia_admin_create_personal_coupon',{
     p_user_id:c.userId,p_discount_type:type.value,p_discount_value:value,
     p_min_order_cents:min,p_ends_at:expiry.value||null
    });
    if(error)throw error;
    customerNote('Cupom exclusivo '+data.code+' criado e colocado na fila de envio para '+c.email+'.');
    await loadKaiaCustomers();
   }catch(err){
    customerNote('Não foi possível criar o cupom: '+(err.message||'erro de permissão'),true);
    create.disabled=!c.offersEmail;
   }
  };
  special.append(create);
  if(!c.offersEmail)special.append(el('p','muted','Para enviar uma oferta especial, a cliente precisa ativar o recebimento de promoções na própria conta.'));
  offer.append(special);card.append(offer);root.append(card);
 }
}
export async function loadKaiaCustomers(){
 if(!client)return;
 customerNote('Carregando clientes cadastrados e consentimentos…');
 const term=$('customerSearch').value.trim();
 const [result,active]=await Promise.all([
  client.rpc('kaia_admin_customer_insights',{p_search:term}),
  client.from('kaia_admin_coupons').select('code,active,discount_type,discount_value,min_order_cents,ends_at,customer_user_id')
   .eq('active',true)
 ]);
 if(result.error){customerNote('Não foi possível carregar os clientes. Confira as permissões.',true);return;}
 customers=Array.isArray(result.data)?result.data:[];
 coupons=active.error?[]:active.data||[];
 customerNote(customers.length+' cliente(s) encontrado(s). '+(!coupons.length?'Não há cupom ativo disponível para envio. ':'')+'Somente dados de navegação autorizados estão vinculados a pessoas.');
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
