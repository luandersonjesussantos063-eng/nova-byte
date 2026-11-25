// Cloudflare Pages: automatically discover newly published merchant-created products.
const ORIGIN='https://usekaiaglow.com.br';
const API='https://vajlhodqxskozuxxlujv.supabase.co/rest/v1/';
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhamxob2RxeHNrb3p1eHhsdWp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDQ0ODIsImV4cCI6MjEwNTQ4MDQ4Mn0.2HfSpUNZZZAJ8xQWK6yuwAkxNa_-dtuFTfkYJzSPybk";
async function rows(table,fields){
 const q=new URLSearchParams({select:fields,limit:'1000'});
 const r=await fetch(API+table+'?'+q,{headers:{apikey:KEY,Authorization:'Bearer '+KEY},
  signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('catalog unavailable');
 return r.json();
}
async function publishedProducts(){
 const [newProducts,overrides]=await Promise.all([
  rows('kaia_new_products','id,sku,updated_at'),
  rows('kaia_catalog_overrides','product_key,visible,archived,updated_at')
 ]);
 const published=new Map(overrides.filter(x=>x.visible&&x.archived!==true).map(x=>[x.product_key,x]));
 return newProducts.filter(x=>published.has(x.sku)&&/^9[0-9]{8,14}$/.test(String(x.id))).map(x=>({
  id:x.id,lastmod:[x.updated_at,published.get(x.sku).updated_at].filter(Boolean).sort().at(-1)?.slice(0,10)
 }));
}
const namespace='http://www.sitemaps.org/schemas/sitemap/0.9';
const xmlResponse=body=>new Response('<?xml version="1.0" encoding="UTF-8"?>\n'+body+'\n',{
 headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public,max-age=120','x-content-type-options':'nosniff'}
});
const unavailable=()=>new Response('Sitemap temporariamente indisponível.',{status:503,
 headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});

export async function onRequestGet(){
 try{
  const items=await publishedProducts();
  const sitemaps=['/sitemap.xml'];
  if(items.length)sitemaps.push('/sitemap-produtos-novos.xml');
  return xmlResponse('<sitemapindex xmlns="'+namespace+'">\n'
   +sitemaps.map(path=>'<sitemap><loc>'+ORIGIN+path+'</loc></sitemap>').join('\n')+'\n</sitemapindex>');
 }catch{return unavailable();}
}

export async function newProductsSitemap(){
 try{
  const items=await publishedProducts();
  if(!items.length)return new Response('Nenhum produto novo publicado.',{status:404,
   headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public,max-age=120'}});
  return xmlResponse('<urlset xmlns="'+namespace+'">\n'+items.map(({id,lastmod})=>'<url><loc>'+ORIGIN+'/produtos/novo/'+id+'</loc>'
   +(/^\d{4}-\d{2}-\d{2}$/.test(lastmod)?'<lastmod>'+lastmod+'</lastmod>':'')+'</url>').join('\n')+'\n</urlset>');
 }catch{return unavailable();}
}
