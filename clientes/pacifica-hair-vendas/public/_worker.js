const out=(x,status=200,h={})=>new Response(JSON.stringify(x),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...h}});
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,"0")).join("");
const eq=(a,b)=>{if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0};
const now=()=>Math.floor(Date.now()/1000),cookie=(s,t)=>"__Host-pacifica_admin="+s+"; Path=/; Max-Age="+t+"; Secure; HttpOnly; SameSite=Strict";

const RECOVERY_AUTH_URL="https://nifvycrvqnzbxgglhlky.supabase.co";
const RECOVERY_AUTH_PUBLIC_KEY="sb_publishable_lVUXjlOgo46IhibFMiCAtw_nAIzVUCz"; // Public browser key, not a service-role secret.
const recoveryEnabled=env=>/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(env.ADMIN_RECOVERY_EMAIL||"").trim());
const strongAdminPassword=s=>typeof s==="string"&&s.length>=12&&s.length<=128&&/[a-zA-Z]/.test(s)&&/\\d/.test(s);
const randomHex=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,"0")).join("");
async function adminPasswordHash(password,salt,iterations=210000){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:Uint8Array.from(salt.match(/.{2}/g),v=>parseInt(v,16)),iterations,hash:"SHA-256"},key,256);
 return Array.from(new Uint8Array(bits),x=>x.toString(16).padStart(2,"0")).join("");
}
async function adminPasswordValid(db,env,password){
 const c=await db.prepare("SELECT salt,password_hash,iterations FROM ph_admin_credentials WHERE id=1").first();
 if(c)return eq(await adminPasswordHash(password,c.salt,c.iterations),c.password_hash);
 return typeof env.ADMIN_PASSWORD==="string"&&env.ADMIN_PASSWORD.length>=12&&eq(await hash(password),await hash(env.ADMIN_PASSWORD));
}
async function recoverAdmin(req,env,db){
 if(!recoveryEnabled(env))return out({error:"Recuperação ainda não configurada. Fale com a responsável pela loja."},503);
 const ip=await hash("admin-recovery:"+(req.headers.get("CF-Connecting-IP")||"unknown")),t=now();
 const attempt=await db.prepare("INSERT INTO attempts(ip,count,expires) VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count").bind(ip,t+900,t,t).first();
 if(attempt.count>5)return out({error:"Muitas tentativas. Tente novamente em 15 minutos."},429);
 const b=await body(req,6000);
 if(!strongAdminPassword(b.password)||typeof b.accessToken!=="string"||b.accessToken.length<60||b.accessToken.length>4096)return out({error:"A nova senha deve conter ao menos 12 caracteres, letras e números."},400);
 let user;
 try{
  const r=await fetch(RECOVERY_AUTH_URL+"/auth/v1/user",{headers:{apikey:RECOVERY_AUTH_PUBLIC_KEY,Authorization:"Bearer "+b.accessToken},signal:AbortSignal.timeout(8000)});
  if(!r.ok)return out({error:"Link expirado ou conta não autorizada. Solicite outro e-mail."},403);
  user=await r.json();
 }catch{return out({error:"Não foi possível validar seu e-mail agora."},503)}
 const expected=String(env.ADMIN_RECOVERY_EMAIL).trim().toLowerCase();
 if(!user?.id||!user?.email_confirmed_at||user?.is_anonymous===true||typeof user.email!=="string"||user.email.toLowerCase()!==expected)return out({error:"Conta não autorizada para recuperar este painel."},403);
 const tokenHash=await hash(b.accessToken),salt=randomHex(16),passwordHash=await adminPasswordHash(b.password,salt);
 try{
  await db.batch([
   db.prepare("INSERT INTO ph_admin_recovery_used(token_hash,used_at) VALUES (?,?)").bind(tokenHash,t),
   db.prepare("INSERT INTO ph_admin_credentials(id,salt,password_hash,iterations,updated_at) VALUES(1,?,?,210000,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,iterations=excluded.iterations,updated_at=CURRENT_TIMESTAMP").bind(salt,passwordHash),
   db.prepare("DELETE FROM sessions"),
   db.prepare("DELETE FROM ph_admin_recovery_used WHERE used_at<?").bind(t-86400)
  ]);
 }catch(e){
  if(/UNIQUE constraint failed/.test(String(e)))return out({error:"Este link de recuperação já foi utilizado. Solicite outro."},409);
  throw e;
 }
 return out({ok:true,message:"Senha alterada. Entre novamente no painel."},200,{"Set-Cookie":cookie("",0)});
}

