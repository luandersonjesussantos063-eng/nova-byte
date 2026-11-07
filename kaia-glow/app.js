Promise.resolve(window.kaiaCatalogReady).then(()=>{
'use strict';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],catalog=window.KAIA_CATALOG;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const whatsappUrl=message=>'https://wa.me/5511965677152?text='+encodeURIComponent(message);
const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
// Only merchant-activated coupons retrieved from Supabase; no demo codes.
const KAIA_COUPONS=(window.KAIA_ACTIVE_COUPONS||[]).map(c=>{
 const percent=c.discount_type==='percent',label=percent?c.discount_value+'% OFF':money(c.discount_value/100)+' OFF';
 return {code:c.code,type:'discount',percent:percent?c.discount_value:0,fixedCents:percent?0:c.discount_value,
  expires:c.ends_at||'9999-12-31',starts:c.starts_at||'0000-01-01',min:c.min_order_cents/100,
  title:'Um carinho de '+label,discountLabel:label,
  condition:c.min_order_cents?'Para pedidos a partir de '+money(c.min_order_cents/100)+'.':'Válido para produtos da coleção Kaia Glow.'};
});
function couponToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Campo_Grande',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(key=>parts.find(p=>p.type===key).value).join('-')}
function calculateCoupon(code,items,today=couponToday()){
 const c=KAIA_COUPONS.find(c=>c.code===code);
 const result={valid:false,discount:0,gift:false,message:''};
 if(!c)return {...result,message:'Cupom não reconhecido. Consulte a aba Cupons.'};
 if(c.expires&&today>c.expires)return {...result,message:'Este cupom expirou.'};
 if(c.starts&&today<c.starts)return {...result,message:'Este cupom ainda não está válido.'};
 const subtotal=items.reduce((sum,item)=>sum+item.price*item.qty,0);
 if(c.min&&subtotal<c.min)return {...result,message:'O pedido mínimo deste cupom é '+money(c.min)+'.'};
 if(c.minItems&&items.reduce((sum,item)=>sum+item.qty,0)<c.minItems)return {...result,message:'Consulte os critérios de participação no atendimento.'};
 const eligible=items.filter(item=>!c.category||item.category===c.category).reduce((sum,item)=>sum+item.price*item.qty,0);
 if(eligible<=0)return {...result,message:c.category?'Adicione produtos de '+c.category+' para usar este cupom.':'Adicione produtos à sacola para usar este cupom.'};
 const discount=c.percent>0?Math.round(eligible*c.percent)/100:Math.min(eligible,c.fixedCents/100);
 return {valid:true,discount,gift:c.percent===100,message:'Desconto na sacola sujeito à validação do servidor.'};
}
function couponItems(){return cart.map(r=>{const p=catalog.find(p=>p.id===r.id);return {category:p.category,price:variantFor(p,r.variantId).price,qty:r.qty}})}

let saved=read('kaia-demo-favorites',[]),favorites=new Set(Array.isArray(saved)?saved.filter(id=>catalog.some(p=>p.id===id)):[]),cart=[],favOnly=false,limit=12,current=null,currentVariant=null,qty=1,coupon='';
let commerceAllowed=null,chosenShipping=null,commerceFetchVersion=0;
const cartItems=()=>cart.map(r=>({sku:catalog.find(p=>p.id===r.id)?.sku,quantity:r.qty}));
function cartSignature(){return JSON.stringify(cartItems().slice().sort((a,b)=>String(a.sku).localeCompare(String(b.sku))));}
function shippingReset(){chosenShipping=null;}
function checkoutEligibility(){
 const btn=$('#checkout');if(!btn)return;
 const skus=cartItems(),eligible=commerceAllowed instanceof Map&&skus.length>0&&
 skus.every(x=>x.sku&&commerceAllowed.has(x.sku)&&
  Math.round(catalog.find(p=>p.sku===x.sku).price*100)===commerceAllowed.get(x.sku));
 const shippingValid=!!(chosenShipping&&chosenShipping.signature===cartSignature()&&
  chosenShipping.postalCode===postalDigits($('#shippingPostalCode')?.value));
 const subtotal=cart.reduce((sum,r)=>sum+variantFor(catalog.find(p=>p.id===r.id),r.variantId).price*r.qty,0);
 const voucher=coupon?calculateCoupon(coupon,couponItems()):null;
 const goodVoucher=!coupon||voucher?.valid===true;
 const shipping=shippingValid?chosenShipping.amountCents/100:0;
 const freeShipping=!!voucher?.valid&&voucher.gift===true;
 const charge=Math.max(0,subtotal-(voucher?.valid?voucher.discount:0)+(freeShipping?0:shipping));
 if($('#kcShippingAmount'))$('#kcShippingAmount').textContent=shippingValid?(freeShipping?'Grátis com cupom':money(shipping)):'A calcular';
 if($('#kcCouponAmount'))$('#kcCouponAmount').textContent=voucher?.valid?'- '+money(voucher.discount):'—';
 if($('#kcTotal'))$('#kcTotal').textContent=money(charge);
 const prepared=!!($('#commercePaymentOptions')||$('#commercePendingOrder'));
 btn.hidden=prepared;btn.disabled=!eligible||!shippingValid||!goodVoucher||prepared;
 btn.textContent=!eligible?'Produto indisponível':!shippingValid?'Escolha o frete':
  !goodVoucher?'Confira o cupom':freeShipping?'Confirmar pedido gratuito':'Continuar para pagamento';
 const note=$('#commerceEligibility');if(!note||prepared)return;
 note.hidden=false;note.style.color='';note.style.fontWeight='';
 note.textContent=!eligible?'Um ou mais itens ainda não estão liberados para compra.':
  !shippingValid?'Selecione o frete para continuar.':
  !goodVoucher?(voucher?.message||'Cupom inválido.'):'';
 note.hidden=!!(eligible&&shippingValid&&goodVoucher);
}
async function fetchEligible(){
 const version=++commerceFetchVersion;
 try{
  const r=await fetch('/api/kaia/comercial/catalogo',{cache:'no-store'});
  if(!r.ok)throw Error('Checkout ainda não liberado');
  const data=await r.json();
  if(version!==commerceFetchVersion)return;
  commerceAllowed=new Map((data.products||[]).map(p=>[p.sku,p.priceCents]));
  checkoutEligibility();render();
 }catch{
  if(version!==commerceFetchVersion)return;
  commerceAllowed=new Map();checkoutEligibility();render();
 }
}
function postalDigits(v){return String(v||'').replace(/\D/g,'');}
function checkoutNotice(message,isError=false){
 const note=$('#commerceEligibility');if(!note)return;
 note.textContent=message;note.style.color=isError?'#a02d33':'';note.style.fontWeight=isError?'700':'';
 if(isError)note.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function validatedMercadoPagoLink(raw){
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.hostname!=='www.mercadopago.com.br'||!u.pathname.startsWith('/checkout/'))
  throw Error('Endereço de pagamento inválido.');
 return u.href;
}
function paymentBrowserOptions(raw,total,{previous=false}={}){
 const url=validatedMercadoPagoLink(raw);
 $('#commercePaymentOptions')?.remove();
 const box=document.createElement('section');
 box.id='commercePaymentOptions';box.className='kc-payment-ready';
 const info=document.createElement('div');info.className='kc-ready-head';
 const label=document.createElement('span');label.textContent=previous?'Pedido em aberto':'Pedido pronto para pagamento';
 info.append(label);
 const link=document.createElement('a');link.href=url;link.target='_blank';
 link.rel='noopener noreferrer';link.className='button kc-pay-action';
 link.textContent='Pagar com Mercado Pago ↗';
 const help=document.createElement('details');help.className='kc-payment-help';
 const summary=document.createElement('summary');summary.textContent='Problemas para abrir?';
 const copy=document.createElement('button');copy.type='button';copy.className='kc-text-action';
 copy.textContent='Copiar link para abrir no Chrome';
 const fallback=document.createElement('div');fallback.className='kc-link-fallback';
 copy.onclick=async()=>{
  try{await navigator.clipboard.writeText(url);copy.textContent='Link copiado. Abra no Chrome.';}
  catch{
   fallback.replaceChildren();
   const input=document.createElement('input');input.type='text';input.readOnly=true;input.value=url;
   input.setAttribute('aria-label','Link para copiar');
   fallback.append(input);input.focus();input.select();
   copy.textContent='Copie o endereço selecionado';
  }
 };
 const tip=document.createElement('p');tip.textContent='Se o aplicativo apresentar erro, use o link copiado no Chrome. Evite pagar duas vezes pelo mesmo pedido.';
 help.append(summary,copy,fallback,tip);
 box.append(info,link,help);
 ($('#kcPaymentArea')||$('#checkout')).append(box);
 const btn=$('#checkout');if(btn)btn.hidden=true;
 const note=$('#commerceEligibility');if(note)note.hidden=true;
 box.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function renderPendingOrder(pending,token){
 $('#commercePendingOrder')?.remove();$('#commercePaymentOptions')?.remove();
 const box=document.createElement('section');box.id='commercePendingOrder';box.className='kc-pending-order';
 const title=document.createElement('strong');title.textContent='Você tem um pedido em aberto';
 const detail=document.createElement('p');
 detail.textContent=(pending.items||[]).map(i=>i.name).join(', ')+' · '+money(pending.totalCents/100);
 box.append(title,detail);
 if(pending.checkoutUrl){
  const resume=document.createElement('a');resume.className='button kc-pay-action';
  resume.href=validatedMercadoPagoLink(pending.checkoutUrl);resume.target='_blank';
  resume.rel='noopener noreferrer';resume.textContent='Retomar pagamento ↗';
  box.append(resume);
 }
 const details=document.createElement('details');details.className='kc-payment-help';
 const summary=document.createElement('summary');summary.textContent='Precisa cancelar este pedido?';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='kc-text-action';
 cancel.textContent='Cancelar pedido não pago';
 cancel.onclick=async()=>{
  if(!confirm('Cancelar este pedido de '+money(pending.totalCents/100)+'? O estoque só será liberado após confirmação do Mercado Pago.'))return;
  cancel.disabled=true;cancel.textContent='Verificando no Mercado Pago…';
  try{
   const r=await fetch('/api/kaia/comercial/pendente',{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'}});
   const info=await r.json();
   if(!r.ok||!info.cancelled)throw Error(info.code||'Cancelamento não confirmado.');
   box.remove();const btn=$('#checkout');if(btn)btn.hidden=false;
   checkoutEligibility();checkoutNotice('Pedido anterior cancelado. Você já pode conferir o frete da nova compra.');
  }catch(e){cancel.disabled=false;cancel.textContent='Tentar cancelar novamente';checkoutNotice('Não foi possível cancelar: '+e.message,true);}
 };
 details.append(summary,cancel);box.append(details);
 ($('#kcPaymentArea')||$('#commerceEligibility')).append(box);
 const btn=$('#checkout');if(btn)btn.hidden=true;
 const note=$('#commerceEligibility');if(note)note.hidden=true;
 box.scrollIntoView({block:'nearest',behavior:'smooth'});
}
async function commercialCheckout(){
 const btn=$('#checkout');
 if(!btn||btn.disabled||!chosenShipping||chosenShipping.signature!==cartSignature())return;
 btn.disabled=true;btn.textContent='Verificando pedidos pendentes…';
 try{
  const {KAIA_AUTH}=await import('./auth-config.js');
  if(!window.supabase)throw Error('Autenticação temporariamente indisponível.');
  const sb=window.supabase.createClient(KAIA_AUTH.url,KAIA_AUTH.publishableKey,
   {auth:{storageKey:'kaia-glow-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const {data}=await sb.auth.getSession();
  if(!data.session)throw Error('Entre na sua conta da Kaia Glow e complete o endereço antes de finalizar. Abra Minha conta em outra aba para preservar a sacola.');
  const token=data.session.access_token;
  const currentPostal=postalDigits($('#shippingPostalCode').value);
  const pendingResponse=await fetch('/api/kaia/comercial/pendente',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
  const pending=await pendingResponse.json();
  if(!pendingResponse.ok)throw Error(pending.code||'Não foi possível conferir seus pedidos anteriores.');
  if(pending.hasPending){
   renderPendingOrder(pending,token);return;
  }
  if(!/^[0-9]{8}$/.test(currentPostal)||pending.registeredPostalCode!==currentPostal)
   throw Error('O CEP usado no frete é diferente do CEP salvo na sua conta ('+(pending.registeredPostalCode||'não cadastrado')+'). Atualize seu endereço em Minha conta e calcule o frete novamente antes de pagar.');
  const fingerprint=cartSignature()+'|'+chosenShipping.serviceId+'|'+currentPostal+'|'+coupon;
  let savedRequest;try{savedRequest=JSON.parse(sessionStorage.getItem('kaia_order_request_v1')||'null');}catch{}
  if(!savedRequest||savedRequest.fingerprint!==fingerprint){
   savedRequest={fingerprint,key:crypto.randomUUID()};
   sessionStorage.setItem('kaia_order_request_v1',JSON.stringify(savedRequest));
  }
  btn.textContent='Preparando pedido…';
  const r=await fetch('/api/kaia/comercial/pedido',{method:'POST',headers:{
   Authorization:'Bearer '+token,'content-type':'application/json',Accept:'application/json'},
   body:JSON.stringify({items:cartItems(),serviceId:chosenShipping.serviceId,postalCode:currentPostal,requestKey:savedRequest.key,coupon:coupon||null})});
  const result=await r.json();
  if(!r.ok)throw Error(({
   CEP_DIFERENTE_DO_CADASTRO:'O CEP da sacola está diferente do endereço cadastrado. Atualize Minha conta e consulte o frete novamente.',
   BANCO_NAO_CONCLUIU_OPERACAO:'Não foi possível reservar o estoque. Confira se já existe um pedido pendente.',
   ENTRE_NA_CONTA:'É necessário entrar na sua conta para pagar.',
   PRODUTO_SEM_LIBERACAO_OU_ESTOQUE:'Produto indisponível ou estoque insuficiente.'
  })[result.code]||result.code||'Não foi possível iniciar seu pedido.');
  if(result.complimentary===true&&result.totalCents===0&&result.status==='approved'){
   window.location.assign('/pedido.html?pedido='+encodeURIComponent(result.id));return;
  }
  const u=new URL(result.checkoutUrl);
  if(u.protocol!=='https:'||u.hostname!=='www.mercadopago.com.br'||!u.pathname.startsWith('/checkout/'))
   throw Error('Endereço de pagamento inválido.');
  // One primary payment action. The provider URL is shown only after
  // the authenticated order and freight total have been saved by the server.
  paymentBrowserOptions(u.href,result.totalCents);
 }catch(e){
  checkoutEligibility();
  checkoutNotice('Não foi possível finalizar: '+e.message,true);
 }
}
let toastTimer;function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000)}
function counts(){$('#favoriteCount').textContent=favorites.size;const n=cart.reduce((a,b)=>a+b.qty,0);$('#bagCount').textContent=n;$('#drawerCount').textContent=`(${n})`;all('[data-wish]').forEach(b=>{const active=favorites.has(b.dataset.wish);b.classList.toggle('active',active);b.textContent=active?'♥':'♡';b.setAttribute('aria-pressed',active)})}
function render(){const term=normalize($('#search').value.trim()),cat=$('#category').value,brand=$('#brand').value,max=+$('#price').value;let list=catalog.filter(p=>(cat==='Todos'||p.category===cat)&&(!brand||p.brand===brand)&&(!max||p.price<=max)&&(!$('#available').checked||p.available)&&(!$('#onSale').checked||p.oldPrice>p.price)&&(!favOnly||favorites.has(p.id))&&(!term||normalize(p.name+' '+p.brand+' '+p.category).includes(term)));
const sort=$('#sort').value;if(sort==='low')list.sort((a,b)=>a.price-b.price);if(sort==='high')list.sort((a,b)=>b.price-a.price);if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
$('#resultCount').textContent=list.length+' '+(favOnly?'favoritos':list.length===1?'produto':'produtos')+(cat==='Todos'?'':' · '+cat);$('#collectionTitle').textContent=favOnly?'Seus favoritos, em um só lugar.':cat==='Todos'?'Todos os produtos.':cat==='Corpo e spa'?'Seu momento de pausa.':cat==='Skincare'?'Um novo ritual para sua pele.':cat==='Cabelos'?'Cuidado da raiz às pontas.':'Seu toque final.';
$('#products').innerHTML=list.slice(0,limit).map(p=>`<article class="product"><div class="product-photo"><a href="#produto-${p.id}" data-product="${p.id}" aria-label="Ver ${esc(p.name)}"><img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer"></a>${!p.available?'<span class="badge sold">ESGOTADO</span>':p.oldPrice>p.price?`<span class="badge">${Math.round((1-p.price/p.oldPrice)*100)}% OFF</span>`:''}<button class="wish" data-wish="${p.id}" aria-label="Favoritar ${esc(p.name)}">♡</button></div><span class="product-brand">${esc(p.brand.toUpperCase())}</span><h3><a href="#produto-${p.id}" data-product="${p.id}">${esc(p.name)}</a></h3><div class="product-price">${p.oldPrice>p.price?`<del>${money(p.oldPrice)}</del>`:''}<span>${money(p.price)}</span></div><button class="quick-add" data-quick="${p.id}" ${p.available&&(commerceAllowed instanceof Map)&&commerceAllowed.has(p.sku)?'':'disabled'}>${p.available&&(commerceAllowed instanceof Map)&&commerceAllowed.has(p.sku)?'Adicionar à sacola':'Compra em breve'}<span>${p.available?'+':'—'}</span></button><a class="kaia-product-page-link" href="${esc(new URL(p.url).pathname)}">Ver página e características ↗</a></article>`).join('');$('#empty').hidden=!!list.length;$('#loadMore').hidden=list.length<=limit;all('nav [data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat&&!favOnly));counts()}
function reset(){favOnly=false;limit=12;$('#search').value='';$('#category').value='Todos';$('#brand').value='';$('#price').value='0';$('#available').checked=false;$('#onSale').checked=false;$('#sort').value='featured';render()}
function setCategory(cat){reset();$('#category').value=cat;render();$('#colecao').scrollIntoView()}
$('#searchForm').onsubmit=e=>{e.preventDefault();limit=12;render();$('#colecao').scrollIntoView()};$('#search').oninput=()=>{limit=12;render()};for(const id of ['category','brand','price','available','onSale','sort'])$('#'+id).onchange=()=>{limit=12;render()};$('#clearFilters').onclick=reset;$('#resetEmpty').onclick=reset;$('#loadMore').onclick=()=>{limit+=12;render()};$('#favorites').onclick=()=>{reset();favOnly=true;render();$('#colecao').scrollIntoView()};$('#offers').onclick=()=>{reset();$('#onSale').checked=true;render();$('#colecao').scrollIntoView()};
$('#brand').innerHTML+=[...new Set(catalog.map(p=>p.brand))].sort().map(b=>`<option>${esc(b)}</option>`).join('');
const hero=catalog.find(p=>p.available&&p.name.includes('PDRN Pink Collagen Gel Mask'))||catalog.find(p=>p.available);$('#heroImage').src=hero.images[0];$('#heroName').textContent=hero.name;$('#heroProduct').onclick=()=>openProduct(hero.id);
const tileNames=['Todos','Skincare','Cabelos','Corpo e spa'];$('#categoryGrid').innerHTML=tileNames.map(cat=>{const p=cat==='Todos'?hero:(catalog.find(x=>x.category===cat&&x.available)||catalog.find(x=>x.category===cat));return `<button class="category-tile" data-cat="${cat}"><div class="category-img"><img src="${esc(p.images[0])}" alt="${cat==='Todos'?'Seleção Kaia Glow':'Seleção de '+cat}" loading="lazy"></div><span>${cat==='Todos'?'Todos os produtos':cat==='Corpo e spa'?'Corpo & spa':cat}<small>↗</small></span></button>`}).join('');
function variantFor(p,id){return p.variants.find(v=>String(v.id)===String(id))||p.variants.find(v=>v.available)||p.variants[0]}
function openProduct(id){const p=catalog.find(x=>x.id===id);if(!p)return;current=p;currentVariant=variantFor(p);qty=1;$('#productContent').innerHTML=`<div class="product-detail"><div class="detail-images"><img id="detailImage" class="main-photo" src="${esc(p.images[0])}" alt="${esc(p.name)}"><div class="thumbs">${p.images.map((im,i)=>`<button data-photo="${i}" aria-label="Ver foto ${i+1}"><img src="${esc(im)}" alt="Foto ${i+1}" loading="lazy"></button>`).join('')}</div></div><div class="detail-info"><span class="eyebrow">${esc(p.brand)} · ${esc(p.category)}</span><h2>${esc(p.name)}</h2><div class="product-price" id="detailPrice">${money(currentVariant.price)}</div><p class="detail-note">${p.available?'Consulte a disponibilidade.':'Produto indisponível.'}</p>${p.variants.length>1?`<label>Opção<select id="variant">${p.variants.map(v=>`<option value="${v.id}" ${v.id===currentVariant.id?'selected':''}>${esc(v.label)}${v.available?'':' · esgotado'}</option>`).join('')}</select></label>`:''}<div class="quantity"><button id="qtyDown" aria-label="Diminuir quantidade">−</button><output id="detailQty">1</output><button id="qtyUp" aria-label="Aumentar quantidade">+</button></div><button class="button" id="addDetail" ${currentVariant.available&&(commerceAllowed instanceof Map)&&commerceAllowed.has(p.sku)?'':'disabled'}>${currentVariant.available&&(commerceAllowed instanceof Map)&&commerceAllowed.has(p.sku)?'Adicionar à sacola':'Compra em breve'}</button><a class="button outline product-whatsapp" href="${esc(whatsappUrl('Olá! Vim pelo site da Kaia Glow e gostaria de saber mais sobre o produto: '+p.name+'.\n'+'https://usekaiaglow.com.br/#produto-'+p.id))}" target="_blank" rel="noopener noreferrer">Tirar dúvida no WhatsApp ↗</a><details class="kc-product-details"><summary>Detalhes e modo de uso</summary><div class="description">${esc(p.description||'Confira as informações deste produto no catálogo original da Kaia Glow. Para saber mais, fale com a equipe Kaia Glow.')}</div></details><p class="detail-note">Consulte as informações e recomendações da embalagem.</p></div></div>`;all('[data-photo]').forEach(b=>b.onclick=()=>{$('#detailImage').src=p.images[+b.dataset.photo]});$('#qtyDown').onclick=()=>{$('#detailQty').textContent=qty=Math.max(1,qty-1)};$('#qtyUp').onclick=()=>{$('#detailQty').textContent=qty=Math.min(10,qty+1)};$('#addDetail').onclick=()=>addCart(p.id,currentVariant.id,qty);if($('#variant'))$('#variant').onchange=e=>{currentVariant=variantFor(p,e.target.value);$('#detailPrice').textContent=money(currentVariant.price);$('#addDetail').disabled=!(currentVariant.available&&(commerceAllowed instanceof Map)&&commerceAllowed.has(p.sku));$('#addDetail').textContent=$('#addDetail').disabled?'Compra em breve':'Adicionar à sacola'};if(!$('#productDialog').open)$('#productDialog').showModal();$('#productDialog').scrollTop=0;window.kaiaMarketing?.productOpened(p);history.replaceState(null,'','#produto-'+id)}
function addCart(id,variantId,quantity=1){const p=catalog.find(x=>x.id===id),v=variantFor(p,variantId);if(!v.available)return;if(!(commerceAllowed instanceof Map)||!commerceAllowed.has(p.sku)){toast('Este produto ficará disponível em outra etapa de vendas.');return;}window.kaiaMarketing?.cartAdded(p);const key=id+'-'+v.id,row=cart.find(x=>x.key===key);if(row)row.qty=Math.min(10,row.qty+quantity);else cart.push({key,id,variantId:v.id,qty:Math.min(10,quantity)});shippingReset();counts();toast('Adicionado à sua sacola.');if($('#bagDialog').open)renderBag()}
function renderBag(){counts();if(!cart.length){$('#bagContent').innerHTML='<div class="bag-body empty"><h2>Sua próxima descoberta<br>está te esperando.</h2><p>Explore a coleção e monte sua sacola.</p><button class="button" id="backShopping">Continuar explorando ↗</button></div>';$('#backShopping').onclick=()=>$('#bagDialog').close();return}
const subtotal=cart.reduce((a,r)=>a+variantFor(catalog.find(p=>p.id===r.id),r.variantId).price*r.qty,0);
$('#bagContent').innerHTML=`<div class="bag-body kc-checkout"><section class="kc-cart-section"><div class="kc-section-title"><h3>Seu pedido</h3><span>${cart.length} ${cart.length===1?'item':'itens'}</span></div>${cart.map(r=>{const p=catalog.find(p=>p.id===r.id),v=variantFor(p,r.variantId);return `<div class="bag-item"><img src="${esc(p.images[0])}" alt="${esc(p.name)}"><div><h3>${esc(p.name)}</h3>${p.variants.length>1?`<small>${esc(v.label)}</small>`:''}<small>${money(v.price)}</small><div class="quantity"><button data-step="-1" data-key="${r.key}" aria-label="Diminuir ${esc(p.name)}">−</button><output>${r.qty}</output><button data-step="1" data-key="${r.key}" aria-label="Aumentar ${esc(p.name)}">+</button></div><button class="remove" data-remove="${r.key}">Remover</button></div></div>`}).join('')}</section><section class="kc-delivery-section"><div class="kc-section-title"><h3>Entrega</h3><a class="kc-account-link" href="/conta.html?aba=dados" target="_blank" rel="noopener noreferrer">Meu endereço ↗</a></div><form id="shippingQuoteForm" class="kc-cep-form" aria-label="Calcular frete"><label for="shippingPostalCode">CEP</label><input id="shippingPostalCode" name="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" aria-label="CEP de entrega" required><button type="submit">Calcular</button></form><p class="kc-inline-hint" id="shippingQuoteResult" role="status" aria-live="polite">Informe seu CEP para ver as opções de entrega.</p><div id="kcShippingChoices" class="kc-shipping-choices" aria-label="Modalidades de entrega"></div></section><section class="kc-payment-section"><div class="kc-section-title"><h3>Finalização</h3><span>Mercado Pago ou cortesia</span></div><div class="kc-amount-line"><span>Produtos</span><strong>${money(subtotal)}</strong></div><form id="kcCouponForm" class="kc-cep-form" aria-label="Aplicar cupom" style="margin:12px 0"><label for="kcCouponCode">Cupom</label><input id="kcCouponCode" type="text" placeholder="Código de desconto" maxlength="24" value="${esc(coupon)}" autocomplete="off"><button type="submit">Aplicar</button></form><p id="kcCouponHint" class="kc-inline-hint" aria-live="polite"></p><div class="kc-amount-line"><span>Desconto</span><strong id="kcCouponAmount">—</strong></div><div class="kc-amount-line"><span>Entrega</span><strong id="kcShippingAmount">A calcular</strong></div><div class="kc-total-line"><span>Total</span><strong id="kcTotal">${money(subtotal)}</strong></div><p class="kc-inline-hint" id="commerceEligibility" role="status">Escolha o frete para continuar.</p><div id="kcPaymentArea"><button class="button" id="checkout" disabled>Escolher frete</button></div><p class="kc-secure-note">Pagamento protegido pelo Mercado Pago.</p></section></div>`;
$('#kcCouponForm').onsubmit=ev=>{
 ev.preventDefault();
 coupon=$('#kcCouponCode').value.trim().toUpperCase();
 const applied=coupon?calculateCoupon(coupon,couponItems()):null;
 $('#kcCouponHint').textContent=!coupon?'Sem cupom.':applied.valid?
  (applied.gift?'100% de desconto e frete grátis. A loja assume a entrega.':
   'Desconto aplicado: '+money(applied.discount)+'.'):
  applied.message;
 checkoutEligibility();
};
if(coupon){
 const applied=calculateCoupon(coupon,couponItems());
 $('#kcCouponHint').textContent=applied.valid?(applied.gift?
  '100% de desconto e frete grátis.':'Desconto aplicado.'):(applied.message||'Confira o cupom.');
}
all('[data-step]').forEach(b=>b.onclick=()=>{const r=cart.find(x=>x.key===b.dataset.key);r.qty=Math.max(1,Math.min(10,r.qty+Number(b.dataset.step)));shippingReset();renderBag()});all('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(r=>r.key!==b.dataset.remove);shippingReset();renderBag()});$('#shippingQuoteForm').onsubmit=async e=>{
 e.preventDefault();
 const status=$('#shippingQuoteResult'),cep=postalDigits($('#shippingPostalCode').value);
 if(!/^[0-9]{8}$/.test(cep)){status.textContent='Informe um CEP válido de 8 números.';return;}
 $('#shippingPostalCode').value=cep.slice(0,5)+'-'+cep.slice(5);
 const requestedCart=cartSignature();
 const items=cart.map(r=>({sku:catalog.find(p=>p.id===r.id)?.sku,quantity:r.qty}));
 if(items.some(x=>!x.sku)){status.textContent='Há itens antigos sem SKU conferido. O frete não pode ser calculado para essa sacola.';return;}
 chosenShipping=null;checkoutEligibility();status.textContent='Consultando os dados de envio…';
 try{
  const r=await fetch('/api/kaia/frete',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({destinoCep:cep,items})});
  const info=await r.json();
  if(cep!==postalDigits($('#shippingPostalCode').value)||requestedCart!==cartSignature())return;
  if(!r.ok){
   const missing=(info.skusPendentes||[]).map(sku=>catalog.find(p=>p.sku===sku)?.name||sku);
   status.textContent=(info.message||'O frete ainda não está disponível para esta sacola.')
     +(missing.length?' Produtos pendentes: '+missing.join(', ')+'.':'');
   return;
  }
  const choices=Array.isArray(info.opcoes)?info.opcoes:[];
  if(!choices.length){status.textContent='Nenhuma opção de envio retornada para esta sacola.';return;}
  const list=$('#kcShippingChoices');list.replaceChildren();
  status.textContent='Selecione uma modalidade de entrega:';
  for(const option of choices){
   const cents=Number(option.freteCentavos);
   if(!Number.isSafeInteger(cents)||cents<=0)continue;
   const serviceId=String(option.id),label=String(option.servico||option.transportadora||('Entrega '+serviceId));
   const button=document.createElement('button');button.type='button';
   button.className='kc-shipping-option';button.setAttribute('aria-pressed','false');
   const name=document.createElement('strong');name.textContent=label;
   const eta=document.createElement('span');eta.className='kc-shipping-eta';
   const days=Number(option.previsaoDias);
   eta.textContent=Number.isFinite(days)&&days>0?'Estimativa: '+days+' dias':'Prazo informado na transportadora';
   const price=document.createElement('b');price.textContent=money(cents/100);
   button.append(name,eta,price);
   button.onclick=()=>{
    chosenShipping={serviceId,signature:cartSignature(),amountCents:cents,postalCode:postalDigits(cep)};
    list.querySelectorAll('button').forEach(b=>{b.classList.remove('is-selected');b.setAttribute('aria-pressed','false')});
    button.classList.add('is-selected');button.setAttribute('aria-pressed','true');
    status.textContent='Entrega selecionada: '+label+'.';
    checkoutEligibility();
   };
   list.append(button);
  }
  if(!list.children.length)status.textContent='Nenhuma modalidade disponível para este CEP.';
 }catch{status.textContent='Não foi possível consultar o frete agora. Confira sua conexão e tente novamente.';}
};$('#shippingPostalCode').oninput=()=>{chosenShipping=null;$('#kcShippingChoices')?.replaceChildren();if($('#shippingQuoteResult'))$('#shippingQuoteResult').textContent='Calcule o frete para este CEP.';checkoutEligibility();};$('#checkout').onclick=commercialCheckout;fetchEligible();checkoutEligibility();}
$('#bagButton').onclick=()=>{renderBag();$('#bagDialog').showModal()};
function info(type){let html='';if(type==='checkout')html='<h2>Finalização indisponível no momento</h2><p>Não foi possível iniciar a finalização online. Fale com a Kaia Glow para receber atendimento. Nenhum pagamento foi iniciado.</p><a class="button" href="'+esc(whatsappUrl('Olá! Preciso de ajuda para finalizar uma compra na Kaia Glow.'))+'" target="_blank" rel="noopener noreferrer">Falar com a equipe</a>';
if(type==='privacy')html='<h2>Sua privacidade na Kaia Glow</h2><p>A conta utiliza dados reais: nome, e-mail, CPF, nascimento, telefone e endereço. Saiba como tratamos seus dados de navegação, cadastro e atendimento. Consulte as finalidades, os provedores, os dados locais e seus direitos na política completa.</p><a class="button" href="privacidade.html">Ler Política de privacidade ↗</a>';
if(type==='contact')html=`<span class="eyebrow">ATENDIMENTO KAIA GLOW</span><h2>Vamos conversar<br>sobre o seu cuidado?</h2><p>Fale com a equipe pelo WhatsApp para tirar dúvidas sobre os produtos e consultar disponibilidade.</p><a class="button" href="${esc(whatsappUrl('Olá! Vim pelo site da Kaia Glow e gostaria de saber mais sobre os produtos.'))}" target="_blank" rel="noopener noreferrer">Conversar no WhatsApp ↗</a><p class="detail-note">(11) 96567-7152 · A mensagem fica preenchida para você revisar e enviar.</p>`;
$('#infoContent').innerHTML=html;if(!$('#infoDialog').open)$('#infoDialog').showModal();if($('#clearData'))$('#clearData').onclick=()=>{favorites.clear();save('kaia-demo-favorites',[]);render();$('#infoDialog').close();toast('Favoritos apagados.')};}
all('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());all('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}));
$('#productDialog').addEventListener('close',()=>{window.kaiaMarketing?.productClosed();if(location.hash.startsWith('#produto-'))history.replaceState(null,'',location.pathname+location.search+'#colecao')});
document.addEventListener('click',e=>{const c=e.target.closest('[data-cat]');if(c)setCategory(c.dataset.cat);const p=e.target.closest('[data-product]');if(p){e.preventDefault();openProduct(p.dataset.product)}const w=e.target.closest('[data-wish]');if(w){favorites.has(w.dataset.wish)?favorites.delete(w.dataset.wish):favorites.add(w.dataset.wish);save('kaia-demo-favorites',[...favorites]);if(favOnly)render();else counts()}const q=e.target.closest('[data-quick]');if(q){const product=catalog.find(p=>p.id===q.dataset.quick);if(product.variants.length>1)openProduct(product.id);else addCart(product.id)}const i=e.target.closest('[data-info]');if(i)info(i.dataset.info)});
render();fetchEligible();const deepLink=location.hash.match(/^#produto-(\d+)$/);if(deepLink)openProduct(deepLink[1]);

// Editorial selection uses the same real catalog and shopping actions.
const featuredSkus=[
 'KG-MED-PDRNPINK-MASK-28G',
 'KG-BIO-BCOLL-DEEP-34G',
 'KG-CEL-RETBOOST-15ML',
 'KG-SK1-TBBTONER-210ML'
];
const desirePicks=featuredSkus.map(sku=>catalog.find(p=>p.sku===sku)).filter(Boolean);
if(desirePicks.length!==4)console.warn('Kaia Glow: seleção editorial incompleta; conferir SKUs de destaque.');
$('#desireGrid').innerHTML=desirePicks.map((p,i)=>`<article class="product desire-product"><div class="desire-number">0${i+1} / THE KAIA EDIT</div><div class="product-photo"><a href="#produto-${p.id}" data-product="${p.id}" aria-label="Descobrir ${esc(p.name)}"><img src="${esc(p.id==='351521227'?p.images[8]:p.images[0])}" alt="${esc(p.name)}" loading="eager"></a><button class="wish" data-wish="${p.id}" aria-label="Favoritar ${esc(p.name)}">♡</button></div><span class="product-brand">${esc(p.brand.toUpperCase())}</span><h3><a href="#produto-${p.id}" data-product="${p.id}">${esc(p.name)}</a></h3><div class="desire-purchase"><span>${money(p.price)}</span><button data-quick="${p.id}" aria-label="Adicionar ${esc(p.name)} à sacola">Eu quero <span>↗</span></button></div></article>`).join('');
counts();

// Four editorial campaigns; rotate every three seconds while in view.
(()=>{
 const section=$('#inicio'),photos=all('[data-campaign-image]');
 const slides=[
  {product:desirePicks[0],headline:'O seu glow<br>começa <em>aqui.</em>',description:'Medicube PDRN Pink Collagen Gel Mask.<br>Uma pausa na rotina. Um cuidado para chamar de seu.'},
  {product:desirePicks[1],headline:'Seu momento.<br>Seu <em>ritual.</em>',description:'Biodance Bio Collagen Real Deep Mask.<br>Descubra o prazer de reservar um tempo para você.'},
  {product:desirePicks[2],headline:'Um cuidado.<br>Só <em>seu.</em>',description:'Celimax Retinal Shot Tightening Booster.<br>Conheça de perto um novo passo no seu ritual.'},
  {product:desirePicks[3],headline:'Uma pausa.<br>Mais <em>você.</em>',description:'SKIN1004 Madagascar Centella Boosting Toner.<br>Uma nova descoberta para os seus momentos de cuidado.'}
 ];
 let index=0,timer=null,visible=true,userPaused=matchMedia('(prefers-reduced-motion: reduce)').matches,focused=false,touchStart=null;
 const dots=$('#campaignDots');
 dots.innerHTML=slides.map((s,i)=>`<button data-campaign-dot="${i}" aria-label="Ver campanha ${i+1}: ${esc(s.product.brand)}" aria-current="${i===0?'true':'false'}"><span></span></button>`).join('');
 function updatePlayback(){
  clearInterval(timer);timer=null;const running=!userPaused&&!document.hidden&&visible&&!focused&&!all('dialog').some(d=>d.open);
  section.classList.toggle('carousel-running',running);
  $('#campaignPause').textContent=userPaused?'▶':'Ⅱ';
  $('#campaignPause').setAttribute('aria-label',userPaused?'Reproduzir carrossel':'Pausar carrossel');
  $('#campaignPause').setAttribute('aria-pressed',String(userPaused));
  if(running)timer=setInterval(()=>show(index+1),3000);
 }
 function show(next){
  index=(next+slides.length)%slides.length;const s=slides[index];
  photos.forEach((im,i)=>im.classList.toggle('active',i===index));
  $('#campaignHeadline').innerHTML=s.headline;$('#campaignDescription').innerHTML=s.description;
  $('#heroImage').src=s.product.id==='351521227'?s.product.images[8]:s.product.images[0];
  $('#heroImage').alt=s.product.name;$('#heroName').textContent=s.product.name;
  $('#heroProduct').onclick=()=>openProduct(s.product.id);
  $('#heroExplore').href='#produto-'+s.product.id;
  $('#heroExplore').onclick=e=>{e.preventDefault();openProduct(s.product.id)};
  $('#campaignLabel').textContent='0'+(index+1)+' / 04 — '+s.product.brand.toUpperCase();
  all('[data-campaign-dot]').forEach((b,i)=>b.setAttribute('aria-current',String(i===index)));
 }
 function manual(next){show(next);updatePlayback()}
 $('#campaignPrevious').onclick=()=>manual(index-1);$('#campaignNext').onclick=()=>manual(index+1);
 all('[data-campaign-dot]').forEach(b=>b.onclick=()=>manual(Number(b.dataset.campaignDot)));
 $('#campaignPause').onclick=()=>{userPaused=!userPaused;if(!userPaused)focused=false;updatePlayback()};
 section.addEventListener('focusin',()=>{focused=true;updatePlayback()});
 section.addEventListener('focusout',e=>{if(!section.contains(e.relatedTarget)){focused=false;updatePlayback()}});
 section.addEventListener('touchstart',e=>{touchStart=e.touches[0].clientX},{passive:true});
 section.addEventListener('touchend',e=>{if(touchStart===null)return;const delta=e.changedTouches[0].clientX-touchStart;touchStart=null;if(Math.abs(delta)>60)manual(index+(delta<0?1:-1))},{passive:true});
 document.addEventListener('visibilitychange',updatePlayback);
 all('dialog').forEach(d=>new MutationObserver(updatePlayback).observe(d,{attributes:true,attributeFilter:['open']}));
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;updatePlayback()},{threshold:.15}).observe(section);
 show(0);updatePlayback();
})();

const ritualFilm=document.querySelector('#chronologisteVideo');
if(ritualFilm){
 const soundButton=document.querySelector('#ritualSound');
 let inView=false,autoPause=false,userPaused=false;
 ritualFilm.muted=true;
 const syncSound=()=>{soundButton.textContent=ritualFilm.muted?'Ativar som':'Desativar som';soundButton.setAttribute('aria-pressed',String(!ritualFilm.muted))};
 soundButton.addEventListener('click',()=>{ritualFilm.muted=!ritualFilm.muted;syncSound()});
 ritualFilm.addEventListener('volumechange',syncSound);
 ritualFilm.addEventListener('pause',()=>{if(!autoPause&&inView&&!document.hidden)userPaused=true;autoPause=false});
 ritualFilm.addEventListener('play',()=>{userPaused=false});
 const updateRitualPlayback=()=>{
  const blocked=document.hidden||!!document.querySelector('dialog[open]');
  if(inView&&!blocked&&!userPaused){ritualFilm.play().catch(()=>{/* Native controls remain available when autoplay is restricted. */})}
  else if(!ritualFilm.paused){autoPause=true;ritualFilm.pause()}
 };
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{const entry=entries[0];inView=entry.isIntersecting&&entry.intersectionRatio>=.2;updateRitualPlayback()},{threshold:[0,.2]}).observe(ritualFilm);
 document.addEventListener('visibilitychange',updateRitualPlayback);
 document.querySelectorAll('dialog').forEach(dialog=>new MutationObserver(updateRitualPlayback).observe(dialog,{attributes:true,attributeFilter:['open']}));
 syncSound();
}

// Keep secondary services inside the header menu, leaving the product showcase clear.
const kaiaMenuButton=document.querySelector('#kaiaMenuButton');
const kaiaMenuDialog=document.querySelector('#kaiaMenuDialog');
const syncMenuExpanded=()=>kaiaMenuButton.setAttribute('aria-expanded',String(kaiaMenuDialog.open));
kaiaMenuButton.addEventListener('click',()=>{kaiaMenuDialog.showModal();syncMenuExpanded()});
kaiaMenuDialog.addEventListener('close',syncMenuExpanded);
new MutationObserver(syncMenuExpanded).observe(kaiaMenuDialog,{attributes:true,attributeFilter:['open']});
if(location.hash==='#exclusivos'){kaiaMenuDialog.showModal();history.replaceState(null,'',location.pathname+location.search)}

// A retail offer shelf uses only the real catalogue prices, without generated ratings or stock claims.
const shelfProducts=catalog.filter(p=>p.available&&p.oldPrice>p.price).slice(0,6);
$('#offerShelf').innerHTML=shelfProducts.map(p=>`<article class="product retail-offer-product"><div class="product-photo"><a href="#produto-${p.id}" data-product="${p.id}" aria-label="Ver ${esc(p.name)}"><img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer"></a><span class="badge">${Math.round((1-p.price/p.oldPrice)*100)}% OFF</span><button class="wish" data-wish="${p.id}" aria-label="Favoritar ${esc(p.name)}">♡</button></div><span class="product-brand">${esc(p.brand)}</span><h3><a href="#produto-${p.id}" data-product="${p.id}">${esc(p.name)}</a></h3><div class="product-price"><del>${money(p.oldPrice)}</del><span>${money(p.price)}</span></div><button class="quick-add" data-quick="${p.id}">Adicionar à sacola <span>+</span></button></article>`).join('');
$('#shelfOffers').onclick=()=>$('#offers').click();
$('#retailEnquiries').onclick=()=>kaiaMenuDialog.showModal();
kaiaMenuDialog.addEventListener('click',event=>{if(event.target.closest('[data-cat]'))kaiaMenuDialog.close()});
counts();

// Coupon catalogue stays behind its tab so the main product flow remains compact.
const couponsDialog=$('#couponsDialog');
function openCoupons(){if(kaiaMenuDialog.open)kaiaMenuDialog.close();if(!couponsDialog.open)couponsDialog.showModal()}
function renderCoupons(){if(!KAIA_COUPONS.length){$('#couponGrid').innerHTML='<p class="coupon-empty">Não há cupons disponíveis no momento. Consulte a equipe para conhecer as condições vigentes.</p>';return;}const type=$('#couponType').value,today=couponToday();$('#couponGrid').innerHTML=KAIA_COUPONS.filter(c=>type==='all'||c.type===type).map(c=>{const expired=today>c.expires;return `<article class="coupon-ticket"><span class="coupon-ticket-tag">${esc(c.discountLabel)}</span><h3>${esc(c.title)}</h3><p class="coupon-expiry">${expired?'Expirado em':'Válido até'} ${c.expires.split('-').reverse().join('/')}</p><details class="coupon-conditions"><summary>Condições</summary><p>${esc(c.condition)} Válido até a data indicada, no horário de Mato Grosso. Consulte os critérios de uso desta oferta antes de concluir a compra.</p></details><div class="coupon-ticket-bottom"><button class="coupon-products" data-coupon-products="${c.code}">Ver produtos ↗</button><button class="coupon-copy" data-copy-coupon="${c.code}" aria-label="Copiar cupom ${c.code}" ${expired?'disabled':''}><span>${c.code}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M15 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1" stroke="currentColor" stroke-width="1.5"/></svg></button></div></article>`}).join('')}
all('[data-open-coupons]').forEach(button=>button.addEventListener('click',openCoupons));
$('#couponType').onchange=renderCoupons;
couponsDialog.addEventListener('click',async event=>{
 const copy=event.target.closest('[data-copy-coupon]');if(copy){const code=copy.dataset.copyCoupon;let copied=false;try{await navigator.clipboard.writeText(code);copied=true}catch{const input=document.createElement('textarea');input.value=code;input.setAttribute('readonly','');input.style.cssText='position:fixed;left:0;top:0;opacity:0;pointer-events:none';couponsDialog.append(input);input.select();try{copied=document.execCommand('copy')}catch{}input.remove();copy.focus()}$('#couponCopyStatus').textContent=copied?'Cupom '+code+' copiado. Cole no campo de cupom da sacola.':'Código '+code+': selecione o texto do botão para copiar ou digite na sacola.';if(copied){copy.querySelector('span').textContent='Copiado ✓';copy.setAttribute('aria-label','Cupom '+code+' copiado');setTimeout(()=>{if(copy.isConnected){copy.querySelector('span').textContent=code;copy.setAttribute('aria-label','Copiar cupom '+code)}},2200)}return}
 const products=event.target.closest('[data-coupon-products]');if(products){const c=KAIA_COUPONS.find(c=>c.code===products.dataset.couponProducts);couponsDialog.close();setCategory(c.category||'Todos');if(!catalog.some(p=>p.category===c.category)&&c.category)toast('Nenhum produto disponível nesta categoria.')}
});
renderCoupons();
if(location.hash==='#cupons')openCoupons();

// Scroll-linked collapse: the same search field moves continuously into its compact position.
(()=>{
 const header=document.querySelector('.retail-header'),stage=document.querySelector('.campaign-stage');
 if(!header||!stage)return;
 let scheduled=false;
 function update(){
  scheduled=false;
  const origin=stage.getBoundingClientRect().top+window.scrollY;
  const progress=Math.max(0,Math.min(1,(window.scrollY-origin)/150));
  header.style.setProperty('--scroll-progress',progress.toFixed(4));
  header.style.setProperty('--header-top',Math.max(0,origin-window.scrollY)+'px');
  header.style.setProperty('--header-ink',`rgb(${Math.round(255-156*progress)},${Math.round(255-204*progress)},${Math.round(255-179*progress)})`);
  header.classList.toggle('is-compact',progress>=.999);
  header.dataset.scrollProgress=progress.toFixed(3);
 }
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update)}}
 window.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('pageshow',schedule);
 update();
})();

