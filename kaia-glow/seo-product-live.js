// Keep static product landing pages consistent with edits made in the Kaia admin.
// Static HTML remains readable by crawlers; published admin overrides enhance the visitor view.
import {KAIA_AUTH} from '/auth-config.js';
const article=document.querySelector('article.product-detail[data-product-key]');
if(article){
 const key=article.dataset.productKey;
 const params=new URLSearchParams({select:'product_key,name,description,images,visible,archived',product_key:'eq.'+key});
 const req=KAIA_AUTH.url+'/rest/v1/kaia_catalog_overrides?'+params;
 try{
  const response=await fetch(req,{headers:{apikey:KAIA_AUTH.publishableKey,Authorization:'Bearer '+KAIA_AUTH.publishableKey,Accept:'application/json'},cache:'no-store'});
  if(response.ok){
   const data=await response.json(),updated=data?.[0];
   if(updated){
    if(updated.visible===false||updated.archived===true){
     const archived=updated.archived===true;
     if(archived){
      const replacement=document.createElement('section');
      replacement.className='content archived-product-message';
      const h1=document.createElement('h1');h1.textContent='Produto retirado da loja';
      const explanation=document.createElement('p');
      explanation.textContent='Este produto não faz mais parte do catálogo disponível. Conheça os outros cuidados da Kaia Glow.';
      const link=document.createElement('a');link.className='button';link.href='/';
      link.textContent='Conhecer outros produtos';
      replacement.append(h1,explanation,link);
      const related=article.nextElementSibling;
      article.replaceWith(replacement);
      if(related?.matches('section.content'))related.remove();
      document.querySelectorAll('script[type="application/ld+json"]').forEach(node=>node.remove());
      document.title='Produto retirado da loja | Kaia Glow';
     }else{
      const notice=document.createElement('p');notice.className='callout';
      notice.textContent='Este produto não está disponível na vitrine no momento. Consulte outras opções da Kaia Glow.';
      article.querySelector('.details')?.append(notice);
     }
     const meta=document.querySelector('meta[name=robots]');if(meta)meta.content='noindex,follow';
    }else{
     const title=updated.name?.trim(),description=updated.description?.trim();
     if(title){
      const h1=article.querySelector('h1');if(h1)h1.textContent=title;
      document.title=title+' | Kaia Glow';
      const og=document.querySelector('meta[property="og:title"]');if(og)og.content=document.title;
     }
     if(description){
      const p=article.querySelector('.details .intro');if(p)p.textContent=description.slice(0,240);
      const body=article.nextElementSibling?.querySelector('p');if(body)body.textContent=description;
      const desc=document.querySelector('meta[name=description]');if(desc)desc.content=description.slice(0,155);
     }
     let imageUrl=null;
     if(Array.isArray(updated.images)&&updated.images.length){
      const src=String(updated.images[0]);
      if(/^assets\/catalog\/[A-Za-z0-9_-]+\.(webp|jpg|jpeg|png|avif)$/.test(src))imageUrl='/'+src;
      if(/^https:\/\/vajlhodqxskozuxxlujv\.supabase\.co\/storage\/v1\/object\/public\/kaia-product-media\/products\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(src))imageUrl=src;
      if(imageUrl){
       const old=article.querySelector('.visual img');
       if(old){old.src=imageUrl;old.alt=title||old.alt;}
       else{
        const visual=article.querySelector('.visual');if(visual){visual.replaceChildren();const img=document.createElement('img');img.src=imageUrl;img.alt=title||'Foto atualizada do produto';visual.append(img);}
       }
       const ogImage=document.querySelector('meta[property="og:image"]');if(ogImage)ogImage.content=new URL(imageUrl,location.origin).href;
      }
     }
     const dataScript=document.querySelector('script[type="application/ld+json"]');
     if(dataScript){try{
      const schemas=JSON.parse(dataScript.textContent);
      const product=Array.isArray(schemas)?schemas.find(x=>x['@type']==='Product'):null;
      if(product){
       if(title)product.name=title;if(description)product.description=description.slice(0,1200);
       if(imageUrl)product.image=[new URL(imageUrl,location.origin).href];
       const crumb=schemas.find(x=>x['@type']==='BreadcrumbList');
       if(crumb&&title)crumb.itemListElement.at(-1).name=title;
       dataScript.textContent=JSON.stringify(schemas).replace(/</g,'\\u003c');
      }
     }catch{}}
    }
   }
  }
 }catch{}
}