const products=async(db,all)=>{const r=await db.prepare("SELECT id,payload,visible,version FROM products "+(all?"":"WHERE visible=1 ")+"ORDER BY rowid").all();return r.results.map(p=>({...JSON.parse(p.payload),id:p.id,visible:!!p.visible,version:p.version}))};
const cats=["Perfumes","Cosméticos","Cabelos","Cuidados Pessoais","Presentes","Maquiagem","Roupas íntimas","Pijamas"];
const pathPhoto=s=>typeof s==="string"&&((/^\/assets\/[a-zA-Z0-9_./-]+\.(webp|png|jpg|jpeg)$/i.test(s)&&!s.includes(".."))||/^\/api\/photos\/[a-f0-9]{64}$/.test(s));
async function body(r,max=2500000){if(Number(r.headers.get("Content-Length")||0)>max)throw Error("Solicitação muito grande");const s=await r.text();if(s.length>max)throw Error("Solicitação muito grande");return JSON.parse(s)}
// Quotes only: no label, charge or checkout operation. Only PAC and SEDEX after merchant review.
const validParcel=p=>p&&Number.isInteger(p.grams)&&p.grams>=1&&p.grams<=30000&&[p.length,p.width,p.height].every(n=>typeof n==="number"&&Number.isFinite(n)&&n>=1&&n<=100);
function quoteItems(raw){
 if(!Array.isArray(raw)||!raw.length||raw.length>12)throw Error("Inclua de 1 a 12 produtos.");
 const result=new Map();
 for(const r of raw){if(typeof r?.id!=="string"||!/^[a-zA-Z0-9_-]{1,120}$/.test(r.id)||!Number.isInteger(r.qty)||r.qty<1||r.qty>10)throw Error("Confira produtos e quantidades.");result.set(r.id,(result.get(r.id)||0)+r.qty);}
 const items=[...result].map(([id,qty])=>({id,qty}));if(items.some(x=>x.qty>10)||items.reduce((n,r)=>n+r.qty,0)>24)throw Error("Limite de unidades para cotação excedido.");return items;
}
async function freight(req,env,db){
 const fail=(error,status=422)=>out({error},status);
 if(req.method!=="POST")return fail("Método não permitido.",405);
 if(req.headers.get("Origin")!==new URL(req.url).origin||req.headers.get("Sec-Fetch-Site")==="cross-site")return fail("Origem inválida.",403);
 if(!req.headers.get("Content-Type")?.startsWith("application/json"))return fail("Envie JSON.",415);
 const from=String(env.PACIFICA_SHIP_FROM_CEP||"").replace(/\D/g,""),mode=env.PACIFICA_SF_MODE,contact=String(env.PACIFICA_SF_CONTACT||"");
 if(!env.PACIFICA_SF_TOKEN||!/^\d{8}$/.test(from)||!["sandbox","production"].includes(mode)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))return fail("O cálculo de frete está em configuração. Consulte o atendimento.",503);
 let cep,items;try{const data=await body(req,6000);cep=String(data.cep||"").replace(/\D/g,"");if(!/^\d{8}$/.test(cep))throw Error("Informe um CEP de 8 números.");items=quoteItems(data.items)}catch(e){return fail("Confira o CEP e as quantidades selecionadas.")}
 const ip=await hash("freight:"+ (req.headers.get("CF-Connecting-IP")||"unknown")),t=now();
 const rate=await db.prepare("INSERT INTO attempts(ip,count,expires) VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count").bind(ip,t+60,t,t).first();
 if(rate.count>12)return fail("Muitas consultas. Tente novamente em um minuto.",429);
 const goods=[];let insurance=0;
 for(const item of items){
  const row=await db.prepare("SELECT payload FROM products WHERE id=? AND visible=1").bind(item.id).first();
  if(!row)return fail("Produto indisponível para cotação.",409);
  const p=JSON.parse(row.payload);
  if(p.stock<item.qty||!Number.isSafeInteger(p.stock))return fail("Confira a disponibilidade e a quantidade dos produtos.",409);
  if(p.shippingAllowed!==true||!validParcel(p.parcel))return fail("Ainda não temos as medidas ou a autorização de transporte de um dos produtos. Consulte o atendimento.",409);
  const q=p.parcel;goods.push({quantity:item.qty,weight:q.grams/1000,length:q.length,width:q.width,height:q.height});
  if(Number.isSafeInteger(p.priceCents)&&p.priceCents>0)insurance+=p.priceCents*item.qty;
 }
 const payload={from:{postal_code:from},to:{postal_code:cep},services:"1,2",products:goods,options:{receipt:false,own_hand:false,insurance_value:insurance/100,use_insurance_value:true}};
 let data;try{const res=await fetch((mode==="sandbox"?"https://sandbox.superfrete.com":"https://api.superfrete.com")+"/api/v0/calculator",{method:"POST",headers:{Authorization:"Bearer "+env.PACIFICA_SF_TOKEN,"User-Agent":"PacificaHair/1.0 ("+contact+")","Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});if(!res.ok)return fail("Não foi possível consultar o frete agora. Tente novamente.",503);data=await res.json()}catch{return fail("A transportadora não respondeu. Tente novamente.",503)}
 const options=(Array.isArray(data)?data:[]).flatMap(q=>{const id=String(q?.id),price=Number(q?.price),days=Number(q?.delivery_time);if(!["1","2"].includes(id)||q?.has_error===true||q?.error||q?.price==null||q?.price===""||q?.delivery_time==null||!Number.isFinite(price)||price<=0||price>100000||!Number.isInteger(days)||days<0||days>365)return [];return [{id,name:id==="1"?"PAC":"SEDEX",carrier:"Correios",cents:Math.round(price*100),days}]});
 if(!options.length)return fail("Não há modalidades disponíveis para este CEP e os produtos.",422);
 return out({cep,mode,options,expiresAt:Date.now()+15*60*1000});
}
const validId=x=>typeof x==="string"&&/^[a-f0-9-]{36}$/.test(x);
const cleanText=(x,max)=>typeof x==="string"?x.trim().slice(0,max):"";
const positiveCents=x=>Number.isSafeInteger(x)&&x>0&&x<=100000000;
const dateISO=x=>typeof x==="string"&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T12:00:00Z"))&&new Date(x+"T12:00:00Z").toISOString().slice(0,10)===x;
async function manage(req,db){
 if(req.method==="GET"){
  try{
   const [customers,credit,receipts,movements,suppliers,expenses,balances]=await Promise.all([
    db.prepare("SELECT * FROM ph_customers ORDER BY name COLLATE NOCASE LIMIT 500").all(),
    db.prepare("SELECT c.*,u.name AS customer_name, c.original_cents-COALESCE((SELECT SUM(r.amount_cents) FROM ph_credit_receipts r WHERE r.credit_id=c.id),0) AS balance_cents FROM ph_credit c JOIN ph_customers u ON u.id=c.customer_id ORDER BY c.created_at DESC LIMIT 500").all(),
    db.prepare("SELECT * FROM ph_credit_receipts ORDER BY created_at DESC LIMIT 1000").all(),
    db.prepare("SELECT * FROM ph_stock_movements ORDER BY created_at DESC LIMIT 250").all(),
    db.prepare("SELECT * FROM ph_suppliers ORDER BY name COLLATE NOCASE LIMIT 500").all(),
    db.prepare("SELECT * FROM ph_expenses ORDER BY spent_on DESC,created_at DESC LIMIT 500").all(),
    db.prepare("SELECT COALESCE(SUM(c.original_cents-COALESCE((SELECT SUM(r.amount_cents) FROM ph_credit_receipts r WHERE r.credit_id=c.id),0)),0) AS receivable_cents,COUNT(*) AS total_credits,(SELECT COALESCE(SUM(amount_cents),0) FROM ph_credit_receipts) AS received_cents,(SELECT COALESCE(SUM(amount_cents),0) FROM ph_expenses) AS spent_cents FROM ph_credit c").first()
   ]);
   return out({customers:customers.results,credits:credit.results,receipts:receipts.results,movements:movements.results,suppliers:suppliers.results,expenses:expenses.results,summary:balances});
  }catch(e){if(/no such table|no such trigger/i.test(String(e)))return out({error:"Módulos administrativos não configurados: aplique backend/management.sql no D1 da Pacífica Hair."},503);throw e}
 }
 if(req.method!=="POST")return out({error:"Método não permitido."},405);
 const b=await body(req,12000),a=b.action,id=validId(b.requestId)?b.requestId:crypto.randomUUID();
 if(["credit.create","credit.receipt","expense.create"].includes(a)&&!validId(b.requestId))return out({error:"Identificador da operação inválido."},400);
 try{
  if(a==="customer.create"){
   const name=cleanText(b.name,120),phone=cleanText(b.phone,20),email=cleanText(b.email,180),notes=cleanText(b.notes,1000);
   if(name.length<2||b.name?.length>120||b.phone?.length>20||b.email?.length>180||b.notes?.length>1000||email&&!/^[^ @]+@[^ @]+[.][^ @]+$/.test(email))return out({error:"Confira os dados da cliente."},400);
   await db.prepare("INSERT INTO ph_customers(id,name,phone,email,notes) VALUES(?,?,?,?,?)").bind(id,name,phone,email,notes).run();
  }else if(a==="credit.create"){
   if(!validId(b.customerId)||!positiveCents(b.amountCents)||!dateISO(b.dueDate)||cleanText(b.description,500).length>500||typeof b.description==="string"&&b.description.length>500)return out({error:"Confira o fiado, valor e vencimento."},400);
   const r=await db.prepare("INSERT INTO ph_credit(id,customer_id,original_cents,due_date,description) SELECT ?,id,?,?,? FROM ph_customers WHERE id=?").bind(id,b.amountCents,b.dueDate,cleanText(b.description,500),b.customerId).run();
   if(r.meta.changes!==1)return out({error:"Cliente não encontrada."},404);
  }else if(a==="credit.receipt"){
   if(!validId(b.creditId)||!positiveCents(b.amountCents)||typeof b.note==="string"&&b.note.length>500)return out({error:"Informe o valor recebido."},400);
   const r=await db.prepare("INSERT INTO ph_credit_receipts(id,credit_id,amount_cents,note) SELECT ?,c.id,?,? FROM ph_credit c WHERE c.id=? AND (SELECT COALESCE(SUM(amount_cents),0) FROM ph_credit_receipts WHERE credit_id=c.id)+?<=c.original_cents").bind(id,b.amountCents,cleanText(b.note,500),b.creditId,b.amountCents).run();
   if(r.meta.changes!==1)return out({error:"Fiado não localizado ou recebimento maior que o saldo pendente."},409);
  }else if(a==="stock.move"){
   const audit=await db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='ph_log_stock_changes'").first();
   if(!audit)return out({error:"Ative o histórico de estoque aplicando backend/management.sql."},503);
   if(typeof b.productId!=="string"||!/^[a-zA-Z0-9_-]{1,120}$/.test(b.productId)||!Number.isInteger(b.delta)||b.delta===0||Math.abs(b.delta)>100000||!Number.isSafeInteger(b.version)||b.version<0)return out({error:"Confira produto, quantidade e tipo da movimentação."},400);
   const r=await db.prepare("UPDATE products SET payload=json_set(payload,'$.stock',CAST(json_extract(payload,'$.stock') AS INTEGER)+?),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? AND CAST(json_extract(payload,'$.stock') AS INTEGER)+? BETWEEN 0 AND 100000").bind(b.delta,b.productId,b.version,b.delta).run();
   if(r.meta.changes!==1)return out({error:"Estoque insuficiente ou alterado em outra sessão. Atualize os produtos."},409);
  }else if(a==="supplier.create"){
   const name=cleanText(b.name,120),contact=cleanText(b.contact,180),notes=cleanText(b.notes,1000);
   if(name.length<2||b.name?.length>120||b.contact?.length>180||b.notes?.length>1000)return out({error:"Confira os dados do fornecedor."},400);
   await db.prepare("INSERT INTO ph_suppliers(id,name,contact,notes) VALUES(?,?,?,?)").bind(id,name,contact,notes).run();
  }else if(a==="expense.create"){
   const category=cleanText(b.category,80),description=cleanText(b.description,200);
   if(category.length<2||description.length<2||b.category?.length>80||b.description?.length>200||!positiveCents(b.amountCents)||!dateISO(b.spentOn))return out({error:"Confira categoria, descrição, valor e data do gasto."},400);
   await db.prepare("INSERT INTO ph_expenses(id,category,description,amount_cents,spent_on) VALUES(?,?,?,?,?)").bind(id,category,description,b.amountCents,b.spentOn).run();
  }else return out({error:"Operação não permitida."},400);
  return out({ok:true,id});
 }catch(e){if(/no such table|no such trigger/i.test(String(e)))return out({error:"Módulos administrativos não configurados: aplique backend/management.sql."},503);if(/UNIQUE constraint failed|PRIMARY KEY|constraint failed/i.test(String(e)))return out({error:"Operação já registrada ou dados duplicados. Atualize o painel antes de tentar novamente."},409);throw e}
}

async function route(req,env){
 const u=new URL(req.url),p=u.pathname,db=env.PACIFICA_DB;
 if(!p.startsWith("/api/"))return env.ASSETS.fetch(req);
 if(!db)return out({error:"Banco indisponível."},503);
 if(p==="/api/frete")return freight(req,env,db);
 if(p==="/api/catalog"&&req.method==="GET")return out({products:await products(db,false)});
 if(p.startsWith("/api/photos/")&&req.method==="GET"){const id=p.split("/").at(-1);if(!/^[a-f0-9]{64}$/.test(id))return out({error:"Foto não encontrada."},404);const row=await db.prepare("SELECT data FROM photos WHERE id=?").bind(id).first();if(!row)return out({error:"Foto não encontrada."},404);return new Response(Uint8Array.from(atob(row.data.split(",")[1]),x=>x.charCodeAt(0)),{headers:{"Content-Type":"image/webp","Cache-Control":"public,max-age=31536000,immutable","X-Content-Type-Options":"nosniff"}})}
 if(!p.startsWith("/api/admin/"))return out({error:"Não encontrado."},404);
 if(req.method!=="GET"&&req.headers.get("Origin")!==u.origin)return out({error:"Origem inválida."},403);
 if(p==="/api/admin/status"&&req.method==="GET"){const exists=await db.prepare("SELECT id FROM ph_admin_credentials WHERE id=1").first();return out({ready:!!exists||(typeof env.ADMIN_PASSWORD==="string"&&env.ADMIN_PASSWORD.length>=12),recoveryReady:recoveryEnabled(env)});}
 if(p==="/api/admin/recover"&&req.method==="POST")return recoverAdmin(req,env,db);
 if(p==="/api/admin/login"&&req.method==="POST"){
  const stored=await db.prepare("SELECT id FROM ph_admin_credentials WHERE id=1").first();
  if(!stored&&(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<12))return out({error:"O acesso administrativo ainda não está configurado."},503);
  const ip=await hash(req.headers.get("CF-Connecting-IP")||"unknown"),t=now();
  const r=await db.prepare("INSERT INTO attempts(ip,count,expires) VALUES (?,1,?) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count").bind(ip,t+900,t,t).first();
  if(r.count>5)return out({error:"Muitas tentativas. Tente novamente em 15 minutos."},429);
  const b=await body(req,2000);if(typeof b.password!=="string"||b.password.length>300||!(await adminPasswordValid(db,env,b.password)))return out({error:"Senha incorreta."},401);
  const key=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
  await db.batch([db.prepare("DELETE FROM sessions WHERE expires<=?").bind(t),db.prepare("INSERT INTO sessions(hash,expires) VALUES (?,?)").bind(await hash(key),t+28800),db.prepare("DELETE FROM attempts WHERE ip=?").bind(ip)]);
  return out({ok:true},200,{"Set-Cookie":cookie(key,28800)});
 }
 const m=(req.headers.get("Cookie")||"").match(/(?:^|;\s*)__Host-pacifica_admin=([a-f0-9]{64})(?:;|$)/),session=m?await hash(m[1]):"";
 if(!session||!(await db.prepare("SELECT hash FROM sessions WHERE hash=? AND expires>?").bind(session,now()).first()))return out({error:"Entre no painel."},401);
 if(p==="/api/admin/manage")return manage(req,db);
 if(p==="/api/admin/health"&&req.method==="GET")return out({database:!!db,adminSession:true,mercadoPagoConfigured:!!(env.PACIFICA_MP_ACCESS_TOKEN),checkoutReady:false});
 if(p==="/api/admin/logout"&&req.method==="POST"){await db.prepare("DELETE FROM sessions WHERE hash=?").bind(session).run();return out({ok:true},200,{"Set-Cookie":cookie("",0)})}
 if(p==="/api/admin/orders"&&req.method==="GET"){
  // Never return fake orders. A missing migration is explicitly reported.
  let data;try{
   data=await db.prepare("SELECT id,customer_name,status,payment_status,payment_method,total_cents,created_at,paid_at FROM orders ORDER BY created_at DESC LIMIT 100").all();
  }catch(e){if(/no such table: orders/i.test(String(e)))return out({error:"Base de pedidos não configurada. Aplique backend/orders.sql."},503);throw e}
  return out({orders:data.results});
 }
 if(p==="/api/admin/sales-summary"&&req.method==="GET"){
  let summary;try{
   summary=await db.prepare("SELECT COUNT(*) AS total_orders, SUM(CASE WHEN payment_status='pending' THEN 1 ELSE 0 END) AS pending_orders, SUM(CASE WHEN payment_status='approved' THEN 1 ELSE 0 END) AS paid_orders, COALESCE(SUM(CASE WHEN payment_status='approved' AND status NOT IN ('cancelled','refunded') THEN total_cents ELSE 0 END),0) AS paid_total_cents FROM orders").first();
  }catch(e){if(/no such table: orders/i.test(String(e)))return out({error:"Base de pedidos não configurada. Aplique backend/orders.sql."},503);throw e}
  return out({summary:{totalOrders:summary.total_orders,pendingOrders:summary.pending_orders,paidOrders:summary.paid_orders,paidTotalCents:summary.paid_total_cents}});
 }
 if(p==="/api/admin/products"&&req.method==="GET")return out({products:await products(db,true)});
 if(p==="/api/admin/products"&&req.method==="POST"){
  const b=await body(req),x=b.product;
  if(!x||typeof x.id!=="string"||!/^[a-zA-Z0-9_-]{1,120}$/.test(x.id)||typeof x.name!=="string"||!x.name.trim()||x.name.length>200||typeof x.brand!=="string"||!x.brand.trim()||x.brand.length>100||!cats.includes(x.category)||typeof x.code!=="string"||x.code.length>60||!Number.isSafeInteger(x.priceCents)||x.priceCents<1||x.priceCents>100000000||!Number.isSafeInteger(x.compareCents)||x.compareCents<0||x.compareCents>100000000||!Number.isSafeInteger(x.stock)||x.stock<0||x.stock>100000||x.minStock!==undefined&&(!Number.isSafeInteger(x.minStock)||x.minStock<0||x.minStock>100000)||typeof x.visible!=="boolean"||!Array.isArray(x.images)||x.images.length>5||x.visible&&!x.images.length)return out({error:"Confira os campos e adicione uma foto para publicar."},400);
  if(x.discountPercent!==undefined){const n=x.discountPercent;if(!Number.isInteger(n)||n<0||n>99||n===0&&x.compareCents!==0||n>0&&(x.compareCents<=x.priceCents||Math.max(1,Math.round(x.compareCents*(100-n)/100))!==x.priceCents))return out({error:"Preço promocional inconsistente."},400);}
  if(x.compareCents&&x.compareCents<=x.priceCents)return out({error:"O preço normal deve ser maior que o promocional."},400);
  if(x.parcel!==undefined&&x.parcel!==null&&!validParcel(x.parcel)||x.shippingAllowed!==undefined&&typeof x.shippingAllowed!=="boolean"||x.shippingAllowed===true&&!validParcel(x.parcel))return out({error:"Confira peso e dimensões antes de habilitar o frete."},400);
  const old=await db.prepare("SELECT payload,version FROM products WHERE id=?").bind(x.id).first();if(old?old.version!==b.version:b.version!==0)return out({error:"Produto alterado em outra sessão. Atualize."},409);
  if(x.code&&await db.prepare("SELECT id FROM products WHERE id<>? AND lower(json_extract(payload,'$.brand'))=lower(?) AND lower(json_extract(payload,'$.code'))=lower(?) LIMIT 1").bind(x.id,x.brand.trim(),x.code.trim()).first())return out({error:"Código duplicado para esta marca."},409);
  const photos=[],ops=[];
  for(const s of x.images){if(pathPhoto(s)){photos.push(s);continue}if(typeof s!=="string"||s.length>440000||!/^data:image\/webp;base64,UklG[A-Za-z0-9+/]+={0,2}$/.test(s))return out({error:"Foto inválida."},400);const id=await hash(s);ops.push(db.prepare("INSERT OR IGNORE INTO photos(id,data) VALUES (?,?)").bind(id,s));photos.push("/api/photos/"+id)}
  const clean={...(old?JSON.parse(old.payload):{}),id:x.id,name:x.name.trim(),brand:x.brand.trim(),code:x.code.trim(),category:x.category,priceCents:x.priceCents,compareCents:x.compareCents,discountPercent:x.discountPercent??(x.compareCents>x.priceCents?Math.min(99,Math.max(1,Math.round(100*(1-x.priceCents/x.compareCents)))):0),stock:x.stock,minStock:x.minStock??5,description:String(x.description||"").slice(0,12000),image:photos[0]||"",images:photos,visible:x.visible,demo:false,reference:false,catalog:false,...(x.parcel!==undefined?{parcel:x.parcel,shippingAllowed:x.shippingAllowed===true}:{} )};
  ops.push(old?db.prepare("UPDATE products SET payload=?,visible=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?").bind(JSON.stringify(clean),x.visible?1:0,x.id,b.version):db.prepare("INSERT INTO products(id,payload,visible) VALUES(?,?,?)").bind(x.id,JSON.stringify(clean),x.visible?1:0));
  const r=await db.batch(ops);if(r.at(-1)?.meta?.changes!==1)return out({error:"Alteração concorrente. Atualize."},409);return out({ok:true});
 }
 return out({error:"Não encontrado."},404);
}
// Security policy applies to ALL Pages responses, including assets served by env.ASSETS.
// Cloudflare Pages advanced-mode _worker.js does not automatically enforce _headers.
const securityPolicy=[
 "default-src 'self'",
 "base-uri 'self'",
 "object-src 'none'",
 "frame-ancestors 'none'",
 "form-action 'self'",
 "script-src 'self' https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js",
 "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
 "font-src 'self' data: https://fonts.gstatic.com",
 "img-src 'self' data: https:",
 "media-src 'self' https:",
 "connect-src 'self' https://nifvycrvqnzbxgglhlky.supabase.co https://viacep.com.br",
 "upgrade-insecure-requests"
].join("; ");
const privateAsset=/^\/(?:conta|admin)\.html$|^\/(?:auth-config|pacifica-auth|conta|admin-pacifica|pacifica-management|cep)\.(?:mjs|js)$/;
function securityHeaders(req,response){
 const requestURL=new URL(req.url),pathname=requestURL.pathname;
 const headers=new Headers(response.headers);
 // Prevent pre-launch Pages previews from being indexed; custom domains remain eligible later.
 if(requestURL.hostname.endsWith(".pages.dev"))headers.set("X-Robots-Tag","noindex, nofollow");
 headers.set("Content-Security-Policy",securityPolicy);
 headers.set("X-Frame-Options","DENY");
 headers.set("X-Content-Type-Options","nosniff");
 headers.set("Strict-Transport-Security","max-age=31536000");
 headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
 headers.set("Referrer-Policy",privateAsset.test(pathname)||pathname.startsWith("/api/")?"no-referrer":"strict-origin-when-cross-origin");
 if(privateAsset.test(pathname)){
  headers.set("Cache-Control","no-store, max-age=0");
  headers.set("Pragma","no-cache");
  headers.set("X-Robots-Tag","noindex, nofollow");
  headers.delete("Access-Control-Allow-Origin");
 }
 if(pathname.startsWith("/api/")&&!pathname.startsWith("/api/photos/"))headers.set("Cache-Control","no-store");
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export default {async fetch(req,env){
 let response;
 try{response=await route(req,env)}
 catch(e){console.error("Pacifica API",e?.message||"Error");response=out({error:"Não foi possível concluir a solicitação."},500)}
 return securityHeaders(req,response);
}};
