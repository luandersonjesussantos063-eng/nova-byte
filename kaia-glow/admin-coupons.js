const $=s=>document.querySelector(s);
const cents=v=>Math.round(Number(v||0)*100);
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let client=null,loaded=[];
const state=(msg,err=false)=>{const n=$('#couponStatus');n.textContent=msg;n.classList.toggle('error',err);};
const priceField=()=>{const percent=$('#couponType').value==='percent';$('#couponValue').max=percent?'100':'100000';$('#couponValue').step=percent?'1':'0.01';};
function render(){
 const root=$('#couponList');root.replaceChildren();$('#couponCount').textContent=loaded.length;
 if(!loaded.length){const p=document.createElement('p');p.textContent='Ainda não há cupons cadastrados.';root.append(p);return;}
 for(const c of loaded){
  const item=document.createElement('article');item.className='coupon-entry';
  const head=document.createElement('div');head.className='head';
  const strong=document.createElement('strong');strong.textContent=c.code;
  const label=document.createElement('span');label.className='status';label.textContent=(c.active?'Ativo':'Pausado')+(c.customer_user_id?' · Exclusivo':' · Público');
  head.append(strong,label);
  const caption=document.createElement('small');caption.textContent=(c.discount_type==='percent'?c.discount_value+'%':money(c.discount_value/100))+' de desconto'+(c.discount_type==='percent'&&c.discount_value===100?' + frete grátis':'')
   +(c.min_order_cents>0?' · pedido acima de '+money(c.min_order_cents/100):'')
   +(c.ends_at?' · até '+c.ends_at.split('-').reverse().join('/'):'');
  const buttons=document.createElement('div');
  const edit=document.createElement('button');edit.type='button';edit.textContent='Editar';edit.disabled=!!c.customer_user_id;edit.title=c.customer_user_id?'Cupons exclusivos são criados na ficha do cliente. Para alterar, exclua e crie outro.':'';edit.onclick=()=>fill(c);
  const del=document.createElement('button');del.type='button';del.textContent='Excluir';del.onclick=()=>remove(c.code);
  buttons.append(edit,del);item.append(head,caption,buttons);root.append(item);
 }
}
function fill(c){
 $('#couponCode').value=c.code;$('#couponType').value=c.discount_type;priceField();
 $('#couponValue').value=c.discount_type==='percent'?c.discount_value:(c.discount_value/100).toFixed(2);
 $('#couponMinimum').value=(c.min_order_cents/100).toFixed(2);
 $('#couponStart').value=c.starts_at||'';$('#couponEnd').value=c.ends_at||'';
 $('#couponActive').checked=c.active;
 $('#couponForm').scrollIntoView({behavior:'smooth',block:'center'});state('Editando '+c.code);
}
async function reload(){
 if(!client)return;
 const {data,error}=await client.from('kaia_admin_coupons').select('*').order('updated_at',{ascending:false});
 if(error){state('Não foi possível carregar os cupons.',true);return;}
 loaded=data||[];render();
}
async function remove(code){
 if(!confirm('Excluir o cupom '+code+'?'))return;
 const {error}=await client.rpc('kaia_admin_delete_coupon',{p_code:code});
 if(error)state('Não foi possível excluir: '+error.message,true);
 else{state('Cupom removido.');await reload();}
}
export async function setupKaiaCoupons(sb){
 client=sb;$('#couponType').onchange=priceField;priceField();
 $('#couponForm').onreset=()=>{setTimeout(priceField,0);state('');};
 $('#couponForm').onsubmit=async e=>{
  e.preventDefault();
  const code=$('#couponCode').value.trim().toUpperCase(),kind=$('#couponType').value;
  const value=kind==='percent'?Number($('#couponValue').value):cents($('#couponValue').value);
  const min=cents($('#couponMinimum').value);
  if(!/^[A-Z0-9_-]{3,24}$/.test(code)||!Number.isSafeInteger(value)||value<1||
   (kind==='percent'&&value>100)||!Number.isSafeInteger(min)||min<0){state('Confira o código e os valores.',true);return;}
  const params={p_code:code,p_discount_type:kind,p_discount_value:value,p_min_order_cents:min,
   p_starts_at:$('#couponStart').value||null,p_ends_at:$('#couponEnd').value||null,p_active:$('#couponActive').checked};
  const btn=$('#saveCouponButton');btn.disabled=true;state('Salvando…');
  try{const {error}=await client.rpc('kaia_admin_upsert_coupon',params);if(error)throw error;
   state('Cupom público salvo. Os cupons exclusivos são criados e enviados na ficha do cliente.');await reload();}
  catch(err){state('Não foi possível salvar: '+(err.message||'erro de permissão'),true);}
  finally{btn.disabled=false;}
 };
 await reload();
}
