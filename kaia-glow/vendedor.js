import {KAIA_AUTH} from './auth-config.js';
const $=id=>document.getElementById(id);
const sb=window.supabase?.createClient(KAIA_AUTH.url,KAIA_AUTH.publishableKey,{
 auth:{storageKey:'kaia-glow-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
});
const formatMoney=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents||0)/100);
const when=date=>{const value=new Date(date);return Number.isFinite(value.getTime())?
 new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Cuiaba'}).format(value):'—'};
const e=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=String(text);return n;};
let currentSeller=null;
function showAuth(msg=''){
 $('sellerLogin').hidden=false;$('sellerDashboard').hidden=true;$('sellerLogout').hidden=true;
 $('sellerAuthStatus').textContent=msg;
}
function showSeller(data){
 currentSeller=data;$('sellerLogin').hidden=true;$('sellerDashboard').hidden=false;$('sellerLogout').hidden=false;
 $('sellerActiveBadge').textContent=data.active?'Vendedor autorizado':'Perfil pausado';
 $('sellerActiveBadge').dataset.active=String(!!data.active);
 $('sellerGreeting').textContent=data.active?
 'Compartilhe seu link para conquistar novas vendas e acompanhar os resultados.':
 'Sua participação está pausada. As vendas anteriores continuam no histórico.';
 $('sellerLink').value=data.link;
 $('sellerCodeLabel').textContent='Seu código: '+data.code+' · Comissão: '+data.commissionPercent+'% nos produtos.';
 $('sellerApproved').textContent=String(data.approvedSales||0);
 $('sellerPending').textContent=String(data.pendingSales||0);
 $('sellerEarned').textContent=formatMoney(data.commissionEarnedCents);
 $('sellerDue').textContent=formatMoney(data.dueCents);
 $('sellerVolume').textContent=formatMoney(data.netSalesCents);
 $('sellerEstimated').textContent=formatMoney(data.commissionPendingCents);
 $('sellerPaid').textContent=formatMoney(data.paidCents);
 $('sellerWhatsApp').disabled=!data.active;
 renderSales(data.sales||[]);
 renderProducts(data);
 const note=$('sellerDashboardStatus');
 note.textContent=data.adjustmentCents>0?
 'Há uma diferença de '+formatMoney(data.adjustmentCents)+' a regularizar após reembolso de venda já repassada. Consulte a Kaia Glow.':
 'Valores de comissão sujeitos à confirmação e às políticas de cancelamento. Os repasses são registrados manualmente pela loja.';
}
function renderSales(rows){
 const root=$('sellerSales');root.replaceChildren();
 if(!Array.isArray(rows)||!rows.length){
  root.append(e('p','seller-subtle','Suas vendas aparecerão aqui após os clientes comprarem usando seu link.'));return;
 }
 const statusText={earned:'Aprovada',pending:'Aguardando',reversed:'Cancelada'};
 for(const r of rows){
  const card=e('article','seller-sale'),left=e('div'),right=e('div','seller-sale-values');
  left.append(e('strong','',r.reference||'Venda Kaia Glow'),
   e('small','',when(r.date)+' · Produtos: '+formatMoney(r.productCents)));
  const badge=e('span','seller-sale-badge',statusText[r.status]||'Em análise');badge.dataset.status=r.status;
  right.append(e('b','',formatMoney(r.commissionCents)),badge);
  card.append(left,right);root.append(card);
 }
}
function productShareLink(p,code){
 // Root shop explicitly supports opening #produto-ID after catalogue sync.
 // A standalone SEO product page might otherwise discard the referral query.
 const address=new URL('https://usekaiaglow.com.br/');
 address.searchParams.set('vendedor',code);
 address.hash='produto-'+String(p.id);
 return address.href;
}
async function renderProducts(seller){
 const root=$('sellerProducts');root.replaceChildren();
 try{await window.kaiaCatalogReady;}catch{}
 const catalog=Array.isArray(window.KAIA_CATALOG)?window.KAIA_CATALOG:[];
 const products=catalog.filter(p=>p.available===true&&p.sku&&
   typeof p.name==='string'&&Number(p.price)>0).slice(0,12);
 if(!products.length){
  root.append(e('p','seller-subtle','O catálogo está sendo atualizado. Você já pode divulgar o link geral da loja.'));return;
 }
 for(const p of products){
  const card=e('article','seller-product');
  const img=e('img');img.src=p.images?.[0]||'assets/kaia-product-photo-pending.svg';
  img.alt=p.name;img.loading='lazy';card.append(img);
  const info=e('div','seller-product-details');
  info.append(e('h3','',p.name),e('strong','',formatMoney(Math.round(p.price*100))));
  const button=e('button','seller-secondary','Copiar link do produto');
  button.type='button';button.disabled=!seller.active;
  button.onclick=async()=>{
   const link=productShareLink(p,seller.code);
   try{await navigator.clipboard.writeText(link);button.textContent='Link copiado ✓';}
   catch{prompt('Copie este link:',link);}
  };
  info.append(button);card.append(info);root.append(card);
 }
}
async function copyLink(){
 if(!currentSeller?.active)return;
 try{await navigator.clipboard.writeText(currentSeller.link);
  $('sellerCopy').textContent='Copiado ✓';
  setTimeout(()=>{$('sellerCopy').textContent='Copiar link'},2200);
 }catch{prompt('Copie seu link:',currentSeller.link);}
}
async function refreshSeller(){
 if(!sb){showAuth('Não foi possível carregar o acesso seguro. Atualize o navegador.');return;}
 const {data:{user},error}=await sb.auth.getUser();
 if(error||!user){showAuth();return;}
 const {data,error:failure}=await sb.rpc('kaia_seller_dashboard');
 if(failure||!data){showAuth(failure?.message?.includes('ACESSO_DE_VENDEDOR')?
   'Seu acesso de vendedor ainda não foi liberado. Solicite autorização à Kaia Glow.':
   'Não foi possível verificar seu acesso de vendedor. Tente novamente.');return;}
 showSeller(data);
}
$('sellerAuthForm').onsubmit=async event=>{
 event.preventDefault();
 const btn=$('sellerLoginButton');btn.disabled=true;
 $('sellerAuthStatus').textContent='Validando sua conta…';
 try{
  const {error}=await sb.auth.signInWithPassword({
   email:$('sellerEmail').value.trim(),password:$('sellerPassword').value});
  if(error)throw error;
  await refreshSeller();
 }catch{
  showAuth('Confira e-mail e senha; o cadastro precisa ter e-mail confirmado e acesso liberado.');
 }finally{btn.disabled=false;}
};
$('sellerLogout').onclick=async()=>{
 await sb?.auth.signOut();currentSeller=null;showAuth('Sessão encerrada.');
 $('sellerPassword').value='';
};
$('sellerRefresh').onclick=refreshSeller;
$('sellerCopy').onclick=copyLink;
$('sellerWhatsApp').onclick=()=>{
 if(!currentSeller?.active)return;
 const message='Oi! Quero compartilhar com você a seleção da Kaia Glow 💗 Confira os produtos pelo meu link: '+currentSeller.link;
 window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
};
refreshSeller().catch(()=>showAuth('Não foi possível consultar o painel. Tente novamente.'));
