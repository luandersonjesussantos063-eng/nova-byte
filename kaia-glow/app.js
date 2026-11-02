'use strict';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],catalog=window.KAIA_CATALOG;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const whatsappUrl=message=>'https://wa.me/5511965677152?text='+encodeURIComponent(message);
const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
const KAIA_COUPONS=[
 {code:'10EXTRA',title:'10% OFF nas compras acima de R$ 149',type:'discount',expires:'2026-11-03',min:149,category:null,condition:'Desconto de 10% sobre os produtos da sacola quando o subtotal for maior que R$ 149.'},
 {code:'MIMODOBOTI',title:'Mimo na compra de 3 ou mais itens',type:'gift',expires:'2026-11-03',minItems:3,category:null,condition:'A partir de 3 itens, esta simulação sinaliza um mimo. O brinde não foi especificado nos prints e não é incluído como produto real.'},
 {code:'PERFUMARIA',title:'10% OFF em produtos de Perfumaria',type:'discount',expires:'2026-12-01',category:'Perfumaria',condition:'10% de desconto somente sobre os itens de Perfumaria. Ainda não há produtos desta categoria na prévia.'},
 {code:'CABELOS',title:'10% OFF em produtos de Cabelos',type:'discount',expires:'2026-12-01',category:'Cabelos',condition:'10% de desconto somente sobre os itens da categoria Cabelos.'},
 {code:'MAKE',title:'10% OFF em produtos de Maquiagem',type:'discount',expires:'2026-12-01',category:'Maquiagem',condition:'10% de desconto somente sobre os itens de Maquiagem. Ainda não há produtos desta categoria na prévia.'},
 {code:'CORPO',title:'10% OFF em produtos de Corpo e Banho',type:'discount',expires:'2026-12-01',category:'Corpo e spa',condition:'10% de desconto somente sobre os itens da categoria Corpo & spa.'}
];
function couponToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Campo_Grande',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(key=>parts.find(p=>p.type===key).value).join('-')}
function calculateCoupon(code,items,today=couponToday()){
 const c=KAIA_COUPONS.find(c=>c.code===code)||(code==='BEMVINDAKAIA10'?{code,type:'discount',category:null}:null);
 const result={valid:false,discount:0,gift:false,message:''};
 if(!c)return {...result,message:'Cupom não reconhecido. Consulte a aba Cupons.'};
 if(c.expires&&today>c.expires)return {...result,message:'Este cupom está expirado nesta simulação.'};
 const subtotal=items.reduce((sum,item)=>sum+item.price*item.qty,0);
 if(c.min&&subtotal<=c.min)return {...result,message:'Este cupom exige subtotal acima de R$ 149.'};
 if(c.minItems&&items.reduce((sum,item)=>sum+item.qty,0)<c.minItems)return {...result,message:'Adicione 3 ou mais itens para simular o mimo.'};
 const eligible=items.filter(item=>!c.category||item.category===c.category).reduce((sum,item)=>sum+item.price*item.qty,0);
 if(eligible<=0)return {...result,message:c.category?'Adicione produtos de '+c.category+' para usar este cupom.':'Adicione produtos à sacola para usar este cupom.'};
 return {valid:true,discount:c.type==='discount'?Math.round(eligible*10)/100:0,gift:c.type==='gift',message:c.type==='gift'?'Mimo sinalizado nesta simulação. Brinde a definir.':'10% aplicado aos produtos elegíveis nesta simulação.'};
}
function couponItems(){return cart.map(r=>{const p=catalog.find(p=>p.id===r.id);return {category:p.category,price:variantFor(p,r.variantId).price,qty:r.qty}})}

