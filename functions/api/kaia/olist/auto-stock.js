// Signed five-minute scheduler -> Olist ERP -> Kaia inventory.
// ONLY downward reconciliation against Olist's absolute available balance.
// Never subtract TikTok orders individually, never change prices, never increase
// stock, and never act unless auto sync is explicitly enabled in Supabase.
import {db,PaymentError} from '../checkout-validacao/_core.js';
import {guardOrigin,validAccessToken,noStoreJson,errorJson} from './_oauth.js';
import {readFullStock} from './stock-preview.js';

const SCHEDULE_KEY_SHA256='675b3806647ad3c91cd34fd9462643df28faf1832af657cb1a9e707da8aa459a';
const asUnits=x=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0&&x<=100000;
async function authorize(request){
 const token=request.headers.get('X-Kaia-Cron-Key')||'';
 if(token.length!==64)
  throw new PaymentError('OLIST_AUTO_NAO_AUTORIZADO',401);
 const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const digest=Array.from(new Uint8Array(buf),x=>x.toString(16).padStart(2,'0')).join('');
 let diff=0;
 for(let i=0;i<digest.length;i++)diff|=digest.charCodeAt(i)^SCHEDULE_KEY_SHA256.charCodeAt(i);
 if(diff!==0)throw new PaymentError('OLIST_AUTO_NAO_AUTORIZADO',401);
}
export async function onRequestPost({request,env}){
 let enabled=false;
 try{
  guardOrigin(request);
  if(new URL(request.url).pathname!=='/api/kaia/olist/auto-stock')
   throw new PaymentError('OLIST_ROTA_INVALIDA',404);
  await authorize(request);
  const rows=await db(env,'kaia_olist_sync_control?slot=eq.1&select=enabled,interval_minutes');
  if(!Array.isArray(rows)||rows.length!==1)throw new PaymentError('OLIST_SYNC_SEM_CONFIGURACAO',503);
  enabled=rows[0].enabled===true;
  if(!enabled)return noStoreJson({ok:true,mode:'paused',changedSkus:0});
  const local=await db(env,'rpc/kaia_olist_auto_stock_skus','POST',{});
  if(!Array.isArray(local)||local.length<30||local.length>=1000)
   throw new PaymentError('OLIST_CATALOGO_LOCAL_INVALIDO',409);
  const bySku=new Map(local.map(x=>[x.sku,x]));
  if(bySku.size!==local.length)throw new PaymentError('OLIST_SKUS_DUPLICADOS',409);
  const token=await validAccessToken(env);
  const {items,total}=await readFullStock(token);
  const seen=new Map();
  for(const product of items){
   if(typeof product?.sku!=='string'||!bySku.has(product.sku))continue;
   if(seen.has(product.sku))throw new PaymentError('OLIST_SKU_DUPLICADO',409);
   if(!asUnits(product.disponivel))throw new PaymentError('OLIST_SALDO_NAO_VALIDO',409);
   seen.set(product.sku,product.disponivel);
  }
  if(seen.size!==local.length)throw new PaymentError('OLIST_SKUS_INCOMPLETOS',409);
  const snapshot=local.map(row=>({sku:row.sku,units:seen.get(row.sku)}));
  const result=await db(env,'rpc/kaia_olist_apply_live_stock','POST',{
   p_snapshot:snapshot,p_source_rows:total
  });
  return noStoreJson({ok:true,mode:'decrease_only',...result});
 }catch(e){
  if(enabled){
   const code=e instanceof PaymentError?e.code:'OLIST_AUTO_FALHA';
   try{await db(env,'rpc/kaia_olist_sync_record_error','POST',{p_code:code});}catch{}
  }
  return errorJson(e);
 }
}
