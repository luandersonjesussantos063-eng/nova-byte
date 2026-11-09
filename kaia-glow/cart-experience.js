/* Kaia Glow cart UI. Server retains authority over prices, freight and payments. */
(function(){
'use strict';
const money=x=>Number(x||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const $=s=>document.querySelector(s);
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x;};
let postal='',gift='none',couponExpanded=false;
function choose(candidates,cart,n){
 const selected=new Set(cart.map(x=>String(x.id)));
 return candidates.filter(p=>p&&p.images?.[0]&&Number(p.price)>0&&!selected.has(String(p.id))).slice(0,n);
}
function productCard(p,add){
 const card=el('article','kg-cart-offer');
 const image=el('img');image.loading='lazy';image.src=p.images[0];image.alt=p.name;card.append(image);
 if(p.oldPrice>p.price){
  const badge=el('span','kg-offer-badge','−'+Math.round((1-p.price/p.oldPrice)*100)+'%');card.append(badge);
 }
 const info=el('div','kg-offer-info');
 info.append(el('small','',p.brand||'Kaia Glow'));
 const name=el('strong','kg-offer-name',p.name);name.title=p.name;info.append(name);
 const prices=el('div','kg-offer-prices');
 if(p.oldPrice>p.price)prices.append(el('del','',money(p.oldPrice)));
 prices.append(el('b','',money(p.price)));info.append(prices);
 const button=el('button','kg-offer-plus','+');button.type='button';
 button.setAttribute('aria-label','Adicionar '+p.name+' à sacola');
 button.onclick=()=>{
  add(p);
  button.textContent='✓';button.disabled=true;
  button.setAttribute('aria-label','Produto adicionado');
  const c=$('#kgAddedCount');if(c)c.textContent=($('#bagCount')?.textContent||'0')+' itens';
 };
 info.append(button);card.append(info);return card;
}
function offers(title,subtitle,products,add,parent){
 if(!products.length)return;
 const section=el('section','kg-cart-offers');
 section.append(el('h3','',title));
 if(subtitle)section.append(el('p','kg-offer-subtitle',subtitle));
 const track=el('div','kg-offer-track');
 products.forEach(p=>track.append(productCard(p,add)));section.append(track);
 if(products.length>2){
  const controls=el('div','kg-offer-controls');
  for(const item of [['‹',-1,'Produtos anteriores'],['›',1,'Mais produtos']]){
   const b=el('button','',item[0]);b.type='button';b.setAttribute('aria-label',item[2]);
   b.onclick=()=>track.scrollBy({left:item[1]*Math.max(210,track.clientWidth*.8),behavior:'smooth'});
   controls.append(b);
  }
  section.append(controls);
 }
 parent.append(section);
}
function showAdded({product,variant,eligible,cart,onAdd,onOpenBag}){
 const dialog=$('#kgAddedDialog'),content=$('#kgAddedContent');
 if(!dialog||!content)return;
 content.replaceChildren();
 const head=el('div','kg-added-heading');
 head.append(el('h2','','✓ Adicionado à sacola!'));
 const close=el('button','kg-added-close','×');close.type='button';close.setAttribute('aria-label','Fechar');
 close.onclick=()=>dialog.close();head.append(close);content.append(head);
 const productRow=el('div','kg-added-item'),photo=el('img');
 photo.src=product.images?.[0]||'';photo.alt=product.name;
 const body=el('div');body.append(el('strong','',product.name));
 if(variant?.label&&variant.label!=='Única')body.append(el('small','',variant.label));
 body.append(el('b','',money(variant?.price??product.price)));
 productRow.append(photo,body);content.append(productRow);
 offers('Aproveite e adicione à sua sacola',
  'Combine esse cuidado com mais produtos selecionados.',
  choose(eligible,cart,8),onAdd,content);
 const footer=el('div','kg-added-footer');
 const count=el('span','',cart.reduce((a,b)=>a+b.qty,0)+' itens');count.id='kgAddedCount';
 const go=el('button','kg-added-open','Ir para a sacola  →');
 go.type='button';go.onclick=()=>{dialog.close();onOpenBag();};
 const keep=el('button','kg-added-keep','Continuar comprando');
 keep.type='button';keep.onclick=()=>dialog.close();
 footer.append(count,go,keep);content.append(footer);
 if($('#productDialog')?.open)$('#productDialog').close();
 if(dialog.open)dialog.close();
 dialog.showModal();
}
function beforeBagRender(){
 const cep=$('#shippingPostalCode');if(cep&&window.kaiaCheckoutGate?.isAuthenticated()===true)postal=cep.value;
 const fold=$('#kgCouponFold');if(fold)couponExpanded=fold.open;
}
function afterBagRender({cart,eligible,onAdd}){
 const dialog=$('#bagDialog'),root=$('#bagContent .kc-checkout');
 if(!dialog||!root)return;
 const steps=el('nav','kg-cart-steps');steps.setAttribute('aria-label','Etapas da compra');
 for(const [no,title] of [['1','Sacola'],['2','Entrega'],['3','Pagamento']]){
  const step=el('span','',no+' · '+title);step.dataset.stage=no;steps.append(step);
 }
 root.prepend(steps);
 const authenticated=window.kaiaCheckoutGate?.isAuthenticated()===true;
 if(!authenticated){
  const delivery=$('.kc-delivery-section'),payment=$('.kc-payment-section');
  if(delivery)delivery.hidden=true;
  if(payment)payment.hidden=true;
  steps.replaceChildren();
  for(const [number,label] of [['1','Sacola'],['2','Identificação'],['3','Entrega'],['4','Pagamento']]){
   const item=el('span',number==='2'?'kg-current':'',number+' · '+label);
   item.dataset.stage=number;steps.append(item);
  }
  {
  const preview=el('section','kg-guest-freight');
  preview.append(el('h3','','Quanto custa a entrega?'),el('p','','Consulte uma estimativa pelo CEP, sem precisar entrar na conta.'));
  const quote=el('form'),label=el('label','','CEP para estimar o frete'),input=el('input');
  input.name='cep';input.inputMode='numeric';input.autocomplete='postal-code';input.maxLength=9;
  input.placeholder='00000-000';input.required=true;input.value=postal;
  input.setAttribute('aria-label','CEP para estimar o frete');label.append(input);
  const submit=el('button','','Calcular frete');submit.type='submit';quote.append(label,submit);
  const output=el('p');output.setAttribute('role','status');output.setAttribute('aria-live','polite');
  const results=el('ul');results.hidden=true;preview.append(quote,output,results);
  const items=cart.map(row=>({sku:window.KAIA_CATALOG.find(p=>String(p.id)===String(row.id))?.sku,quantity:row.qty}));
  const fingerprint=JSON.stringify(items);let requestVersion=0;
  input.oninput=()=>{postal=input.value;requestVersion++;results.replaceChildren();results.hidden=true;output.textContent='';submit.disabled=false;};
  quote.onsubmit=async event=>{
   event.preventDefault();const cep=input.value.replace(/\D/g,'');
   if(!/^[0-9]{8}$/.test(cep)){output.textContent='Informe os 8 números do CEP.';return;}
   const version=++requestVersion;postal=cep;input.value=cep.slice(0,5)+'-'+cep.slice(5);
   submit.disabled=true;results.replaceChildren();results.hidden=true;output.textContent='Consultando as transportadoras…';
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
   try{
    const response=await fetch('/api/kaia/frete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({destinoCep:cep,items}),signal:controller.signal});
    const data=await response.json();
    if(version!==requestVersion||!preview.isConnected||fingerprint!==JSON.stringify(items))return;
    if(!response.ok)throw Error(data.message||'Não foi possível calcular o frete agora.');
    for(const option of data.opcoes||[]){
     if(!Number.isSafeInteger(option.freteCentavos)||option.freteCentavos<=0)continue;
     const days=Number(option.previsaoDias);
     results.append(el('li','',(option.servico||option.transportadora||'Entrega')+' · '+money(option.freteCentavos/100)+(Number.isFinite(days)&&days>=0?' · estimativa de '+days+' dia(s) úteis':'')));
    }
    results.hidden=!results.children.length;
    output.textContent=results.children.length?'Estimativa de transporte. Após entrar, confirme o endereço para escolher o frete e conferir o total final.':'Não há modalidade disponível para este CEP. Fale com a equipe para consultar alternativas.';
   }catch(error){if(version===requestVersion&&preview.isConnected)output.textContent=error.name==='AbortError'?'A consulta demorou mais que o esperado. Tente novamente.':error.message;}
   finally{clearTimeout(timer);if(version===requestVersion&&preview.isConnected)submit.disabled=false;}
  };
  root.querySelector('.kc-cart-section')?.after(preview);
  }
  const intro=el('section','kg-checkout-identification');
  intro.append(el('span','kg-identification-kicker','FALTA POUCO PARA O SEU CUIDADO'));
  intro.append(el('h3','','Entre para continuar sua compra'));
  intro.append(el('p','','Seus produtos já estão na sacola. Identifique-se para escolher a entrega e seguir para o pagamento protegido.'));
  const list=root.querySelector('.kc-cart-section');
  if(list)list.after(intro);
  let dock=$('#kgCartDock');
  if(!dock){dock=el('div','kg-cart-dock');dock.id='kgCartDock';dialog.append(dock);}
  dock.replaceChildren();
  const row=el('div','kg-dock-row'),total=el('div','kg-dock-total');
  const label=el('small','','Subtotal · consulte o frete acima');label.id='kgDockLabel';
  const amount=el('strong','','A calcular');amount.id='kgDockValue';
  total.append(label,amount);
  const action=el('div','kg-dock-action');
  const enter=el('button','kg-checkout-identify-button','Ir para pagamento  →');
  enter.type='button';enter.id='kgCheckoutIdentify';
  enter.onclick=()=>{
   if(window.kaiaCheckoutGate?.promptLogin)window.kaiaCheckoutGate.promptLogin();
   else location.assign('/conta.html?voltar=sacola');
  };
  action.append(enter);row.append(total,action);dock.append(row);
  dock.append(el('small','kg-dock-note','Primeiro confirme sua conta. Nenhum pagamento será iniciado agora.'));
  return;
 }
 const cep=$('#shippingPostalCode');
 const storedPostal=postal||window.kaiaCheckoutGate?.postal()||'';
 if(cep&&storedPostal){
  const digits=storedPostal.replace(/\D/g,'');
  cep.value=digits.length===8?digits.slice(0,5)+'-'+digits.slice(5):storedPostal;
 }
 const delivery=$('.kc-delivery-section');
 if(delivery)delivery.insertBefore(el('p','kg-cep-note',
  'Calcule o frete com seu CEP para conferir valores e prazos reais.'),$('#shippingQuoteForm'));
 const payment=$('.kc-payment-section');
 const giftSection=el('section','kg-gift-choice'),heading=el('div','kg-gift-title');
 heading.append(el('h3','','Adicionar embalagem para presente?'),el('small','','Opcional'));
 giftSection.append(heading);
 const choices=el('div','kg-gift-options');
 for(const [value,label,illustration] of [
  ['none','Sem embalagem','/assets/gift-no-packaging.svg'],
  ['box','Caixa','/assets/gift-box.svg'],
  ['bag','Sacola','/assets/gift-bag.svg']
 ]){
  const row=el('label','kg-gift-option'),input=el('input');
  input.type='radio';input.name='kgGift';input.value=value;input.checked=gift===value;
  input.onchange=()=>{if(input.checked)gift=value;};
  const image=el('img','kg-gift-illustration');
  image.src=illustration;image.alt='';image.width=76;image.height=76;
  image.loading='eager';image.decoding='async';
  row.append(input,image,el('span','kg-gift-caption',label));choices.append(row);
 }
 giftSection.append(choices,el('p','kg-gift-note',
  'Embalagem sujeita à confirmação da Kaia Glow, sem cobrança adicional não autorizada.'));
 if(payment)root.insertBefore(giftSection,payment);
 const recommendation=choose(eligible,cart,11),discounted=recommendation.filter(p=>p.oldPrice>p.price).slice(0,5);
 const normal=recommendation.filter(p=>!discounted.includes(p)).slice(0,6);
 const blocks=el('div','kg-cart-recommendations');
 offers('Oferta da seleção','Preços e descontos já publicados pela loja.',discounted,onAdd,blocks);
 offers('Aproveite e leve também','Escolhas para complementar seu cuidado.',normal,onAdd,blocks);
 if(payment&&blocks.children.length)root.insertBefore(blocks,payment);
 let dock=$('#kgCartDock');if(!dock){dock=el('div','kg-cart-dock');dock.id='kgCartDock';dialog.append(dock);}
 dock.replaceChildren();
 const fold=el('details','kg-coupon-fold');fold.id='kgCouponFold';fold.open=couponExpanded;
 fold.append(el('summary','','♧  Tem cupom de desconto?'));
 const field=el('div','kg-coupon-fields');
 for(const id of ['kcCouponForm','kcCouponStatus']){
  const n=$('#'+id);if(n)field.append(n);
 }
 fold.append(field);dock.append(fold);
 const row=el('div','kg-dock-row'),total=el('div','kg-dock-total');
 const label=el('small','','Subtotal');label.id='kgDockLabel';
 const amount=el('strong','','—');amount.id='kgDockValue';
 total.append(label,amount);
 const action=el('div','kg-dock-action'),paymentArea=$('#kcPaymentArea');
 if(paymentArea)action.append(paymentArea);
 row.append(total,action);dock.append(row);
 dock.append(el('small','kg-dock-note','Pagamento protegido pelo Mercado Pago.'));
}
function updateTotals({subtotal,shipping,discount,isFree,shippingValid}){
 const total=$('#kgDockValue'),label=$('#kgDockLabel');
 if(total)total.textContent=money(Math.max(0,subtotal-discount+(isFree?0:shipping)));
 if(label)label.textContent=window.kaiaCheckoutGate?.isAuthenticated()===true?
  (shippingValid?'Total do pedido':'Subtotal · frete a calcular'):'Subtotal · consulte o frete acima';
 if(window.kaiaCheckoutGate?.isAuthenticated()===true)
  for(const step of document.querySelectorAll('.kg-cart-steps [data-stage]')){
   step.classList.toggle('kg-current',Number(step.dataset.stage)===(shippingValid?3:2));
  }
}
function closeBagIfEmpty(){const dock=$('#kgCartDock');if(dock)dock.remove();}
window.kaiaCartExperience={showAdded,beforeBagRender,afterBagRender,updateTotals,closeBagIfEmpty,
 giftChoice:()=>gift,clearGift:()=>{gift='none';}};
})();