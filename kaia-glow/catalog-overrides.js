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
   const results=await Promise.allSettled([fetchWithTimeout('kaia_catalog_overrides'),fetchWithTimeout('kaia_admin_coupons')]);
   if(results[0].status==='fulfilled'){
    const rows=results[0].value||[],byKey=new Map(rows.map(r=>[r.product_key,r]));
    const list=window.KAIA_CATALOG||[];
    for(let i=list.length-1;i>=0;i--){
     const product=list[i],row=byKey.get(product.sku||'legacy:'+product.id);
     if(!row)continue;
     if(!row.visible){list.splice(i,1);continue;}
     product.name=row.name;product.description=row.description;
     product.price=row.price_cents/100;product.oldPrice=row.old_price_cents/100;
     if(Array.isArray(row.images)&&row.images.length)product.images=row.images;
     product.available=!!row.available;
     if(Array.isArray(product.variants))for(const variant of product.variants){
      variant.price=product.price;variant.available=product.available;
     }
    }
   }
   if(results[1].status==='fulfilled')window.KAIA_ACTIVE_COUPONS=(results[1].value||[]).filter(c=>c.active);
  }catch(e){console.warn('Kaia: não foi possível atualizar catálogo ao vivo.',e?.name);}
  finally{clearTimeout(timer);}
 })();
})();
