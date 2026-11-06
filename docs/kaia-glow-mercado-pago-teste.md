# Mercado Pago Orders — implementação isolada de teste

Preparação de 06/11/2026. **Não implantada e não homologada no Mercado Pago.**
A vitrine e `/api/kaia/checkout` continuam bloqueados. Nenhum token foi obtido, persistido ou incluído no código.

## Análise confirmada

Base: `feat/kaia-loja-real`, commit `38e47ca4ac20be28ffbf0e32acac0c60699490e1`.
O build publica somente Kaia (`dist/kaia-glow`), com Functions `/api/kaia/*`.
A branch base é a branch de produção do Pages: **não mesclar nem publicar alterações nela para homologar**.
Usar preview isolado com seus próprios segredos, host explícito e banco de teste.

Consulta somente leitura no Supabase em 06/11: 51 SKUs, 51 com estoque verificado,
29 com embalagem verificada, **zero com preço de venda verificado**.
`reference_price_cents`, catálogo do navegador e `kaia_catalog_overrides.price_cents`
não substituem `sale_price_cents` e `price_verified_at` do estoque central.
Nenhum produto, preço ou pedido foi alterado. O banco compartilhado não recebeu DDL.

O carrinho usa preços/descontos no navegador para apresentação. Cupons administrativos
existem em `kaia_admin_coupons` (`percent`/`fixed`, início/fim, mínimo, ativo).
A rota de teste busca tudo novamente no servidor, aceita apenas SKU/quantidade,
CEP, modalidade e código de cupom. Valores do navegador são descartados.
O endpoint público SuperFrete usa produção somente para estimativa; **não é reutilizado
para cobrar frete**. A integração nova consulta exclusivamente sandbox, usando
peso/dimensões verificados no banco. Não cria etiquetas.

## Rotas preparadas

- `POST /api/kaia/mp-test/orders`: sessão Supabase validada no servidor,
  usuário de teste em allowlist, host restrito, banco isolado confirmado por UUID,
  nova cotação SuperFrete sandbox e reserva atômica. Orders API `/v1/orders`,
  `type=online`, `processing_mode=manual`, `X-Idempotency-Key` UUID persistido.
- `POST /api/kaia/mp-test/webhook`: valida HMAC, tópico Order (`order`/`orders_v2`),
  `live_mode=false`, identidade do recurso `ORDTST`, consulta autenticada GET
  `/v1/orders/{id}`, moeda BRL, total e referência interna. Nunca usa o estado
  ou valor recebido no corpo do evento para aprovar.

Itens detalhados e preços unitários ficam no banco. O payload de checkout leva
uma linha com o subtotal líquido dos produtos e outra de frete; ambas somam
exatamente o total em centavos, sem arredondar desconto por unidade.
Somente `processed/accredited` com total integral pago permite aprovação.
`created/processing/action_required` permanecem pendentes; `failed` recusado;
`canceled` cancelado. Reembolsos e estados desconhecidos exigem revisão, sem
reposição automática de estoque.

## Banco e estoque

A migração fica em `kaia-glow/backend/mp-test/supabase/migrations/`, fora da
pasta de migrações compartilhada dos outros projetos. Foi criada com o CLI Supabase.
Instalar **apenas em banco isolado contendo o esquema Kaia e usuários de teste**.
A instalação exige `SET kaia.test_database='true'` na sessão, como confirmação
operacional explícita do destino. O código rejeita os dois projetos existentes
identificados nesta conta e exige que o UUID de `kaia_mp_test_config` coincida
com `KAIA_MP_TEST_DATABASE_ID`.

Não copiar dados pessoais para o teste. Preços de fixture dos testes automatizados
existem somente em banco local efêmero e não são preços de produtos da loja.
Não inserir fixtures no banco comercial nem preencher preços ausentes por estimativa.

As tabelas novas têm RLS, nenhum acesso de `anon`/`authenticated`, e RPCs
`SECURITY INVOKER` com EXECUTE só para `service_role`. Pedidos antigos não são
reescritos: estados de pagamento ficam em `kaia_mp_test_orders`.
O algoritmo usa `kaia_sale_inventory` **do banco isolado**, preservando a fonte
central e seu contrato de SKU. Não há baixa no estoque real nesta etapa.

Reservas pendentes descontam da disponibilidade para novas reservas; linhas de
estoque são bloqueadas em ordem de SKU. Preço/embalagem são conferidos novamente
na transação depois da cotação. Aprovação e baixa se confirmam na mesma transação;
`stock_applied_at`, bloqueio do pedido e unicidade da order impedem baixa duplicada.
Recusa/cancelamento liberam a reserva sem baixar estoque. Eventos pendentes
atrasados não reabrem pedidos finais. Uma aprovação após recusa/cancelamento
exige revisão e não produz baixa silenciosa.

Timeout do provedor conserva reserva, payload e chave. Repetir a mesma requisição
com a mesma chave recupera a tentativa sem recriar o pedido local. A chave enviada
ao provedor é sempre a representação persistida no banco. Depois de uma hora,
tentativas ambíguas sem ID remoto exigem reconciliação operacional antes de outra
criação; reservas não expiram automaticamente enquanto houver possibilidade de
pagamento. Não trocar a chave para contornar essa proteção.

