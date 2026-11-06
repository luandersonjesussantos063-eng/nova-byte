# Kaia Glow — homologação Mercado Pago em ambiente isolado

Status conferido em **06/11/2026**. Todo o trabalho desta pasta pertence à branch de testes `test/kaia-mercadopago-homologacao` e **não está publicado em produção**.

## Diagnóstico confiável da produção (somente leitura)

- Projeto real: Supabase `vajlhodqxskozuxxlujv`. Não aplicar as migrations desta pasta nele.
- **51 SKUs**, **409 unidades**, **0 preços com `price_verified_at`**, **29 embalagens com `package_verified_at`** (22 aguardando conferência formal); **43 SKUs** têm todos os campos de medidas preenchidos. O fato de uma dimensão estar preenchida não substitui sua verificação comercial.
- Cloudflare Pages: projeto `kaia-glow`, produção branch `feat/kaia-loja-real`, domínio `usekaiaglow.com.br`.
- `POST /api/kaia/checkout` permanece **503** sem cobrança, `/api/kaia/mercado-pago-webhook` permanece sem processamento real.
- Nenhuma credencial de teste do Mercado Pago foi configurada nos segredos Cloudflare disponíveis nesta sessão. Não houve pagamento, order nem Webhook de teste real criado.

## 1. Plugin oficial do Mercado Pago no Codex

O plugin é uma extensão do **Codex**, não um conector deste chat. Instale **na sessão de Codex do desenvolvedor** (não na loja):

```bash
codex plugin marketplace add mercadopago/mercadopago-codex-marketplace
codex plugin add mercadopago@mercadopago-codex-marketplace
```

No Codex use `/mp-connect` e autorize no navegador **a aplicação existente Kaia Glow Loja Online** sob a conta recebedora da cliente. Não crie outra aplicação. Execute `/mp-test-setup` e `/mp-test-cards`, se esses comandos estiverem disponíveis na versão instalada.

Docs oficiais:
- https://www.mercadopago.com.br/developers/pt/docs/mp-plugin/install
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/integration-test-introduction
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications

## 2. Credenciais e serviços de teste (ainda PENDENTES)

Usar somente um **novo Supabase test project** e os segredos de **preview/teste** da Cloudflare.

| Segredo / variável | Onde | Regras |
| --- | --- | --- |
| `KAIA_MP_TEST_ACCESS_TOKEN` | Cloudflare preview secret | Emitido no ambiente **Teste** da aplicação Kaia Glow. Nunca colocar no chat, commit ou frontend |
| `KAIA_MP_WEBHOOK_SECRET` | Cloudflare preview secret | Assinatura gerada para Webhooks em **Teste**. Não é o Access Token |
| `KAIA_TEST_SUPABASE_URL` | Cloudflare preview | URL do projeto Supabase de teste, **nunca** `vajlhodqxskozuxxlujv` |
| `KAIA_TEST_SUPABASE_SERVICE_KEY` | Cloudflare preview secret | Chave de backend apenas, jamais publicar no JS/HTML |
| `KAIA_TEST_SUPABASE_ANON_KEY` | Cloudflare preview | Chave pública do projeto de testes, separada da produção |
| `KAIA_SF_SANDBOX_TOKEN` | Cloudflare preview secret | Somente após confirmar oficialmente o ambiente de homologação com a SuperFrete |
| `KAIA_SF_MODE` | Cloudflare preview | Manter `mock` até confirmar token e endpoint de testes |
| `KAIA_TEST_ACCESS_ISSUER` | Cloudflare preview | URL `https://<team>.cloudflareaccess.com` habilitada no Zero Trust |
| `KAIA_TEST_ACCESS_AUD` | Cloudflare preview | Audience ID da aplicação Access exclusiva do preview |
| `KAIA_TEST_EMAIL_ALLOWLIST` | Cloudflare preview | Endereços autorizados a abrir o preview (separados por vírgula) |
| `KAIA_MP_PREVIEW_BUILD` | build de homologação | `true` para permitir build da branch protegida |

**Nunca adicionar segredos ausentes como valores fictícios ou copiar credenciais de produção para o preview.**

SuperFrete: existe cotação de frete de produção no site, mas a existência de um sandbox de API compatível com a conta ainda não foi validada em fonte oficial. Até essa validação, usar cotações simuladas apenas no projeto de teste; não chamar emissão de etiquetas.

## 3. Banco de testes separado e seguro

**Não usar os outros projetos existentes**, inclusive PP-MT. Criar um novo projeto Supabase na organização selecionada pelo usuário, após confirmar eventual custo adicional.

