// Read-only, authenticated payment readiness for the Kaia Glow control panel.
// This endpoint does not initiate payments, reveal secrets or update orders.
import {buyerAdmin,db,response,fail,HOSTS} from './checkout-validacao/_core.js';

export async function onRequestGet({request,env}){
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:'||!HOSTS.includes(url.hostname))
   return response({code:'AMBIENTE_INVALIDO'},403);
  await buyerAdmin(request,env);
  const secrets={
   productionAccess:!!env.KAIA_MP_PROD_ACCESS_TOKEN,
   webhookSignature:!!env.KAIA_MP_PROD_WEBHOOK_SECRET,
   secureDatabase:!!env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY
  };
  const shippingReady=env.KAIA_SHIPPING_PROVIDER==='superfrete'&&
   env.KAIA_SF_MODE==='production'&&!!env.KAIA_SF_ACCESS_TOKEN&&
   /^\d{8}$/.test(String(env.KAIA_SHIP_FROM_CEP||''))&&
   !!env.KAIA_SHIPPING_TECH_CONTACT;
  if(!secrets.secureDatabase) return response({
   configuration:secrets,shippingReady,checkedAt:new Date().toISOString(),
   pilotPaymentApproved:null,storePaidOrderApproved:null,freeOrderApproved:null,
   releasedProducts:null,checkoutEligibleProducts:null,
   checkoutConfigured:false,detail:'BANCO_NAO_CONFIGURADO'
  });
  const [pilot,paid,free,launch,inventory]=await Promise.all([
   db(env,'kaia_mp_live_pilot_orders?select=status,paid_amount_cents&limit=1'),
   db(env,'kaia_commercial_payments?status=eq.approved&total_cents=gt.0&select=id&limit=1'),
   db(env,'kaia_commercial_payments?status=eq.approved&total_cents=eq.0&select=id&limit=1'),
   db(env,'kaia_sales_launch_cohort?select=sku,is_enabled'),
   db(env,'kaia_sale_inventory?select=sku,sale_price_cents,available_units,price_verified_at,stock_verified_at,package_verified_at,weight_grams,length_cm,width_cm,height_cm')
  ]);
  const released=new Set(launch.filter(x=>x.is_enabled===true).map(x=>x.sku));
  const eligible=inventory.filter(p=>released.has(p.sku)&&
   Number.isSafeInteger(p.sale_price_cents)&&p.sale_price_cents>0&&
   p.price_verified_at&&p.stock_verified_at&&p.package_verified_at&&
   p.available_units>0&&
   ['weight_grams','length_cm','width_cm','height_cm'].every(k=>Number(p[k])>0)).length;
  const checkoutConfigured=secrets.productionAccess&&secrets.webhookSignature&&
   secrets.secureDatabase&&shippingReady;
  return response({
   configuration:secrets,shippingReady,checkoutConfigured,
   pilotPaymentApproved:pilot.some(o=>o.status==='approved'&&Number(o.paid_amount_cents)>=500),
   storePaidOrderApproved:paid.length>0,
   freeOrderApproved:free.length>0,
   releasedProducts:released.size,checkoutEligibleProducts:eligible,
   checkedAt:new Date().toISOString(),
   note:'Indicadores do banco e configurações do servidor. Não representa teste financeiro em tempo real no Mercado Pago.'
  });
 }catch(e){return fail(e);}
}
