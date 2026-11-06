// Readiness only. No payment requests or secrets are exposed.
export async function onRequestGet({env}){
 const ready=!!env.KAIA_MP_PROD_ACCESS_TOKEN&&!!env.KAIA_MP_PROD_WEBHOOK_SECRET&&!!env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY;
 return new Response(JSON.stringify({
  amount_cents:500,currency:'BRL',configured:ready,
  checkoutEnabled:ready&&env.KAIA_MP_REAL_R5_ENABLED==='true'
 }),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow'}});
}
