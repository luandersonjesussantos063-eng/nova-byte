// Read-only administrative order list. Reuses the store's verified admin guard.
// No credentials, postal addresses, tax IDs, checkout URLs or payment keys returned.
import {buyerAdmin,db,response,HOSTS,PaymentError} from './checkout-validacao/_core.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanItems=items=>(Array.isArray(items)?items:[]).slice(0,30).map(i=>({
 name:String(i.name||i.product_name||i.sku||'Produto').slice(0,220),
 quantity:Math.max(0,Number(i.quantity)||0)
}));
export async function onRequestGet({request,env}){
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:'||!HOSTS.includes(url.hostname))return response({code:'AMBIENTE_INVALIDO'},403);
  await buyerAdmin(request,env);
  const customer=url.searchParams.get('customer');
  if(customer&&!UUID.test(customer))return response({code:'CLIENTE_INVALIDO'},400);
  const scope=customer?'&user_id=eq.'+customer:'';
  if(!env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY)return response({code:'CONSULTA_INDISPONIVEL'},503);
  const [payments,history]=await Promise.all([
   db(env,'kaia_commercial_payments?select=id,user_id,status,items,total_cents,paid_amount_cents,coupon_code,gift_packaging,created_at&order=created_at.desc&limit=100'+scope),
   db(env,'kaia_orders?select=id,user_id,order_number,status,total_cents,items,gift_packaging,created_at&order=created_at.desc&limit=100'+scope)
  ]);
  const ids=[...new Set([...payments,...history].map(o=>o.user_id).filter(id=>UUID.test(id||'')))];
  const people=ids.length?await db(env,'kaia_customers?select=user_id,full_name&user_id=in.('+ids.join(',')+')'):[];
  const names=new Map(people.map(p=>[p.user_id,p.full_name]));
  const represented=new Set(payments.map(p=>'KG-'+p.id.replaceAll('-','')));
  const orders=payments.map(p=>({
   id:p.id,userId:p.user_id,number:'KG-'+p.id.replaceAll('-',''),customer:names.get(p.user_id)||'Cliente cadastrado',
   status:p.status,totalCents:p.total_cents,paidCents:p.paid_amount_cents,
   items:cleanItems(p.items),coupon:p.coupon_code||null,giftPackaging:p.gift_packaging||'none',createdAt:p.created_at,source:'payment'
  }));
  for(const o of history){
   if(represented.has(o.order_number))continue;
   orders.push({id:o.id,userId:o.user_id,number:o.order_number,customer:names.get(o.user_id)||'Cliente cadastrado',
    status:o.status,totalCents:o.total_cents,items:cleanItems(o.items),giftPackaging:o.gift_packaging||'none',createdAt:o.created_at,source:'history'});
  }
  orders.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return response({orders:orders.slice(0,100),limited:payments.length===100||history.length===100||orders.length>100,checkedAt:new Date().toISOString()});
 }catch(e){
  if(e instanceof PaymentError&&[401,403].includes(e.status))return response({code:e.code},e.status);
  return response({code:'CONSULTA_PEDIDOS_INDISPONIVEL'},503);
 }
}
