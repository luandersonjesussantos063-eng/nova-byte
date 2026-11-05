// Readiness only. No secrets, customer data, or provider requests are returned.
const asJson = (body, status=200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'access-control-allow-origin':'same-origin'
  }
});
export function onRequestGet({env}) {
  return asJson({
    loja:'Kaia Glow',
    fase:'homologacao',
    checkoutAtivo:false,
    pagamentos:{
      fornecedor:'Mercado Pago',
      integracao:'Checkout Pro via Orders API',
      credenciaisTesteConfiguradas:!!env.KAIA_MP_TEST_ACCESS_TOKEN,
      webhookAssinaturaConfigurada:!!env.KAIA_MP_WEBHOOK_SECRET,
      pedidosTransacionaisProntos:false
    },
    frete:{
      provedorEscolhido:env.KAIA_SHIPPING_PROVIDER==='superfrete'?'SuperFrete':env.KAIA_SHIPPING_PROVIDER==='melhor_envio'?'Melhor Envio':'pendente',
      integracaoDisponivel:['superfrete','melhor_envio'],
      credenciaisConfiguradas:env.KAIA_SHIPPING_PROVIDER==='superfrete'?!!env.KAIA_SF_ACCESS_TOKEN:env.KAIA_SHIPPING_PROVIDER==='melhor_envio'?!!env.KAIA_ME_ACCESS_TOKEN:false,
      cepOrigemConfigurado:/^\d{8}$/.test(String(env.KAIA_SHIP_FROM_CEP||'')),
      catalogoPronto:false,
      consultaDeFreteAtiva:env.KAIA_SHIPPING_PROVIDER==='superfrete'&&env.KAIA_SF_MODE==='production'&&!!env.KAIA_SF_ACCESS_TOKEN,
      consultaSemPagamento:true,
      itensComPesoEDimensoes:43,
      itensComMedidasPendentes:8
    },
    aviso:'Checkout desativado. Sem cobrança nem envio contratado.'
  });
}
