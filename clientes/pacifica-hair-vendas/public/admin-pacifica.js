import {promotionalPrice,discountLabel} from "/promotions.mjs";
import {createManagement} from "/pacifica-management.js";
const $=q=>document.querySelector(q),status=(id,msg)=>$(id).textContent=msg;
const el=(tag,t,cls)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;if(cls)n.className=cls;return n};
let rows=[],selected=null,images=[],busy=false,management=null;
async function api(path,data){const r=await fetch("/api/admin/"+path,data===undefined?{cache:"no-store"}:{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw Error(j.error||"Falha na comunicação");return j}
function tab(s){for(const k of ["overview","products","stock","orders","customers","finance","reports","suppliers","settings"])$("#"+k).hidden=k!==s;document.querySelectorAll(".p-side button").forEach(b=>b.classList.toggle("active",b.dataset.tab===s));if(s==="orders")loadOrders();else management?.refresh(s)}
function picture(src){const i=el("img");i.alt="Foto do produto";if(src)i.src=src;else i.style.visibility="hidden";return i}
const money=n=>(n/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function draw(){
 const q=$("#search").value.toLocaleLowerCase("pt-BR"),f=$("#filter").value,slot=$("#list");slot.replaceChildren();
 const table=el("table",undefined,"ph-data-table"),head=el("thead"),tr=el("tr");
 for(const title of ["Foto / Produto","Preço de venda","Estoque","Status","Ações"])tr.append(el("th",title));
 head.append(tr);const body=el("tbody");
 const filtered=rows.filter(p=>[p.name,p.brand,p.code].join(" ").toLocaleLowerCase("pt-BR").includes(q)&&!(f==="available"&&p.stock<=0||f==="low"&&(p.stock<=0||p.stock>(p.minStock??5))||f==="zero"&&p.stock>0||f==="hidden"&&p.visible));
 for(const p of filtered){
  const r=el("tr"),td=el("td"),name=el("div",undefined,"ph-product-name");name.append(picture(p.image),el("span",p.name));td.append(name);r.append(td);
  for(const text of [money(p.priceCents),String(p.stock)])r.append(el("td",text));
  const stat=el("td"),tag=el("span",p.visible?"Ativo":"Inativo","ph-status"+(p.visible?"":" inactive"));stat.append(tag);r.append(stat);
  const actions=el("td"),editButton=el("button","Editar"),hideButton=el("button",p.visible?"Ocultar":"Exibir");
  editButton.type=hideButton.type="button";
  editButton.onclick=()=>{if(!busy)edit(p)};
  hideButton.onclick=async()=>{if(busy)return;const label=p.visible?"ocultar":"exibir";if(!confirm("Deseja "+label+" este produto na vitrine?"))return;busy=true;try{await api("products",{product:{...p,visible:!p.visible},version:p.version});await load();status("#globalStatus","Visibilidade atualizada com sucesso.")}catch(e){status("#globalStatus",e.message)}finally{busy=false}};
  actions.append(editButton,hideButton);r.append(actions);body.append(r);
 }
 if(!filtered.length){const row=el("tr"),cell=el("td","Nenhum produto encontrado.");cell.colSpan=5;row.append(cell);body.append(row)}
 table.append(head,body);slot.append(table);
}
const orderStatus={pending:"Pendente",paid:"Pago",preparing:"Em preparação",shipped:"Enviado",delivered:"Entregue",cancelled:"Cancelado",refunded:"Reembolsado"};
async function loadOrders(){
 const slot=$("#ordersList");slot.replaceChildren();status("#ordersStatus","Consultando pedidos...");
 try{
  const [o,s]=await Promise.all([api("orders"),api("sales-summary")]);
  $("#paidOrders").textContent=s.summary.paidOrders;
  $("#paidRevenue").textContent=money(s.summary.paidTotalCents);
  status("#ordersStatus",o.orders.length+" pedido(s) registrado(s).");
  if(!o.orders.length)slot.append(el("p","Nenhum pedido registrado até o momento."));
  for(const order of o.orders){
   const row=el("div",undefined,"ph-order"),info=el("div"),name=el("strong","#"+order.id.slice(0,12)+" · "+(order.customer_name||"Cliente"));
   info.append(name,el("small",new Date(order.created_at).toLocaleString("pt-BR") + " · "+(orderStatus[order.status]||order.status)+" · Pagamento: "+(order.payment_status==="approved"?"Aprovado":order.payment_status)));
   row.append(info,el("strong",money(order.total_cents)));slot.append(row);
  }
 }catch(e){status("#ordersStatus",e.message);slot.append(el("p","Pedidos indisponíveis. O painel não exibirá valores fictícios."))}
}
async function loadSales(){
 try{const s=await api("sales-summary");$("#paidOrders").textContent=s.summary.paidOrders;$("#paidRevenue").textContent=money(s.summary.paidTotalCents)}
 catch(e){$("#paidOrders").textContent="—";$("#paidRevenue").textContent="—";status("#globalStatus","Indicadores de vendas indisponíveis: "+e.message)}
}
function dashboard(){
 const low=rows.filter(p=>p.stock>0&&p.stock<=(p.minStock??5)),zero=rows.filter(p=>p.stock===0);
 $("#lowTotal").textContent=low.length;
 $("#lowSummary").textContent=low.length;
 $("#dashboardDate").textContent="Hoje: "+new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date());
 const chart=$("#categoryChart");chart.replaceChildren();
 const categories=new Map();for(const p of rows)categories.set(p.category||"Outros",(categories.get(p.category||"Outros")||0)+1);
 const top=[...categories].sort((a,b)=>b[1]-a[1]).slice(0,6),max=Math.max(1,...top.map(x=>x[1]));
 if(!top.length)chart.append(el("p","Nenhum produto cadastrado."));
 for(const [name,count] of top){const wrap=el("div",undefined,"ph-bar-item"),bar=el("div",undefined,"ph-bar");bar.style.height=Math.max(5,Math.round(count/max*130))+"px";wrap.append(el("strong",String(count)),bar,el("small",name));chart.append(wrap)}
 const list=$("#lowStockList");list.replaceChildren();
 if(!low.length)list.append(el("p","Nenhum produto com estoque baixo."));
 else for(const p of low.slice(0,6)){const b=el("button",p.name+" · "+p.stock+" unidade(s)","product-option");b.type="button";b.onclick=()=>{tab("products");edit(p)};list.append(b)}
}
async function load(){rows=(await api("products")).products;$("#login").hidden=true;$("#panel").hidden=false;$("#logout").hidden=false;$("#total").textContent=rows.length;$("#visibleTotal").textContent=rows.filter(p=>p.visible).length;$("#zeroTotal").textContent=rows.filter(p=>p.stock===0).length;dashboard();draw();management?.productsUpdated();await loadSales()}
function edit(p){selected=p||{id:crypto.randomUUID(),version:0,brand:"Avon",category:"Perfumes",stock:0,visible:false};images=p?.images?.slice()||(p?.image?[p.image]:[]);const f=$("#editor");f.reset();for(const k of ["name","brand","category","code","stock","description"])f.elements[k].value=selected[k]??"";f.elements.minStock.value=p?.minStock??5;f.elements.price.value=p?((p.compareCents>p.priceCents?p.compareCents:p.priceCents)/100).toFixed(2):"";f.elements.promotion.checked=!!(p&&p.compareCents>p.priceCents);f.elements.discount.value=String(p?discountLabel(p):0);previewPromotion();f.elements.visible.checked=!!selected.visible;for(const k of ["grams","length","width","height"])f.elements["ship_"+k].value=selected.parcel?.[k]??"";f.elements.shippingAllowed.checked=selected.shippingAllowed===true;$("#title").textContent=p?"Editar produto":"Novo produto";$("#archive").hidden=!p;$("#archive").textContent=p?.visible?"Ocultar produto":"Restaurar à vitrine";f.hidden=false;status("#productStatus","");status("#photoStatus","");drawPhotos();if(matchMedia("(max-width:800px)").matches)f.scrollIntoView({behavior:"smooth"})}
function drawPhotos(){const n=$("#photos");n.replaceChildren();for(let i=0;i<images.length;i++){const p=el("div",undefined,"photo-tile");p.append(picture(images[i]));if(!i)p.append(el("span","Capa","photo-cover"));const c=el("div",undefined,"photo-tile-controls");for(const [label,fn] of [["←",()=>{if(i>0)[images[i-1],images[i]]=[images[i],images[i-1]]}],["→",()=>{if(i+1<images.length)[images[i],images[i+1]]=[images[i+1],images[i]]}],["×",()=>images.splice(i,1)]]){const b=el("button",label);b.type="button";b.setAttribute("aria-label",label==="×"?"Excluir foto":"Mover foto "+label);b.onclick=()=>{if(!busy){fn();drawPhotos()}};c.append(b)}p.append(c);n.append(p)}if(!images.length)n.append(el("p","Nenhuma foto."))}
async function resize(f){if(!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>10*1024*1024)throw Error("Use JPG, PNG ou WebP de até 10 MB.");const img=await createImageBitmap(f),c=document.createElement("canvas");let s=Math.min(1,900/Math.max(img.width,img.height));for(let i=0;i<6;i++){c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));const ctx=c.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);const d=c.toDataURL("image/webp",.78-.05*i);if(d.startsWith("data:image/webp;base64,")&&d.length<440000){img.close();return d}s*=.8}img.close();throw Error("Falha ao otimizar imagem.")}
$("#upload").onchange=async e=>{if(busy)return;busy=true;$("#save").disabled=true;try{const fs=[...e.target.files];if(images.length+fs.length>5)throw Error("Máximo de cinco fotos.");for(const f of fs)images.push(await resize(f));status("#photoStatus","Fotos preparadas. Salve para publicar.")}catch(err){status("#photoStatus",err.message)}finally{busy=false;$("#save").disabled=false;e.target.value="";drawPhotos()}};
function previewPromotion(){const f=$("#editor"),base=Math.round(Number(f.elements.price.value)*100),enabled=f.elements.promotion.checked;f.elements.discount.disabled=!enabled;const slot=$("#promotionPreview");slot.replaceChildren();try{const v=promotionalPrice(base,enabled?Number(f.elements.discount.value):0);if(v.compareCents){slot.append(el("del",money(v.compareCents)),el("strong",money(v.priceCents)),el("span","-"+v.discountPercent+"%","promo-badge"));}else{slot.append(el("strong",money(v.priceCents)));}}catch(e){slot.append(el("span","Preencha o preço e o desconto."));}}
for(const name of ["price","discount","promotion"])$("#editor").elements[name].addEventListener("input",previewPromotion);
$("#editor").onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(e.target);let pricing;try{if(f.has("promotion")&&Number(f.get("discount"))<1)throw Error("Informe um desconto de 1 a 99%.");pricing=promotionalPrice(Math.round(Number(f.get("price"))*100),f.has("promotion")?Number(f.get("discount")):0);}catch(err){status("#productStatus",err.message);return;}const keys=["grams","length","width","height"],values=keys.map(k=>String(f.get("ship_"+k)||"").trim());const parcel=values.some(Boolean)?Object.fromEntries(keys.map((k,i)=>[k,Number(values[i])])):null;const shippingAllowed=f.has("shippingAllowed");if(parcel&&(!values.every(Boolean)||!Number.isInteger(parcel.grams)||parcel.grams<1||parcel.grams>30000||!["length","width","height"].every(k=>Number.isFinite(parcel[k])&&parcel[k]>=1&&parcel[k]<=100))||shippingAllowed&&!parcel){status("#productStatus","Informe peso e todas as medidas para cotação.");return;}busy=true;$("#save").disabled=true;const p={...selected,parcel,shippingAllowed,name:String(f.get("name")),brand:String(f.get("brand")),code:String(f.get("code")),category:String(f.get("category")),description:String(f.get("description")),...pricing,stock:Number(f.get("stock")),minStock:Number(f.get("minStock")),visible:f.has("visible"),images:images.slice()};try{await api("products",{product:p,version:selected.version});await load();edit(rows.find(x=>x.id===p.id));status("#productStatus","Alterações salvas no servidor.")}catch(err){status("#productStatus",err.message)}finally{busy=false;$("#save").disabled=false}};
$("#archive").onclick=()=>{if(selected&&!busy){$("#editor").elements.visible.checked=!selected.visible;$("#editor").requestSubmit()}};$("#cancel").onclick=()=>{if(!busy){selected=null;$("#editor").hidden=true}};$("#search").oninput=draw;$("#filter").onchange=draw;$("#add").onclick=()=>{if(!busy)edit(null)};$("#quickAdd").onclick=()=>{tab("products");edit(null)};$("#reload").onclick=()=>load().catch(e=>status("#globalStatus",e.message));$("#refreshDashboard").onclick=()=>load().catch(e=>status("#globalStatus",e.message));$("#refreshOrders").onclick=loadOrders;document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$("#loginForm").onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;try{await api("login",{password:new FormData(e.target).get("password")});e.target.reset();await load();let recoveryReady=true;try{recoveryReady=(await api("health")).recoveryReady!==false}catch{}tab(recoveryReady?"overview":"settings");if(!recoveryReady)status("#globalStatus","Antes de continuar, configure seu e-mail de recuperação em Configurações. Assim você poderá redefinir a senha caso esqueça.");}catch(err){status("#loginStatus",err.message)}finally{b.disabled=false}};$("#logout").onclick=async()=>{try{await api("logout",{});location.reload()}catch(err){status("#globalStatus",err.message)}};management=createManagement({api,getProducts:()=>rows,goTab:tab,reloadProducts:load,editProduct:edit});load().catch(()=>{});
