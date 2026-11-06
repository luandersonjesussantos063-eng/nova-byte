import {gate,database,json,fail} from './_core.js';
export async function onRequestGet({request,env}){
 try{
  gate(request,env);
  const rows=await database(env,'kaia_sales_launch_cohort?select=sku,is_enabled');
  const wave=rows.filter(r=>r.is_enabled===true);
  if(!wave.length)return json({enabled:false,products:[]});
  const inventory=await database(env,'kaia_sale_inventory?select=sku,sale_price_cents,available_units,price_verified_at,stock_verified_at,package_verified_at,weight_grams,length_cm,width_cm,height_cm');
  const allowed=new Set(wave.map(r=>r.sku));
  const products=inventory.filter(p=>allowed.has(p.sku)&&Number.isSafeInteger(p.sale_price_cents)&&p.sale_price_cents>0&&
  p.price_verified_at&&p.stock_verified_at&&p.package_verified_at&&p.available_units>0&&
  ['weight_grams','length_cm','width_cm','height_cm'].every(k=>Number(p[k])>0))
    .map(p=>({sku:p.sku,priceCents:p.sale_price_cents}));
  return json({enabled:products.length>0,products});
 }catch(e){return fail(e);}
}
