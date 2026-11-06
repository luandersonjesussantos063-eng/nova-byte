// Kaia Glow: fail-closed scaffold for a future isolated R$ 5.00 live-payment pilot.
// Not imported into any existing Kaia site or payment-test Worker.
// No Mercado Pago API calls, no order creation, no payments.
export default {
  async fetch(request, env) {
    return new Response(JSON.stringify({
      code: "KAIA_REAL_PILOT_NOT_ENABLED",
      message: "Piloto real de R$ 5,00 em preparação. Nenhuma cobrança está disponível.",
      amount_cents: 500,
      currency: "BRL",
      checkout_enabled: false
    }), {
      status: 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer"
      }
    });
  }
};