Os arquivos `supabase/kaia-mp-test/` foram separados de `supabase/migrations` para evitar aplicação automática ao banco real:

1. `001_isolated_test_database.sql` — tabelas somente de testes, RLS, reserva atômica, idempotência, movimentação e Webhooks.
2. `002_synthetic_test_fixtures.sql` — três SKUs **fictícios com prefixo TEST-KAIA**, preços e dimensões artificiais **somente para QA**. Nenhum dado desses deve ser copiado para produtos reais.
3. `003_assertions_rollback.sql` — testes SQL de reserva, ordem duplicada, aprovação, pendência, recusa e liberação, todos revertidos.

Para o teste de **concorrência real do PostgreSQL**, após rodar os dois primeiros SQL e testar asserções, usar:

```bash
python3 -m pip install "psycopg[binary]"
KAIA_TEST_PROJECT_REF=<ref-do-projeto-novo> \
KAIA_TEST_DATABASE_URL=<dsn-protegido-do-projeto-novo> \
python3 scripts/test-kaia-mp-concurrency.py
```

O script se recusa a usar os refs de produção. Executa 10 reservas simultâneas disputando 5 unidades fictícias, valida 5 sucessos/5 faltas, idempotência, aprovações, recusas, cancelamento e notificação repetida. **Esse teste ainda não foi executado em banco**; a criação do projeto isolado e as credenciais são pré-requisitos. Não publicar DSN nem resultados contendo credenciais.

## 4. Preview privado: bloqueado até Cloudflare Access

O Cloudflare da conta atual respondeu **HTTP 403: Access não habilitado**. A configuração do projeto Pages mostra `preview_deployment_setting = none`. Portanto nenhum preview privado foi publicado nesta etapa.

A branch inclui `functions/_middleware.js`, que recusa todas as requisições (inclusive assets) enquanto não conseguir verificar um JWT **assinado** pelo Cloudflare Access, com Audience e e-mail em lista permitida. `_routes.json` inclui todas as rotas no build dessa branch. A construção precisa de `KAIA_MP_PREVIEW_BUILD=true`.

Antes de publicar:
- Habilitar **Cloudflare Zero Trust / Access** na conta.
- Criar uma aplicação Access para o subdomínio de homologação, com política permitir apenas e-mails explicitamente escolhidos.
- Configurar os três valores de Access na Cloudflare preview, sem desabilitar middleware.
- Criar o Supabase de teste e **substituir/remover todas as referências de front e backend ao Supabase de produção**. Existem referências estáticas no catálogo e em funções do projeto original. Nunca publicar um preview que consulte ou modifique a base de produção.
- Verificar retorno 403/503 sem JWT e HTTP 200 somente após validação de um JWT real de e-mail autorizado.
- Configurar *noindex* e impedir geração de pedidos reais.

## 5. Testar Mercado Pago sem cobranças reais

Depois de configurar credenciais de teste seguras e uma aplicação de testes isolada:
- Criar Order via `POST /v1/orders` com `X-Idempotency-Key` única por tentativa e `checkout_url` de teste.
- Não gerar Order a partir de total e frete informados pelo navegador. Recalcular no servidor a partir do catálogo fictício de teste e dados verificados.
- No painel Mercado Pago, escolher **Teste** → Webhooks; cadastrar **somente a URL de homologação com endpoint já seguro e funcional**; selecionar tópico **Order (Mercado Pago)** (`orders`).
- Verificar `x-signature`, `x-request-id`, timestamps e, obrigatoriamente, consultar a Order na API autenticada antes de alterar estado/estoque.
- Executar os cenários aprovado, recusado, pendente, cancelado, notificações duplicadas, reenvio e concorrência.
- Não transformar a resposta HTTP do Webhook nem o retorno do navegador em confirmação de venda sem persistência, idempotência e conciliação.
- O pagamento real só pode ser ativado após aprovação formal dos preços e embalagens e autorização explícita do responsável.

## Status de entrega

| Item | Estado |
| --- | --- |
| Código isolado em branch própria | Preparado |
| Banco de testes — SQL e asserções | Preparado, **não aplicado** |
| Script de concorrência real | Preparado, **não executado** |
| Cloudflare Access | Indisponível até habilitação |
| Preview privado | **Não publicado** |
| Plugin na sessão Codex | **Pendente de instalação/autorização no Codex do usuário** |
| Segredos de teste | **Não configurados** |
| Webhook registrado no Mercado Pago Teste | **Não registrado** |
| Pagamentos reais ou simulados via API | **Nenhum executado** |
| Produção e estoque real | **Sem alterações** |
