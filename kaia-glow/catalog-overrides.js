// Public storefront only. Uses the existing Supabase ANON key, never a privileged key.
(function(){
 const projectUrl="https://vajlhodqxskozuxxlujv.supabase.co",publicKey="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhamxob2RxeHNrb3p1eHhsdWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDQ0ODIsImV4cCI6MjEwNTQ4MDQ4Mn0.2HfSpUNZZZAJ8xQWK6yuwAkxNa_-dtuFTfkYJzSPybk";
 const get=async table=>{
  const response=await fetch(projectUrl+'/rest/v1/'+table+'?select=*',{headers:{apikey:publicKey,Authorization:'Bearer '+publicKey,Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw Error('Não foi possível sincronizar '+table);
  return response.json();
 };
 window.KAIA_PUBLIC_API={projectUrl,publicKey};
 window.KAIA_ACTIVE_COUPONS=[];
 window.kaiaCatalogReady=(async()=>{
  const controller=new AbortController();
  let timer;
  try{
   const fetchWithTimeout=(table)=>fetch(projectUrl+'/rest/v1/'+table+'?select=*',{headers:{
     apikey:publicKey,Authorization:'Bearer '+publicKey,Accept:'application/json'
    },cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Sync failed');return r.json();});
   timer=setTimeout(()=>controller.abort(),6000);
   const results=await Promise.allSettled([
    fetchWithTimeout('kaia_catalog_overrides'),
    fetchWithTimeout('kaia_admin_coupons'),
    fetchWithTimeout('kaia_new_products')
   ]);
   const list=window.KAIA_CATALOG||[];
   const rows=results[0].status==='fulfilled'?(results[0].value||[]):[];
   const byKey=new Map(rows.map(r=>[r.product_key,r]));
   // SEO navigation is generated from the original legacy catalogue at build time.
   // Remove links to archived entries when live catalogue data is loaded.
   if(results[0].status==='fulfilled'){
    const archivedLegacy=new Set(rows.filter(r=>r.archived===true&&
     /^legacy:[0-9]{1,15}$/.test(r.product_key||''))
     .map(r=>r.product_key.slice(7)));
    if(archivedLegacy.size){
     document.querySelectorAll('.kaia-seo-product-links a[href]').forEach(link=>{
      const path=new URL(link.href,location.origin).pathname;
      const id=/\/produtos\/[^/]+-([0-9]{1,15})\/?$/.exec(path)?.[1];
      if(id&&archivedLegacy.has(id))link.remove();
     });
    }
   }
   if(results[0].status==='fulfilled'){
    for(let i=list.length-1;i>=0;i--){
     const product=list[i],row=byKey.get(product.sku||'legacy:'+product.id);
     if(!row)continue;
     if(!row.visible){list.splice(i,1);continue;}
     product.name=row.name;product.description=row.description;
     product.brand=row.brand||product.brand;product.category=row.category||product.category;
     product.price=row.price_cents/100;product.oldPrice=row.old_price_cents/100;
     if(Array.isArray(row.images)&&row.images.length)product.images=row.images;
     product.available=!!row.available;
     if(Array.isArray(product.variants))for(const variant of product.variants){
      variant.price=product.price;variant.available=product.available;
     }
    }
   }
   if(results[2].status==='fulfilled'){
    const newProducts=results[2].value||[];
    for(const p of newProducts){
     const edit=byKey.get(p.sku);
     if(!edit||!edit.visible||list.some(original=>original.sku===p.sku))continue;
     const price=Number(edit.price_cents)/100;
     if(!Number.isFinite(price)||price<=0)continue;
     const variant={id:Number(p.id),label:'Única',price,available:!!edit.available,sku:p.sku};
     list.push({id:String(p.id),sku:p.sku,brand:edit.brand||p.brand,category:edit.category||p.category,
      name:edit.name,description:edit.description,price,oldPrice:Number(edit.old_price_cents||0)/100,
      images:edit.images?.length?edit.images:['assets/kaia-product-photo-pending.svg'],
      available:!!edit.available,
      variants:[variant],url:'https://usekaiaglow.com.br/produtos/novo/'+p.id,isNew:true
     });
    }
   }
   if(results[1].status==='fulfilled')window.KAIA_ACTIVE_COUPONS=(results[1].value||[]).filter(c=>c.active);
   // Central inventory is the single authority for the available/unavailable flag.
   // This exposes only a boolean to the public storefront, never private quantities.
   const availableSkus=[...new Set(list.map(p=>p.sku).filter(Boolean))];
   if(availableSkus.length){
    try{
     const availability=await fetch(projectUrl+'/rest/v1/rpc/kaia_public_product_availability',{
      method:'POST',headers:{apikey:publicKey,Authorization:'Bearer '+publicKey,
       'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({p_skus:availableSkus}),cache:'no-store',signal:controller.signal
     });
     if(availability.ok){
      const current=new Map((await availability.json()).map(r=>[r.sku,!!r.available]));
      for(const p of list){
       if(p.sku&&current.has(p.sku)){
        p.available=current.get(p.sku);
        if(Array.isArray(p.variants))for(const v of p.variants)v.available=p.available;
       }
      }
     }
    }catch{ /* Never claim stock is synchronized if the source is unreachable. */ }
   }
  }catch(e){console.warn('Kaia: não foi possível atualizar catálogo ao vivo.',e?.name);}
  finally{clearTimeout(timer);}
 })();
})();
