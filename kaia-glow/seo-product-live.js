/* Product and collection pages use the same public catalogue as the storefront.
   Transactional prices, eligibility and payment stay on the existing server. */
await Promise.resolve(window.kaiaCatalogReady);
const presentation=window.KaiaCatalogPresentation;
const products=window.KAIA_CATALOG||[];
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let eligible=null;
try{
 const response=await fetch('/api/kaia/comercial/catalogo',{cache:'no-store',signal:AbortSignal.timeout(8000)});
 if(response.ok)eligible=new Map(((await response.json()).products||[]).map(p=>[p.sku,p.priceCents]));
}catch{}
const canBuy=p=>eligible instanceof Map&&p.sku&&p.available&&eligible.get(p.sku)===Math.round(p.price*100);
const imageUrl=p=>{
 const src=p.images?.find(s=>!s.includes('photo-pending'));
 if(!src)return null;
 const url=new URL(src,location.origin);
 return url.protocol==='https:'||url.origin===location.origin?url.href:null;
};
for(const card of document.querySelectorAll('article.item[data-product-id]')){
 const p=products.find(p=>String(p.id)===card.dataset.productId);
 if(!p){card.hidden=true;continue;}
 const h3=card.querySelector('h3');if(h3)h3.textContent=p.name;
 const brand=card.querySelector('.brand-name');if(brand)brand.textContent=p.brand;
 const price=card.querySelector('.landing-price');if(price)price.textContent=money(p.price);
 const stock=card.querySelector('.landing-stock');if(stock)stock.textContent=canBuy(p)?'Pronta entrega':eligible instanceof Map?'Sob encomenda':'Confira disponibilidade na loja';
 const photo=imageUrl(p);
 if(photo){const img=document.createElement('img');img.src=photo;img.alt=p.name;img.loading='lazy';card.querySelector('img,.photo-none')?.replaceWith(img);}
}
const article=document.querySelector('article.product-detail[data-product-id]');
if(article){
 const product=products.find(p=>String(p.id)===article.dataset.productId);
 const buy=document.getElementById('landingBuy'),notice=document.getElementById('landingAvailability');
 if(!product){
  document.title='Produto indisponível | Kaia Glow';
  document.querySelector('meta[name=robots]')?.setAttribute('content','noindex,follow');
  article.replaceChildren();
  const title=document.createElement('h1');title.textContent='Este produto não está disponível na vitrine.';
  const link=document.createElement('a');link.className='button';link.href='/';link.textContent='Conhecer outros produtos';article.append(title,link);
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s=>s.remove());
 }else{
  presentation.normalize(product);
  article.querySelector('h1').textContent=product.name;document.title=product.name+' | Kaia Glow';
  article.querySelector('.details .intro').textContent=presentation.brief(product);
  document.getElementById('landingPrice').textContent=money(product.price);
  const description=article.nextElementSibling?.querySelector('p');if(description)description.textContent=product.description;
  article.querySelector('.eyebrow').textContent=product.brand+' · '+product.category;
  const photo=imageUrl(product);
  if(photo){const img=document.createElement('img');img.src=photo;img.alt=product.name;img.fetchPriority='high';article.querySelector('.visual').replaceChildren(img);}
  const available=canBuy(product);
  buy.textContent=available?'Adicionar à sacola':eligible instanceof Map?'Solicitar encomenda':'Ver opções na loja';
  const destination=new URL('/',location.origin);destination.hash='produto-'+product.id;
  if(available)destination.searchParams.set('adicionar',product.id);
  buy.href=destination.pathname+destination.search+destination.hash;
  notice.textContent=available?'Pronta entrega. Consulte o frete pelo CEP na sacola. O pagamento é processado pelo Mercado Pago.':eligible instanceof Map?'Sob encomenda, sem pagamento antecipado. Previsão de disponibilização em até 7 dias corridos, sujeita à confirmação da loja. O transporte será combinado separadamente.':'Consulte a disponibilidade na loja. Confira o endereço, o frete e o total antes de pagar.';
  for(const [selector,value] of [['meta[name=description]',product.description.slice(0,155)],['meta[property="og:title"]',document.title],['meta[property="og:description"]',product.description.slice(0,155)]])document.querySelector(selector)?.setAttribute('content',value);
  if(photo)document.querySelector('meta[property="og:image"]')?.setAttribute('content',photo);
  for(const script of document.querySelectorAll('script[type="application/ld+json"]')){
   try{
    const schemas=JSON.parse(script.textContent);
    for(const schema of Array.isArray(schemas)?schemas:[schemas]){
     if(schema['@type']==='Product'){
      schema.name=product.name;schema.description=product.description;schema.brand={"@type":"Brand",name:product.brand};
      if(photo)schema.image=[photo];
      // Offer schema is published only after the commerce endpoint confirms the price.
      if(available)schema.offers={"@type":"Offer",url:location.href,priceCurrency:'BRL',price:product.price.toFixed(2),availability:'https://schema.org/InStock'};
      else delete schema.offers;
     }
     if(schema['@type']==='BreadcrumbList')schema.itemListElement.at(-1).name=product.name;
    }
    script.textContent=JSON.stringify(schemas).replace(/</g,'\\u003c');
   }catch{}
  }
 }
}
