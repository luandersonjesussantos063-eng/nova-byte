/* Kaia Glow — confirmação do endereço na sacola.
 * Nunca altera o endereço de outros usuários; grava via RPC autenticada existente.
 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const keys=['street','street_number','complement','neighborhood','city','state'];
 const ids={street:'kgAddressStreet',street_number:'kgAddressNumber',complement:'kgAddressComplement',
  neighborhood:'kgAddressNeighborhood',city:'kgAddressCity',state:'kgAddressState'};
 const onlyDigits=v=>String(v||'').replace(/\D/g,'');
 let saved=null,confirmed=null,signature=()=>'',onChange=()=>{},serial=0,loading=false,edited=false,mountGeneration=0;
 const pendingInput=()=>keys.some(k=>$(ids[k])?.value.trim());
 const getPostal=()=>onlyDigits($('shippingPostalCode')?.value);
 const formData=()=>Object.fromEntries(keys.map(k=>[k,$(ids[k])?.value.trim()||'']));
 const stamp=()=>JSON.stringify({postal:getPostal(),...formData(),cart:signature()});
 const status=text=>{if($('kgAddressStatus'))$('kgAddressStatus').textContent=text;};
 function recalc(){
  const payment=document.querySelector('.kc-payment-section');
  if(payment)payment.hidden=!isConfirmed();
  onChange();
 }
 function isConfirmed(){return !!confirmed&&confirmed===stamp();}
 function invalidate(text='Confira o endereço e clique em Confirmar endereço.'){
  confirmed=null;status(text);recalc();
 }
 function fill(info,{emptyOnly=false}={}){
  for(const k of keys){
   const input=$(ids[k]);if(!input)continue;
   if(emptyOnly&&input.value.trim())continue;
   input.value=String(info?.[k]||'');
  }
 }
 async function client(){
  const {KAIA_AUTH}=await import('./auth-config.js');
  if(!window.supabase)throw Error('O serviço de login está indisponível.');
  return window.supabase.createClient(KAIA_AUTH.url,KAIA_AUTH.publishableKey,
   {auth:{storageKey:'kaia-glow-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 }
 async function lookup(cep,version){
  if(!/^[0-9]{8}$/.test(cep))return;
  status('Buscando endereço pelo CEP…');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
   const r=await fetch('https://viacep.com.br/ws/'+cep+'/json/',{signal:controller.signal});
   const v=await r.json();
   if(!r.ok||v.erro)throw Error('CEP não encontrado');
   if(version!==serial||cep!==getPostal())return;
   const data={street:v.logradouro||'',street_number:'',complement:'',
    neighborhood:v.bairro||'',city:v.localidade||'',state:v.uf||''};
   fill(data,{emptyOnly:true});
   status('Confira os dados do CEP e o número do imóvel antes de confirmar.');
  }catch{
   if(version===serial&&cep===getPostal())status('Não conseguimos completar o CEP automaticamente. Preencha o endereço manualmente.');
  }finally{clearTimeout(timer);}
 }
 async function load(){
  const version=serial,generation=mountGeneration;
  if(!$('kgDeliveryAddressMount')||loading)return;
  loading=true;
  if(!edited&&!pendingInput())status('Carregando o endereço da sua conta…');
  try{
   const sb=await client();
   const {data:auth,error:authError}=await sb.auth.getUser();
   if(authError||!auth?.user)throw Error('Faça login para confirmar o endereço de entrega.');
   const {data:details,error}=await sb.from('kaia_customer_details')
    .select('cpf,birth_date,phone,postal_code,street,street_number,complement,neighborhood,city,state')
    .eq('user_id',auth.user.id).maybeSingle();
   if(error||!details)throw Error('Complete seu cadastro em Minha conta para continuar.');
   if(generation!==mountGeneration||!$('kgDeliveryAddressMount'))return;
   saved=details;
   const cep=getPostal();
   if(cep&&cep!==onlyDigits(details.postal_code)){
    if(!edited&&!pendingInput())fill(null);
    await lookup(cep,serial);
   }else{
    fill(details,{emptyOnly:true});
    if(!edited)status('Endereço cadastrado carregado. Confira os dados antes de confirmar.');
    if(cep.length===8)lookup(cep,serial);
   }
   recalc();
  }catch(e){
   if(version===serial){status(e.message);recalc();}
  }finally{loading=false;}
 }
 function postalChanged(){
  const version=++serial,cep=getPostal();
  confirmed=null;
  if(!$('kgDeliveryAddressMount'))return;
  if(cep.length!==8){edited=false;fill(null);invalidate('Informe os 8 números do CEP para preencher seu endereço.');return;}
  edited=false;fill(null);
  if(saved&&cep===onlyDigits(saved.postal_code)){
   fill(saved,{emptyOnly:true});
   invalidate('Endereço do cadastro recuperado. Confira número e complemento.');
  }else invalidate('Consultando CEP…');
  lookup(cep,version);
 }
 async function confirm(event){
  event.preventDefault();
  const button=$('kgAddressConfirm');
  const cep=getPostal(),data=formData();
  data.state=data.state.toUpperCase();
  if($(ids.state))$(ids.state).value=data.state;
  if(!/^[0-9]{8}$/.test(cep)||data.street.length<2||data.street.length>200||
    !data.street_number||data.street_number.length>20||data.complement.length>100||
    data.neighborhood.length<2||data.neighborhood.length>100||data.city.length<2||
    data.city.length>100||!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(data.state)){
   invalidate('Confira CEP, rua, número, bairro, cidade e UF. Complemento é opcional.');return;
  }
  if(!saved){invalidate('Complete seu cadastro em Minha conta antes de confirmar.');return;}
  const original=stamp();
  button.disabled=true;status('Salvando endereço de entrega…');
  try{
   const sb=await client();
   const {data:auth,error:authError}=await sb.auth.getUser();
   if(authError||!auth?.user)throw Error('Sua sessão expirou. Faça login novamente.');
   const {data:customer,error:customerError}=await sb.from('kaia_customers')
    .select('full_name').eq('user_id',auth.user.id).maybeSingle();
   if(customerError||!customer?.full_name)throw Error('Seu cadastro não foi encontrado.');
   const payload={...saved,...data,postal_code:cep,full_name:customer.full_name};
   const {error}=await sb.rpc('kaia_save_customer_details',{details:payload});
   if(error)throw Error('Não conseguimos salvar o endereço. Confira os campos e tente novamente.');
   saved={...saved,...data,postal_code:cep};
   if(original!==stamp())throw Error('O endereço mudou durante a confirmação. Confira e confirme novamente.');
   confirmed=stamp();
   status('Endereço confirmado e salvo! Escolha o frete para continuar.');
   recalc();
  }catch(e){invalidate(e.message);}
  finally{if(document.contains(button))button.disabled=false;}
 }
 function mount(options={}){
  const root=$('kgDeliveryAddressMount');
  if(!root)return;
  const previous=$('kgAddressForm');
  const existingDraft=previous?formData():null;
  const previousPostal=getPostal();
  mountGeneration++;serial++;
  confirmed=null;edited=!!existingDraft&&Object.values(existingDraft).some(v=>v);
  loading=false;
  signature=options.cartSignature||(()=> '');
  onChange=options.onChange||(()=>{});
  root.innerHTML=`<form id="kgAddressForm" class="kg-address-form">
   <h4>Confirme seu endereço de entrega</h4>
   <p>O CEP preenche os dados disponíveis. Confira e complete antes do pagamento.</p>
   <div class="kg-address-grid">
    <label class="kg-address-wide">Rua ou avenida<input id="kgAddressStreet" autocomplete="shipping street-address" maxlength="200" required></label>
    <label>Número<input id="kgAddressNumber" maxlength="20" placeholder="Ex.: 125 ou S/N" required></label>
    <label>Complemento (opcional)<input id="kgAddressComplement" maxlength="100" placeholder="Apartamento, bloco…"></label>
    <label class="kg-address-wide">Bairro<input id="kgAddressNeighborhood" maxlength="100" required></label>
    <label>Cidade<input id="kgAddressCity" maxlength="100" required></label>
    <label>UF<input id="kgAddressState" maxlength="2" placeholder="SP" required></label>
   </div>
   <p class="kg-address-status" id="kgAddressStatus" role="status" aria-live="polite"></p>
   <button type="submit" id="kgAddressConfirm" class="button">Confirmar endereço</button>
   </form>`;
  if(existingDraft&&previousPostal===getPostal())fill(existingDraft);
  $('kgAddressForm').addEventListener('submit',confirm);
  $('kgAddressForm').querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{
   edited=true;invalidate();
  }));
  recalc();
  load();
 }
 window.kaiaDeliveryAddress={mount,postalChanged,isConfirmed,reset(){
  serial++;mountGeneration++;confirmed=null;saved=null;edited=false;recalc();
 }};
})();
