// Kaia Glow: one-way scheduled Olist -> site stock reconciliation.
// Only PostgreSQL cron may mint the single-use challenge. All 51 SKUs must match.
// Never touches price, order, coupons, Olist records or shipping settings.
// IMPORTANT: Outbound site order transmission to Olist is NOT active yet.
import {db,PaymentError} from '../checkout-validacao/_core.js';
import {validAccessToken,API_URL,noStoreJson,errorJson} from './_oauth.js';
import {readFullStock} from './stock-preview.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isQuantity=v=>Number.isSafeInteger(v)&&v>=0&&v<=1000000;
export async function onRequestPost({request,env}){
 let authorized=false;
 try{
  const u=new URL(request.url);
  if(u.protocol!=='https:'||u.hostname!=='usekaiaglow.com.br'||
    u.pathname!=='/api/kaia/olist/auto-sync')throw new PaymentError('ORIGEM_INDEVIDA',403);
  const challenge=request.headers.get('x-kaia-sync-challenge')||'';
  if(!uuid.test(challenge))throw new PaymentError('DESAFIO_INVALIDO',403);
  const claimed=await db(env,'rpc/kaia_olist_claim_sync','POST',{p_nonce:challenge});
  if(claimed!==true)throw new PaymentError('DESAFIO_EXPIRADO',403);
  authorized=true;
  const control=await db(env,'kaia_olist_sync_control?slot=eq.1&select=enabled');
  if(!Array.isArray(control)||control.length!==1||control[0].enabled!==true)
   throw new PaymentError('SINCRONIZACAO_DESLIGADA',409);
  const token=await validAccessToken(env);
  const {items,total}=await readFullStock(token);
  const site=await db(env,'kaia_sale_inventory?select=sku&order=sku&limit=1000');
  if(!Array.isArray(site)||site.length!==51)throw new PaymentError('CATALOGO_INESPERADO',409);
  const skus=new Set(site.map(x=>x.sku)),counts=new Map();
  for(const it of items){
   if(typeof it?.sku!=='string'||!skus.has(it.sku))continue;
   if(counts.has(it.sku))throw new PaymentError('SKU_OLIST_DUPLICADO',409);
   if(!isQuantity(it.disponivel))throw new PaymentError('SALDO_OLIST_INVALIDO',409);
   counts.set(it.sku,it.disponivel);
  }
  if(counts.size!==51)throw new PaymentError('SKUS_OLIST_INCOMPLETOS',409);
  const rows=site.map(r=>({sku:r.sku,available:counts.get(r.sku)}));
  const result=await db(env,'rpc/kaia_olist_apply_snapshot','POST',{
   p_rows:rows,p_source_count:total
  });
  if(!result||result.ok!==true||result.checked!==51)
   throw new PaymentError('CONCILIACAO_NAO_CONFIRMADA',503);
  return noStoreJson({ok:true,changed:result.changed,checked:result.checked,autoSync:true});
 }catch(e){
  if(authorized){
   // A private, non-sensitive status code is recorded for administrators.
   try{await db(env,'kaia_olist_sync_control?slot=eq.1','PATCH',{
    last_run_at:new Date().toISOString(),last_error:e instanceof PaymentError?e.code:'OLIST_ERRO_INTERNO',
    updated_at:new Date().toISOString()
   });}catch{}
  }
  return errorJson(e);
 }
}
