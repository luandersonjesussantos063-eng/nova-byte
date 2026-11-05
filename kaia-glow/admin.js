import {KAIA_AUTH} from './auth-config.js';
import {setupKaiaCoupons} from './admin-coupons.js';
import {initKaiaAnalytics,loadKaiaAnalytics} from './admin-analytics.js';
const $=s=>document.querySelector(s),all=s=>Array.from(document.querySelectorAll(s));
const sb=window.supabase?.createClient(KAIA_AUTH.url,KAIA_AUTH.publishableKey,{auth:{storageKey:'kaia-glow-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const catalog=window.KAIA_CATALOG||[];let edits=new Map(),inventory=new Map(),selected=null,images=[],signedIn=false;
const keyOf=p=>p.sku||'legacy:'+p.id;
const cents=v=>Math.round(Number(v||0)*100);
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const status=(id,message,isError=false)=>{const n=$(id);n.textContent=message;n.classList.toggle('error',isError);};
function picture(src,alt){const i=document.createElement('img');i.src=src||'assets/kaia-product-photo-pending.svg';i.alt=alt;i.loading='lazy';return i;}
function productData(p){const e=edits.get(keyOf(p)),stock=inventory.get(p.sku),legacy=!p.sku;return{
 key:keyOf(p),name:e?.name||p.name,description:e?.description??p.description??'',
 price:(e?.price_cents??stock?.sale_price_cents??cents(p.price))/100,
 oldPrice:(e?.old_price_cents??cents(p.oldPrice))/100,
 stock:legacy?null:stock?.available_units??0,
 visible:e?.visible??true,
 images:e?.images?.length?e.images:p.images,
 legacy,available:legacy?false:(stock?.available_units??0)>0
};}
function setSignedIn(ok,email=''){
 signedIn=ok;$('#loginPanel').hidden=ok;$('#adminPanel').hidden=!ok;$('#logoutButton').hidden=!ok;
 if(ok)$('#adminIdentity').textContent=email;
}
async function authorize(){
 if(!sb){status('#loginStatus','A biblioteca de acesso não carregou. Atualize a página.',true);return;}
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user){setSignedIn(false);return;}
 const result=await sb.rpc('kaia_is_store_admin');
 if(result.error||result.data!==true){setSignedIn(false);status('#loginStatus','Esta conta ainda não tem autorização administrativa. O e-mail precisa estar confirmado e aprovado.',true);return;}
 setSignedIn(true,user.email);await loadAdmin();
}
async function loadAdmin(){
 const [products,stock]=await Promise.all([
  sb.from('kaia_catalog_overrides').select('*'),
  sb.from('kaia_sale_inventory').select('sku,available_units,sale_price_cents')
 ]);
 if(products.error||stock.error){status('#productStatus','Não foi possível ler o catálogo autorizado. Confira a conexão.',true);return;}
 edits=new Map((products.data||[]).map(x=>[x.product_key,x]));
 inventory=new Map((stock.data||[]).map(x=>[x.sku,x]));
 initKaiaAnalytics(sb);
 $('#productCount').textContent=catalog.length;
 renderProductList();await setupKaiaCoupons(sb);
}
function renderProductList(){
 const term=$('#productSearch').value.trim().toLocaleLowerCase('pt-BR');const parent=$('#productList');parent.replaceChildren();
 const matched=catalog.filter(p=>(p.name+' '+p.brand+' '+(p.sku||'')).toLocaleLowerCase('pt-BR').includes(term));
 for(const p of matched){
  const d=productData(p),btn=document.createElement('button');btn.type='button';btn.className='product-option'+(selected===d.key?' active':'');
  btn.append(picture(d.images?.[0],p.name));
  const info=document.createElement('span'),name=document.createElement('strong'),small=document.createElement('small');
  name.textContent=d.name;small.textContent=money(d.price)+(d.legacy?' · legado':' · '+d.stock+' un.');
  info.append(name,small);if(!d.visible){const hidden=document.createElement('small');hidden.textContent='Oculto da loja';info.append(hidden);}
  btn.append(info);btn.onclick=()=>selectProduct(p);parent.append(btn);
 }
 if(!matched.length){const msg=document.createElement('p');msg.textContent='Nenhum produto encontrado.';parent.append(msg);}
}
function renderPhotos(){
 const list=$('#photoList');list.replaceChildren();
 images.forEach((url,index)=>{
  const tile=document.createElement('div');tile.className='photo-tile';tile.append(picture(url,'Foto '+(index+1)));
  if(index===0){const badge=document.createElement('span');badge.className='photo-cover';badge.textContent='Capa';tile.append(badge);}
  const actions=document.createElement('div');actions.className='photo-tile-controls';
  for(const [symbol,action,disabled] of [['←',()=>movePhoto(index,-1),index===0],['→',()=>movePhoto(index,1),index===images.length-1],['×',()=>{images.splice(index,1);renderPhotos();},false]]){
   const btn=document.createElement('button');btn.type='button';btn.textContent=symbol;btn.disabled=disabled;btn.setAttribute('aria-label',symbol==='×'?'Remover foto':symbol==='←'?'Mover à esquerda':'Mover à direita');btn.onclick=action;actions.append(btn);
  }
  tile.append(actions);list.append(tile);
 });
 if(!images.length){const msg=document.createElement('p');msg.textContent='Sem fotos. Adicione uma imagem abaixo.';list.append(msg);}
}
function movePhoto(pos,step){const next=pos+step;if(next<0||next>=images.length)return;[images[pos],images[next]]=[images[next],images[pos]];renderPhotos();}
function selectProduct(p){
 selected=keyOf(p);const d=productData(p);images=[...(d.images||[])];
 $('#productForm').hidden=false;$('#editingProductTitle').textContent=d.name;$('#editingProductSku').textContent=p.sku||'Produto legado · sem SKU comercial';
 $('#editName').value=d.name;$('#editPrice').value=d.price.toFixed(2);$('#editOldPrice').value=d.oldPrice.toFixed(2);
 $('#editStock').value=d.stock??0;$('#stockEditLabel').hidden=d.legacy;$('#editStock').disabled=d.legacy;$('#editStock').required=!d.legacy;
 $('#editDescription').value=d.description;$('#editVisible').checked=d.visible;
 $('#uploadStatus').textContent='';$('#productStatus').textContent='';
 renderPhotos();renderProductList();
 if(matchMedia('(max-width:800px)').matches)$('#productForm').scrollIntoView({behavior:'smooth',block:'start'});
}
$('#productSearch').oninput=renderProductList;
$('#reloadButton').onclick=()=>{if(signedIn)loadAdmin();};
$('#editUpload').onchange=async e=>{
 const files=[...(e.target.files||[])];e.target.value='';
 if(!selected||!signedIn)return;
 for(const file of files){
  if(images.length>=10){status('#uploadStatus','Limite de 10 fotos por produto.',true);break;}
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  if(!ext||file.size>5242880){status('#uploadStatus','Envie JPG, PNG ou WebP com até 5 MB.',true);continue;}
  status('#uploadStatus','Enviando '+file.name+'…');
  const path='products/'+crypto.randomUUID()+'.'+ext;
  const {error}=await sb.storage.from('kaia-product-media').upload(path,file,{cacheControl:'31536000',contentType:file.type,upsert:false});
  if(error){status('#uploadStatus','Não foi possível enviar esta foto. Verifique o acesso autorizado.',true);continue;}
  const {data}=sb.storage.from('kaia-product-media').getPublicUrl(path);
  images.push(data.publicUrl);renderPhotos();status('#uploadStatus','Foto enviada. Clique em Salvar alterações para publicar.');
 }
};
$('#productForm').onsubmit=async e=>{
 e.preventDefault();if(!selected||!signedIn)return;
 const product=catalog.find(p=>keyOf(p)===selected);if(!product)return;
 const price=cents($('#editPrice').value),old=cents($('#editOldPrice').value);
 const stock=product.sku?Number($('#editStock').value):null;
 if(!Number.isSafeInteger(price)||price<100||!Number.isSafeInteger(old)||old<0
  ||(stock!==null&&(!Number.isSafeInteger(stock)||stock<0))){status('#productStatus','Confira preço e estoque.',true);return;}
 if(images.length>10){status('#productStatus','Máximo de 10 fotos.',true);return;}
 const params={p_product_key:selected,p_name:$('#editName').value.trim(),p_description:$('#editDescription').value,
  p_price_cents:price,p_old_price_cents:old,
  p_images:images.filter(u=>!u.endsWith('kaia-product-photo-pending.svg')),
  p_visible:$('#editVisible').checked,p_stock_units:stock};
 const btn=$('#saveProductButton');btn.disabled=true;status('#productStatus','Salvando alterações…');
 try{
  const {error}=await sb.rpc('kaia_admin_save_product',params);
  if(error)throw error;
  edits.set(selected,{product_key:selected,name:params.p_name,description:params.p_description,price_cents:price,
   old_price_cents:old,images:params.p_images,visible:params.p_visible,available:stock!==null&&stock>0});
  if(product.sku)inventory.set(product.sku,{sku:product.sku,sale_price_cents:price,available_units:stock});
  status('#productStatus','Alterações salvas. Atualize a vitrine para conferir.');
  renderProductList();
 }catch(err){status('#productStatus','Não foi possível salvar: '+(err.message||'verifique a autorização.'),true);}
 finally{btn.disabled=false;}
};
all('[data-tab]').forEach(button=>button.onclick=()=>{
 const current=button.dataset.tab;
 all('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===current)));
 $('#productsTab').hidden=current!=='products';$('#couponsTab').hidden=current!=='coupons';
 $('#analyticsTab').hidden=current!=='analytics';if(current==='analytics')loadKaiaAnalytics();
});
$('#logoutButton').onclick=async()=>{await sb?.auth.signOut();setSignedIn(false);$('#adminPassword').value='';status('#loginStatus','Sessão encerrada.');};
$('#loginForm').onsubmit=async e=>{
 e.preventDefault();const btn=$('#loginForm button');btn.disabled=true;status('#loginStatus','Verificando acesso…');
 try{
  if(!sb)throw Error('Biblioteca de autenticação indisponível.');
  const {error}=await sb.auth.signInWithPassword({email:$('#adminEmail').value.trim(),password:$('#adminPassword').value});
  if(error)throw error;
  await authorize();
 }catch{status('#loginStatus','Não foi possível entrar. Confira as credenciais, a confirmação do e-mail e a autorização.',true);}
 finally{btn.disabled=false;}
};
authorize().catch(()=>{setSignedIn(false);status('#loginStatus','Não foi possível verificar o acesso no momento.',true);});
