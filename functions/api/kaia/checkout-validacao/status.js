// Server-only readiness for Kaia Glow R$ 5.00 validation purchase.
// Intentionally does not create an order, does not use the token, and never returns secrets.
// The pilot is fail-closed until order persistence, signed webhooks and authorization are deployed.
export async function onRequestGet({env}) {
 const productionTokenPresent=typeof env.KAIA_MP_PROD_ACCESS_TOKEN==='string' && env.KAIA_MP_PROD_ACCESS_TOKEN.length>0;
 const webhookSecretPresent=typeof env.KAIA_MP_PROD_WEBHOOK_SECRET==='string' && env.KAIA_MP_PROD_WEBHOOK_SECRET.length>0;
 const storageConfigured=typeof env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY==='string' && !!env.KAIA_MP_PROD_SUPABASE_URL;
 return new Response(JSON.stringify({
  amount_cents:500,
  currency:'BRL',
  productionTokenPresent,
  webhookSecretPresent,
  storageConfigured,
  paymentEnabled:false,
  next:'Aguarda implementacao e validacao do fluxo de pagamento real e confirmacao por webhook.'
 }),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}});
}
