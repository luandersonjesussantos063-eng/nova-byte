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
export async function onRequestGet(){
 try{
  const [newProducts,overrides]=await Promise.all([
   rows('kaia_new_products','id,sku,updated_at'),
   rows('kaia_catalog_overrides','product_key,visible,updated_at')
  ]);
  const published=new Map(overrides.filter(x=>x.visible).map(x=>[x.product_key,x]));
  const items=newProducts.filter(x=>published.has(x.sku)&&/^9[0-9]{8,14}$/.test(String(x.id)));
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n'
   +'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
   +items.map(x=>'<url><loc>'+esc(ORIGIN+'/produtos/novo/'+x.id)
    +'</loc><lastmod>'+esc(String(published.get(x.sku).updated_at||'').slice(0,10))
    +'</lastmod></url>').join('\n')
   +'\n</urlset>\n';
  return new Response(xml,{headers:{'content-type':'application/xml; charset=utf-8',
   'cache-control':'public,max-age=120','x-content-type-options':'nosniff'}});
 }catch{
  return new Response('Sitemap temporariamente indisponível.',{status:503,
   headers:{'content-type':'text/plain','cache-control':'no-store'}});
 }
}
