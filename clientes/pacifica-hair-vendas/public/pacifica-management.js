// Pacífica Hair | management UI. No mock sales, no client-side financial truth.
export function createManagement({api,getProducts,goTab,reloadProducts,editProduct}){
 const $=q=>document.querySelector(q);
 const el=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;if(cls)x.className=cls;return x};
 const brl=c=>(Number(c||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const cents=s=>Math.round(Number(s)*100);
 const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const low=p=>p.stock>0&&p.stock<=Math.max(0,Number.isInteger(p.minStock)?p.minStock:5);
 let data=null,stockView="current",customerView="customers",lastTab="overview",lastError="";
 const notify=(id,msg)=>{const x=$(id);if(x)x.textContent=msg};
 const empty=(node,message)=>node.append(el("p",message,"ph-empty"));
 const setHidden=(id,hidden)=>{$(id).hidden=hidden};
 const setForm=(id,open)=>{const f=$(id);f.hidden=!open;if(open)f.querySelector("input,select")?.focus()};
 function columns(row,values){for(const v of values){const td=el("td");if(v instanceof Node)td.append(v);else td.textContent=String(v??"");row.append(td)}return row}
 function label(text,cls){return el("span",text,"ph-status"+(cls?" "+cls:""))}
 function statusFor(p){return p.stock===0?label("Sem estoque","zero"):low(p)?label("Baixo","low"):label("Normal")}
 function productList(){
  const ps=getProducts();
  notify("#productTotal",String(ps.length));notify("#productActive",String(ps.filter(p=>p.visible).length));notify("#productInactive",String(ps.filter(p=>!p.visible).length));
  notify("#stockUnits",ps.reduce((s,p)=>s+Math.max(0,p.stock||0),0).toLocaleString("pt-BR"));
  notify("#stockAvailable",ps.reduce((s,p)=>s+Math.max(0,p.stock||0),0).toLocaleString("pt-BR"));
  notify("#stockLow",ps.filter(low).length);
  const picker=$("#movementProduct"),current=picker.value;picker.replaceChildren(el("option","Selecione um produto"));
  picker.firstChild.value="";
  for(const p of ps){const o=el("option",p.name+" ("+p.stock+" un.)");o.value=p.id;picker.append(o)}
  picker.value=ps.some(p=>p.id===current)?current:"";
  renderStock();
  renderReports();
 }
 function renderStock(){
  const ps=getProducts(),q=$("#stockSearch").value.toLocaleLowerCase("pt-BR"),slot=$("#stockTable");slot.replaceChildren();
  const filtered=ps.filter(p=>[p.name,p.brand,p.code].join(" ").toLocaleLowerCase("pt-BR").includes(q)&&(stockView!=="alerts"||p.stock===0||low(p)));
  if(!filtered.length){const tr=el("tr");const td=el("td","Nenhum produto encontrado.");td.colSpan=5;tr.append(td);slot.append(tr)}
  for(const p of filtered){
   const tr=el("tr"),name=el("div",undefined,"ph-product-name");if(p.image){const img=el("img");img.src=p.image;img.alt="";name.append(img)}name.append(el("span",p.name));
   const actions=el("div",undefined,"ph-action-inline");
   for(const [txt,kind] of [["Entrada","entry"],["Saída","exit"],["Editar","edit"]]){
    const b=el("button",txt);b.type="button";b.onclick=()=>{if(kind==="edit"){goTab("products");editProduct(p)}else{goTab("stock");setForm("#movementForm",true);$("#movementProduct").value=p.id;$("#movementForm").elements.kind.value=kind;}};actions.append(b)
   }
   slot.append(columns(tr,[name,p.stock,Number.isInteger(p.minStock)?p.minStock:5,statusFor(p),actions]));
  }
  setHidden("#stockCurrent",stockView==="entry"||stockView==="exit");
  setHidden("#stockHistory",!(stockView==="entry"||stockView==="exit"));
  const list=$("#stockMovementRows");list.replaceChildren();
  if(stockView==="entry"||stockView==="exit"){
   $("#stockHistoryTitle").textContent=stockView==="entry"?"Entradas registradas":"Saídas registradas";
   const logs=(data?.movements||[]).filter(r=>stockView==="entry"?r.delta>0:r.delta<0);
   if(!logs.length)empty(list,"Nenhuma movimentação registrada.");
   for(const r of logs){const d=el("div",undefined,"ph-row"),info=el("div");info.append(el("strong",r.product_name||r.product_id),el("small",new Date(r.created_at).toLocaleString("pt-BR")));d.append(info,el("strong",(r.delta>0?"+":"")+r.delta+" unidades"));list.append(d)}
  }
 }
 function renderCustomers(){
  if(!data)return;
  const q=$("#customerSearch").value.toLocaleLowerCase("pt-BR"),customers=$("#customerRows"),credits=$("#creditRows");
  customers.replaceChildren();credits.replaceChildren();
  let past=0,soon=0;const now=today(),horizon=new Date(now+"T12:00:00Z");horizon.setUTCDate(horizon.getUTCDate()+7);const until=horizon.toISOString().slice(0,10);
  for(const c of data.credits){if(c.balance_cents>0){if(c.due_date<now)past+=c.balance_cents;else if(c.due_date<=until)soon+=c.balance_cents}}
  notify("#creditOverdue",brl(past));notify("#creditSoon",brl(soon));notify("#creditTotal",brl(data.summary?.receivable_cents));
  const select=$("#creditCustomer"),v=select.value;select.replaceChildren();const def=el("option","Selecione um cliente");def.value="";select.append(def);
  for(const c of data.customers){const o=el("option",c.name);o.value=c.id;select.append(o)}
  select.value=data.customers.some(c=>c.id===v)?v:"";
  const matches=data.customers.filter(c=>(c.name+" "+c.phone).toLocaleLowerCase("pt-BR").includes(q));
  if(!matches.length){const td=el("td","Nenhuma cliente cadastrada.");td.colSpan=4;const r=el("tr");r.append(td);customers.append(r)}
  for(const c of matches){
   const r=el("tr"),debt=data.credits.filter(x=>x.customer_id===c.id).reduce((sum,x)=>sum+x.balance_cents,0);
   const b=el("button","Registrar fiado");b.type="button";b.onclick=()=>{selectCustomerTab("credit");setForm("#creditForm",true);$("#creditCustomer").value=c.id};
   customers.append(columns(r,[c.name,c.phone||c.email||"—",brl(debt),b]));
  }
  const active=data.credits.filter(x=>x.balance_cents>0);
  if(!active.length){const td=el("td","Nenhum fiado em aberto.");td.colSpan=5;const r=el("tr");r.append(td);credits.append(r)}
  for(const c of active){
   const r=el("tr"),due=c.due_date<now?"Atrasado":c.due_date<=until?"A vencer":"Em dia";
   const button=el("button","Receber");button.type="button";button.onclick=()=>{$("#receiptForm").elements.creditId.value=c.id;$("#receiptHint").textContent=c.customer_name+" · Saldo: "+brl(c.balance_cents);$("#receiptForm").elements.amount.value=(c.balance_cents/100).toFixed(2);setForm("#receiptForm",true)};
   credits.append(columns(r,[c.customer_name,brl(c.balance_cents),new Date(c.due_date+"T12:00:00Z").toLocaleDateString("pt-BR"),label(due,c.due_date<now?"overdue":""),button]));
  }
 }
 function renderFinance(sales){
  if(!data)return;
  const spent=data.summary?.spent_cents??data.expenses.reduce((sum,e)=>sum+e.amount_cents,0),received=data.summary?.received_cents??0;
  notify("#financeReceipts",brl(received));
  notify("#financeExpenses",brl(spent));
  const revenue=sales?.summary?.paidTotalCents;
  notify("#financeRevenue",Number.isSafeInteger(revenue)?brl(revenue):"—");
  notify("#financeBalance",Number.isSafeInteger(revenue)?brl(revenue+received-spent):"—");
  const list=$("#expenseRows");list.replaceChildren();
  if(!data.expenses.length)empty(list,"Nenhuma despesa registrada.");
  for(const e of data.expenses){const d=el("div",undefined,"ph-row"),info=el("div");info.append(el("strong",e.description),el("small",e.category+" · "+new Date(e.spent_on+"T12:00:00Z").toLocaleDateString("pt-BR")));d.append(info,el("strong",brl(e.amount_cents)));list.append(d)}
 }
 function renderReports(){
  const stock=$("#reportStock");stock.replaceChildren();
  const sorted=getProducts().slice().sort((a,b)=>b.stock-a.stock).slice(0,10);
  if(!sorted.length)empty(stock,"Nenhum produto no catálogo.");
  for(const p of sorted){const row=el("div",undefined,"ph-row");row.append(el("strong",p.name),el("span",p.stock+" un."));stock.append(row)}
  const moves=$("#reportMovements");moves.replaceChildren();
  if(!data?.movements?.length)empty(moves,"Nenhuma movimentação registrada.");
  else for(const m of data.movements.slice(0,10)){const row=el("div",undefined,"ph-row");row.append(el("span",m.product_name),el("strong",(m.delta>0?"+":"")+m.delta+" un."));moves.append(row)}
 }
 function renderSuppliers(){
  if(!data)return;const slot=$("#supplierRows");slot.replaceChildren();
  if(!data.suppliers.length)empty(slot,"Nenhum fornecedor cadastrado.");
  for(const s of data.suppliers){const row=el("div",undefined,"ph-row"),i=el("div");i.append(el("strong",s.name),el("small",[s.contact,s.notes].filter(Boolean).join(" · ")));row.append(i);slot.append(row)}
 }
 async function refresh(tab){
  lastTab=tab;productList();
  if(!["stock","customers","finance","reports","suppliers","settings"].includes(tab))return;
  if(tab==="settings"){
   const box=$("#settingsSummary");box.replaceChildren();
   try{const h=await api("health");for(const [key,labelText,ok] of [["database","Banco da loja",h.database],["adminSession","Acesso administrativo",h.adminSession],["mercadoPagoConfigured","Credenciais de Mercado Pago detectadas",h.mercadoPagoConfigured],["checkoutReady","Checkout real ativo",h.checkoutReady]]){const row=el("div",undefined,"ph-row");row.append(el("strong",labelText),label(ok?"Configurado":"Pendente",ok?"":"low"));box.append(row)}}catch(e) {empty(box,e.message)}return;
  }
  try{
   data=await api("manage");lastError="";
   renderStock();renderCustomers();renderSuppliers();renderReports();
   if(tab==="finance"){let sales=null;try{sales=await api("sales-summary")}catch{}renderFinance(sales)}
   notify("#customersFeedback","");
  }catch(e){lastError=e.message;notify("#customersFeedback",lastError);if(tab==="stock")empty($("#stockMovementRows"),lastError);if(tab==="finance")notify("#financeRevenue","—");}
 }
 async function submit(e,action,payload,section){
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"],button:not([type])');if(button)button.disabled=true;
  try{await api("manage",{action,...payload(new FormData(form))});notify(section,"Salvo no servidor.");form.reset();form.hidden=true;await reloadProducts();await refresh(lastTab)}
  catch(err){notify(section,err.message)}finally{if(button)button.disabled=false}
 }
 function selectCustomerTab(view){
  customerView=view;document.querySelectorAll("[data-customer-view]").forEach(b=>b.classList.toggle("is-selected",b.dataset.customerView===view));setHidden("#customerCurrent",view!=="customers");setHidden("#creditCurrent",view!=="credit");
 }
 document.querySelectorAll("[data-stock-view]").forEach(b=>b.addEventListener("click",()=>{stockView=b.dataset.stockView;document.querySelectorAll("[data-stock-view]").forEach(x=>x.classList.toggle("is-selected",x===b));renderStock()}));
 document.querySelectorAll("[data-customer-view]").forEach(b=>b.addEventListener("click",()=>selectCustomerTab(b.dataset.customerView)));
 $("#stockSearch").addEventListener("input",renderStock);
 $("#customerSearch").addEventListener("input",renderCustomers);
 $("#openMovement").onclick=()=>setForm("#movementForm",true);
 $("#cancelMovement").onclick=()=>setForm("#movementForm",false);
 $("#addCustomer").onclick=()=>setForm("#customerForm",true);
 $("#cancelCustomer").onclick=()=>setForm("#customerForm",false);
 $("#addCredit").onclick=()=>setForm("#creditForm",true);
 $("#cancelCredit").onclick=()=>setForm("#creditForm",false);
 $("#cancelReceipt").onclick=()=>setForm("#receiptForm",false);
 $("#addSupplier").onclick=()=>setForm("#supplierForm",true);
 $("#cancelSupplier").onclick=()=>setForm("#supplierForm",false);
 $("#addExpense").onclick=()=>{$("#expenseForm").elements.spentOn.value=today();setForm("#expenseForm",true)};
 $("#cancelExpense").onclick=()=>setForm("#expenseForm",false);
 $("#movementForm").onsubmit=e=>submit(e,"stock.move",f=>{const p=getProducts().find(p=>p.id===f.get("productId"));if(!p)throw Error("Selecione um produto.");return {productId:p.id,version:p.version,delta:Number(f.get("quantity"))*(f.get("kind")==="exit"?-1:1)}},"#movementFeedback");
 $("#customerForm").onsubmit=e=>submit(e,"customer.create",f=>({name:f.get("name"),phone:f.get("phone"),email:f.get("email"),notes:f.get("notes")}),"#customerForm .ph-feedback");
 $("#creditForm").onsubmit=e=>submit(e,"credit.create",f=>({customerId:f.get("customerId"),amountCents:cents(f.get("amount")),dueDate:f.get("dueDate"),description:f.get("description")}),"#creditForm .ph-feedback");
 $("#receiptForm").onsubmit=e=>submit(e,"credit.receipt",f=>({creditId:f.get("creditId"),amountCents:cents(f.get("amount")),note:f.get("note")}),"#receiptForm .ph-feedback");
 $("#supplierForm").onsubmit=e=>submit(e,"supplier.create",f=>({name:f.get("name"),contact:f.get("contact"),notes:f.get("notes")}),"#supplierForm .ph-feedback");
 $("#expenseForm").onsubmit=e=>submit(e,"expense.create",f=>({category:f.get("category"),description:f.get("description"),amountCents:cents(f.get("amount")),spentOn:f.get("spentOn")}),"#expenseForm .ph-feedback");
 return {refresh,productsUpdated:productList};
}
