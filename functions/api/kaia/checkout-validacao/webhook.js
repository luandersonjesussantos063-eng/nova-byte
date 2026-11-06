// Production-only Mercado Pago webhook receiver for Kaia Glow R$5 purchase.
// SAFE-INCOMPLETE: validates signature and authenticated order but NEVER acknowledges an
// event as processed, because durable reconciliation is not wired yet. No charges created.
const json=(code,status)=>new Response(JSON.stringify({code}),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow'}});
const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
function equalHex(a,b) {
 if(!/^[0-9a-f]{64}$/i.test(a)||!/^[0-9a-f]{64}$/i.test(b))return false;
 let mismatch=0;
 for(let i=0;i<64;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
 return mismatch===0;
}
async function signatureIsValid(request,secret,id){
 const raw=request.headers.get('x-signature')||'';
 const rid=request.headers.get('x-request-id')||'';
 if(!rid||rid.length>160)return false;
 const ts=/\bts=(\d{10,13})\b/.exec(raw)?.[1],v1=/\bv1=([a-f0-9]{64})\b/i.exec(raw)?.[1];
 if(!ts||!v1)return false;
 // Mercado Pago's manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 const manifest='id:'+id.toLowerCase()+';request-id:'+rid+';ts:'+ts+';';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sum=hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(manifest))));
 return equalHex(sum,v1.toLowerCase());
}
export async function onRequestPost({request,env}) {
 if(!env.KAIA_MP_PROD_ACCESS_TOKEN||!env.KAIA_MP_PROD_WEBHOOK_SECRET)return json('CREDENCIAIS_PRODUCAO_PENDENTES',503);
 const u=new URL(request.url);
 if(u.protocol!=='https:'||!['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(u.hostname))return json('ORIGEM_INCORRETA',403);
 const id=u.searchParams.get('data.id');
 if(!id||!/^ORD[A-Z0-9]{6,64}$/i.test(id)||!await signatureIsValid(request,env.KAIA_MP_PROD_WEBHOOK_SECRET,id))return json('ASSINATURA_INVALIDA',401);
 let body;
 try {
  if(Number(request.headers.get('content-length')||0)>16000)return json('EVENTO_EXCESSIVO',413);
  const text=await request.text();
  if(text.length>16000)return json('EVENTO_EXCESSIVO',413);
  body=JSON.parse(text);
 } catch {return json('EVENTO_INVALIDO',400);}
 if(body?.live_mode!==true||!['order','orders_v2'].includes(body.type)||String(body.data?.id)!==id)return json('EVENTO_NAO_AUTORIZADO',400);
 let response;
 try {response=await fetch('https://api.mercadopago.com/v1/orders/'+encodeURIComponent(id),{
   headers:{Authorization:'Bearer '+env.KAIA_MP_PROD_ACCESS_TOKEN,Accept:'application/json'},
   signal:AbortSignal.timeout(6000)});
 } catch{return json('CONSULTA_PROVEDOR_INDISPONIVEL',503);}
 if(!response.ok)return json('CONSULTA_PROVEDOR_FALHOU',503);
 let order;try{order=await response.json();}catch{return json('RESPOSTA_PROVEDOR_INVALIDA',503);}
 if(order?.id!==id||order?.live_mode!==true||order?.currency!=='BRL'||order?.total_amount!=='5.00')return json('ORDER_DIVERGENTE',409);
 // Never acknowledge 200 until transaction is reconciled and committed atomically.
 return json('PERSISTENCIA_TRANSACIONAL_PENDENTE',503);
}
