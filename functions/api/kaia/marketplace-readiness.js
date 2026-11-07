// Kaia Glow: read-only integration readiness. Administrator access required.
// OAuth secrets, shop tokens and partner keys are NEVER returned to browsers.
import {buyerAdmin,db,response,fail} from './checkout-validacao/_core.js';

export async function onRequestGet({request,env}){
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:'||!['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(url.hostname))
   return response({code:'AMBIENTE_INVALIDO'},403);
  await buyerAdmin(request,env);
  const [connections,links,wave,inventory]=await Promise.all([
   db(env,'kaia_marketplace_connections?select=channel,status,external_shop_id,last_synced_at,last_error'),
   db(env,'kaia_marketplace_links?select=channel,sku,status'),
   db(env,'kaia_sales_launch_cohort?select=sku,is_enabled'),
   db(env,'kaia_sale_inventory?select=sku,available_units')
  ]);
  const enabled=new Set(wave.filter(x=>x.is_enabled===true).map(x=>x.sku));
  const ids=['shopee','tiktok'];
  const channels=ids.map(id=>{
   const connection=connections.find(c=>c.channel===id)||{status:'disconnected'};
   const credentials=id==='shopee'
    ?!!env.KAIA_SHOPEE_PARTNER_ID&&!!env.KAIA_SHOPEE_PARTNER_KEY
    :!!env.KAIA_TIKTOK_APP_KEY&&!!env.KAIA_TIKTOK_APP_SECRET;
   const total=links.filter(l=>l.channel===id).length;
   const verified=links.filter(l=>l.channel===id&&l.status==='verified').length;
   return {
    id,status:connection.status,
    authorized:connection.status==='connected'&&!!connection.external_shop_id,
    appCredentialsConfigured:credentials,
    mappedSkuCount:total,verifiedSkuCount:verified,
    lastSyncedAt:connection.last_synced_at,
    // No live connector dispatch is installed or enabled at this stage.
    automaticSyncEnabled:false
   };
  });
  return response({
   skuCount:inventory.length,
   activeSiteSkuCount:enabled.size,
   firstWaveSkus:[...enabled].sort(),
   activeSiteStockUnits:inventory.filter(i=>enabled.has(i.sku)).reduce((sum,i)=>sum+Math.max(0,Number(i.available_units)||0),0),
   channels,
   integrationMode:'preparation_only',
   guidance:'Conectar e autorizar cada loja, validar IDs externos, homologar pedidos e somente depois ativar sincronizacao.'
  });
 }catch(e){return fail(e);}
}
