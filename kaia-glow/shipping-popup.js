// Shipping presentation only. Quotes come from /api/kaia/frete; no label or checkout.
(()=>{'use strict';
 const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const elt=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const dialog=document.getElementById('shippingDialog'),choicesBox=document.getElementById('shippingOptions');
 const back=document.getElementById('shippingDialogDone');
 if(!dialog||!choicesBox||!back)return;
 back.addEventListener('click',()=>dialog.close());
 window.kaiaShowShippingOptions=(quote,postalCode)=>{
  const options=(Array.isArray(quote?.opcoes)?quote.opcoes:[])
   .filter(o=>Number.isSafeInteger(o.freteCentavos)&&o.freteCentavos>=0&&Number.isSafeInteger(o.previsaoDias)&&o.previsaoDias>=0)
   .sort((a,b)=>a.freteCentavos-b.freteCentavos||a.previsaoDias-b.previsaoDias);
  if(!options.length)return;
  const minPrice=Math.min(...options.map(o=>o.freteCentavos));
  const minDays=Math.min(...options.map(o=>o.previsaoDias));
  const cep=String(postalCode||'').replace(/\D/g,'');
  document.getElementById('shippingPostalSummary').textContent='Opções para o CEP '+(cep.length===8?cep.slice(0,5)+'-'+cep.slice(5):cep);
  choicesBox.replaceChildren();
  options.forEach(o=>{
   const best=o.freteCentavos===minPrice,fast=o.previsaoDias===minDays;
   const card=elt('article','shipping-option-card'+(best?' is-cheapest':''),null);
   const top=elt('div','shipping-option-title',null);
   top.append(elt('strong','', [o.transportadora,o.servico].filter(Boolean).join(' · ')));
   const badges=elt('div','shipping-option-badges',null);
   if(best)badges.append(elt('span','shipping-option-badge','Melhor preço'));
   if(fast)badges.append(elt('span','shipping-option-badge is-fastest','Mais rápido'));
   top.append(badges);card.append(top);
   card.append(elt('span','shipping-option-price',money(o.freteCentavos/100)));
   const time=elt('p','shipping-option-time','Prazo estimado: ');
   time.append(elt('strong','',o.previsaoDias+' '+(o.previsaoDias===1?'dia':'dias')));
   card.append(time);choicesBox.append(card);
  });
  document.getElementById('shippingDialogNote').textContent=(quote.referenciasExternas?'Algumas medidas são referências de fornecedores. ':'')
   +'Valores e prazos estimados pela SuperFrete, sujeitos à conferência no pedido. Compra e pagamento continuam indisponíveis.';
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('.shipping-close')?.focus();
 };
})();
