// Kaia Glow / Olist ERP v3: READ-ONLY inventory reconciliation.
// This endpoint makes no inventory, payment, order or marketplace writes.
// The Olist ERP is the stock source; displayed store prices are untouched.
import {buyerAdmin,db,PaymentError} from '../checkout-validacao/_core.js';
import {guardOrigin,validAccessToken,API_URL,noStoreJson,errorJson} from './_oauth.js';

const PAGE_SIZE=100,MAX_PAGES=8,MAX_ITEMS=800;
const isUnits=n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=1000000;
function safeCounter(n){return isUnits(n)?n:null;}

async function readOlistStockPage(token,offset){
 const u=new URL(API_URL+'/estoque');
 u.searchParams.set('limit',String(PAGE_SIZE));
 u.searchParams.set('offset',String(offset));
 let r;
 try{
  r=await fetch(u.href,{
   method:'GET',
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(12500)
  });
 }catch(e){
  throw new PaymentError(e?.name==='TimeoutError'||e?.name==='AbortError'?
   'OLIST_ESTOQUE_TIMEOUT':'OLIST_ESTOQUE_FALHA_REDE',502);
 }
 if(r.status>=300&&r.status<400)throw new PaymentError('OLIST_ESTOQUE_REDIRECIONADO',502);
 if(r.status===401||r.status===403)throw new PaymentError('OLIST_ESTOQUE_SEM_PERMISSAO',403);
 if(r.status===429)throw new PaymentError('OLIST_ESTOQUE_LIMITE_DE_CHAMADAS',429);
 if(!r.ok)throw new PaymentError('OLIST_ESTOQUE_API_INDISPONIVEL',502);
 let payload;
 try{payload=await r.json();}catch{throw new PaymentError('OLIST_ESTOQUE_JSON_INVALIDO',502);}
 if(!payload||!Array.isArray(payload.itens)||payload.itens.length>PAGE_SIZE)
  throw new PaymentError('OLIST_ESTOQUE_RESPOSTA_INVALIDA',502);
 return payload;
}
export async function readFullStock(token){
 const items=[];
 let finished=false;
 let sourceTotal=null;
 for(let n=0;n<MAX_PAGES;n++){
  const payload=await readOlistStockPage(token,n*PAGE_SIZE);
  const page=payload.itens;
  items.push(...page);
  if(items.length>MAX_ITEMS)throw new PaymentError('OLIST_ESTOQUE_LISTA_EXTENSA',409);
  const count=Number(payload.paginacao?.total);
  if(Number.isSafeInteger(count)&&count>=0&&count<=10000000){
   if(sourceTotal!==null&&sourceTotal!==count)
    throw new PaymentError('OLIST_ESTOQUE_ALTERADO_DURANTE_CONSULTA',409);
   sourceTotal=count;
  }
  if(sourceTotal!==null&&items.length>=sourceTotal){finished=true;break;}
  if(page.length<PAGE_SIZE){finished=true;break;}
 }
 if(!finished)throw new PaymentError('OLIST_ESTOQUE_PAGINACAO_INCOMPLETA',409);
 // A changing page count may hide SKUs: do not return a "safe" preview.
 if(sourceTotal!==null&&items.length!==sourceTotal)
  throw new PaymentError('OLIST_ESTOQUE_PAGINACAO_DIVERGENTE',409);
 return {items,total:sourceTotal??items.length};
}

