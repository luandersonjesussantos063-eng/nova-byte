// Validate Mercado Pago webhooks, but NEVER acknowledge payment until durable order processing exists.
const respond=(code,status)=>new Response(JSON.stringify({code}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const equal=(a,b)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0};
export async function verifyMpWebhook(request,secret){
 const url=new URL(request.url),id=url.searchParams.get('data.id')||url.searchParams.get('data_id');
 const reqId=request.headers.get('x-request-id'),signature=request.headers.get('x-signature')||'';
 const parts=Object.fromEntries(signature.split(',').map(s=>s.trim().split('=',2)).filter(a=>a.length===2));
 if(!id||!reqId||!(/^[0-9]{10,16}$/).test(parts.ts||'')||!(/^[0-9a-f]{64}$/i).test(parts.v1||''))return false;
 const message='id:'+id.toLowerCase()+';request-id:'+reqId+';ts:'+parts.ts+';';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const result=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));
 const hash=Array.from(new Uint8Array(result)).map(x=>x.toString(16).padStart(2,'0')).join('');
 return equal(hash,parts.v1.toLowerCase());
}
export async function onRequestPost({request,env}){
 if(!env.KAIA_MP_WEBHOOK_SECRET)return respond('WEBHOOK_EM_CONFIGURACAO',503);
 if(!(await verifyMpWebhook(request,env.KAIA_MP_WEBHOOK_SECRET)))return respond('ASSINATURA_INVALIDA',401);
 // No 200 until server-side provider lookup, idempotency and atomic stock reconciliation are live.
 return respond('PROCESSAMENTO_AINDA_NAO_HABILITADO',503);
}
