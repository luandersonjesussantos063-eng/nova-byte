// Admin-only read-only launch readiness. Pricing decisions are NEVER inferred from catalog snapshots.
import {buyerAdmin,db,response,fail} from './checkout-validacao/_core.js';
export async function onRequestGet({request,env}){
 try {
  if(new URL(request.url).protocol!=='https:')return response({code:'HTTPS_OBRIGATORIO'},403);
  await buyerAdmin(request,env);
  if(!env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY)return response({code:'BANCO_INDISPONIVEL'},503);
  const rows=await db(env,'kaia_sale_inventory?select=sku,display_name,sale_price_cents,available_units,weight_grams,length_cm,width_cm,height_cm,price_verified_at,stock_verified_at,package_verified_at&order=display_name.asc');
  const wave=await db(env,'kaia_sales_launch_cohort?select=sku,is_enabled');
  const selected=new Map(wave.map(r=>[r.sku,!!r.is_enabled]));
  const products=rows.map(r=>{
    const priceReady=Number.isInteger(r.sale_price_cents)&&r.sale_price_cents>0&&!!r.price_verified_at;
    const stockReady=Number.isInteger(r.available_units)&&r.available_units>0&&!!r.stock_verified_at;
    const packageReady=!!r.package_verified_at&&['weight_grams','length_cm','width_cm','height_cm'].every(k=>Number(r[k])>0);
    return {sku:r.sku,name:r.display_name,priceCents:r.sale_price_cents,stock:r.available_units,
      priceReady,stockReady,packageReady,inFirstWave:selected.has(r.sku),checkoutEnabled:selected.get(r.sku)===true,ready:selected.has(r.sku)&&priceReady&&stockReady&&packageReady};
  });
  const count=k=>products.filter(p=>p[k]).length;
  return response({total:products.length,firstWave:count('inFirstWave'),firstWaveReady:count('ready'),firstWaveEnabled:count('checkoutEnabled'),ready:count('ready'),priceReady:count('priceReady'),
   stockReady:count('stockReady'),packageReady:count('packageReady'),products});
 }catch(e){return fail(e);}
}
