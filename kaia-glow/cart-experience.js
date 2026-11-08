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
 const cep=$('#shippingPostalCode');if(cep)postal=cep.value;
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
 const cep=$('#shippingPostalCode');if(cep&&postal)cep.value=postal;
 const delivery=$('.kc-delivery-section');
 if(delivery)delivery.insertBefore(el('p','kg-cep-note',
  'Calcule o frete com seu CEP para conferir valores e prazos reais.'),$('#shippingQuoteForm'));
 const payment=$('.kc-payment-section');
 const giftSection=el('section','kg-gift-choice'),heading=el('div','kg-gift-title');
 heading.append(el('h3','','Adicionar embalagem para presente?'),el('small','','Opcional'));
 giftSection.append(heading);
 const choices=el('div','kg-gift-options');
 for(const [value,label,icon] of [['none','Sem embalagem','—'],['box','Caixa','▣'],['bag','Sacola','♧']]){
  const row=el('label','kg-gift-option'),input=el('input');
  input.type='radio';input.name='kgGift';input.value=value;input.checked=gift===value;
  input.onchange=()=>{if(input.checked)gift=value;};
  row.append(input,el('span','kg-gift-icon',icon),el('span','',label));choices.append(row);
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
 if(label)label.textContent=shippingValid?'Total do pedido':'Subtotal · frete a calcular';
 for(const step of document.querySelectorAll('.kg-cart-steps [data-stage]')){
  step.classList.toggle('kg-current',Number(step.dataset.stage)===(shippingValid?3:2));
 }
}
function closeBagIfEmpty(){const dock=$('#kgCartDock');if(dock)dock.remove();}
window.kaiaCartExperience={showAdded,beforeBagRender,afterBagRender,updateTotals,closeBagIfEmpty,
 giftChoice:()=>gift,clearGift:()=>{gift='none';}};
})();