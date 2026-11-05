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

## SuperFrete — conta identificada em 05/11/2026

A proprietária enviou captura da conta logada no aplicativo **SuperFrete**. Isso comprova acesso ao aplicativo, **não** que o token de API do site independente tenha sido emitido ou conectado. A empresa não precisa abrir outra conta Melhor Envio se optar pela SuperFrete.

- Adaptador preparado em `functions/api/kaia/frete.js`, com duas alternativas aceitas: `KAIA_SHIPPING_PROVIDER=superfrete` ou `melhor_envio`. O servidor exige preço e estoque atuais, peso/dimensões conferidos, CEP de origem e credenciais; não envia valores falsos nem inicia pagamentos.
- Para SuperFrete, após aceite da proprietária e emissão de token no portal oficial `https://web.superfrete.com/`, configure na **Cloudflare Pages > kaia-glow > Settings > Variables and Secrets**: `KAIA_SHIPPING_PROVIDER=superfrete`, `KAIA_SHIP_FROM_CEP` (CEP completo de postagem), `KAIA_SF_ACCESS_TOKEN` **encrypted secret**, `KAIA_SF_MODE=sandbox` para homologação, `KAIA_SF_SERVICES` (IDs das modalidades habilitadas na conta; por exemplo, `1,2,17` quando confirmadas), `KAIA_SHIPPING_TECH_CONTACT` (e-mail técnico autorizado, usado somente no `User-Agent`) e `KAIA_SUPABASE_SERVICE_ROLE_KEY` como **encrypted secret**. Nenhum desses dados foi fornecido ainda.
- Endpoint preparado: `POST /api/v0/calculator`, domínio `sandbox.superfrete.com` para homologação e `api.superfrete.com` apenas depois da validação, autenticação Bearer do lado servidor. Na cotação por produtos, pesos são convertidos de gramas para quilogramas, dimensões em centímetros, e serviços inválidos `has_error` são ignorados. Valores/previsões são extraídos de `price` e `delivery_time`, nunca inventados. Os detalhes devem ser confrontados com a documentação e resposta da conta SuperFrete antes de usar produção.
- Material público de referência: `https://superfrete.com/integracao-frete` (suporte a site próprio por API), `https://ajuda.superfrete.com/artigo/quais-as-integracoes-disponiveis-da-superfrete-com-plataformas-de-e-commerce/` e `https://ajuda.superfrete.com/artigo/como-calcular-fretes/`.
- A disponibilidade de saldo na carteira e a emissão de etiquetas não significam que a API esteja integrada. Nenhuma etiqueta foi criada ou cobrada. Mercado Pago não está conectado.

**Regra de lançamento:** checkout e indexação permanecem bloqueados até conta Mercado Pago comercial, pedido transacional idempotente, estoque atual confirmado, pesos e dimensões, frete real validado e end-to-end em sandbox. Não substituir a Nuvemshop no domínio antes disso.


## Credencial SuperFrete — configuração Cloudflare (05/11/2026)

- Variável de produção `KAIA_SHIPPING_PROVIDER=superfrete` configurada no projeto Pages existente `kaia-glow`.
- `KAIA_SF_ACCESS_TOKEN` gravado como **`secret_text`**, nunca no repositório ou no frontend. A conexão API ainda não foi testada com uma cotação real.
- CEP de postagem confirmado pelo responsável: `01550000`, igual ao endereço cadastral exibido na Kaia Glow. A variável já está configurada nas implantações de produção e prévia.
- A credencial foi compartilhada em uma conversa e precisa ser **revogada/rotacionada antes da ativação comercial**. Colocar a credencial substituta diretamente no painel da Cloudflare, sem publicá-la em chat, GitHub, arquivos ou prints.
- Permanecem ausentes serviço(s) SuperFrete validado(s), contato técnico autorizado, credencial de backend Supabase, estoque/preço atual, dimensões de postagem e os testes de cálculo. Consequentemente, cotação e checkout seguem bloqueados por segurança.


## Homologação SuperFrete — variáveis sem segredos

- Em 05/11/2026 foram confirmados via API no projeto Cloudflare Pages `kaia-glow`: `KAIA_SHIPPING_PROVIDER=superfrete`, `KAIA_SHIP_FROM_CEP=01550000`, `KAIA_SF_MODE=sandbox`, `KAIA_SF_SERVICES=1,2,17` (PAC, SEDEX e Mini Envios para teste), `KAIA_SHIPPING_TECH_CONTACT` com e-mail de contato publicado pela loja. O token permanece `secret_text` e seu valor não foi consultado nem registrado.
- A Cloudflare confirma **presença** de uma credencial criptografada, não se ela é nova, válida ou se foi efetivamente revogada na SuperFrete. Validar a autenticação apenas quando houver disponibilidade de integração para teste, sem emitir etiqueta.
- Persistem pendentes `KAIA_SUPABASE_SERVICE_ROLE_KEY` no backend, valores, saldos e embalagens atuais validados. Logo, o cálculo de frete ainda é indisponível por design; nenhum pagamento foi desbloqueado.
- Alterações de variáveis de ambiente podem exigir nova implantação Pages. Este commit serve apenas para registrar a configuração pública sem segredos e atualizar a publicação.


