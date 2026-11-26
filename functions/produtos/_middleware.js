import {database} from '../api/kaia/comercial/_core.js';
import {onRequestGet as commercialCatalog} from '../api/kaia/comercial/catalogo.js';

const productSchema=/<script type="application\/json" data-kaia-product>([\s\S]*?)<\/script>/;

export async function onRequestGet(context){
 const {request,env}=context;
 const url=new URL(request.url);
 const original=await context.next();
 if(!['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(url.hostname)||!/^\/produtos\/[a-z0-9-]+\/$/.test(url.pathname)||
  !original.ok||!original.headers.get('content-type')?.startsWith('text/html'))return original;

 try{
  const markup=await original.clone().text();
  const script=markup.match(productSchema);
  if(!script)return original;
  const schemas=JSON.parse(script[1]);
  const product=schemas.find(item=>item['@type']==='Product');
  const priceCents=Number(markup.match(/data-product-price-cents="(\d+)"/)?.[1]);
  if(!product?.sku||!Number.isSafeInteger(priceCents)||priceCents<=0)return original;

  const catalog=await commercialCatalog(context);
  if(!catalog.ok)return original;
  const {products}=await catalog.json();
  const verifiedPrice=products.find(item=>item.sku===product.sku)?.priceCents;
  if(verifiedPrice!==priceCents)return original;

  const editQuery=new URLSearchParams({
   select:'visible,archived,available,price_cents',
   product_key:'eq.'+product.sku,
   limit:'1'
  });
  const [edit]=await database(env,'kaia_catalog_overrides?'+editQuery);
  if(edit&&(!edit.visible||edit.archived||!edit.available||edit.price_cents!==priceCents))return original;

  product.offers={'@type':'Offer',url:product.url,priceCurrency:'BRL',price:(priceCents/100).toFixed(2),
   availability:'https://schema.org/InStock'};
  const structured=JSON.stringify(schemas).replace(/</g,'\\u003c');
  const headers=new Headers(original.headers);
  for(const key of ['content-length','content-encoding','etag','last-modified'])headers.delete(key);
  headers.set('Cache-Control','no-store');
  const published='<script type="application/ld+json" data-kaia-product>'+structured+'</script>';
  return new Response(markup.replace(productSchema,()=>published),{status:original.status,headers});
 }catch{return original;}
}
