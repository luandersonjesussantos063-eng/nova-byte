// Kaia Glow: transactional order-confirmation dispatch (customer + store).
// Cron-only, one-time database challenge. Never accepts untrusted recipients,
// payment status, price or PII from HTTP input. Production secrets are required.
// Private outbox + provider idempotency avoid duplicate sends on webhook retries.
import {db,PaymentError} from '../checkout-validacao/_core.js';
const json=(x,s=200)=>new Response(JSON.stringify(x),{
 status:s,headers:{'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store','x-robots-tag':'noindex,nofollow'}});
const MERCHANT_EMAIL='Usekaiaglow@gmail.com';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeMail=s=>typeof s==='string'&&s.length<=180&&
 /^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$/.test(s);
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const brl=v=>new Intl.NumberFormat('pt-BR',{
 style:'currency',currency:'BRL'}).format((Number(v)||0)/100);
const dateTime=v=>new Intl.DateTimeFormat('pt-BR',{
 dateStyle:'short',timeStyle:'short',timeZone:'America/Cuiaba'
}).format(new Date(v));
function deliveryEstimate(creation,days){
 if(!Number.isSafeInteger(days)||days<1||days>90)return null;
 const d=new Date(creation);
 if(!Number.isFinite(d.getTime()))return null;
 // Estimate from the day after order creation plus the carrier's business days.
 // Excludes weekends, but carriers/holidays can change the actual delivery date.
 d.setUTCHours(12,0,0,0);
 let count=0,remaining=days+1;
 while(remaining>0&&count++<130){
  d.setUTCDate(d.getUTCDate()+1);
  if(d.getUTCDay()!==0&&d.getUTCDay()!==6)remaining--;
 }
 return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',
 timeZone:'UTC'}).format(d);
}
const textValue=(v,max=200)=>String(v??'').trim().slice(0,max);
function contents(order,kind){
 const id='KG-'+String(order.id||'').replace(/-/g,'').toUpperCase();
 const customer=textValue(order.buyer_name,100);
 const address=order.destination||{};
 const location=[textValue(address.street,180),textValue(address.street_number,15),
  textValue(address.complement,90),textValue(address.neighborhood,90),
  textValue(address.city,80)+' / '+textValue(address.state,2),
  textValue(address.postal_code,12)].filter(Boolean).join(' · ');
 const created=dateTime(order.created_at);
 const eta=deliveryEstimate(order.created_at,order.shipping_days);
 const estimated=eta?'Previsão estimada até '+eta+' (dias úteis, sujeita a feriados e postagem)':
  'Previsão de entrega: em confirmação pela transportadora.';
 const products=Array.isArray(order.items)?order.items:[];
 const free=order.total_cents===0;
 const payment=free?'Cortesia com cupom — nenhum pagamento necessário':
  'Mercado Pago — modalidade escolhida no checkout (Pix, cartão ou outra)';
 const discount=Number(order.discount_cents||0);
 const shipping=Number(order.shipping_cents||0);
 const subtotal=Number(order.list_products_cents??order.products_cents)||0;
 const shippingList=Number(order.list_shipping_cents??order.shipping_cents)||0;
 const orderLines=products.map(x=>{
  const n=textValue(x.name,120),q=Number(x.quantity),u=Number(x.unit_cents);
  const quantity=Number.isSafeInteger(q)&&q>0&&q<=100?q:0;
  const unit=Number.isSafeInteger(u)&&u>=0&&u<=10000000?u:0;
  return {name:n,sku:textValue(x.sku,90),quantity,unit,amount:quantity*unit};
 });
 const buyerLines=[
  'Olá, '+customer+'!',
  'Seu pedido '+id+' foi confirmado na Kaia Glow.',
  'Data: '+created,
  ...orderLines.map(x=>'• '+x.name+' — '+x.quantity+' × '+brl(x.unit)+' = '+brl(x.amount)),
  'Produtos: '+brl(subtotal),
  ...(discount?['Desconto: -'+brl(discount)]:[]),
  'Entrega: '+(free?'Grátis (cortesia da Kaia Glow)':brl(shipping)),
  'Total: '+brl(order.total_cents),
  'Forma de pagamento: '+payment,
  estimated,
  'Endereço de entrega: '+location,
  'Acompanhe pelo site: https://usekaiaglow.com.br/conta.html?aba=pedidos',
  'Equipe Kaia Glow'
 ];
 const sellerLines=[
  'Novo pedido confirmado na Kaia Glow: '+id,
  'Data: '+created,
  'Comprador: '+customer,
  'E-mail: '+textValue(order.buyer_email,180),
  'Telefone: '+textValue(order.buyer_phone,30),
  'CPF: '+textValue(order.buyer_cpf,14),
  'Endereço: '+location,
  ...orderLines.map(x=>'• '+x.name+' | SKU '+textValue(x.sku,90)+
    ' | '+x.quantity+' × '+brl(x.unit)+' = '+brl(x.amount)),
  'Produtos: '+brl(subtotal),
  ...(discount?['Desconto: -'+brl(discount)]:[]),
  'Frete cotado (custo da loja quando grátis): '+brl(shippingList),
  'Frete cobrado do cliente: '+brl(shipping),
  'Total cobrado: '+brl(order.total_cents),
  'Pagamento: '+payment,
  'Cupom: '+textValue(order.coupon_code||'Nenhum',24),
  estimated,
  'Acompanhe e prepare o envio no painel administrativo da Kaia Glow.',
  'https://usekaiaglow.com.br/admin.html'
 ];
 const lines=kind==='buyer'?buyerLines:sellerLines;
 const subject=kind==='buyer'?
  'Kaia Glow • Pedido '+id+' confirmado':
  'Novo pedido '+id+' • '+customer;
 // Only HTML-escape lines, including merchant-entered product names and buyer PII.
 const markup='<div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e9dbe1;border-radius:14px;padding:30px;font:15px/1.65 Arial,sans-serif;color:#3b2b35">'+
  '<div style="font-size:13px;color:#754a63;letter-spacing:3px">KAIA GLOW</div>'+
  '<h1 style="font:600 25px Arial,sans-serif;color:#552942">'+html(kind==='buyer'?
   'Compra confirmada':'Você recebeu um pedido!')+'</h1>'+
  lines.map(x=>'<p style="margin:5px 0;overflow-wrap:anywhere">'+html(x)+'</p>').join('')+
  '<hr style="border:none;border-top:1px solid #eadce4;margin:22px 0">'+
  '<small style="color:#796e76">Mensagem transacional. Não responda com dados de cartão ou senhas.</small></div>';
 return {subject,text:lines.join('\n'),html:markup};
}
async function send(env,to,content,key){
 const rawFrom=env.KAIA_ORDER_EMAIL_FROM;
 if(!safeMail(rawFrom)||!rawFrom.toLowerCase().endsWith('@usekaiaglow.com.br')||
  !safeMail(to)||!env.KAIA_ORDER_EMAIL_API_KEY)
  throw new PaymentError('EMAIL_CONFIGURACAO_PENDENTE',503);
 let r;
 try{
  r=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{
    Authorization:'Bearer '+env.KAIA_ORDER_EMAIL_API_KEY,
    'Content-Type':'application/json','Idempotency-Key':key
   },body:JSON.stringify({from:'Kaia Glow <'+rawFrom+'>',to:[to],
    subject:content.subject,text:content.text,html:content.html}),
   signal:AbortSignal.timeout(10000)
  });
 }catch{throw new PaymentError('EMAIL_FALHA_REDE',503);}
 if(!r.ok)throw new PaymentError(r.status===429?'EMAIL_LIMITE_ENVIO':
  r.status===401||r.status===403?'EMAIL_CREDENCIAIS_INVALIDAS':
  'EMAIL_SERVICO_RECUSOU',503);
 let result;
 try{result=await r.json();}catch{throw new PaymentError('EMAIL_RESPOSTA_INVALIDA',503);}
 if(typeof result?.id!=='string'||!result.id)
  throw new PaymentError('EMAIL_RESPOSTA_INVALIDA',503);
 return result.id;
}
export async function onRequestPost({request,env}){
 try{
  const u=new URL(request.url);
  if(u.protocol!=='https:'||u.hostname!=='usekaiaglow.com.br'||
   u.pathname!=='/api/kaia/order-email/dispatch')
   throw new PaymentError('EMAIL_ORIGEM_INVALIDA',403);
  const nonce=request.headers.get('x-kaia-mail-challenge')||'';
  if(!uuid.test(nonce))throw new PaymentError('EMAIL_DESAFIO_INVALIDO',403);
  const claimed=await db(env,'rpc/kaia_mail_claim_sync','POST',{p_nonce:nonce});
  if(claimed!==true)throw new PaymentError('EMAIL_DESAFIO_EXPIRADO',403);
  // Fail closed until a verified sending domain, recipient and secret exist.
  if(!env.KAIA_ORDER_EMAIL_API_KEY||
   !safeMail(env.KAIA_ORDER_EMAIL_FROM)||
   !env.KAIA_ORDER_EMAIL_FROM.toLowerCase().endsWith('@usekaiaglow.com.br')||
   !safeMail(MERCHANT_EMAIL))
    throw new PaymentError('EMAIL_CONFIGURACAO_PENDENTE',503);
  const batch=await db(env,'rpc/kaia_mail_claim_batch','POST',{});
  if(!Array.isArray(batch))throw new PaymentError('EMAIL_FILA_INVALIDA',503);
  const stats={attempted:0,accepted:0,failed:0};
  for(const job of batch){
   stats.attempted++;
   let success=false,providerId=null,errorCode=null;
   try{
    if(!uuid.test(job.id)||!uuid.test(job.payment_id)||!uuid.test(job.lease_id)||
       !['buyer','merchant'].includes(job.kind))
     throw new PaymentError('EMAIL_ITEM_FILA_INVALIDO',503);
    const order=await db(env,'rpc/kaia_mail_order_details','POST',
     {p_payment_id:job.payment_id});
    if(!order||order.total_cents<0||!safeMail(order.buyer_email))
     throw new PaymentError('EMAIL_PEDIDO_INCOMPLETO',503);
    const to=job.kind==='buyer'?order.buyer_email:MERCHANT_EMAIL;
    const content=contents(order,job.kind);
    providerId=await send(env,to,content,'kaia-confirmed-'+job.payment_id+'-'+job.kind);
    success=true;stats.accepted++;
   }catch(e){
    errorCode=e instanceof PaymentError?e.code:'EMAIL_ERRO_INTERNO';stats.failed++;
   }
   // Durable outcome with lease token; a lost ack will retry idempotently.
   try{await db(env,'rpc/kaia_mail_mark_result','POST',{
    p_id:job.id,p_lease:job.lease_id,p_success:success,
    p_message_id:providerId,p_code:errorCode
   });}catch{/* Avoid leaking details or falsely claiming delivery. */}
  }
  return json({ok:true,providerAccepted:stats.accepted,attempted:stats.attempted,
   failed:stats.failed});
 }catch(e){
  return json({ok:false,code:e instanceof PaymentError?e.code:'EMAIL_DESPACHO_INDISPONIVEL'},
   e instanceof PaymentError?e.status:503);
 }
}