## Diagnóstico de cotação SuperFrete 05/11/2026

- Estoque de setembro/2026 confirmado novamente pelo responsável em 05/11/2026; `public.kaia_sale_inventory` agora contém 51 saldos confirmados, total 409 unidades, com `stock_verified_at` preenchido. Os preços e medidas de embalagem permanecem pendentes de validação independente; não foram inventados ou alterados.
- Rota temporária `/api/kaia/diagnostico-superfrete`, protegida por segredo independente, para testar exclusivamente cotação de **pacote ilustrativo**, sem SKU, etiqueta ou pagamento, de `01550000` para `01001000`, 0,3 kg / 17 × 11 × 4 cm, usando API SuperFrete produção em modo somente cotação. Deve ser REMOVIDA junto ao segredo temporário após o diagnóstico.
- Não habilitar o checkout enquanto não houver medidas e preços validados, autenticação dos pedidos e Mercado Pago transacional.


## Resultado real do teste de cotação SuperFrete — 05/11/2026

- O proprietário confirmou que os saldos físicos atuais **coincidem com a planilha de setembro/2026**. Em `public.kaia_sale_inventory`, foram preenchidos `available_units` e `stock_verified_at` de todos os 51 SKUs, **409 unidades no total**. Os preços de referência e os campos de peso/dimensões permanecem separadamente não verificados; não interpretar confirmação do estoque como confirmação de embalagem.
- A autenticação com a API **real de produção** da SuperFrete retornou HTTP 200 em chamada **somente de cotação**, sem emitir etiqueta ou fazer pagamento. Origem `01550000`; destino ilustrativo `01001000`. Pacote ilustrativo 17 × 11 × 4 cm e 0,3 kg, sem associação a produto/estoque comercial. Serviços retornados: PAC (R$ 17,77 / 5 dias), SEDEX (R$ 11,43 / 1 dia), Mini Envios (R$ 13,79 / 8 dias). Valores variam com o CEP, medidas, modalidade e data da consulta; **não são tarifas da loja nem preços fixos**.
- A rota temporária autenticada usada para diagnóstico foi deletada de `functions/api/kaia` após o teste; o segredo temporário foi removido da configuração de produção Cloudflare. O token principal SuperFrete permanece criptografado. Nenhuma chave aparece em logs/documentos.
- Integração de rede e token SuperFrete **testados**; cotação comercial na sacola **permanece não ativada**, porque a tabela `kaia_sale_inventory` ainda exige `sale_price_cents` / `price_verified_at`, `weight_grams` e dimensões da **embalagem pronta** / `package_verified_at` e acesso servidor ao Supabase. A referência de medidas da antiga Nuvemshop não foi presumida como embalagem física.
- A variável de homologação `KAIA_SF_MODE=sandbox` foi mantida no endpoint de frete comercial. Diagnóstico real chamou o endpoint de produção somente para **cotação**, sem criar etiqueta. Não mudar a loja para produção até a validação do checkout Mercado Pago, conferência de preços e embalagens e testes ponta a ponta.


## Cotação SuperFrete pública sem checkout — 05/11/2026

- Após autorização do proprietário, o endpoint `POST /api/kaia/frete` consulta a API **de produção somente para cotação** da SuperFrete. `KAIA_SF_MODE=production` define o ambiente de consulta, não habilita compra de etiqueta.
- O código usa uma tabela estática reconciliada no servidor com 43 SKUs contendo peso + comprimento/largura/altura, a partir de 36 produtos da Nuvemshop e 7 referências do comércio pesquisadas na internet. A quantidade de SKU e o CEP são validados em cada requisição; o provedor e token nunca são enviados ao navegador.
- Não exige `KAIA_SUPABASE_SERVICE_ROLE_KEY`, estoque online ou `sale_price_cents` **somente para orçamento de envio**. Sem valor declarado/seguro, e com medidas de catálogo/referências comerciais. **Estes valores não devem ser usados como cobrança definitiva nem para emitir etiqueta antes da validação comercial do pedido.**
- Os 8 SKUs sem dimensões completas geram HTTP 409 com lista de itens, em vez de inventar valor de entrega. Sem preços de venda validados não se indica seguro ou total final.
- Teste live `https://usekaiaglow.com.br/api/kaia/frete` com `KG-MED-ZEROPAD2-70P`, CEP destino `01001000`: HTTP 200, PAC R$ 17,77 / 5 dias, SEDEX R$ 11,43 / 1 dia. Carrinho em celular confirmou opções em texto e estado finalização em breve.
- `POST /api/kaia/checkout` continua HTTP 503 `CHECKOUT_NAO_HABILITADO`; nenhuma cobrança, pedido, etiqueta ou pagamento criado. Mercado Pago, ordens transacionais e conferência final de medidas/preços continuam pendentes.
