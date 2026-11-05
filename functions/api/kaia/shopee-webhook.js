// shopee webhook is DISABLED until seller OAuth, HMAC validation and order idempotency are implemented.
// Do not log credentials, raw events or buyer PII.
export function onRequestPost(){return new Response(JSON.stringify({
 channel:'shopee',connected:false,status:'not_configured',
 message:'A integração da Kaia Glow não está autorizada. Nenhum evento foi processado.'
}),{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
