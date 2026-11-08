import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const SITE='https://usekaiaglow.com.br';
const NOW=new Date().toISOString().slice(0,10);
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xml=html;
const plain=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001F]+/g,' ').replace(/\s+/g,' ').trim();
const shorten=(s,n=155)=>{const value=plain(s);if(value.length<=n)return value;return value.slice(0,n-1).replace(/\s+\S*$/,'').trimEnd()+'…'};
const slug=s=>plain(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const img=p=>p.images?.find(v=>/^assets\/catalog\/[A-Za-z0-9_-]+\.(webp|jpg|jpeg|png|avif)$/i.test(v))||null;
const asset=v=>SITE+'/'+v.replace(/^\/+/,'');
const productPath=p=>{
 if(p.url){try{const u=new URL(p.url);if(['www.usekaiaglow.com.br','usekaiaglow.com.br'].includes(u.hostname)&&/^\/produtos\/[a-z0-9-]+\/$/.test(u.pathname))return u.pathname}catch{}}
 return '/produtos/'+slug(p.name).slice(0,65).replace(/-+$/,'')+'-'+slug(p.id)+'/';
};
const pageLayout=({title,description,pathname,body,data,photo})=>{
 const canonical=SITE+pathname;
 const schema=data?'<script type="application/ld+json">'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>':'';
 const imageMeta=photo?'<meta property="og:image" content="'+html(asset(photo))+'">':'';
 return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
 +'<meta name="robots" content="index,follow"><meta name="theme-color" content="#54233d">'
 +'<title>'+html(shorten(title,84))+'</title><meta name="description" content="'+html(shorten(description,165))+'">'
 +'<link rel="canonical" href="'+html(canonical)+'">'
 +'<meta property="og:type" content="website"><meta property="og:site_name" content="Kaia Glow">'
 +'<meta property="og:title" content="'+html(shorten(title,100))+'"><meta property="og:description" content="'+html(shorten(description,165))+'">'
 +'<meta property="og:url" content="'+html(canonical)+'">'+imageMeta
 +'<link rel="stylesheet" href="/kaia-seo.css?v=2"><link rel="stylesheet" href="/premium-seo.css?v=1">'+schema+'</head><body>'
 +'<a class="skip" href="#conteudo">Pular para conteúdo</a>'
 +'<header class="top"><div class="shell head"><a class="brand" href="/">KAIA GLOW</a><nav aria-label="Navegação da loja">'
 +'<a href="/#colecao">Loja</a><a href="/skincare-coreano/">Skincare coreano</a><a href="/categoria/cabelos/">Cabelos</a><a href="/cosmeticos-em-sao-paulo/">São Paulo</a></nav></div></header>'
 +'<main class="shell" id="conteudo">'+body+'</main>'
 +'<footer class="bottom"><div class="shell"><strong>KAIA GLOW</strong><p>Seleção de skincare, cuidados capilares e autocuidado. Loja online com atendimento por canais digitais.</p><nav><a href="/sobre.html">Sobre</a><a href="/atendimento.html">Atendimento</a><a href="/privacidade.html">Privacidade</a><a href="/">Voltar à loja</a></nav>'
 +'<p class="fine">Endereço cadastral: Rua Eng. Prudente, 35, apto. 154, Vila Monumento, São Paulo, SP. Atendimento e condições de entrega pelo site.</p></div></footer>'
 +(pathname.startsWith('/produtos/')?'<script type="module" src="/seo-product-live.js"></script>':'')+'</body></html>';
};
const crumbs=(parts)=>'<nav class="crumbs" aria-label="Navegação estrutural">'+parts.map((p,i)=>i===parts.length-1?'<span aria-current="page">'+html(p.title)+'</span>':'<a href="'+html(p.path)+'">'+html(p.title)+'</a>').join('<span aria-hidden="true">›</span>')+'</nav>';
const breadcrumbsData=(parts)=>({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:parts.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.title,item:SITE+p.path}))});
const productCard=(p)=>'<article class="item"><a href="'+html(productPath(p))+'">'+(img(p)?'<img src="'+html('/'+img(p))+'" alt="Foto de '+html(p.name)+'" loading="lazy">':'<div class="photo-none">Foto em atualização</div>')+'<span class="brand-name">'+html(p.brand)+'</span><h3>'+html(p.name)+'</h3><span class="view">Ver detalhes e características ›</span></a></article>';
const cardGrid=(products)=>'<div class="grid">'+products.map(productCard).join('')+'</div>';
const groups=[
 {path:'/categoria/skincare/',title:'Skincare e cuidados com a pele',search:'Skincare e cosméticos faciais online',intro:'Descubra séruns, cremes, máscaras e cuidados faciais de marcas selecionadas pela Kaia Glow. Compare as apresentações, veja fotos e conheça as características de cada produto.',select:p=>p.category==='Skincare'},
 {path:'/categoria/cabelos/',title:'Produtos para cabelos',search:'Produtos capilares e cuidados com os cabelos',intro:'Conheça os óleos, máscaras e tratamentos capilares do catálogo Kaia Glow, com opções para diferentes rotinas de cuidados e informações sobre cada apresentação.',select:p=>p.category==='Cabelos'},
 {path:'/categoria/corpo-e-spa/',title:'Corpo e spa',search:'Acessórios de autocuidado e produtos para o corpo',intro:'Uma seleção de acessórios e cuidados para o corpo e os momentos de autocuidado, para pesquisar e escolher com tranquilidade.',select:p=>p.category==='Corpo e spa'},
 {path:'/skincare-coreano/',title:'Skincare coreano',search:'Skincare coreano: marcas e produtos K-beauty',intro:'Explore produtos de marcas conhecidas do skincare coreano, como Medicube, Beauty of Joseon, VT Cosmetics, Anua, Biodance e SKIN1004, disponíveis para consulta no catálogo da Kaia Glow.',select:p=>['Medicube','Beauty of Joseon','VT Cosmetics','VT','Anua','Biodance','SKIN1004','Celimax','Purito','Numbuzin'].some(b=>p.brand.toLowerCase().includes(b.toLowerCase()))},
 {path:'/seruns-faciais/',title:'Séruns faciais',search:'Sérum facial: niacinamida, PDRN e cuidado diário',intro:'Compare séruns faciais, diferentes ingredientes anunciados e tamanhos das embalagens. Consulte as descrições de cada produto antes de escolher para sua rotina.',select:p=>p.category==='Skincare'&&/sérum|serum|booster|ampoule|shot/i.test(p.name)},
 {path:'/mascaras-faciais/',title:'Máscaras faciais e patches',search:'Máscaras faciais, gel masks e patches de skincare',intro:'Confira máscaras em gel, máscaras de tratamento e patches para a área dos olhos e do rosto, com detalhes de composição e apresentação de cada item.',select:p=>/máscara|mascara|mask|patch|pads?/i.test(p.name)},
 {path:'/cuidados-com-poros/',title:'Cuidados com poros e textura',search:'Produtos para cuidados com poros e textura da pele',intro:'Uma seleção de produtos cujo nome ou descrição aborda poros, textura da pele e limpeza facial. Consulte cada composição e siga as orientações do fabricante.',select:p=>p.category==='Skincare'&&/poro|pore|seb[uú]m|esfolia/i.test(p.name+' '+p.description.slice(0,180))}
];
const linkToCategory=groups.map(g=>'<a class="pill" href="'+g.path+'">'+html(g.title)+'</a>').join('');
async function writePage(output,pathname,content){
 const folder=path.join(output,pathname.replace(/^\//,''));
 await mkdir(folder,{recursive:true});
 await writeFile(path.join(folder,'index.html'),content);
}
export async function generateKaiaSeoPages(source,output){
 const raw=await readFile(path.join(source,'catalog.js'),'utf8');
 const prefix='window.KAIA_CATALOG=';
 if(!raw.startsWith(prefix))throw Error('Catálogo Kaia: formato inesperado');
 const products=JSON.parse(raw.slice(prefix.length).trim().replace(/;$/,''));
 if(products.length<50)throw Error('Catálogo insuficiente para geração SEO');
 const used=new Set(),urls=[],byCategory=new Map();
 for(const product of products){
  const pathname=productPath(product);
  if(used.has(pathname))throw Error('URL de produto duplicada: '+pathname);
  used.add(pathname);
  const description=plain(product.description||'');
  const category=groups.find(g=>g.select(product))||groups[0];
  const crumbsList=[{title:'Kaia Glow',path:'/'},{title:category.title,path:category.path},{title:product.name,path:pathname}];
  const data=[
   {'@context':'https://schema.org','@type':'Product',name:product.name,description:shorten(description,1200),url:SITE+pathname,
    ...(img(product)?{image:[asset(img(product))]}:{}),
    ...(product.sku?{sku:product.sku}:{}),
    brand:{'@type':'Brand',name:product.brand}},
   breadcrumbsData(crumbsList)
  ];
  const related=products.filter(p=>p.id!==product.id&&(p.brand===product.brand||p.category===product.category)).slice(0,4);
  const paragraphs=description.length>1600?description.slice(0,1600).replace(/\s+\S*$/,'')+'…':description;
  const body=crumbs(crumbsList)+'<article class="product-detail" data-product-key="'+html(product.sku||'legacy:'+product.id)+'"><div class="visual">'
   +(img(product)?'<img src="'+html('/'+img(product))+'" alt="'+html(product.name)+'" fetchpriority="high">':'<div class="photo-none large">Imagem do produto em atualização</div>')
   +'</div><div class="details"><span class="eyebrow">'+html(product.brand)+' · '+html(product.category)+'</span><h1>'+html(product.name)+'</h1>'
   +'<p class="intro">'+html(shorten(description,240))+'</p>'
   +(product.sku?'<p class="small">Referência do produto: '+html(product.sku)+'</p>':'')
   +'<p class="callout">A compra pelo site ainda está em preparação. Valores, estoque e condições de entrega devem ser consultados na vitrine e com o atendimento.</p>'
   +'<a class="button" href="/#produto-'+encodeURIComponent(product.id)+'">Abrir este produto na loja</a>'
   +'<a class="button secondary" href="/atendimento.html">Consultar atendimento</a></div></article>'
   +'<section class="content"><h2>Descrição e características</h2><p>'+html(paragraphs)+'</p></section>'
   +(related.length?'<section class="content"><h2>Descubra produtos relacionados</h2>'+cardGrid(related)+'</section>':'')
   +'<section class="content"><h2>Veja outras categorias</h2><div class="pills">'+linkToCategory+'</div></section>';
  await writePage(output,pathname,pageLayout({
   title:product.name+' | Kaia Glow',description:shorten(description,152)||'Conheça '+product.name+' da '+product.brand+' na Kaia Glow.',
   pathname,body,data,photo:img(product)
  }));
  urls.push(pathname);
 }
 for(const g of groups){
  const chosen=products.filter(g.select);
  if(chosen.length===0)continue;
  const crumbsList=[{title:'Kaia Glow',path:'/'},{title:g.title,path:g.path}];
  const schema=[breadcrumbsData(crumbsList),{
   '@context':'https://schema.org','@type':'CollectionPage',name:g.title,description:g.intro,url:SITE+g.path,
   mainEntity:{'@type':'ItemList',itemListElement:chosen.map((p,i)=>({'@type':'ListItem',position:i+1,url:SITE+productPath(p)}))}
  }];
  const body=crumbs(crumbsList)+'<p class="eyebrow">CURADORIA KAIA GLOW</p><h1>'+html(g.search)+'</h1>'
   +'<p class="intro wide">'+html(g.intro)+'</p>'
   +'<p class="small">'+chosen.length+' produtos para conhecer. Consulte preços e condições de compra na vitrine.</p>'
   +cardGrid(chosen)+'<section class="content"><h2>Explore outras seleções</h2><div class="pills">'+linkToCategory+'</div></section>';
  await writePage(output,g.path,pageLayout({title:g.search+' | Kaia Glow',description:g.intro,pathname:g.path,body,data:schema}));
  urls.push(g.path);byCategory.set(g.path,chosen.length);
 }
 const localPath='/cosmeticos-em-sao-paulo/';
 const location={title:'Cosméticos online em São Paulo',path:localPath};
 const cr=[{title:'Kaia Glow',path:'/'},location];
 const localData=[breadcrumbsData(cr),{'@context':'https://schema.org','@type':'OnlineStore',name:'Kaia Glow',
  url:SITE+'/',address:{'@type':'PostalAddress',streetAddress:'Rua Eng. Prudente, 35, apto. 154, Vila Monumento',
    addressLocality:'São Paulo',addressRegion:'SP',postalCode:'01550-000',addressCountry:'BR'},
  email:'usekaiaglow@gmail.com',areaServed:{'@type':'AdministrativeArea',name:'São Paulo'}}];
 const localBody=crumbs(cr)+'<p class="eyebrow">KAIA GLOW · SÃO PAULO</p>'
  +'<h1>Skincare e cosméticos online em São Paulo</h1>'
  +'<p class="intro wide">Conheça a curadoria de skincare, cosméticos e autocuidado da Kaia Glow. Nossa empresa tem endereço cadastral na Vila Monumento, em São Paulo (SP), e disponibiliza o catálogo para consultas online.</p>'
  +'<section class="content"><h2>Encontre seus cuidados favoritos</h2><p>Buscando séruns faciais, máscaras, produtos capilares ou novidades de skincare coreano? Explore as categorias para comparar as marcas e conhecer cada apresentação.</p><div class="pills">'+linkToCategory+'</div></section>'
  +'<section class="content"><h2>Produtos para pesquisar</h2>'+cardGrid(products.filter(p=>img(p)).slice(0,16))+'</section>'
  +'<section class="content"><h2>Atendimento e entrega na região de São Paulo</h2><p>O endereço informado na loja é o endereço cadastral da empresa, localizado na região da Vila Monumento, próxima ao Ipiranga. O catálogo é online: informe seu CEP na sacola para consultar modalidades e estimativas de frete quando as medidas do produto estiverem disponíveis.</p>'
  +'<p>Não há anúncio de atendimento presencial ou retirada nesse endereço. A finalização de compras está sendo preparada; confirme condições de atendimento e compra antes de realizar qualquer pedido.</p><a class="button" href="/atendimento.html">Falar com a Kaia Glow</a></section>';
 await writePage(output,localPath,pageLayout({title:'Skincare e cosméticos em São Paulo | Kaia Glow',
  description:'Conheça a Kaia Glow, loja online de skincare e cosméticos com endereço cadastral na Vila Monumento, em São Paulo. Explore marcas, produtos e frete.',
  pathname:localPath,body:localBody,data:localData}));
 urls.push(localPath);
 // Keep a short, useful collection guide on the homepage instead of dumping
 // the entire product index as bare links. Individual product landing pages and
 // all catalog URLs remain discoverable through category pages and sitemap.xml.
 const homePath=path.join(output,'index.html');let home=await readFile(homePath,'utf8');
 const featuredCategories=[
  {path:'/categoria/skincare/',title:'Rosto e skincare',description:'Séruns, máscaras e cuidados faciais.'},
  {path:'/categoria/cabelos/',title:'Cabelos',description:'Tratamentos e cuidados capilares.'},
  {path:'/categoria/corpo-e-spa/',title:'Corpo e spa',description:'Autocuidado para diferentes momentos.'},
  {path:'/skincare-coreano/',title:'Skincare coreano',description:'Descubra marcas e rotinas K-beauty.'}
 ];
 const categoryCards=featuredCategories.map(g=>
  '<a class="kaia-seo-category" href="'+html(g.path)+'"><span class="kaia-seo-category-label">EXPLORE</span>'+
  '<strong>'+html(g.title)+'</strong><span>'+html(g.description)+'</span>'+
  '<span class="kaia-seo-category-arrow" aria-hidden="true">→</span></a>'
 ).join('');
 const hub='<section id="explore-seo" class="kaia-seo-hub" aria-labelledby="kaia-seo-title"><div class="wrap">'
  +'<p class="kaia-seo-eyebrow">CONTINUE EXPLORANDO</p>'
  +'<h2 id="kaia-seo-title">Encontre seu próximo cuidado</h2>'
  +'<p>Descubra nossas seleções por categoria e escolha os produtos que combinam com sua rotina.</p>'
  +'<nav class="kaia-seo-category-grid" aria-label="Categorias da Kaia Glow">'+categoryCards+'</nav>'
  +'</div></section>';
 if(!home.includes('id="explore-seo"')){
  const marker='<footer';const idx=home.indexOf(marker);
  if(idx<0)throw Error('Rodapé da vitrine não encontrado; recusa inserir hubs SEO');
  home=home.slice(0,idx)+hub+home.slice(idx);
 }
 await writeFile(homePath,home);
 const publicUrls=['/','/sobre.html','/atendimento.html','/privacidade.html','/como-funciona-privacidade.html','/termos-de-uso.html',...urls];
 const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n'
  +'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  +publicUrls.map(pathname=>'  <url><loc>'+xml(SITE+pathname)+'</loc><lastmod>'+NOW+'</lastmod></url>').join('\n')
  +'\n</urlset>\n';
 await writeFile(path.join(output,'sitemap.xml'),sitemap);
 console.log('SEO Kaia: '+products.length+' páginas individuais, '+byCategory.size+' páginas de coleção, 1 página local, '+publicUrls.length+' URLs canônicas no sitemap.');
 return {products:products.length,collections:byCategory.size,publicUrls:publicUrls.length,preservedOldUrls:products.filter(p=>p.url).length};
}
