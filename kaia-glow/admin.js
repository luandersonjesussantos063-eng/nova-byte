import {KAIA_AUTH} from './auth-config.js';
import {setupKaiaCoupons} from './admin-coupons.js';
import {initKaiaAnalytics,loadKaiaAnalytics} from './admin-analytics.js';
import {initKaiaMarketplaces,loadKaiaMarketplaces} from './admin-marketplaces.js';
import {initKaiaPayments,loadKaiaPayments} from './admin-payments.js';
const $=s=>document.querySelector(s),all=s=>Array.from(document.querySelectorAll(s));
const sb=window.supabase?.createClient(KAIA_AUTH.url,KAIA_AUTH.publishableKey,{auth:{storageKey:'kaia-glow-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const catalog=window.KAIA_CATALOG||[];let edits=new Map(),inventory=new Map(),selected=null,images=[],signedIn=false;
const imagePlaceholder='assets/kaia-product-photo-pending.svg';
const keyOf=p=>p.sku||'legacy:'+p.id;
const cents=v=>Math.round(Number(v||0)*100);
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const status=(id,message,isError=false)=>{const n=$(id);n.textContent=message;n.classList.toggle('error',isError);};
function picture(src,alt){const i=document.createElement('img');i.src=src||'assets/kaia-product-photo-pending.svg';i.alt=alt;i.loading='lazy';return i;}
function productData(p){const e=edits.get(keyOf(p)),stock=inventory.get(p.sku),legacy=!p.sku;return{
 key:keyOf(p),name:e?.name||p.name,brand:e?.brand||p.brand,category:e?.category||p.category,
 description:e?.description??p.description??'',
 price:(e?.price_cents??stock?.sale_price_cents??cents(p.price))/100,
 oldPrice:(e?.old_price_cents??cents(p.oldPrice))/100,
 stock:legacy?null:stock?.available_units??0,
 weight:stock?.weight_grams??null,length:stock?.length_cm??null,
 width:stock?.width_cm??null,height:stock?.height_cm??null,
 visible:e?.visible??true,
 images:e?.images?.length?e.images:p.images,
 legacy,isNew:!!p.isNew,available:legacy?false:(stock?.available_units??0)>0
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
 const requested=location.hash.replace(/^#/,'');
 if(['products','coupons','analytics','marketplaces','payments'].includes(requested))openAdminTab(requested,false);
}
async function loadAdmin(){
 const [products,stock,newProducts]=await Promise.all([
  sb.from('kaia_catalog_overrides').select('*'),
  sb.from('kaia_sale_inventory').select('sku,available_units,sale_price_cents,weight_grams,length_cm,width_cm,height_cm'),
  sb.from('kaia_new_products').select('id,sku,brand,category,created_at')
 ]);
 if(products.error||stock.error||newProducts.error){status('#productStatus','Não foi possível ler o catálogo autorizado. Confira a conexão.',true);return;}
 edits=new Map((products.data||[]).map(x=>[x.product_key,x]));
 inventory=new Map((stock.data||[]).map(x=>[x.sku,x]));
 for(let i=catalog.length-1;i>=0;i--)if(catalog[i].isNew)catalog.splice(i,1);
 for(const row of newProducts.data||[]){
   const edit=edits.get(row.sku);if(!edit)continue;
   catalog.push({id:row.id,sku:row.sku,brand:edit.brand||row.brand,category:edit.category||row.category,
    name:edit.name,description:edit.description,price:edit.price_cents/100,oldPrice:edit.old_price_cents/100,
    images:edit.images?.length?edit.images:[imagePlaceholder],
    url:'https://usekaiaglow.com.br/produtos/novo/'+row.id,
    available:!!edit.available,variants:[{id:Number(row.id),label:'Única',
    price:edit.price_cents/100,available:!!edit.available,sku:row.sku}],isNew:true});
 }
 initKaiaAnalytics(sb);
 initKaiaMarketplaces(sb,{onStockChanged:()=>loadAdmin()});
 initKaiaPayments();
 $('#productCount').textContent=catalog.length;
 renderProductList();await setupKaiaCoupons(sb);
}
function renderProductList(){
 const term=$('#productSearch').value.trim().toLocaleLowerCase('pt-BR');const parent=$('#productList');parent.replaceChildren();
 const matched=catalog.filter(p=>{const d=productData(p);
  return (d.name+' '+d.brand+' '+(p.sku||'')).toLocaleLowerCase('pt-BR').includes(term);
 });
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
 selected=keyOf(p);const d=productData(p);images=[...(d.images||[])].filter(url=>url!==imagePlaceholder);
 $('#productForm').hidden=false;$('#editingProductTitle').textContent=d.name;$('#editingProductSku').textContent=p.sku||'Produto legado · sem SKU comercial';
 $('#editName').value=d.name;$('#editBrand').value=d.brand;$('#editCategory').value=d.category;
 $('#editPrice').value=d.price.toFixed(2);$('#editOldPrice').value=d.oldPrice.toFixed(2);$('#confirmSalePrice').checked=false;
 $('#editStock').value=d.stock??0;$('#stockEditLabel').hidden=d.legacy;$('#editStock').disabled=d.legacy;$('#editStock').required=!d.legacy;
 $('#editDescription').value=d.description;$('#editVisible').checked=d.visible;
 $('#packagingFields').hidden=!d.isNew;
 $('#editWeight').value=d.isNew?(d.weight??''):'';$('#editLength').value=d.isNew?(d.length??''):'';
 $('#editWidth').value=d.isNew?(d.width??''):'';$('#editHeight').value=d.isNew?(d.height??''):'';
 $('#saveProductButton').textContent='Salvar alterações';
 $('#cancelNewProduct').hidden=true;$('#newProductPhotoHint').hidden=!d.isNew;
 $('#uploadStatus').textContent='';$('#productStatus').textContent='';
 renderPhotos();renderProductList();
 if(matchMedia('(max-width:800px)').matches)$('#productForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function startNewProduct(){
 if(!signedIn)return;
 selected='__new__';images=[];
 $('#productForm').hidden=false;$('#editingProductTitle').textContent='Cadastrar novo produto';
 $('#editingProductSku').textContent='SKU automático · criado ao salvar o produto';
 $('#editName').value='';$('#editBrand').value='';$('#editCategory').value='Skincare';
 $('#editPrice').value='';$('#editOldPrice').value='0';$('#confirmSalePrice').checked=false;
 $('#editStock').value='0';$('#stockEditLabel').hidden=false;$('#editStock').disabled=false;$('#editStock').required=true;
 $('#editDescription').value='';$('#editVisible').checked=false;
 $('#packagingFields').hidden=false;
 for(const field of ['editWeight','editLength','editWidth','editHeight'])$('#'+field).value='';
 $('#saveProductButton').textContent='Cadastrar produto';
 $('#cancelNewProduct').hidden=false;$('#newProductPhotoHint').hidden=false;
 $('#uploadStatus').textContent='';$('#productStatus').textContent='';
 renderPhotos();renderProductList();
 $('#productForm').scrollIntoView({behavior:'smooth',block:'start'});
 $('#editName').focus();
}
$('#addProductButton').onclick=startNewProduct;
$('#cancelNewProduct').onclick=()=>{
 selected=null;images=[];$('#productForm').hidden=true;$('#cancelNewProduct').hidden=true;renderProductList();
};

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
 const isCreating=selected==='__new__';
 const product=isCreating?null:catalog.find(p=>keyOf(p)===selected);
 if(!isCreating&&!product)return;
 if(!$('#confirmSalePrice').checked){status('#productStatus','Confirme que verificou o preço de venda atual antes de salvar.',true);return;}
 const price=cents($('#editPrice').value),old=cents($('#editOldPrice').value);
 const stock=isCreating||product.sku?Number($('#editStock').value):null;
 const brand=$('#editBrand').value.trim(),category=$('#editCategory').value;
 if(!Number.isSafeInteger(price)||price<100||!Number.isSafeInteger(old)||old<0
  ||(stock!==null&&(!Number.isSafeInteger(stock)||stock<0||stock>100000))
  ||brand.length<2||!['Skincare','Cabelos','Corpo e spa'].includes(category)){
  status('#productStatus','Confira nome, marca, categoria, preços e estoque.',true);return;
 }
 const photos=images.filter(url=>url!==imagePlaceholder);
 if(photos.length>10){status('#productStatus','Máximo de 10 fotos.',true);return;}
 if((isCreating||product.isNew)&&$('#editVisible').checked&&!photos.length){
  status('#productStatus','Adicione pelo menos uma foto antes de publicar. Ou salve como rascunho.',true);return;
 }
 const measure=id=>{const value=$('#'+id).value.trim();return value===''?null:Number(value);};
 const weights={
  p_weight_grams:(isCreating||product.isNew)?measure('editWeight'):null,
  p_length_cm:(isCreating||product.isNew)?measure('editLength'):null,
  p_width_cm:(isCreating||product.isNew)?measure('editWidth'):null,
  p_height_cm:(isCreating||product.isNew)?measure('editHeight'):null
 };
 if(weights.p_weight_grams!==null&&(!Number.isSafeInteger(weights.p_weight_grams)||weights.p_weight_grams<1)
  ||[weights.p_length_cm,weights.p_width_cm,weights.p_height_cm].some(v=>v!==null&&(!Number.isFinite(v)||v<=0))){
  status('#productStatus','Confira o peso e as medidas da embalagem.',true);return;
 }
 const common={p_name:$('#editName').value.trim(),p_brand:brand,p_category:category,
  p_description:$('#editDescription').value,p_price_cents:price,p_old_price_cents:old,
  p_images:photos,p_visible:$('#editVisible').checked,...weights};
 const btn=$('#saveProductButton');btn.disabled=true;status('#productStatus',isCreating?'Cadastrando novo produto…':'Salvando alterações…');
 try{
  const params=isCreating?{...common,p_stock_units:stock}:{...common,p_product_key:selected,p_stock_units:stock};
  const {data,error}=await sb.rpc(isCreating?'kaia_admin_create_product':'kaia_admin_save_product_v2',params);
  if(error)throw error;
  if(isCreating){
   if(!data?.created||!data?.sku||!data?.id)throw Error('O cadastro não retornou o identificador do produto.');
   const fresh={id:String(data.id),sku:data.sku,brand,category,
    name:common.p_name,description:common.p_description,price:price/100,
    oldPrice:old/100,images:photos.length?photos:[imagePlaceholder],
    available:stock>0,variants:[{id:Number(data.id),label:'Única',price:price/100,
    available:stock>0,sku:data.sku}],isNew:true,
    url:'https://usekaiaglow.com.br/produtos/novo/'+data.id};
   catalog.push(fresh);
   selected=data.sku;
  }
  const saveKey=selected;
  edits.set(saveKey,{product_key:saveKey,name:common.p_name,brand,category,
   description:common.p_description,price_cents:price,
   old_price_cents:old,images:photos,visible:common.p_visible,available:stock!==null&&stock>0});
  if(stock!==null)inventory.set(saveKey,{sku:saveKey,sale_price_cents:price,
   available_units:stock,weight_grams:weights.p_weight_grams,
   length_cm:weights.p_length_cm,width_cm:weights.p_width_cm,height_cm:weights.p_height_cm});
  if(isCreating){
   $('#productCount').textContent=catalog.length;
   const added=catalog.find(p=>p.sku===saveKey);if(added)selectProduct(added);
   status('#productStatus',common.p_visible?
    'Produto cadastrado e publicado! Abra a loja para conferir.':
    'Produto cadastrado como rascunho. Ative “Exibir na vitrine” e salve quando quiser publicar.');
  }else{
   status('#productStatus','Alterações salvas. Atualize a vitrine para conferir.');
  }
  renderProductList();
 }catch(err){status('#productStatus','Não foi possível salvar: '+(err.message||'verifique a autorização.'),true);}
 finally{btn.disabled=false;}
};
function openAdminTab(current,updateHash=true){
 if(!['products','coupons','analytics','marketplaces','payments'].includes(current))return;
 const selected=all('[data-tab]').find(button=>button.dataset.tab===current);
 all('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===current)));
 $('#productsTab').hidden=current!=='products';$('#couponsTab').hidden=current!=='coupons';
 $('#analyticsTab').hidden=current!=='analytics';if(current==='analytics')loadKaiaAnalytics();
 $('#marketplacesTab').hidden=current!=='marketplaces';if(current==='marketplaces')loadKaiaMarketplaces();
 $('#paymentsTab').hidden=current!=='payments';if(current==='payments')loadKaiaPayments();
 if(updateHash)history.replaceState(null,'',location.pathname+location.search+'#'+current);
 selected?.scrollIntoView({block:'nearest',inline:'nearest'});
}
all('[data-tab]').forEach(button=>button.onclick=()=>openAdminTab(button.dataset.tab));
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
