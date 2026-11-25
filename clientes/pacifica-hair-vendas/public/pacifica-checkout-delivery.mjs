import {authClient,verifiedUser} from "/pacifica-auth.mjs";
import {cepDigits,formatCep,lookupCep} from "/cep.mjs";
const fields=["full_name","phone","postal_code","street","house_number","complement","neighborhood","city","state"];
const money=c=>(Number(c||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const safe=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let current=null,sequence=0;
function input(name,label,attrs=""){
 const value=current?.address?.[name]||"";
 return '<label>'+label+'<input name="'+name+'" value="'+safe(name==="postal_code"?formatCep(value):value)+'" '+attrs+'></label>';
}
function closeDelivery(){
 sequence++;
 const dialog=document.querySelector("#pacifica-delivery-dialog");
 if(dialog)dialog.remove();
 document.body.classList.remove("p-delivery-active");
 current=null;
}
function draw(){
 const d=document.querySelector("#pacifica-delivery-dialog");if(!d||!current)return;
 const stage=current.stage;
 const subtotal=current.subtotalCents;
 const selected=current.freight;
 const shipping=selected?.cents;
 d.innerHTML='<div class="p-delivery-shell" role="dialog" aria-modal="true" aria-label="Finalização da compra">'+
 '<header class="p-delivery-head"><strong>Pacífica Hair · Finalização</strong><button type="button" data-checkout="close" aria-label="Fechar">×</button></header>'+
 '<nav class="p-delivery-steps" aria-label="Etapas"><span>1 · Sacola</span><strong aria-current="'+(stage==="address"?"step":"false")+'">2 · Entrega</strong><strong aria-current="'+(stage==="payment"?"step":"false")+'">3 · Pagamento</strong></nav>'+
 (stage==="address"?'<div class="p-delivery-scroll"><h2>Endereço de entrega</h2><p>Digite o CEP para completar o endereço. Confirme o número antes de continuar.</p>'+
 '<form id="pacifica-delivery-form" class="p-delivery-form"><div class="p-delivery-fields">'+
 input("full_name","Nome completo",'required autocomplete="name" maxlength="100"')+
 input("phone","Telefone com DDD",'required autocomplete="tel" type="tel" inputmode="tel" maxlength="20"')+
 input("postal_code","CEP",'required autocomplete="postal-code" inputmode="numeric" maxlength="9" placeholder="00000-000"')+
 '<p class="p-cep-message" id="p-checkout-cep-status" role="status" aria-live="polite">Busque seu endereço pelo CEP.</p>'+
 input("street","Rua / Avenida",'required autocomplete="address-line1" maxlength="160"')+
 input("house_number","Número",'required maxlength="30"')+
 input("complement","Complemento (opcional)",'maxlength="100" autocomplete="address-line2"')+
 input("neighborhood","Bairro",'required maxlength="100"')+
 input("city","Cidade",'required autocomplete="address-level2" maxlength="100"')+
 input("state","UF",'required autocomplete="address-level1" maxlength="2"')+
 '</div><div class="p-delivery-freight"><h3>Frete para seu endereço</h3><button type="button" data-checkout="quote">Calcular opções de entrega</button><p id="p-delivery-quote-status" role="status"></p><div id="p-delivery-quote-options" class="p-delivery-quote-options"></div></div>'+
 '<p id="p-checkout-delivery-error" class="p-delivery-error" role="alert"></p>'+
 '<button class="p-delivery-primary" type="submit">Salvar endereço e ir para pagamento →</button></form></div>':
 '<div class="p-delivery-scroll"><h2>Pagamento</h2><p>Seu endereço foi salvo. Confira os valores antes de pagar.</p>'+
 '<div class="p-delivery-summary"><div><span>Produtos</span><strong>'+money(subtotal)+'</strong></div>'+
 '<div><span>Entrega</span><strong>'+(shipping==null?"A confirmar":money(shipping))+'</strong></div>'+
 '<div class="p-delivery-total"><span>Total estimado</span><strong>'+(shipping==null?"A confirmar":money(subtotal+shipping))+'</strong></div></div>'+
 '<h3>Escolha a forma de pagamento</h3><div class="p-delivery-methods"><label><input type="radio" name="payment_preview" checked value="pix"> Pix</label><label><input type="radio" name="payment_preview" value="card"> Cartão</label></div>'+
 '<p class="p-delivery-unavailable">O Mercado Pago ainda não foi ativado para a Pacífica Hair. Nenhum pagamento ou pedido será gerado nesta etapa.</p>'+
 '<button class="p-delivery-primary" type="button" disabled>Pagamento online em configuração</button>'+
 '<button class="p-delivery-secondary" type="button" data-checkout="back">← Alterar endereço</button></div>')+
 '</div>';
 d.querySelector('[data-checkout="close"]').onclick=()=>{const onClose=current?.onClose;closeDelivery();onClose?.()};
 if(stage==="address"){
  d.querySelector("#pacifica-delivery-form").addEventListener("input",addressInput);
  d.querySelector("#pacifica-delivery-form").addEventListener("submit",saveDelivery);
  d.querySelector('[data-checkout="quote"]').onclick=quoteFreight;
 }else d.querySelector('[data-checkout="back"]').onclick=()=>{current.stage="address";draw()};
}
function addressInput(e){
 if(!fields.includes(e.target.name)||!current)return;
 const form=e.currentTarget,key=e.target.name;
 if(key==="postal_code"){
  const cep=cepDigits(e.target.value);
  e.target.value=formatCep(cep);
  if(cepDigits(current.address.postal_code)!==cep){
   sequence++;
   for(const k of ["street","neighborhood","city","state"]){current.address[k]="";form.elements[k].value=""}
   current.freight=null;
   dStatus("p-delivery-quote-status","");
   dStatus("p-checkout-cep-status",cep.length===8?"Buscando endereço…":"Digite os 8 números do CEP.");
  }
  current.address.postal_code=cep;
  if(cep.length===8){const seq=++sequence;void lookupAndFill(cep,seq);}
 }else current.address[key]=e.target.value;
}
function dStatus(id,message){const node=document.getElementById(id);if(node)node.textContent=message}
async function lookupAndFill(cep,seq){
 try{
  const found=await lookupCep(cep);
  if(!current||seq!==sequence||cepDigits(current.address.postal_code)!==cep)return;
  const f=document.querySelector("#pacifica-delivery-form");if(!f)return;
  for(const k of ["street","neighborhood","city","state"]){if(!f.elements[k].value.trim()){f.elements[k].value=found[k]||"";current.address[k]=found[k]||""}}
  dStatus("p-checkout-cep-status","Endereço localizado. Confira os dados e informe o número.");
 }catch(err){if(seq!==sequence)return;dStatus("p-checkout-cep-status",err.message==="not_found"?"CEP não encontrado. Preencha o endereço manualmente.":"Não conseguimos consultar o CEP. Você pode preencher manualmente.")}
}
async function quoteFreight(){
 if(!current)return;
 const cep=cepDigits(current.address.postal_code);
 if(cep.length!==8){dStatus("p-delivery-quote-status","Digite um CEP válido.");return;}
 const btn=document.querySelector('[data-checkout="quote"]');btn.disabled=true;
 dStatus("p-delivery-quote-status","Consultando transportadoras…");
 const box=document.querySelector("#p-delivery-quote-options");box.replaceChildren();
 const seq=++sequence;
 try{
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),20000);
  let response;
  try{response=await fetch("/api/frete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cep,items:current.items}),signal:ctl.signal,cache:"no-store"})}
  finally{clearTimeout(tm)}
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"Frete indisponível.");
  if(seq!==sequence||!current)return;
  if(data.mode!=="production")throw Error("Cotação de teste; indisponível para compra.");
  for(const option of data.options||[]){
   if(!Number.isSafeInteger(option.cents)||option.cents<1)continue;
   const choice=document.createElement("button");choice.type="button";choice.className="p-delivery-shipping";
   choice.textContent=option.name+" · "+money(option.cents)+" · "+option.days+" dias úteis";
   choice.onclick=()=>{if(!current)return;current.freight={...option,cep};box.querySelectorAll("button").forEach(x=>x.classList.toggle("selected",x===choice));dStatus("p-delivery-quote-status","Frete selecionado.")};
   box.append(choice);
  }
  dStatus("p-delivery-quote-status",box.children.length?"Selecione uma das opções. Valores sujeitos à confirmação no pagamento.":"Nenhuma transportadora disponível para este CEP.");
 }catch(err){if(seq===sequence)dStatus("p-delivery-quote-status",err.name==="AbortError"?"Consulta demorou demais. Tente novamente.":err.message)}
 finally{if(btn.isConnected)btn.disabled=false}
}
async function saveDelivery(e){
 e.preventDefault();
 if(!current)return;
 const f=e.currentTarget;
 const values=Object.fromEntries(fields.map(k=>[k,String(f.elements[k].value||"").trim()]));
 values.postal_code=cepDigits(values.postal_code);values.phone=values.phone.replace(/\D/g,"");values.state=values.state.toUpperCase();
 if(!/^\d{8}$/.test(values.postal_code)||!/^\d{10,11}$/.test(values.phone)||!/^[A-Z]{2}$/.test(values.state)||!values.full_name||!values.street||!values.house_number||!values.neighborhood||!values.city){
  dStatus("p-checkout-delivery-error","Confira CEP, telefone com DDD e todos os campos obrigatórios.");return;
 }
 const button=f.querySelector('button[type="submit"]');button.disabled=true;
 try{
  const user=await verifiedUser();if(!user)throw Error("Sua sessão expirou. Entre novamente na sua conta.");
  const sb=authClient(),{error}=await sb.from("pacifica_customer_details").upsert({...values,user_id:user.id},{onConflict:"user_id"});
  if(error)throw Error("Não conseguimos salvar o endereço. Confira os dados e tente novamente.");
  current.address=values;current.stage="payment";if(current.freight?.cep!==values.postal_code)current.freight=null;draw();
 }catch(err){dStatus("p-checkout-delivery-error",err.message||"Não foi possível salvar o endereço.")}
 finally{button.disabled=false}
}
export async function openDelivery({items,subtotalCents,onClose}){
 const user=await verifiedUser();
 if(!user){location.assign("/conta.html?voltar=sacola");return false;}
 const sb=authClient();
 const {data,error}=await sb.from("pacifica_customer_details").select(fields.join(",")).eq("user_id",user.id).maybeSingle();
 if(error)throw Error("Não conseguimos carregar seu endereço. Tente novamente.");
 closeDelivery();
 current={items,subtotalCents,onClose,stage:"address",address:Object.fromEntries(fields.map(k=>[k,data?.[k]||""])),freight:null};
 if(!current.address.full_name)current.address.full_name=user.user_metadata?.pacifica_name||"";
 const layer=document.createElement("div");layer.className="p-delivery-overlay";layer.id="pacifica-delivery-dialog";
 layer.addEventListener("click",e=>{if(e.target===layer){const cb=current?.onClose;closeDelivery();cb?.()}});
 document.body.append(layer);document.body.classList.add("p-delivery-active");draw();
 return true;
}
