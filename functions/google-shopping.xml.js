import {onRequestGet as commercialCatalog} from './api/kaia/comercial/catalogo.js';
import {database} from './api/kaia/comercial/_core.js';
import '../kaia-glow/catalog-presentation.js';

const site='https://usekaiaglow.com.br';
const localPhoto=/^assets\/catalog\/[A-Za-z0-9_-]+\.(webp|jpe?g|png|avif)$/i;
const uploadedPhoto=/^https:\/\/vajlhodqxskozuxxlujv\.supabase\.co\/storage\/v1\/object\/public\/kaia-product-media\/products\/[A-Za-z0-9_-]+\.(webp|jpe?g|png)$/i;
const escapeXml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
 .replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tag=(key,value)=>'<g:'+key+'>'+escapeXml(value)+'</g:'+key+'>';
const plain=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

function productItem(product,edit,priceCents){
 if(!Number.isSafeInteger(priceCents)||priceCents<=0||product.variants?.length!==1)return '';
 if(edit&&(!edit.visible||edit.archived||!edit.available))return '';
 if((edit?.price_cents??Math.round(product.price*100))!==priceCents)return '';

 const entry={
  name:edit?.name??product.name,
  description:edit?.description??product.description,
  brand:edit?.brand||product.brand
 };
 globalThis.KaiaCatalogPresentation.normalize(entry);
 const title=plain(entry.name).slice(0,150),description=plain(entry.description).slice(0,5000),brand=plain(entry.brand).slice(0,70);
 const url=new URL(product.url);
 if(!['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(url.hostname)||!/^\/produtos\/[a-z0-9-]+\/$/.test(url.pathname))return '';

 const images=[...new Set(edit?.images?.length?edit.images:product.images||[])].flatMap(src=>{
  if(localPhoto.test(src))return [site+'/'+src];
  return uploadedPhoto.test(src)?[src]:[];
 });
 if(!title||!description||!brand||!images.length)return '';

 const fields=[tag('id',product.sku),tag('title',title),tag('description',description),tag('link',site+url.pathname),
  tag('image_link',images[0]),...images.slice(1,11).map(image=>tag('additional_image_link',image)),
  tag('availability','in_stock'),tag('price',(priceCents/100).toFixed(2)+' BRL'),tag('brand',brand),
  tag('condition','new'),tag('excluded_destination','Shopping_ads')];
 return '<item>'+fields.join('')+'</item>';
}

export async function onRequestGet(context){
 const {request,env}=context;
 try{
  const commercial=await commercialCatalog(context);
  if(!commercial.ok)return new Response('Catálogo comercial indisponível.',{status:commercial.status});
  const {products}=await commercial.json();
  const prices=new Map(products.map(product=>[product.sku,product.priceCents]));
  const [source,edits]=await Promise.all([
   env.ASSETS.fetch(new URL('/catalog.js',request.url)),
   database(env,'kaia_catalog_overrides?select=product_key,visible,archived,available,name,description,brand,price_cents,images')
  ]);
  const prefix='window.KAIA_CATALOG=';
  const contents=(await source.text()).trim();
  if(!source.ok||!contents.startsWith(prefix))throw Error('Catálogo indisponível');
  const catalog=JSON.parse(contents.slice(prefix.length).replace(/;$/,''));
  const overrides=new Map(edits.map(edit=>[edit.product_key,edit]));
  const items=catalog.filter(product=>prices.has(product.sku))
   .map(product=>productItem(product,overrides.get(product.sku),prices.get(product.sku))).filter(Boolean);
  const body='<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">'
   +'<channel><title>Kaia Glow</title><link>'+site+'/</link><description>Produtos disponíveis para compra online na Kaia Glow</description>'
   +items.join('\n')+'</channel></rss>\n';
  return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8',
   'cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch{
  return new Response('Catálogo comercial temporariamente indisponível.',{status:503,headers:{'cache-control':'no-store'}});
 }
}
