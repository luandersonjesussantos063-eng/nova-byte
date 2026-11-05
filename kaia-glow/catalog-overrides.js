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
   if(results[0].status==='fulfilled'){
    const rows=results[0].value||[],byKey=new Map(rows.map(r=>[r.product_key,r]));
    const list=window.KAIA_CATALOG||[];
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
  }catch(e){console.warn('Kaia: não foi possível atualizar catálogo ao vivo.',e?.name);}
  finally{clearTimeout(timer);}
 })();
})();
