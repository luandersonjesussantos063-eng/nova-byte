/* Quote-only shipping, product composition and verified ratings. */
(function(){
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
 const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
 function mount(target,p,opts={}){
  if(!target||!p)return;
  target.querySelector('.kg-product-extras')?.remove();
  const section=el('section','','kg-product-extras');target.append(section);
  const info=el('div','','kg-extra-panel');info.append(el('h3','Composição e cuidados'));
  const inci=String(p.inci||'').trim()||(/(?:^|\n)\s*(?:INCI|Lista de ingredientes)\s*:\s*([^\n]+)/i.exec(p.description||'')?.[1]||'').trim();
  info.append(el('p',inci||'A lista completa de ingredientes ainda não está disponível nesta página. Consulte a embalagem ou solicite a composição à equipe antes da compra.'));
  const contact=el('a','Consultar composição');contact.href='https://wa.me/5511965677152?text='+encodeURIComponent('Olá! Gostaria de confirmar a lista completa de ingredientes de '+p.name+'.');contact.target='_blank';contact.rel='noopener noreferrer';info.append(contact);section.append(info);
  if(opts.quote&&p.sku){
   const shipping=el('div','','kg-extra-panel'),form=el('form','','kg-product-quote'),label=el('label','Calcular frete pelo CEP'),input=el('input'),button=el('button','Calcular'),status=el('p','Estimativa para o produto. O valor final é confirmado na sacola.','kg-extra-status'),results=el('ul');
   input.inputMode='numeric';input.autocomplete='postal-code';input.placeholder='00000-000';input.maxLength=9;input.required=true;label.append(input);button.type='submit';form.append(label,button);status.setAttribute('role','status');shipping.append(form,status,results);section.append(shipping);
   form.addEventListener('submit',async e=>{e.preventDefault();const cep=input.value.replace(/\D/g,'');results.replaceChildren();if(cep.length!==8){status.textContent='Informe um CEP válido com 8 números.';return;}button.disabled=true;status.textContent='Consultando transportadoras…';
    try{const r=await fetch('/api/kaia/frete',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({destinoCep:cep,items:[{sku:p.sku,quantity:Math.max(1,Math.min(10,Number(opts.quantity?.()||1)))}]}),signal:AbortSignal.timeout(20000)});const data=await r.json();
     if(!r.ok)throw Error(data.message||'Frete indisponível.');
     const choices=(data.opcoes||[]).filter(x=>Number.isSafeInteger(x.freteCentavos)&&x.freteCentavos>0);status.textContent=choices.length?'Valores estimados; confirme o total na sacola.':'Nenhuma modalidade encontrada.';
     for(const x of choices)results.append(el('li',[x.transportadora,x.servico].filter(Boolean).join(' · ')+' — '+money(x.freteCentavos)+' · '+x.previsaoDias+' dias estimados'));
    }catch(e){status.textContent=e.message||'Não foi possível calcular o frete.';}finally{button.disabled=false;}
   });
  }
  if(p.sku){
   const reviews=el('div','','kg-extra-panel'),heading=el('h3','Avaliações de clientes'),summary=el('p','Consultando avaliações…'),form=el('form','','kg-rating-form'),label=el('label','Sua nota'),select=el('select'),submit=el('button','Avaliar'),status=el('p','','kg-extra-status');
   status.setAttribute('role','status');select.required=true;for(let i=5;i>=1;i--){const option=el('option',i+' de 5 estrelas');option.value=String(i);select.append(option);}label.append(select);submit.type='submit';form.append(label,submit);reviews.append(heading,summary,el('p','Somente clientes com pedido pago e entregue podem avaliar.'),form,status);section.append(reviews);
   function show(data){summary.textContent=data.count>0?Number(data.average).toLocaleString('pt-BR')+' de 5 · '+data.count+(data.count===1?' avaliação verificada':' avaliações verificadas'):'Ainda não há avaliações verificadas.';}
   fetch('/api/kaia/product-ratings?sku='+encodeURIComponent(p.sku),{signal:AbortSignal.timeout(8000)}).then(async r=>{if(!r.ok)throw Error();show(await r.json());}).catch(()=>{summary.textContent='Avaliações temporariamente indisponíveis.';});
   form.addEventListener('submit',async e=>{e.preventDefault();let token;try{token=JSON.parse(localStorage.getItem('kaia-glow-auth-v1')||'null')?.access_token;}catch{}
    if(!token){status.replaceChildren(el('span','Entre na sua conta para avaliar. '));const link=el('a','Minha conta');link.href='/conta.html';status.append(link);return;}
    submit.disabled=true;status.textContent='Verificando sua compra…';try{const r=await fetch('/api/kaia/product-ratings',{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({sku:p.sku,rating:Number(select.value)}),signal:AbortSignal.timeout(12000)});const data=await r.json();
     if(!r.ok){status.textContent=data.code==='COMPRA_NAO_VERIFICADA'?'Só é possível avaliar após receber um pedido deste produto.':r.status===401?'Entre novamente na sua conta.':'Não foi possível registrar sua avaliação.';return;}show(data);status.textContent='Avaliação registrada. Obrigado!';
    }catch{status.textContent='Não foi possível registrar sua avaliação.';}finally{submit.disabled=false;}
   });
  }
 }
 window.KaiaProductExtras={mount};
})();