// A visitor sees the invitation once per tab session and can reopen it from the menu.
(()=>{
 const dialog=document.querySelector('#referralDialog'),share=document.querySelector('#shareReferral'),status=document.querySelector('#referralStatus');
 const sessionKey='kaia-referral-seen-v1';
 let shown=false,returnFocus=null;
 try{shown=sessionStorage.getItem(sessionKey)==='1'}catch{}
 function openReferral(){
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  returnFocus=document.activeElement;
  status.textContent='';dialog.showModal();shown=true;
  try{sessionStorage.setItem(sessionKey,'1')}catch{}
 }
 document.querySelectorAll('[data-open-referral]').forEach(b=>b.addEventListener('click',openReferral));
 dialog.addEventListener('close',()=>{if(returnFocus&&returnFocus.isConnected)returnFocus.focus()});
 function invite(){if(shown)return;if(document.hidden||document.querySelector('dialog[open]')){setTimeout(invite,2000);return}openReferral()}
 if(!shown)setTimeout(invite,8000);
 share.addEventListener('click',()=>{const code=new URLSearchParams(location.search).get('indicacao');location.href='conta.html?aba=indicacoes'+(/^[a-f0-9]{20}$/.test(code||'')?'&modo=cadastro&indicacao='+encodeURIComponent(code):'')});
})();

