import {identity,database,json,fail,CheckoutError} from './comercial/_core.js';
const validSku=s=>typeof s==='string'&&/^KG-[A-Z0-9-]{4,90}$/.test(s);
const permitted=request=>['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(new URL(request.url).hostname);
async function summary(env,sku){
 const rows=await database(env,'rpc/kaia_verified_rating_summary',{method:'POST',body:{p_sku:sku}});
 const row=rows?.[0]||{};return {count:Number(row.review_count)||0,average:row.average_rating===null?null:Number(row.average_rating)};
}
export async function onRequestGet({request,env}){
 try{const sku=new URL(request.url).searchParams.get('sku');if(!permitted(request)||!validSku(sku))throw new CheckoutError('PRODUTO_INVALIDO',400);return json(await summary(env,sku));}catch(e){return fail(e);}
}
export async function onRequestPost({request,env}){
 try{
  if(!permitted(request)||request.headers.get('Origin')!==new URL(request.url).origin||!request.headers.get('content-type')?.startsWith('application/json'))throw new CheckoutError('ORIGEM_INVALIDA',403);
  const user=await identity(request);
  const raw=await request.text();if(raw.length>1000)throw new CheckoutError('DADOS_INVALIDOS',413);
  const {sku,rating}=JSON.parse(raw);if(!validSku(sku)||!Number.isInteger(rating)||rating<1||rating>5)throw new CheckoutError('DADOS_INVALIDOS',422);
  const accepted=await database(env,'rpc/kaia_submit_verified_rating',{method:'POST',body:{p_user_id:user.id,p_sku:sku,p_rating:rating}});
  if(accepted!==true)throw new CheckoutError('COMPRA_NAO_VERIFICADA',403);
  return json({saved:true,...await summary(env,sku)});
 }catch(e){return fail(e);}
}
