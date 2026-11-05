// Kaia Glow: server-authoritative freight quote. Provider credentials and
// service_role are Cloudflare Pages encrypted secrets, never included in frontend.
// No fallback rate, no guessed stock/parcel size, no payment initiation.
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer'
}});
const digits = x => String(x||'').replace(/\D/g,'');
const validSku = s => /^KG-[A-Z0-9-]{4,90}$/.test(s);
const inRange = (n,lo,hi) => Number.isFinite(n)&&n>=lo&&n<=hi;
const isMoney = n=>Number.isSafeInteger(n)&&n>0&&n<100000000;
const fail=(code,message,status=422)=>json({code,message,freteDisponivel:false},status);

function parseItems(raw){
 if(!Array.isArray(raw)||raw.length===0||raw.length>12)throw new Error('Inclua de 1 a 12 produtos.');
 const combined=new Map();
 for(const item of raw){
  const sku=String(item?.sku||'');
  const qty=item?.quantity;
  if(!validSku(sku)||!Number.isSafeInteger(qty)||qty<1||qty>10)throw new Error('Confira SKU e quantidade (1 a 10).');
  combined.set(sku,(combined.get(sku)||0)+qty);
  if(combined.get(sku)>10)throw new Error('Quantidade máxima por SKU excedida.');
 }
 return [...combined].map(([sku,quantity])=>({sku,quantity}));
}
async function authoritativeItems(env,items){
 const key=env.KAIA_SUPABASE_SERVICE_ROLE_KEY,base='https://vajlhodqxskozuxxlujv.supabase.co';
 if(!key)throw new Error('SUPABASE_NOT_CONFIGURED');
 const inParam=items.map(x=>x.sku).join(',');
 const path='/rest/v1/kaia_sale_inventory?select=sku,display_name,sale_price_cents,available_units,weight_grams,length_cm,width_cm,height_cm,price_verified_at,stock_verified_at,package_verified_at&sku=in.('+encodeURIComponent(inParam)+')';
 const resp=await fetch(base+path,{headers:{apikey:key,Authorization:'Bearer '+key,Accept:'application/json'},signal:AbortSignal.timeout(10000)});
 if(!resp.ok)throw new Error('CATALOG_UNAVAILABLE');
 const rows=await resp.json();
 if(!Array.isArray(rows))throw new Error('CATALOG_UNAVAILABLE');
 const map=new Map(rows.map(x=>[x.sku,x]));
 const products=[];
 for(const {sku,quantity} of items){
  const p=map.get(sku);
  if(!p||!p.price_verified_at||!p.stock_verified_at||!p.package_verified_at
     ||!isMoney(p.sale_price_cents)||!Number.isInteger(p.available_units)||p.available_units<quantity
     ||!inRange(p.weight_grams,1,30000)
     ||!inRange(Number(p.width_cm),1,200)||!inRange(Number(p.length_cm),1,200)||!inRange(Number(p.height_cm),1,200)
  )throw new Error('PRODUCT_NOT_VERIFIED');
  products.push({sku,quantity,price_cents:p.sale_price_cents,name:p.display_name,
    width:Number(p.width_cm),height:Number(p.height_cm),length:Number(p.length_cm),weight:p.weight_grams/1000});
 }
 return products;
}
export async function onRequestPost({request,env}){
 if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin)
   return fail('ORIGEM_INVALIDA','Origem não autorizada.',403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
   return fail('TIPO_INVALIDO','Envie JSON.');
 const provider=env.KAIA_SHIPPING_PROVIDER;
 if(!['melhor_envio','superfrete'].includes(provider))
   return fail('FRETE_EM_CONFIGURACAO','A transportadora ainda não foi definida. Nenhuma tarifa foi calculada.',503);
 const from=digits(env.KAIA_SHIP_FROM_CEP);
 const accessToken=provider==='superfrete'?env.KAIA_SF_ACCESS_TOKEN:env.KAIA_ME_ACCESS_TOKEN;
 if(!/^\d{8}$/.test(from)||!accessToken||!env.KAIA_SUPABASE_SERVICE_ROLE_KEY)
   return fail('CONFIGURACAO_PENDENTE','Faltam CEP de postagem e credenciais de frete/banco no servidor.',503);
 const sfServices=String(env.KAIA_SF_SERVICES||'');
 // Never infer selected shipping services or use an unverified API contact identity.
 if(provider==='superfrete'&&(
   !/^(1|2|3|17|33)(,(1|2|3|17|33))*$/.test(sfServices)||
   !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(env.KAIA_SHIPPING_TECH_CONTACT||''))))
   return fail('CONFIGURACAO_PENDENTE','Configure os serviços SuperFrete e o contato técnico autorizado.',503);
 const raw=await request.text();
 if(raw.length>12000)return fail('PEDIDO_GRANDE','Quantidade de dados excessiva.',413);
 let dest,items;
 try{
  const payload=JSON.parse(raw);
  dest=digits(payload.destinoCep);
  if(!/^\d{8}$/.test(dest))throw new Error('Informe um CEP de destino com 8 dígitos.');
  items=parseItems(payload.items);
 }catch(e){return fail('VALIDACAO',e.message);}
 let products;
 try{products=await authoritativeItems(env,items);}
 catch(e){
  if(e.message==='PRODUCT_NOT_VERIFIED')return fail('DADOS_NAO_CONFERIDOS','Produto sem preço, estoque atual ou medidas confirmados. Consulte a loja antes do pagamento.',409);
  return fail('CATALOGO_INDISPONIVEL','Não foi possível validar o catálogo com o servidor.',503);
 }
 const subtotal=products.reduce((sum,p)=>sum+p.price_cents*p.quantity,0);
 if(!Number.isSafeInteger(subtotal)||subtotal>100000000)return fail('TOTAL_INVALIDO','O total precisa de revisão.',422);
 // The SuperFrete adapter is staged: API shape must be verified with a test token
 // and the selected shipping services before any production quote is exposed.
 const sandbox=provider==='superfrete'?env.KAIA_SF_MODE!=='production':env.KAIA_ME_MODE!=='production';
 const endpoint=provider==='superfrete'
   ?(sandbox?'https://sandbox.superfrete.com':'https://api.superfrete.com')+'/api/v0/calculator'
   :(sandbox?'https://sandbox.melhorenvio.com.br':'https://melhorenvio.com.br')+'/api/v2/me/shipment/calculate';
 const payload=provider==='superfrete'?{
   from:{postal_code:from},to:{postal_code:dest},
   services:sfServices,
   products:products.map(p=>({width:p.width,height:p.height,length:p.length,weight:p.weight,quantity:p.quantity})),
   options:{receipt:false,own_hand:false,insurance_value:subtotal/100,use_insurance_value:true}
 }:{
   from:{postal_code:from},to:{postal_code:dest},
   products:products.map(p=>({id:p.sku,width:p.width,height:p.height,length:p.length,
     weight:p.weight,insurance_value:p.price_cents/100,quantity:p.quantity})),
   options:{receipt:false,own_hand:false}
 };
 const agent=provider==='superfrete'
  ?'KaiaGlow/1.0 ('+env.KAIA_SHIPPING_TECH_CONTACT+')'
  :'KaiaGlow/1.0 (frete ecommerce)';
 let resp;
 try{
  resp=await fetch(endpoint,{method:'POST',headers:{
   Authorization:'Bearer '+accessToken,Accept:'application/json',
   'Content-Type':'application/json','User-Agent':agent
  },body:JSON.stringify(payload),signal:AbortSignal.timeout(16000)});
 }catch{return fail('COTACAO_INDISPONIVEL','Não foi possível consultar as transportadoras.',503)}
 if(!resp.ok)return fail('COTACAO_INDISPONIVEL','Transportadoras não retornaram uma cotação válida.',503);
 let data;
 try{data=await resp.json();}catch{return fail('RESPOSTA_INVALIDA','Erro na resposta da transportadora.',503)}
 const options=(Array.isArray(data)?data:[]).flatMap(q=>{
  if(q.has_error===true)return [];
  const value=Number(provider==='superfrete'?q.price:q.custom_price);
  const days=Number(provider==='superfrete'?q.delivery_time:q.custom_delivery_time);
  if(!Number.isFinite(value)||value<0||!Number.isSafeInteger(days)||days<0||!q.id||!q.company?.name)return [];
  const cents=Math.round(value*100);
  return [{id:String(q.id),servico:String(q.name||''),transportadora:String(q.company.name),
    freteCentavos:cents,previsaoDias:days,totalCentavos:subtotal+cents}];
 });
 if(!options.length)return fail('SEM_COTACAO','Nenhuma modalidade está disponível para este CEP e pacote.',422);
 return json({freteDisponivel:true,homologacao:sandbox,subtotalCentavos:subtotal,opcoes:options,
   aviso:'Cotação de referência sujeita a recálculo no checkout. Nenhum pagamento foi iniciado.'});
}