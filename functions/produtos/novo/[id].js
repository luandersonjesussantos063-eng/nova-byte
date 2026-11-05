// Cloudflare Pages: SEO-friendly dynamic product detail for new admin-created items.
// Public API key only; no service_role secrets, no checkout.
const SUPABASE='https://vajlhodqxskozuxxlujv.supabase.co';
const PUBLIC_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhamxob2RxeHNrb3p1eHhsdWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDQ0ODIsImV4cCI6MjEwNTQ4MDQ4Mn0.2HfSpUNZZZAJ8xQWK6yuwAkxNa_-dtuFTfkYJzSPybk";
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snippet=(v,n)=>String(v||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const jsonResponse=(body,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8',
 'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'}});
async function lookup(table,field,value){
 const qs=new URLSearchParams({select:'*',[field]:'eq.'+value,limit:'1'});
 const response=await fetch(SUPABASE+'/rest/v1/'+table+'?'+qs,{
  headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+PUBLIC_KEY,Accept:'application/json'},
  signal:AbortSignal.timeout(6000)
 });
 if(!response.ok)throw Error('upstream not available');
 const rows=await response.json();return rows[0]||null;
}
function documentFor(product,override){
 const id=product.id,url='https://usekaiaglow.com.br/produtos/novo/'+id;
 const name=override.name,brand=override.brand||product.brand,category=override.category||product.category;
 const description=snippet(override.description,3500);
 const metaDesc=snippet(override.description,160)||'Conheça '+name+' da '+brand+' na Kaia Glow.';
 const img=Array.isArray(override.images)?override.images[0]:null;
 const validImage=typeof img==='string'&&
 (/^https:\/\/vajlhodqxskozuxxlujv\.supabase\.co\/storage\/v1\/object\/public\/kaia-product-media\/products\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(img)
 || /^assets\/catalog\/[A-Za-z0-9_-]+\.(webp|jpg|jpeg|png|avif)$/.test(img));
 const photo=validImage?(img.startsWith('https:')?img:'https://usekaiaglow.com.br/'+img):null;
 const schema=[
  {'@context':'https://schema.org','@type':'Product',name,description,
   brand:{'@type':'Brand',name:brand},sku:product.sku,url,...(photo?{image:[photo]}:{})},
  {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[
   {'@type':'ListItem',position:1,name:'Kaia Glow',item:'https://usekaiaglow.com.br/'},
   {'@type':'ListItem',position:2,name:category,item:'https://usekaiaglow.com.br/#colecao'},
   {'@type':'ListItem',position:3,name,item:url}
  ]}
 ];
 const json=JSON.stringify(schema).replace(/</g,'\\u003c');
 const imageHTML=photo?'<img src="'+escapeHTML(photo)+'" alt="'+escapeHTML(name)+'" fetchpriority="high">':
  '<div class="photo-none large">Foto do produto em atualização</div>';
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  +'<meta name="robots" content="index,follow">'
  +'<title>'+escapeHTML(snippet(name+' | '+brand+' | Kaia Glow',90))+'</title>'
  +'<meta name="description" content="'+escapeHTML(metaDesc)+'">'
  +'<link rel="canonical" href="'+escapeHTML(url)+'">'
  +'<meta property="og:title" content="'+escapeHTML(name+' | Kaia Glow')+'">'
  +'<meta property="og:description" content="'+escapeHTML(metaDesc)+'">'
  +'<meta property="og:url" content="'+escapeHTML(url)+'">'
  +(photo?'<meta property="og:image" content="'+escapeHTML(photo)+'">':'')
  +'<link rel="stylesheet" href="/kaia-seo.css">'
  +'<script type="application/ld+json">'+json+'</script></head><body>'
  +'<header class="top"><div class="shell head"><a class="brand" href="/">KAIA GLOW</a>'
  +'<nav><a href="/#colecao">Catálogo</a><a href="/skincare-coreano/">Skincare coreano</a><a href="/atendimento.html">Atendimento</a></nav></div></header>'
  +'<main class="shell"><nav class="crumbs"><a href="/">Kaia Glow</a> › <a href="/#colecao">'+escapeHTML(category)+'</a> › '
  +escapeHTML(name)+'</nav><article class="product-detail">'
  +'<div class="visual">'+imageHTML+'</div>'
  +'<div class="details"><span class="eyebrow">'+escapeHTML(brand)+' · '+escapeHTML(category)+'</span>'
  +'<h1>'+escapeHTML(name)+'</h1><p class="intro">'+escapeHTML(snippet(description,240))+'</p>'
  +'<p class="small">Referência: '+escapeHTML(product.sku)+'</p>'
  +'<p class="callout">A loja está em preparação para finalizar compras online. Consulte o produto na vitrine e entre em contato para mais informações.</p>'
  +'<a class="button" href="/#produto-'+escapeHTML(id)+'">Ver na vitrine</a>'
  +'<a class="button secondary" href="/atendimento.html">Falar com a Kaia Glow</a></div></article>'
  +'<section class="content"><h2>Descrição e informações do produto</h2><p>'+escapeHTML(description)+'</p></section>'
  +'<section class="content"><h2>Continue explorando</h2><a class="pill" href="/#colecao">Outros produtos da Kaia Glow</a>'
  +'<a class="pill" href="/cosmeticos-em-sao-paulo/">Cosméticos online em São Paulo</a></section>'
  +'</main><footer class="bottom"><div class="shell"><strong>KAIA GLOW</strong>'
  +'<p>Loja online de skincare e cosméticos · <a href="/privacidade.html">Privacidade</a> · '
  +'<a href="/atendimento.html">Atendimento</a></p></div></footer></body></html>';
}
export async function onRequestGet({params}){
 const id=String(params?.id||'');
 if(!/^9[0-9]{8,14}$/.test(id))return jsonResponse('<h1>Produto não encontrado</h1>',404);
 try{
  const product=await lookup('kaia_new_products','id',id);
  if(!product)return jsonResponse('<h1>Produto não encontrado</h1>',404);
  const override=await lookup('kaia_catalog_overrides','product_key',product.sku);
  if(!override||!override.visible)return jsonResponse('<h1>Produto não publicado</h1>',404);
  return jsonResponse(documentFor(product,override));
 }catch{return jsonResponse('<h1>Esta página está temporariamente indisponível</h1>',503);}
}