export async function onRequestPost({request,env}){
 try{
  guardOrigin(request);
  const origin=request.headers.get('origin');
  if(origin!=='https://usekaiaglow.com.br'&&origin!=='https://www.usekaiaglow.com.br')
   throw new PaymentError('ORIGEM_INVALIDA',403);
  await buyerAdmin(request,env);
  const token=await validAccessToken(env);
  // No PII: read SKU and pending item quantities only.
  const [stock,openPayments]=await Promise.all([
   db(env,'rpc/kaia_olist_auto_stock_skus','POST',{}),
   db(env,'kaia_commercial_payments?select=status,items&status=in.(created,pending,review_required)&limit=1000')
  ]);
  if(!Array.isArray(stock)||stock.length<30||stock.length>=1000)
   throw new PaymentError('CATALOGO_LOCAL_INESPERADO',409);
  if(!Array.isArray(openPayments)||openPayments.length>=1000)
   throw new PaymentError('RESERVAS_NAO_CONFERIDAS',409);
  const pending=new Map();
  for(const p of openPayments){
   if(!Array.isArray(p.items))throw new PaymentError('RESERVA_INVALIDA',409);
   for(const line of p.items){
    if(typeof line.sku!=='string'||!isUnits(line.quantity))
     throw new PaymentError('RESERVA_INVALIDA',409);
    pending.set(line.sku,(pending.get(line.sku)||0)+line.quantity);
   }
  }
  const {items:remoteItems,total}=await readFullStock(token);
  const inventory=new Map();
  const siteSkus=new Set(stock.map(x=>x.sku));
  for(const r of remoteItems){
   if(typeof r.sku!=='string'||!siteSkus.has(r.sku))continue;
   if(!inventory.has(r.sku))inventory.set(r.sku,[]);
   inventory.get(r.sku).push(r);
  }
  let changed=0,missing=0,ambiguous=0,invalid=0,matched=0;
  const rows=stock.map(x=>{
   if(typeof x.sku!=='string'||!isUnits(x.available_units))
    throw new PaymentError('CATALOGO_LOCAL_INVALIDO',409);
   const local=x.available_units;
   const records=inventory.get(x.sku)||[];
   const reservation=pending.get(x.sku)||0;
   if(records.length===0){missing++;return {sku:x.sku,local,reservation,state:'missing'};}
   if(records.length!==1){ambiguous++;return {sku:x.sku,local,reservation,state:'duplicate'};}
   const r=records[0];
   const available=safeCounter(r.disponivel);
   const physical=safeCounter(r.saldo);
   const held=safeCounter(r.reservado);
   if(available===null){invalid++;return {sku:x.sku,local,reservation,state:'invalid'};}
   // Reservation for the site's pending Mercado Pago order has not yet been
   // entered in Olist. This is a provisional comparison, never a stock write.
   const suggested=Math.max(0,available-reservation);
   matched++;if(suggested!==local)changed++;
   return {sku:x.sku,local,olistAvailable:available,
    olistPhysical:physical,olistReserved:held,reservation,
    suggested,delta:suggested-local,state:suggested===local?'equal':'different'};
  });
  // Persist readiness metadata, never stock, after a complete verified pull.
  const complete=missing===0&&ambiguous===0&&invalid===0&&matched===stock.length;
  let verifiedForAutomatic=false;
  if(complete){
   try{
    await db(env,'rpc/kaia_olist_record_valid_preview','POST',{
     p_site_rows:stock.length,p_source_rows:total
    });
    verifiedForAutomatic=true;
   }catch{/* Activation remains blocked if the validation cannot be recorded. */}
  }
  return noStoreJson({
   mode:'preview_only',autoSync:false,pricesUntouched:true,
   verifiedForAutomatic,
   source:'olist_erp_v3',stockBasis:'disponivel',
   checkedAt:new Date().toISOString(),
   olistInventoryRows:total,siteSkuCount:stock.length,
   summary:{matched,different:changed,missing,duplicate:ambiguous,
    invalid,reservedSiteUnits:Array.from(pending.values()).reduce((a,b)=>a+b,0)},
   safeForAutomaticApplication:false,
   notice:'A comparação não altera estoque. A ativação depende de confirmar que o TikTok Shop já importa pedidos e aplica o saldo na Olist. O sincronismo da Kaia será somente de reduções.',
   rows
  });
 }catch(e){return errorJson(e);}
}
