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
 let saved=null,confirmed=null,signature=()=>'',onChange=()=>{},onConfirmed=()=>{},onEditing=()=>{},serial=0,loading=false,edited=false,mountGeneration=0,postalReference=null,lastPostal='',lookupActive=null,lookupCEP='';
 const dirtyFields=new Set();
 const pendingInput=()=>keys.some(k=>$(ids[k])?.value.trim());
 const getPostal=()=>onlyDigits($('shippingPostalCode')?.value);
 const formData=()=>Object.fromEntries(keys.map(k=>[k,$(ids[k])?.value.trim()||'']));
 const stamp=()=>JSON.stringify({postal:getPostal(),...formData(),cart:signature()});
 const status=text=>{if($('kgAddressStatus'))$('kgAddressStatus').textContent=text;};
 function recalc(){
  const ready=isConfirmed();
  const payment=document.querySelector('.kc-payment-section');
  if(payment)payment.hidden=!ready;
  const form=$('kgAddressForm'),summary=$('kgAddressSummary'),cepForm=$('shippingQuoteForm');
  if(form)form.hidden=ready;
  if(summary)summary.hidden=!ready;
  if(cepForm)cepForm.hidden=ready;
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
  // Do not launch duplicate requests when account data finishes loading later.
  if(lookupActive&&lookupCEP===cep)return lookupActive;
  lookupCEP=cep;
  const request=(async()=>{
   status('Buscando endereço pelo CEP…');
   const providers=[
    {url:'https://viacep.com.br/ws/'+cep+'/json/',convert:v=>({
     street:v.logradouro||'',neighborhood:v.bairro||'',city:v.localidade||'',state:v.uf||'',notFound:!!v.erro
    })},
    {url:'https://brasilapi.com.br/api/cep/v2/'+cep,convert:v=>({
     street:v.street||'',neighborhood:v.neighborhood||'',city:v.city||'',state:v.state||'',notFound:false
    })}
   ];
   for(const provider of providers){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),6500);
    try{
     const response=await fetch(provider.url,{signal:controller.signal,headers:{Accept:'application/json'}});
     if(!response.ok)throw Error('Serviço de CEP indisponível');
     const value=provider.convert(await response.json());
     if(value.notFound||!value.city||!value.state)throw Error('CEP não localizado');
     if(version!==serial||cep!==getPostal()||!$('kgAddressForm'))return;
     postalReference={postal:cep,city:String(value.city).trim(),state:String(value.state).trim()};
     // The CEP is authoritative for locality. Never overwrite manually edited fields.
     for(const key of ['street','neighborhood','city','state']){
      const input=$(ids[key]);
      if(input&&value[key]&&!dirtyFields.has(key))input.value=String(value[key]).trim();
     }
     status(value.street&&value.neighborhood
      ?'Endereço encontrado. Confira o número e o complemento, se houver.'
      :'CEP localizado. Confira e complete rua e bairro, além do número.');
     recalc();
     return;
    }catch(error){
     // A second provider is tried, without changing fields the client typed.
    }finally{clearTimeout(timer)}
   }
   if(version===serial&&cep===getPostal()&&$('kgAddressForm'))
    status('Não conseguimos consultar esse CEP agora. Confira e preencha o endereço manualmente.');
  })();
  lookupActive=request;
  try{return await request}finally{
   if(lookupActive===request){lookupActive=null;lookupCEP='';}
  }
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
  const cep=getPostal();
  if(cep===lastPostal)return;
  const previous=lastPostal;lastPostal=cep;
  const version=++serial;
  confirmed=null;postalReference=null;
  if(!$('kgDeliveryAddressMount'))return;
  if(cep.length!==8){
   if(previous.length===8){dirtyFields.clear();edited=false;fill(null);}
   invalidate('Informe os 8 números do CEP para preencher seu endereço.');
   return;
  }
  dirtyFields.clear();edited=false;fill(null);
  if(saved&&cep===onlyDigits(saved.postal_code)){
   fill(saved,{emptyOnly:true});
   invalidate('Endereço cadastrado carregado. Conferindo os dados pelo CEP…');
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
  if(postalReference&&postalReference.postal===cep&&
   ((postalReference.city&&postalReference.city.toLocaleLowerCase('pt-BR')!==data.city.toLocaleLowerCase('pt-BR'))||
    (postalReference.state&&postalReference.state!==data.state))){
   invalidate('A cidade ou UF não corresponde ao CEP consultado. Confira o endereço antes de continuar.');return;
  }
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
   const formattedCep=cep.slice(0,5)+'-'+cep.slice(5);
   const summary=$('kgAddressSummaryText');
   if(summary)summary.textContent=data.street+', '+data.street_number+
    (data.complement?', '+data.complement:'')+' · '+data.neighborhood+
    ' · '+data.city+'/'+data.state+' · CEP '+formattedCep;
   status('Endereço confirmado e salvo! Escolha o frete para continuar.');
   recalc();
   onConfirmed();
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
  lastPostal=getPostal();dirtyFields.clear();lookupActive=null;lookupCEP='';
  confirmed=null;postalReference=null;edited=!!existingDraft&&Object.values(existingDraft).some(v=>v);
  loading=false;
  signature=options.cartSignature||(()=> '');
  onChange=options.onChange||(()=>{});
  onConfirmed=options.onConfirmed||(()=>{});
  onEditing=options.onEditing||(()=>{});
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
   </form>
   <section class="kg-address-summary" id="kgAddressSummary" aria-label="Endereço de entrega confirmado" hidden>
    <div class="kg-address-summary-details">
     <strong>✓ Endereço confirmado</strong>
     <p id="kgAddressSummaryText"></p>
    </div>
    <button type="button" id="kgAddressEdit">Alterar endereço</button>
   </section>`;
  if(existingDraft&&previousPostal===getPostal())fill(existingDraft);
  $('kgAddressForm').addEventListener('submit',confirm);
  $('kgAddressEdit').addEventListener('click',()=>{
   confirmed=null;
   status('Confira ou altere os dados e confirme o endereço novamente.');
   recalc();
   onEditing();
   $('kgAddressForm')?.scrollIntoView?.({block:'start',behavior:'smooth'});
   $('kgAddressNumber')?.focus?.({preventScroll:true});
  });
  $('kgAddressForm').querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{
   edited=true;
   const key=keys.find(k=>ids[k]===input.id);
   if(key)dirtyFields.add(key);
   invalidate();
  }));
  recalc();
  load();
 }
 window.kaiaDeliveryAddress={mount,postalChanged,isConfirmed,reset(){
  serial++;mountGeneration++;confirmed=null;saved=null;edited=false;postalReference=null;
  dirtyFields.clear();lastPostal='';lookupActive=null;lookupCEP='';recalc();
 }};
})();