let saved=read('kaia-demo-favorites',[]),favorites=new Set(Array.isArray(saved)?saved.filter(id=>catalog.some(p=>p.id===id)):[]),cart=[],favOnly=false,limit=12,current=null,currentVariant=null,qty=1,coupon='';
let toastTimer;function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000)}
function counts(){$('#favoriteCount').textContent=favorites.size;const n=cart.reduce((a,b)=>a+b.qty,0);$('#bagCount').textContent=n;$('#drawerCount').textContent=`(${n})`;all('[data-wish]').forEach(b=>{const active=favorites.has(b.dataset.wish);b.classList.toggle('active',active);b.textContent=active?'♥':'♡';b.setAttribute('aria-pressed',active)})}
function render(){const term=normalize($('#search').value.trim()),cat=$('#category').value,brand=$('#brand').value,max=+$('#price').value;let list=catalog.filter(p=>(cat==='Todos'||p.category===cat)&&(!brand||p.brand===brand)&&(!max||p.price<=max)&&(!$('#available').checked||p.available)&&(!$('#onSale').checked||p.oldPrice>p.price)&&(!favOnly||favorites.has(p.id))&&(!term||normalize(p.name+' '+p.brand+' '+p.category).includes(term)));
const sort=$('#sort').value;if(sort==='low')list.sort((a,b)=>a.price-b.price);if(sort==='high')list.sort((a,b)=>b.price-a.price);if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
$('#resultCount').textContent=list.length+' '+(favOnly?'favoritos':list.length===1?'produto':'produtos')+(cat==='Todos'?'':' · '+cat);$('#collectionTitle').textContent=favOnly?'Seus favoritos, em um só lugar.':cat==='Todos'?'Todos os produtos.':cat==='Corpo e spa'?'Seu momento de pausa.':cat==='Skincare'?'Um novo ritual para sua pele.':cat==='Cabelos'?'Cuidado da raiz às pontas.':'Seu toque final.';
$('#products').innerHTML=list.slice(0,limit).map(p=>`<article class="product"><div class="product-photo"><a href="#produto-${p.id}" data-product="${p.id}" aria-label="Ver ${esc(p.name)}"><img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer"></a>${!p.available?'<span class="badge sold">ESGOTADO</span>':p.oldPrice>p.price?`<span class="badge">${Math.round((1-p.price/p.oldPrice)*100)}% OFF</span>`:''}<button class="wish" data-wish="${p.id}" aria-label="Favoritar ${esc(p.name)}">♡</button></div><span class="product-brand">${esc(p.brand.toUpperCase())}</span><h3><a href="#produto-${p.id}" data-product="${p.id}">${esc(p.name)}</a></h3><div class="product-price">${p.oldPrice>p.price?`<del>${money(p.oldPrice)}</del>`:''}<span>${money(p.price)}</span></div><button class="quick-add" data-quick="${p.id}" ${p.available?'':'disabled'}>${p.available?'Adicionar à sacola':'Indisponível na consulta'}<span>${p.available?'+':'—'}</span></button></article>`).join('');$('#empty').hidden=!!list.length;$('#loadMore').hidden=list.length<=limit;all('nav [data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat&&!favOnly));counts()}
function reset(){favOnly=false;limit=12;$('#search').value='';$('#category').value='Todos';$('#brand').value='';$('#price').value='0';$('#available').checked=false;$('#onSale').checked=false;$('#sort').value='featured';render()}
function setCategory(cat){reset();$('#category').value=cat;render();$('#colecao').scrollIntoView()}
$('#searchForm').onsubmit=e=>{e.preventDefault();limit=12;render();$('#colecao').scrollIntoView()};$('#search').oninput=()=>{limit=12;render()};for(const id of ['category','brand','price','available','onSale','sort'])$('#'+id).onchange=()=>{limit=12;render()};$('#clearFilters').onclick=reset;$('#resetEmpty').onclick=reset;$('#loadMore').onclick=()=>{limit+=12;render()};$('#favorites').onclick=()=>{reset();favOnly=true;render();$('#colecao').scrollIntoView()};$('#offers').onclick=()=>{reset();$('#onSale').checked=true;render();$('#colecao').scrollIntoView()};
$('#brand').innerHTML+=[...new Set(catalog.map(p=>p.brand))].sort().map(b=>`<option>${esc(b)}</option>`).join('');
const hero=catalog.find(p=>p.available&&p.name.includes('PDRN Pink Collagen Gel Mask'))||catalog.find(p=>p.available);$('#heroImage').src=hero.images[0];$('#heroName').textContent=hero.name;$('#heroProduct').onclick=()=>openProduct(hero.id);
const tileNames=['Todos','Skincare','Cabelos','Corpo e spa'];$('#categoryGrid').innerHTML=tileNames.map(cat=>{const p=cat==='Todos'?hero:(catalog.find(x=>x.category===cat&&x.available)||catalog.find(x=>x.category===cat));return `<button class="category-tile" data-cat="${cat}"><div class="category-img"><img src="${esc(p.images[0])}" alt="${cat==='Todos'?'Seleção Kaia Glow':'Seleção de '+cat}" loading="lazy"></div><span>${cat==='Todos'?'Todos os produtos':cat==='Corpo e spa'?'Corpo & spa':cat}<small>↗</small></span></button>`}).join('');
function variantFor(p,id){return p.variants.find(v=>String(v.id)===String(id))||p.variants.find(v=>v.available)||p.variants[0]}
function openProduct(id){const p=catalog.find(x=>x.id===id);if(!p)return;current=p;currentVariant=variantFor(p);qty=1;$('#productContent').innerHTML=`<div class="product-detail"><div class="detail-images"><img id="detailImage" class="main-photo" src="${esc(p.images[0])}" alt="${esc(p.name)}"><div class="thumbs">${p.images.map((im,i)=>`<button data-photo="${i}" aria-label="Ver foto ${i+1}"><img src="${esc(im)}" alt="Foto ${i+1}" loading="lazy"></button>`).join('')}</div></div><div class="detail-info"><span class="eyebrow">${esc(p.brand)} · ${esc(p.category)}</span><h2>${esc(p.name)}</h2><div class="product-price" id="detailPrice">${money(currentVariant.price)}</div><p class="detail-note">${p.available?'Disponível na consulta ao catálogo.':'Esgotado na consulta ao catálogo.'} · Valores de referência.</p>${p.variants.length>1?`<label>Opção<select id="variant">${p.variants.map(v=>`<option value="${v.id}" ${v.id===currentVariant.id?'selected':''}>${esc(v.label)}${v.available?'':' · esgotado'}</option>`).join('')}</select></label>`:''}<div class="quantity"><button id="qtyDown" aria-label="Diminuir quantidade">−</button><output id="detailQty">1</output><button id="qtyUp" aria-label="Aumentar quantidade">+</button></div><button class="button" id="addDetail" ${currentVariant.available?'':'disabled'}>${currentVariant.available?'Adicionar à sacola de teste':'Produto esgotado'}</button><a class="button outline product-whatsapp" href="${esc(whatsappUrl('Olá! Vim pelo site da Kaia Glow e gostaria de saber mais sobre o produto: '+p.name+'.\n'+p.url))}" target="_blank" rel="noopener noreferrer">Tirar dúvida no WhatsApp ↗</a><p class="detail-note">A sacola é demonstrativa. Pelo WhatsApp, você fala diretamente com a Kaia Glow.</p><div class="description">${esc(p.description||'Confira as informações deste produto no catálogo original da Kaia Glow. As informações completas serão revisadas para a versão final.')}</div><p class="detail-note">Informações e fotos reproduzidas do catálogo público. Siga as instruções da embalagem.</p></div></div>`;all('[data-photo]').forEach(b=>b.onclick=()=>{$('#detailImage').src=p.images[+b.dataset.photo]});$('#qtyDown').onclick=()=>{$('#detailQty').textContent=qty=Math.max(1,qty-1)};$('#qtyUp').onclick=()=>{$('#detailQty').textContent=qty=Math.min(10,qty+1)};$('#addDetail').onclick=()=>addCart(p.id,currentVariant.id,qty);if($('#variant'))$('#variant').onchange=e=>{currentVariant=variantFor(p,e.target.value);$('#detailPrice').textContent=money(currentVariant.price);$('#addDetail').disabled=!currentVariant.available;$('#addDetail').textContent=currentVariant.available?'Adicionar à sacola de teste':'Produto esgotado'};if(!$('#productDialog').open)$('#productDialog').showModal();$('#productDialog').scrollTop=0;history.replaceState(null,'','#produto-'+id)}
function addCart(id,variantId,quantity=1){const p=catalog.find(x=>x.id===id),v=variantFor(p,variantId);if(!v.available)return;const key=id+'-'+v.id,row=cart.find(x=>x.key===key);if(row)row.qty=Math.min(10,row.qty+quantity);else cart.push({key,id,variantId:v.id,qty:Math.min(10,quantity)});counts();toast('Adicionado à sua sacola de teste.');if($('#bagDialog').open)renderBag()}
function renderBag(){counts();if(!cart.length){$('#bagContent').innerHTML='<div class="bag-body empty"><h2>Sua próxima descoberta<br>está te esperando.</h2><p>Explore a coleção e monte sua sacola de teste.</p><button class="button" id="backShopping">Continuar explorando ↗</button></div>';$('#backShopping').onclick=()=>$('#bagDialog').close();return}
const subtotal=cart.reduce((a,r)=>a+variantFor(catalog.find(p=>p.id===r.id),r.variantId).price*r.qty,0),benefit=coupon?calculateCoupon(coupon,couponItems()):null,discount=benefit?.valid?benefit.discount:0;
$('#bagContent').innerHTML=`<div class="bag-body">${cart.map(r=>{const p=catalog.find(p=>p.id===r.id),v=variantFor(p,r.variantId);return `<div class="bag-item"><img src="${esc(p.images[0])}" alt="${esc(p.name)}"><div><h3>${esc(p.name)}</h3>${p.variants.length>1?`<small>${esc(v.label)}</small>`:''}<small>${money(v.price)}</small><div class="quantity"><button data-step="-1" data-key="${r.key}" aria-label="Diminuir ${esc(p.name)}">−</button><output>${r.qty}</output><button data-step="1" data-key="${r.key}" aria-label="Aumentar ${esc(p.name)}">+</button></div><button class="remove" data-remove="${r.key}">Remover</button></div></div>`}).join('')}<form class="coupon" id="couponForm"><input id="couponCode" aria-label="Cupom de desconto" placeholder="Digite seu cupom" value="${esc(coupon)}"><button>Aplicar</button></form><p class="detail-note" id="couponNote">${coupon?esc(benefit.message):'Consulte os códigos na aba Cupons · benefícios demonstrativos.'}</p><div class="bag-total"><span>Subtotal</span><span>${money(subtotal)}</span></div>${discount>0?`<div class="bag-total"><span>Desconto simulado (${esc(coupon)})</span><span>− ${money(discount)}</span></div>`:''}${benefit?.valid&&benefit.gift?'<p class="coupon-gift-note">Mimo demonstrativo: benefício sinalizado para esta sacola. Brinde a definir.</p>':''}<div class="bag-total"><b>Total de referência</b><b>${money(subtotal-discount)}</b></div><p class="detail-note">Frete não incluído. Nenhum pagamento será solicitado nesta prévia.</p><button class="button" id="checkout">Experimentar finalização ↗</button><p class="detail-note">Sacola demonstrativa. Não reserva estoque e não envia pedidos.</p></div>`;
all('[data-step]').forEach(b=>b.onclick=()=>{const r=cart.find(x=>x.key===b.dataset.key);r.qty=Math.max(1,Math.min(10,r.qty+Number(b.dataset.step)));renderBag()});all('[data-remove]').forEach(b=>b.onclick=()=>{cart=cart.filter(r=>r.key!==b.dataset.remove);renderBag()});$('#couponForm').onsubmit=e=>{e.preventDefault();const code=$('#couponCode').value.trim().toUpperCase(),result=calculateCoupon(code,couponItems());coupon=result.valid?code:'';renderBag();$('#couponCode').value=code;$('#couponNote').textContent=result.message};$('#checkout').onclick=()=>info('checkout')}
$('#bagButton').onclick=()=>{renderBag();$('#bagDialog').showModal()};
function info(type){let html='';if(type==='checkout')html='<span class="eyebrow">VOCÊ CHEGOU AO FINAL DA PRÉVIA</span><h2>Uma compra simples.<br>Do começo ao fim.</h2><p>Na loja final, esta etapa terá endereço de entrega, cálculo de frete e pagamento integrado à plataforma escolhida.</p><p>Este teste termina aqui: nenhum pedido foi criado e não haverá cobrança. A área Minha conta permite acompanhar indicações e pedidos vinculados pela equipe.</p><button class="button" id="finishDemo">Concluir demonstração ✓</button>';
if(type==='demo')html='<span class="eyebrow">KAIA GLOW × NOVA BYTE</span><h2>Uma nova forma de<br>descobrir sua beleza.</h2><p>Conceito de redesign desenvolvido para apresentar uma nova experiência da Kaia Glow, com catálogo, filtros, favoritos, ficha de produto e sacola de teste.</p><p>Os 54 produtos foram consultados no site público em 01/11/2026. Esta prévia não está conectada ao estoque nem ao checkout da loja original.</p>';
if(type==='privacy')html='<h2>Privacidade desta prévia</h2><p>Os favoritos ficam salvos somente neste navegador. A sacola existe apenas durante a visita. A área Minha conta guarda nome, e-mail e registros de indicações e pedidos vinculados à sua conta. O acesso utiliza autenticação e sessão salvos no navegador. O código de um convite pode ser lembrado por até 30 dias para concluir a indicação. Não há rastreamento de marketing nem envio automático de pedidos. Para solicitar exclusão da conta, fale com a equipe pelo WhatsApp. Os links de WhatsApp abrem uma conversa externa com uma mensagem sugerida, que você pode revisar antes de enviar.</p><button class="button" id="clearData">Apagar favoritos deste navegador</button>';
if(type==='contact')html=`<span class="eyebrow">ATENDIMENTO KAIA GLOW</span><h2>Vamos conversar<br>sobre o seu cuidado?</h2><p>Fale com a equipe pelo WhatsApp para tirar dúvidas sobre os produtos e consultar disponibilidade.</p><a class="button" href="${esc(whatsappUrl('Olá! Vim pelo site da Kaia Glow e gostaria de saber mais sobre os produtos.'))}" target="_blank" rel="noopener noreferrer">Conversar no WhatsApp ↗</a><p class="detail-note">(11) 96567-7152 · A mensagem fica preenchida para você revisar e enviar.</p>`;
$('#infoContent').innerHTML=html;if(!$('#infoDialog').open)$('#infoDialog').showModal();if($('#finishDemo'))$('#finishDemo').onclick=()=>{$('#infoDialog').close();$('#bagDialog').close();toast('Demonstração concluída. Nenhuma compra foi realizada.')};if($('#clearData'))$('#clearData').onclick=()=>{favorites.clear();save('kaia-demo-favorites',[]);render();$('#infoDialog').close();toast('Favoritos apagados.')};}
all('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());all('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}));
$('#productDialog').addEventListener('close',()=>{if(location.hash.startsWith('#produto-'))history.replaceState(null,'',location.pathname+location.search+'#colecao')});
document.addEventListener('click',e=>{const c=e.target.closest('[data-cat]');if(c)setCategory(c.dataset.cat);const p=e.target.closest('[data-product]');if(p){e.preventDefault();openProduct(p.dataset.product)}const w=e.target.closest('[data-wish]');if(w){favorites.has(w.dataset.wish)?favorites.delete(w.dataset.wish):favorites.add(w.dataset.wish);save('kaia-demo-favorites',[...favorites]);if(favOnly)render();else counts()}const q=e.target.closest('[data-quick]');if(q){const product=catalog.find(p=>p.id===q.dataset.quick);if(product.variants.length>1)openProduct(product.id);else addCart(product.id)}const i=e.target.closest('[data-info]');if(i)info(i.dataset.info)});
render();const deepLink=location.hash.match(/^#produto-(\d+)$/);if(deepLink)openProduct(deepLink[1]);

// Editorial selection uses the same real catalog and shopping actions.
const desirePicks=[
 catalog.find(p=>p.available&&p.name.includes('PDRN Pink Collagen Gel Mask')),
 catalog.find(p=>p.available&&p.name.includes('Biodance Bio Collagen')),
 catalog.find(p=>p.available&&p.name.includes('Celimax Retinal Shot Tightening Booster')),
 catalog.find(p=>p.available&&p.brand==='SKIN1004')
].filter(Boolean);
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
kaiaMenuButton.addEventListener('click',()=>kaiaMenuDialog.showModal());
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
function renderCoupons(){const type=$('#couponType').value,today=couponToday();$('#couponGrid').innerHTML=KAIA_COUPONS.filter(c=>type==='all'||c.type===type).map(c=>{const expired=today>c.expires;return `<article class="coupon-ticket"><span class="coupon-ticket-tag">${c.type==='gift'?'MIMO':'10% OFF'} · SIMULAÇÃO</span><h3>${esc(c.title)}</h3><p class="coupon-expiry">${expired?'Expirado em':'Válido até'} ${c.expires.split('-').reverse().join('/')}</p><details class="coupon-conditions"><summary>Condições</summary><p>${esc(c.condition)} Válido até a data indicada, no horário de Mato Grosso. Benefício demonstrativo, sem validade comercial nesta página.</p></details><div class="coupon-ticket-bottom"><button class="coupon-products" data-coupon-products="${c.code}">Ver produtos ↗</button><button class="coupon-copy" data-copy-coupon="${c.code}" aria-label="Copiar cupom ${c.code}" ${expired?'disabled':''}><span>${c.code}</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M15 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1" stroke="currentColor" stroke-width="1.5"/></svg></button></div></article>`}).join('')}
all('[data-open-coupons]').forEach(button=>button.addEventListener('click',openCoupons));
$('#couponType').onchange=renderCoupons;
couponsDialog.addEventListener('click',async event=>{
 const copy=event.target.closest('[data-copy-coupon]');if(copy){const code=copy.dataset.copyCoupon;let copied=false;try{await navigator.clipboard.writeText(code);copied=true}catch{const input=document.createElement('textarea');input.value=code;input.setAttribute('readonly','');input.style.cssText='position:fixed;left:0;top:0;opacity:0;pointer-events:none';couponsDialog.append(input);input.select();try{copied=document.execCommand('copy')}catch{}input.remove();copy.focus()}$('#couponCopyStatus').textContent=copied?'Cupom '+code+' copiado. Cole no campo de cupom da sacola de teste.':'Código '+code+': selecione o texto do botão para copiar ou digite na sacola.';if(copied){copy.querySelector('span').textContent='Copiado ✓';copy.setAttribute('aria-label','Cupom '+code+' copiado');setTimeout(()=>{if(copy.isConnected){copy.querySelector('span').textContent=code;copy.setAttribute('aria-label','Copiar cupom '+code)}},2200)}return}
 const products=event.target.closest('[data-coupon-products]');if(products){const c=KAIA_COUPONS.find(c=>c.code===products.dataset.couponProducts);couponsDialog.close();setCategory(c.category||'Todos');if(!catalog.some(p=>p.category===c.category)&&c.category)toast('Esta categoria ainda não tem produtos na prévia.')}
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
