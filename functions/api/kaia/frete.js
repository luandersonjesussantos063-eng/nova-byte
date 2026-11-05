// Kaia Glow: live SuperFrete quote-only endpoint. Never creates labels, orders or payments.
// Source of parcel reference: owner-confirmed Nuvemshop export + researched listings,
// reconciled with Supabase 2026-11-05; this is NOT a transactional inventory or checkout.
// Shipping estimates exclude insurance pending merchant-approved sale prices.
const PARCELS={"KG-ANU-PDRNGLOW-60P":[180,8,8,10,"nuvemshop"],"KG-APR-TXA99-WRAP-80ML":[120,10,5,16,"nuvemshop"],"KG-ARE-PDRNBOOST-30ML":[20,5,5,18,"nuvemshop"],"KG-ARO-SUPCOLL-43G":[180,22,15,7,"nuvemshop"],"KG-ARO-SUPCOLL-WRAP-80ML":[10,1,14,20,"nuvemshop_revisar"],"KG-AUS-PIMPLESTAR-150P":[200,15,15,8,"nuvemshop"],"KG-BIO-BCOLL-DEEP-34G":[80,8,15,15,"nuvemshop"],"KG-BIO-CPDRN-EYE30":[20,7,10,10,"nuvemshop_revisar"],"KG-BOJ-GPRC-100ML":[180,22,15,7,"nuvemshop"],"KG-BOJ-RS-RICENIA-50ML":[69,14.2,3.8,3.2,"web"],"KG-BOJ-RSAF-50ML":[100,22,15,7,"nuvemshop"],"KG-CEL-RETBOOST-15ML":[20,15,15,15,"nuvemshop"],"KG-CEL-RETDUAL-50ML":[90,15.1,4.5,3.8,"web"],"KG-CEN-360PDRN-50ML":[150,5,5,14,"nuvemshop"],"KG-CHO-NNLIPS":[20,5,5,15,"nuvemshop"],"KG-CKD-RETICOLL-MASK-31G":[50,22,15,7,"nuvemshop"],"KG-DAL-FIRSTSPRAY-100ML":[185,15.88,4.95,4.95,"web"],"KG-DHC-BULGROSE-40CAP":[10,10,1,10,"nuvemshop"],"KG-DRA-345RC-50ML":[83,15.2,7.7,3.2,"web"],"KG-ELI-CER100-OIL-100ML":[140,13,6,5.5,"web"],"KG-FIN-GENLUXE-MASK-200G":[230,22,15,7,"nuvemshop"],"KG-FIN-OIL-AIRY-70ML":[20,22,15,7,"nuvemshop_revisar"],"KG-FIN-OIL-CLASSIC-70ML":[170,22,15,7,"nuvemshop"],"KG-FUL-GTCP-120ML":[30,22,15,7,"nuvemshop_revisar"],"KG-FUL-RTJMC-120ML":[20,22,15,7,"nuvemshop_revisar"],"KG-MAR-WRPATCH-36P":[20,10,1,10,"nuvemshop"],"KG-MED-EGFNAD-30ML":[30,8,8,8,"nuvemshop"],"KG-MED-EXO7500-30ML":[150,22,15,7,"nuvemshop"],"KG-MED-PDRNPINK-MASK-28G":[30,8,8,8,"nuvemshop"],"KG-MED-TXANI15-30ML":[20,5,5,18,"nuvemshop_revisar"],"KG-MED-ZEROPAD2-70P":[300,22,15,7,"nuvemshop"],"KG-MIS-PERFSER-ORI-80ML":[118,15,4.5,3,"web"],"KG-NUM-N9-EYE-10ML":[10,22,15,7,"nuvemshop"],"KG-PUR-TXA6NI10RET-30ML":[150,22,15,7,"nuvemshop"],"KG-RET-EAR-CRYSTAL-10P":[20,22,15,7,"nuvemshop"],"KG-SK1-LCOIL-200ML":[370,22,15,7,"nuvemshop"],"KG-SK1-TBBTONER-210ML":[380,22,15,7,"nuvemshop"],"KG-SK1-TBCA-100ML":[310,22,15,7,"nuvemshop"],"KG-TIR-CMA-40ML":[180,22,15,7,"nuvemshop"],"KG-VIV-REVIVE-15ML":[20,3,3,15,"nuvemshop"],"KG-VT-PDRN-BRUSH-100ML":[155,15.8,9.2,3.9,"web"],"KG-VT-RS300-50ML":[20,22,15,7,"nuvemshop_revisar"],"KG-VT-RSLIFT-30ML":[150,20,15,7,"nuvemshop"]};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'
}});
const fail=(code,message,status=422,extra={})=>json({code,message,freteDisponivel:false,...extra},status);
const digits=s=>String(s??'').replace(/\D/g,'');
const validSku=s=>/^KG-[A-Z0-9-]{4,90}$/.test(s);
function parseItems(raw){
 if(!Array.isArray(raw)||!raw.length||raw.length>12)throw Error('Inclua de 1 a 12 produtos.');
 const merged=new Map();
 for(const row of raw){
  const sku=String(row?.sku||'');const qty=row?.quantity;
  if(!validSku(sku)||!Number.isSafeInteger(qty)||qty<1||qty>10)throw Error('Confira produto e quantidade (1 a 10).');
  merged.set(sku,(merged.get(sku)||0)+qty);
  if(merged.get(sku)>10)throw Error('Quantidade máxima por produto excedida.');
 }
 return [...merged].map(([sku,quantity])=>({sku,quantity}));
}
export async function onRequestPost({request,env}){
 const origin=request.headers.get('origin');
 const url=new URL(request.url);
 if(origin && origin!==url.origin) return fail('ORIGEM_INVALIDA','Origem não autorizada.',403);
 if(request.headers.get('sec-fetch-site')==='cross-site')return fail('ORIGEM_INVALIDA','Origem não autorizada.',403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
  return fail('TIPO_INVALIDO','Envie JSON.');
 if(env.KAIA_SHIPPING_PROVIDER!=='superfrete'||!env.KAIA_SF_ACCESS_TOKEN||
    env.KAIA_SF_MODE!=='production'||
    !/^\d{8}$/.test(digits(env.KAIA_SHIP_FROM_CEP))||
    !/^(1|2|3|17|33)(,(1|2|3|17|33))*$/.test(String(env.KAIA_SF_SERVICES||''))||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(env.KAIA_SHIPPING_TECH_CONTACT||'')))
  return fail('FRETE_EM_CONFIGURACAO','Consulta de frete temporariamente indisponível.',503);
 let raw;
 try{raw=await request.text()}catch{return fail('REQUISICAO_INVALIDA','Não foi possível ler os dados.');}
 if(raw.length>12000)return fail('PEDIDO_GRANDE','Dados excessivos.',413);
 let cep,items;
 try{const data=JSON.parse(raw);cep=digits(data?.destinoCep);
  if(!/^\d{8}$/.test(cep))throw Error('Informe um CEP de destino com 8 dígitos.');
  items=parseItems(data?.items);
 }catch(e){return fail('DADOS_INVALIDOS',e.message,422);}
 const missing=items.filter(({sku})=>!PARCELS[sku]).map(({sku})=>sku);
 if(missing.length)return fail('MEDIDAS_PENDENTES',
  'Um ou mais produtos ainda não possuem peso e dimensões completos para cotação.',409,
  {skusPendentes:missing});
 const products=items.map(({sku,quantity})=>{
  const [grams,length,width,height,origem]=PARCELS[sku];
  // Respect carrier minimum parcel sides when source lists a smaller product box.
  return {sku,quantity,length:Math.max(13,length),width:Math.max(8,width),
   height:Math.max(1,height),weight:Math.max(0.01,grams/1000),origem};
 });
 const itemCount=items.reduce((a,x)=>a+x.quantity,0);
 if(itemCount>24)return fail('QUANTIDADE_INVALIDA','Limite de itens por cotação excedido.');
 const payload={
  from:{postal_code:digits(env.KAIA_SHIP_FROM_CEP)},to:{postal_code:cep},
  services:String(env.KAIA_SF_SERVICES),
  products:products.map(p=>({width:p.width,height:p.height,length:p.length,weight:p.weight,quantity:p.quantity})),
  options:{receipt:false,own_hand:false,insurance_value:0,use_insurance_value:false}
 };
 let resp;
 try{resp=await fetch('https://api.superfrete.com/api/v0/calculator',{
  method:'POST',headers:{Authorization:'Bearer '+env.KAIA_SF_ACCESS_TOKEN,
   Accept:'application/json','Content-Type':'application/json',
   'User-Agent':'KaiaGlow/1.0 ('+env.KAIA_SHIPPING_TECH_CONTACT+')'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
 })}catch{return fail('COTACAO_INDISPONIVEL','A transportadora não respondeu. Tente novamente.',503)}
 if(!resp.ok)return fail('COTACAO_INDISPONIVEL','Não foi possível consultar as transportadoras agora.',503);
 let data;
 try{data=await resp.json()}catch{return fail('RESPOSTA_INVALIDA','A transportadora enviou uma resposta inválida.',503)}
 const options=(Array.isArray(data)?data:[]).flatMap(q=>{
  if(q.has_error===true)return [];
  const price=Number(q.price),days=Number(q.delivery_time);
  if(!q.id||!Number.isFinite(price)||price<=0||!Number.isSafeInteger(days)||days<0)return [];
  return [{id:String(q.id),servico:String(q.name||''),transportadora:String(q.company?.name||''),
   freteCentavos:Math.round(price*100),previsaoDias:days}];
 });
 if(!options.length)return fail('SEM_COTACAO',
  'Nenhuma modalidade disponível para este CEP e as medidas cadastradas.',422);
 const hasUnreviewed=products.some(p=>p.origem!=='nuvemshop');
 return json({freteDisponivel:true,consultaPrevia:true,checkoutAtivo:false,
  cepOrigem:digits(env.KAIA_SHIP_FROM_CEP),cepDestino:cep,
  referenciasExternas:hasUnreviewed,
  opcoes:options,
  aviso:'Estimativa da SuperFrete com as medidas cadastradas; valor final, seguro e embalagem serão conferidos antes da compra. Compras ainda indisponíveis.'
 });
}
