export const cepDigits=s=>String(s??"").replace(/\D/g,"").slice(0,8);
export const formatCep=s=>{const c=cepDigits(s);return c.length>5?c.slice(0,5)+"-"+c.slice(5):c};
export const itemKey=items=>JSON.stringify(items.map(x=>[x.id,x.qty]).sort((a,b)=>a[0].localeCompare(b[0])));
export function validSelection(selection,items,cep){
 return !!selection&&selection.mode==="production"&&Number.isFinite(selection.expiresAt)&&selection.expiresAt>Date.now()&&selection.key===itemKey(items)&&selection.cep===cepDigits(cep)&&Number.isSafeInteger(selection.cents)&&selection.cents>0&&["1","2"].includes(selection.id);
}
export function normalizeOptions(raw){
 return (Array.isArray(raw)?raw:[]).filter(x=>["1","2"].includes(x?.id)&&Number.isSafeInteger(x.cents)&&x.cents>0&&Number.isInteger(x.days)&&x.days>=0).sort((a,b)=>a.cents-b.cents||a.days-b.days);
}
export async function requestQuote(cep,items,fetcher=globalThis.fetch){
 if(!/^\d{8}$/.test(cep))throw Error("Informe os oito números do CEP.");
 const r=await fetcher("/api/frete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cep,items}),signal:AbortSignal.timeout(20000),cache:"no-store"});
 const data=await r.json();if(!r.ok)throw Error(data.error||"Não foi possível calcular o frete.");
 const options=normalizeOptions(data.options);if(!options.length||data.cep!==cep||!["production","sandbox"].includes(data.mode)||!Number.isFinite(data.expiresAt))throw Error("Cotação indisponível.");
 return {...data,options};
}
export function mountFreight({money,getItems,onSelect,getCep}){
 const dialog=document.createElement("dialog");dialog.className="p-freight-dialog";dialog.setAttribute("aria-labelledby","p-freight-title");dialog.innerHTML='<button class="p-freight-close" type="button" aria-label="Fechar">×</button><h2 id="p-freight-title">Calcular frete</h2><p class="p-freight-desc">Consulte as opções e os prazos antes de finalizar.</p><form><label>CEP de entrega<input name="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000" required pattern="[0-9]{5}-?[0-9]{3}"></label><button type="submit" class="primary">Calcular</button></form><p class="p-freight-status" role="status" aria-live="polite"></p><div class="p-freight-options"></div><p class="p-freight-note">Valores e prazos estimados pela SuperFrete. Sujeitos à confirmação no fechamento.</p>';
 document.body.append(dialog);
 const form=dialog.querySelector("form"),input=form.elements.cep,status=dialog.querySelector(".p-freight-status"),box=dialog.querySelector(".p-freight-options"),submit=form.querySelector("button");
 let context="cart",items=[],sequence=0,boundCep="";
 dialog.querySelector(".p-freight-close").onclick=()=>dialog.close();
 dialog.addEventListener("close",()=>{sequence++;submit.disabled=false;});
 input.addEventListener("input",()=>{input.value=formatCep(input.value);sequence++;submit.disabled=false;box.replaceChildren();status.textContent=""});
 form.onsubmit=async e=>{e.preventDefault();const seq=++sequence,cep=cepDigits(input.value);box.replaceChildren();submit.disabled=true;status.textContent="Consultando a SuperFrete…";try{
  const q=await requestQuote(cep,items);if(seq!==sequence||!dialog.open)return;
  status.textContent=(q.mode==="sandbox"?"Simulação de homologação — valores não comerciais. ":"")+"Opções para "+formatCep(cep);
  const minPrice=Math.min(...q.options.map(x=>x.cents)),minDays=Math.min(...q.options.map(x=>x.days));
  for(const option of q.options){const b=document.createElement(context==="cart"&&q.mode==="production"?"button":"article");if(b.tagName==="BUTTON")b.type="button";b.className="p-freight-option";const title=document.createElement("strong");title.textContent=option.carrier+" · "+option.name;const price=document.createElement("strong");price.textContent=money(option.cents);const note=document.createElement("small");note.textContent=option.days+" dias úteis"+(option.cents===minPrice?" · Menor preço":"")+(option.days===minDays?" · Mais rápido":"");b.append(title,price,note);if(b.tagName==="BUTTON"){const choose=document.createElement("small");choose.textContent="Selecionar";b.append(choose);b.onclick=()=>{if(itemKey(getItems())!==itemKey(items)){box.replaceChildren();status.textContent="Sua sacola mudou. Calcule novamente.";return;}onSelect({...option,mode:q.mode,key:itemKey(items),cep,expiresAt:q.expiresAt});dialog.close();};}box.append(b);}
 }catch(err){if(seq===sequence&&dialog.open)status.textContent=err.message||"Frete indisponível.";}finally{if(seq===sequence)submit.disabled=false;}};
 return {open(kind,requestedItems,fixedCep=""){context=kind;items=requestedItems.map(x=>({...x}));if(!items.length)return;sequence++;boundCep=cepDigits(fixedCep);input.value=formatCep(boundCep||getCep()||"");input.readOnly=!!boundCep;box.replaceChildren();submit.disabled=false;status.textContent="";if(!dialog.open)dialog.showModal();if(boundCep)form.requestSubmit();}};
}
