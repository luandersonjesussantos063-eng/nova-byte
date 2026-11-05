# Kaia Glow — implantação controlada do frete e Mercado Pago

Atualização de 05/11/2026. **NÃO há pagamentos ou fretes prontos para uso comercial.**

## O que está implementado

- Backend Cloudflare Pages Functions com endpoints `/api/kaia/status`, `/api/kaia/frete`, `/api/kaia/checkout` e `/api/kaia/mercado-pago-webhook`; somente `/api/kaia/*` invoca Functions (arquivo `dist/kaia-glow/_routes.json`). Não interfere no site NovaByte.
- `/api/kaia/frete` aceita CEP e SKU/quantidade. Busca preço, estoque e medidas **somente no banco servidor** via service_role, exigindo verificação individual de preço, saldo e embalagem. Sem todos esses requisitos, retorna indisponível e não inventa preço. Quando a proprietária optar por Melhor Envio, estiver autenticada e os dados estiverem conferidos, busca tarifas reais na API (sandbox inicialmente), usa `custom_price` e `custom_delivery_time`.
- `/api/kaia/checkout` devolve HTTP 503 deliberadamente, inclusive se alguém manipular o frontend. Não chama Mercado Pago. A compra nunca é considerada aprovada por parâmetros de retorno da página.
- `/api/kaia/mercado-pago-webhook` verifica assinatura HMAC-SHA256 com `x-signature`/`x-request-id`/`data.id`, sem registrar ou aprovar pagamento. Responde 503 mesmo quando a assinatura é válida, até existir armazenamento durável e reconciliação idempotente. **Não cadastrar essa URL no Mercado Pago como webhook ativo ainda.**
- Supabase: `public.kaia_sale_inventory`, 51 SKUs, RLS habilitado, sem grants para `anon`/`authenticated`. Campos atuais `sale_price_cents`, `available_units` e dimensões estão **NULL**, com verificações pendentes. `reference_price_cents` é referência do levantamento de setembro/2026, não autorização para vender. Registros de setembro e mandarim permanecem em `kaia_private`.

## O que a proprietária precisa resolver

1. **Mercado Pago (da própria empresa)**: criar/regularizar conta comercial e aplicação `Kaia Glow` em https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-application. Escolher `Pagamentos online > Checkout Pro > Orders API`. Deixar em **Teste** inicialmente. Não enviar Access Token, webhook secret ou dados bancários pelo chat ou repositório.
2. **Envio**: confirmar se deseja Melhor Envio (apenas adaptador técnico preparado) ou outra transportadora. Informar **CEP real de postagem**, não necessariamente o endereço do CNPJ. Identificar pesos e dimensões da embalagem pronta para envio por SKU. Conferir se há restrições de produto/transportadora.
3. **Estoque e preços**: atualizar fisicamente o saldo de cada SKU em novembro/2026; revisar preço atual. Não usar a contagem de setembro como saldo atual. Validar os 15 produtos ainda com foto pendente.
4. **Cloudflare**: conectar segredos somente em Workers & Pages > `kaia-glow` > Settings > Variables and Secrets > **Encrypt**. Não repetir chaves no GitHub.
   - `KAIA_SUPABASE_SERVICE_ROLE_KEY`: credencial privada da conta Supabase existente, destinada ao backend; nunca no JS do cliente.
   - `KAIA_SHIPPING_PROVIDER`: `melhor_envio` **após escolha explícita**.
   - `KAIA_SHIP_FROM_CEP`: CEP real de postagem, 8 dígitos, como variável de ambiente.
   - `KAIA_ME_ACCESS_TOKEN`: token de integração Melhor Envio (sandbox primeiro).
   - `KAIA_ME_MODE`: `sandbox` inicialmente. Só `production` após testes.
   - `KAIA_MP_TEST_ACCESS_TOKEN`: Access Token da aplicação Mercado Pago em modo Teste.
   - `KAIA_MP_WEBHOOK_SECRET`: assinatura secreta de Webhooks da aplicação e ambiente correspondente.
5. **Pagamento transacional AINDA NÃO IMPLEMENTADO**: criar/autorizar pedido para usuário logado, calcular total no servidor (itens + frete cotado novamente), reservar estoque atomicamente, criar order Mercado Pago com `X-Idempotency-Key`, registrar `external_reference` e `checkout_url`, validar webhook, consultar status pela API Mercado Pago, vincular e atualizar pedido e estoque idempotentemente. Conferir pagamentos aprovados, pendentes, recusados, cancelamentos e duplicidade antes de remover a trava do `checkout`.
6. **DNS**: `usekaiaglow.com.br` está em transição do Registro.br para Cloudflare; manter registros atuais Nuvemshop e acesso à loja antiga. Não vincular Pages ou substituir www antes dos testes comerciais.

## Endpoints e garantias

- `GET https://kaia-glow.pages.dev/api/kaia/status` — flags de preparação, sem exposição de segredos.
- `POST https://kaia-glow.pages.dev/api/kaia/frete` — cotação por CEP e SKU somente após ativação e dados verificados; caso contrário responde 503/409.
- `POST https://kaia-glow.pages.dev/api/kaia/checkout` — sempre 503; nenhum pagamento.
- `POST https://kaia-glow.pages.dev/api/kaia/mercado-pago-webhook` — autentica assinatura, mas não confirma evento; responde 503 até implementação completa.

## Referências verificadas

- Mercado Pago Checkout Pro **Orders API recomendada**: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order
- Mercado Pago Webhooks: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications
- Melhor Envio cotação: https://docs.melhorenvio.com.br/docs/cotacao-de-fretes
- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/get-started/
- Cloudflare secrets: https://developers.cloudflare.com/pages/functions/bindings/

**Jamais declarar loja pronta para vender antes de teste real integral no ambiente de homologação.**