// Preserve only a public referral code; registration and attribution happen on the server.
(()=>{
 const code=new URLSearchParams(location.search).get('indicacao');
 if(!/^[a-f0-9]{20}$/.test(code||''))return;
 try{localStorage.setItem('kaia-pending-referral-v1',JSON.stringify({code,at:Date.now()}))}catch{}
 document.querySelectorAll('a[href^="conta.html"]').forEach(link=>{const url=new URL(link.getAttribute('href'),location.href);url.searchParams.set('indicacao',code);url.searchParams.set('modo','cadastro');link.href=url.pathname+url.search});
})();

// Keep one top-level menu group open at a time, including on older browsers.
document.querySelectorAll('#kaiaMenuDialog .menu-group').forEach(group=>group.addEventListener('toggle',()=>{
 if(group.open)document.querySelectorAll('#kaiaMenuDialog .menu-group').forEach(other=>{if(other!==group)other.open=false});
}));

// The footer already provides a WhatsApp link; keep its legal text unobstructed.
(()=>{
 const footer=document.querySelector('#informacoes'),contact=document.querySelector('.whatsapp-floating');
 if(!footer||!contact||!('IntersectionObserver' in window))return;
 new IntersectionObserver(entries=>{contact.hidden=entries[0].isIntersecting;}).observe(footer);
})();

// About navigation is separate from the purchasing flow.
all('[data-open-about]').forEach(button=>button.addEventListener('click',()=>{
 kaiaMenuDialog.showModal();const about=$('#sobre-kaia');about.open=true;about.querySelector('summary').focus();
}));

}).catch(error=>console.error('Kaia Glow: erro de inicialização do catálogo',error));
