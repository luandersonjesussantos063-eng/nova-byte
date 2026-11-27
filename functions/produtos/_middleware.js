import {database} from '../api/kaia/comercial/_core.js';
import {onRequestGet as commercialCatalog} from '../api/kaia/comercial/catalogo.js';

const productSchema=/<script type="application\/json" data-kaia-product>([\s\S]*?)<\/script>/;

export async function onRequestGet(context){
 const {request,env}=context;
 const url=new URL(request.url);
 const legacyPaths={"/produtos/medicube-red-acne-succinic-acid-peel-358414277/":"/produtos/medicube-red-acne-succinic-acid-peel/","/produtos/elizavecca-cer-100-hair-muscle-essence-oil-100-ml-stock-kg-eli-cer100-oil-100ml/":"/produtos/elizavecca-cer-100-hair-muscle-essence-oil-100-ml/","/produtos/cell-fusion-c-glass-skin-tone-up-cream-50-ml-stock-kg-cfc-glasstone-50ml/":"/produtos/cell-fusion-c-glass-skin-tone-up-cream-50-ml/","/produtos/d-alba-white-truffle-first-spray-serum-100-ml-stock-kg-dal-firstspray-100ml/":"/produtos/d-alba-white-truffle-first-spray-serum-100-ml/","/produtos/dr-althea-345-relief-cream-50-ml-stock-kg-dra-345rc-50ml/":"/produtos/dr-althea-345-relief-cream-50-ml/","/produtos/mise-en-scene-perfect-serum-original-80-ml-stock-kg-mis-perfser-ori-80ml/":"/produtos/mise-en-scene-perfect-serum-original-80-ml/","/produtos/vt-pdrn-reedle-shot-brush-hair-serum-100-ml-stock-kg-vt-pdrn-brush-100ml/":"/produtos/vt-pdrn-reedle-shot-brush-hair-serum-100-ml/","/produtos/ongredients-skin-barrier-glow-mist-healthion-edition-50-ml-stock-kg-ong-sbgm-50ml/":"/produtos/ongredients-skin-barrier-glow-mist-healthion-edition-50-ml/","/produtos/beauty-of-joseon-relief-sun-rice-niacinamide-spf50-pa-50-ml-stock-kg-boj-rs-ricenia-50ml/":"/produtos/beauty-of-joseon-relief-sun-rice-niacinamide-spf50-pa-50-ml/","/produtos/shaishaishai-repair-milky-urea-glow-bubble-serum-110-ml-stock-kg-sha-repairmilky-110ml/":"/produtos/shaishaishai-repair-milky-urea-glow-bubble-serum-110-ml/","/produtos/celimax-retinal-shot-tightening-dual-cream-50-ml-stock-kg-cel-retdual-50ml/":"/produtos/celimax-retinal-shot-tightening-dual-cream-50-ml/","/produtos/baoweiquan-sodium-hyaluronate-anti-wrinkle-firming-sleep-wrinkle-stock-kg-bao-sleepwrinkle-16p/":"/produtos/baoweiquan-sodium-hyaluronate-anti-wrinkle-firming-sleep-wrinkle-patch-16-patches/","/produtos/hunmui-goat-milk-polypeptide-yeast-neck-membrane-15-ml-1-mascara-stock-kg-hun-goatmilk-neck-15ml/":"/produtos/hunmui-goat-milk-polypeptide-yeast-neck-membrane-15-ml-1-mascara/","/produtos/twinkle-jewel-seal-jewel-seal-mix-1-cartela-stock-kg-tjs-jewelseal-mix/":"/produtos/twinkle-jewel-seal-jewel-seal-mix-1-cartela/","/produtos/twinkle-jewel-seal-cellphone-stickers-pink-hearts-1-cartela-stock-kg-tjs-cellphone-pink/":"/produtos/twinkle-jewel-seal-cellphone-stickers-pink-hearts-1-cartela/","/produtos/crystal-stickers-bow-butterfly-crystal-stickers-1-cartela-stock-kg-cry-stickers-bowbutter/":"/produtos/crystal-stickers-bow-butterfly-crystal-stickers-1-cartela/"};
 const canonicalPath=legacyPaths[url.pathname]||legacyPaths[url.pathname+'/'];
 if(canonicalPath&&['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(url.hostname)){url.pathname=canonicalPath;return Response.redirect(url.href,301);}
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
