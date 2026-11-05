// Deliberately fail-closed until stock reservation, idempotent order persistence,
// server-side totals, authenticated checkout and MP Orders API are fully verified.
const noStore={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
export function onRequestPost() {
  return new Response(JSON.stringify({
    code:'CHECKOUT_NAO_HABILITADO',
    message:'O pagamento da Kaia Glow ainda está em configuração. Nenhuma cobrança foi iniciada.',
    chargeCreated:false
  }),{status:503,headers:noStore});
}