## Configuração pendente — somente segredos protegidos de preview

Variáveis não secretas:

- `KAIA_MP_TEST_ENABLED=true`
- `KAIA_MP_TEST_HOST`: hostname exclusivo do preview, sem protocolo
- `KAIA_MP_TEST_SUPABASE_URL`: URL do projeto isolado (não o banco da loja)
- `KAIA_MP_TEST_DATABASE_ID`: UUID da tabela de configuração do banco isolado
- `KAIA_MP_TEST_USER_IDS`: UUIDs de usuários de teste confirmados, separados por vírgula
- `KAIA_MP_TEST_SF_MODE=sandbox`, `KAIA_MP_TEST_SF_SERVICES`: modalidades autorizadas
- `KAIA_SHIP_FROM_CEP`, `KAIA_SHIPPING_TECH_CONTACT`: origem e contato técnico conferidos

Segredos criptografados exclusivos de teste:

- `KAIA_MP_TEST_ACCESS_TOKEN`: somente token com prefixo `TEST-`
- `KAIA_MP_TEST_WEBHOOK_SECRET`: assinatura de Webhooks do ambiente Teste
- `KAIA_MP_TEST_SUPABASE_SERVICE_ROLE_KEY`: somente banco de teste
- `KAIA_MP_TEST_SF_ACCESS_TOKEN`: token sandbox SuperFrete

Nenhuma dessas variáveis foi configurada por este trabalho. Nunca fornecer valores
em chat, comandos com valores literais, logs ou Git. Não reutilizar os segredos de
produção. O código novo não aceita fallback para as credenciais públicas existentes.

Para criar uma tentativa, usar uma sessão do usuário autorizado do banco de teste,
`Authorization: Bearer <sessão>`, `X-Idempotency-Key` UUID v4 e JSON:

```json
{"items":[{"sku":"SKU_CONFERIDO","quantity":1}],"destinoCep":"01001000","serviceId":"1","coupon":""}
```

Esse exemplo não define preço nem dá disponibilidade a qualquer produto.
Não há botão ou link para a rota na vitrine. O retorno contém a URL de checkout
somente para o usuário de teste autenticado; parâmetros de retorno não aprovam compra.

## Testes e limitações

`npm ci` e `node --test scripts/tests/kaia-mp-test.test.mjs`.
Resultado local: **8 testes passaram**. Build estático e compilação das Pages Functions
com Wrangler também passaram. `git diff --check` sem erros.
Os testes usam PGlite (Postgres em WASM), HTTP simulado e Web Crypto real.
Cobrem ausência de preço, adulteração de valores, cupom, reserva, indisponibilidade,
aprovação, recusa, pendência, cancelamento, notificações duplicadas, estado atrasado,
HMAC, tentativa de produção, permissões, divergência de total, timeout e repetição
da mesma chave/payload, consulta autenticada prevalecendo sobre corpo do evento.
**Não comprovam concorrência entre conexões Postgres reais nem aceitação do payload
pela conta Mercado Pago ou da cotação pela conta SuperFrete.**

O plugin oficial Mercado Pago não apareceu nas ferramentas nem na busca do catálogo.
`/mp-test-setup`, `/mp-test-cards`, `/mp-webhooks simulate` e `/mp-review` não estavam
disponíveis. Nenhum desses comandos foi executado. A implementação foi preparada
pela documentação oficial; o uso solicitado do plugin e a homologação nele continuam
pendentes. Não considerar simulações locais como pagamentos de teste efetivamente
processados pelo Mercado Pago.

A suíte anterior `kaia-navigation.test.mjs` tem uma falha já presente na base:
exige a expressão “GitHub Pages” na política de privacidade. Não foi alterada neste
trabalho de pagamentos.

## Antes de qualquer ativação real

1. Conectar o plugin oficial e revisar com `/mp-review`, quando disponível.
2. Provisionar banco/usuários de teste e secrets protegidos no preview isolado;
   conferir schema completo do clone, grants e integração do administrador de estoque.
3. Conferir preços e embalagens com a responsável; sem preços verificados, recusar.
4. Implantar somente preview e configurar Webhooks da aplicação “Kaia Glow Loja Online”
   em **Teste**, evento **Order (Mercado Pago)**, na rota de teste publicada.
5. Testar cartões aprovados/recusados, pendência, cancelamento, assinatura inválida,
   duplicidade, timeout e concorrência real; conferir estoque antes/depois.
6. Validar seguro, embalagem consolidada, termos de entrega e valores comerciais
   com SuperFrete. Esta etapa usa orçamento sandbox sem seguro, sem emissão de etiqueta.
7. Projetar a migração de produção, observabilidade, reconciliação de tentativas
   ambíguas, cancelamentos/reembolsos e reservas; testar carga/concorrência reais.
8. Obter autorização explícita para produção e só então configurar credenciais
   reais, migrar o contrato de pagamentos e liberar o checkout público em mudança separada.

Referências oficiais consultadas:
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/payment-management/status/order-status
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/database/postgres/row-level-security
