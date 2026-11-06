# Kaia Glow — homologação isolada (06/11/2026)

Branch: `test/kaia-mercadopago-homologacao`, retomada do commit `4fb37e4`.
Origem comercial: `feat/kaia-loja-real`, commit `38e47ca`. Não mesclar esta branch
na produção: ela constrói somente um laboratório privado de pagamentos.

## O que já existia

- Middleware fechado por padrão, verificação RS256 de JWT Cloudflare Access,
  audience e allowlist; nenhuma publicação de preview.
- `supabase/kaia-mp-test/001...003`: catálogo sintético, reservas com bloqueios
  ordenados, pedidos, eventos e auditoria, fixtures explicitamente artificiais e
  asserções que revertem dados de teste.
- Script Python de concorrência, preparado mas ainda não executado.
- Checkout e webhook comerciais bloqueados. Nenhuma order criada no Mercado Pago.

## O que foi executado nesta retomada

### Cloudflare — confirmado via API

- Access habilitado na conta existente: issuer
  `https://super-voice-4134.cloudflareaccess.com`.
- Aplicação **Kaia Glow Previews Privados**, domínio `*.kaia-glow.pages.dev`,
  identidade por PIN e política reutilizável restrita ao e-mail informado pelo
  responsável. Nenhuma aplicação Access no domínio comercial foi criada.
- Exceção de Access exclusiva para `/api/kaia/mp-test/webhook` nos previews.
  Ela não remove a autenticação HMAC: middleware e handler exigem assinatura;
  faltando secrets/flag/host, a rota devolve 503. Métodos diferentes de POST não processam.
- As variáveis não secretas de Access foram configuradas **somente em preview**.
- Preview autorizado apenas para `test/kaia-mercadopago-homologacao`.
  `KAIA_MP_PREVIEW_BUILD=true`, **`KAIA_MP_TEST_ENABLED=false`**, `KAIA_SF_MODE=mock`.
- Comparação via API confirmou configuração de produção inalterada e branch de
  produção ainda `feat/kaia-loja-real`. Não houve mudança de DNS nem de credenciais reais.
- Login autorizado de uma pessoa ainda precisa ser confirmado no navegador.
  Os testes locais de JWT usam chave sintética; não comprovam login humano na Cloudflare.

### Supabase — bloqueio confirmado

O responsável selecionou a organização **lucas-agora**. A tentativa de criar
`kaia-glow-homologacao` em `sa-east-1` foi recusada pelo limite de **dois projetos
gratuitos ativos**. A consulta de custo respondeu US$ 0/mês para projeto gratuito,
mas isso não libera uma terceira vaga. Nenhum upgrade foi contratado, projeto
existente pausado ou banco de produção alterado.

É preciso disponibilizar uma vaga/plano que comporte um **novo projeto separado**.
Não utilizar Kaia produção nem PP-MT. Não importar clientes, usuários ou dados
comerciais para o banco novo.

Consulta somente leitura confirmou os números comerciais: **51 SKUs, 409 unidades,
0 preços verificados e 29 embalagens verificadas**; 22 seguem pendentes. Esses
produtos permanecem bloqueados. A API do laboratório aceita exclusivamente
`TEST-KAIA-*`, portanto não usa nenhum dos 51 SKUs reais.

### Plugin oficial — instalado; conexão bloqueada

`mercadopago@mercadopago-plugins-marketplace` **1.0.1** instalado e habilitado.
O MCP global foi registrado no endpoint oficial `https://mcp.mercadopago.com/mcp`.
`codex mcp login mercadopago` falhou na etapa de registro dinâmico com HTTP 403.
A conexão direta pelo cliente MCP oficial também não completou inicialização.
Nenhuma URL de autorização válida nem ferramenta autenticada foi obtida.

Foram utilizadas as skills locais oficiais **mp-connect**, **mp-test-setup**,
**mp-webhooks** e **mp-review** para orientação/revisão estática. Nenhum usuário
Mercado Pago foi criado; nenhuma credencial foi importada ou exposta.

Correções importantes da orientação anterior:

- Checkout Pro Orders pode usar credenciais de teste **APP_USR-**. Prefixo sozinho
  não comprova teste. A implementação verifica `/users/me`: ID configurado e tag
  `test_user`, antes de criar Orders, além de exigir recursos `ORDTST`.
- A skill `mp-webhooks` 1.0.1 informa que `simulate_webhook` não existe mais no MCP.
  `/mp-webhooks simulate` não foi alegado como executado. A validação externa
  precisa de pagamento com usuário/cartão de teste e histórico de notificações.
- A referência `products.md` desta instalação não contém a tabela de cartões
  indicada pela skill. Não foram inventados números. Usar a documentação oficial
  de compra com cartões linkada abaixo.
- Partes de `mp-review` 1.0.1 descrevem Checkout Pro apenas com Preferences; isso
  diverge da documentação atual e do escopo solicitado. Foi preservada **Orders API**.

## Código preparado, sem habilitar cobranças

- `/api/kaia/mp-test/orders`: identidade do Access validada pelo middleware,
  host de preview explícito, banco isolado confirmado por UUID/purpose,
  preços/medidas e cupons sintéticos no servidor, cotação sandbox e reserva atômica.
  O navegador não define preço, desconto, frete nem e-mail do comprador.
- `POST /v1/orders`: `type=online`, `processing_mode=manual`, `external_reference`
  local e chave UUID persistida em `X-Idempotency-Key`. Payload e total ficam
  congelados para recuperar timeout sem duplicar a tentativa. Depois de uma hora,
  tentativa ambígua sem ID remoto exige reconciliação operacional.
- Webhook: HMAC sobre identificação e headers; corpo precisa indicar teste e
  tópico Order; estado/total/referência são obtidos por **GET autenticado**.
  Aprovação exige `processed/accredited` e pagamento integral. Não há aprovação
  por retorno do navegador. Reembolsos e estados desconhecidos exigem revisão.
- Banco: reforço da idempotência contra alteração de carrinho, vínculo da order
  remota já no estado pendente, deduplicação vinculada ao recurso/estado,
  baixa e auditoria na mesma transação. Aprovação depois de liberação exige
  reconciliação, em vez de confirmar silenciosamente.
- Funções existentes passaram a `SECURITY INVOKER`; grants ficam restritos ao
  serviço. Wrappers públicos `kaia_qa_*` não concedem EXECUTE a `anon`/`authenticated`.
- Build privado em **Pages advanced mode**: `_worker.js` contém somente as rotas
  de QA e chama explicitamente o middleware. As funções e adaptadores comerciais
  originais não entram no bundle. Não copia catálogo, chaves públicas de produção,
  páginas de conta/admin, scripts comerciais nem acessa Supabase de produção.
- Frete: adaptador exclusivo sandbox, sem fallback para token/endpoint de produção,
  sem etiquetas. Requer confirmação explícita do contrato sandbox e token próprio;
  esse ambiente ainda não foi confirmado com a conta SuperFrete. Até lá, bloqueado.

## Evidências executadas

| Verificação | Resultado e limite |
| --- | --- |
| PostgreSQL 17 real em Docker local, banco `kaia_mp_qa` | Executado; não é Supabase hospedado |
| Asserções SQL de reserva/estados/rollback | Passaram, sem deixar alterações dessas asserções |
| 10 conexões disputando 5 unidades sintéticas | 5 reservas, 5 recusas por estoque; sem venda duplicada |
| 10 retries concorrentes com a mesma chave | Todos deduplicados |
| 10 webhooks concorrentes para a mesma aprovação | 1 aprovação, 9 duplicados; uma única baixa |
| Aprovado, pendente, recusado, cancelado | Passaram no banco local e/ou mapeamento HTTP simulado |
| Saldo final do cenário de concorrência | 3 unidades sintéticas, zero reservas, após 2 aprovações |
| 8 testes Node com PostgreSQL local real | 8 passaram, zero skips |
| JWT Access assinado/forjado, audience, expiração e allowlist | Passaram com chaves sintéticas locais |
| HMAC, evento sem assinatura e live_mode=true | Rejeitados conforme esperado |
| Timeout após criação remota, total adulterado e cupom | Passaram com API Mercado Pago/SuperFrete simulada |
| Webhook com corpo falso e GET autenticado pendente | Manteve pedido pendente; não confiou no corpo |
| Build privado, flag obrigatória, ausência de integração comercial nos assets/bundle | Passaram |
| Compilação das Pages Functions e sintaxe do bundle | Passaram |
| Suíte comercial anterior `kaia-navigation.test.mjs` | 3 passaram; falha preexistente na expectativa textual “GitHub Pages”, fora do laboratório |
| Pagamento efetivamente processado no Mercado Pago | **Não executado** |
| Cotação efetiva da SuperFrete sandbox | **Não executada** |
| Concorrência em Supabase hospedado | **Não executada** |

Logs sanitizados em `docs/evidence/kaia-homologacao-concurrency.json` e
`docs/evidence/kaia-homologacao-node-tests.txt`. O workflow
`.github/workflows/kaia-homologacao.yml` reproduz os testes em PostgreSQL descartável,
sem secrets de Mercado Pago, Supabase ou SuperFrete.

## Como retomar o ambiente protegido

1. Liberar capacidade para novo Supabase e criá-lo na organização escolhida;
   verificar o ref contra os dois refs proibidos antes de aplicar qualquer SQL.
2. Instalar `001`, `002`, executar `003` e aplicar a migração
   `migrations/20261106171915_kaia_homologacao_checkout.sql` **somente no banco novo**.
   O UUID de `kaia_mp_test.environment` identifica a instância isolada.
3. Guardar **apenas em secrets de preview protegidos**:
   `KAIA_TEST_SUPABASE_SERVICE_KEY`, `KAIA_MP_TEST_ACCESS_TOKEN`,
   `KAIA_MP_WEBHOOK_SECRET`, `KAIA_SF_SANDBOX_TOKEN`.
4. Configurar metadados não secretos de teste:
   `KAIA_TEST_SUPABASE_URL`, `KAIA_MP_TEST_DATABASE_ID`, `KAIA_MP_TEST_SELLER_ID`,
   `KAIA_MP_TEST_BUYER_EMAIL` (comprador `@testuser.com`),
   `KAIA_MP_TEST_SF_SERVICES`, `KAIA_SHIPPING_TECH_CONTACT`, origem verificada.
   `KAIA_TEST_SUPABASE_ANON_KEY` não é necessária: o laboratório usa Access e não
   inclui cliente Supabase no navegador.
5. Resolver autenticação do plugin na sessão com acesso ao endpoint oficial;
   selecionar **Kaia Glow Loja Online**, ambiente Teste. Não criar nova aplicação.
6. Confirmar oficialmente sandbox/credencial SuperFrete antes de definir
   `KAIA_SF_SANDBOX_CONFIRMED=true` e `KAIA_SF_MODE=sandbox`.
7. Só após conferir banco, conta test_user, comprador e frete, definir
   `KAIA_MP_TEST_ENABLED=true` **exclusivamente no preview** e redeploy do preview.
8. Registrar webhook **Teste**, evento **Order (Mercado Pago)**, em
   `https://test-kaia-mercadopago-homologacao.kaia-glow.pages.dev/api/kaia/mp-test/webhook`.
   Confirmar o tópico efetivo da conta (`order`/`orders_v2`) no payload/documentação.
9. Executar compra com cartões oficiais: APRO para aprovado, OTHE/FUND para recusado,
   CONT para pendente; cancelamento antes do pagamento conforme API oficial.
   Guardar IDs e histórico sanitizado das entregas; conferir estoque antes/depois.
10. Repetir concorrência no Supabase novo, testar retorno/recuperação operacional,
    revisar qualidade com o MCP e obter autorização separada antes de planejar produção.

Nenhum segredo foi solicitado pelo chat, gravado em arquivo versionado ou copiado
de produção. Nenhum dado real de cliente, preço, estoque ou pedido foi alterado.

## Revisão local do plugin oficial — mp-review v1.0.1

**Scope:** security. **API detected:** Orders API. **Products:** Checkout Pro.
**Files analyzed:** middleware, `mp-test-core.js`, `qa-worker.js`, rotas `mp-test`,
SQL isolado, builder, testes e `.gitignore`.

### Security checklist

| # | Verificação | Estado | Evidência |
| --- | --- | --- | --- |
| 1 | Token só em ambiente protegido | Passou no código; secrets ainda ausentes | `mp-test-core.js`, `mpCall` |
| 2 | .env ignorado e .env.example permitido | Passou | `.gitignore` |
| 3 | HMAC-SHA256 no webhook | Passou localmente | `verifyMpWebhook`, testes Node |
| 4 | URLs de retorno e notificação HTTPS | Parcial: redirecionamento validado; callback ainda não registrado | `orders.js`, `testConfig` |
| 5 | Confirmação autenticada após retorno | Parcial: GET no webhook; retorno/polling dedicado ainda não implementado | `webhook.js` |
| 6 | Idempotência de criação | Passou localmente | chave persistida, testes de timeout e concorrência |
| 7 | Referência externa | Passou | UUID local em `external_reference` |
| 8 | Credenciais separadas da produção | Passou na configuração atual; nenhuma credencial de teste instalada | API Cloudflare preview |
| 9 | Ausência de sandbox_init_point | Passou | Orders usa `checkout_url` |

Official quality: **não verificada**; quality_checklist indisponível pelo MCP.
quality_evaluation: não aplicável à integração exclusivamente Orders.
Formulário de homologação/ativação de produção: **não enviado**.

## Implementation Report

### Verified
- [x] Código existente reaproveitado; ambiente de homologação em branch própria.
- [x] Access habilitado, políticas reutilizáveis restritas e preview sem secrets reais.
- [x] PostgreSQL real local: reserva concorrente e eventos duplicados sem baixa repetida.
- [x] 8 testes locais passaram, incluindo integração HTTP simulada com banco real.
- [x] Os 51 SKUs reais e os 22 produtos com embalagem pendente continuam bloqueados.

### Needs attention
- [ ] Resolver limite gratuito do Supabase e provisionar projeto isolado.
- [ ] Resolver HTTP 403 no MCP e executar setup/qualidade autenticados.
- [ ] Configurar secrets exclusivamente de teste, registrar e testar callback.
- [ ] Confirmar login humano Access, sandbox SuperFrete e concorrência no Supabase.
- [ ] Implementar e homologar retorno/polling e reconciliação operacional antes de produção.

### Blockers (must fix before production)
- [ ] Credenciais, banco remoto e pagamentos externos de teste ainda não homologados.
- [ ] Zero preços de venda reais verificados e 22 embalagens pendentes.
- [ ] Produção permanece fora do escopo e depende de autorização explícita.

### Next steps
1. Disponibilizar o novo projeto Supabase sem pausar outros projetos.
2. Completar autenticação do plugin e configuração protegida das credenciais de teste.
3. Reexecutar `mp-review` após homologação externa completa.

### Resources used
- Local: código, PostgreSQL 17 em Docker, Node test runner, Web Crypto e mocks HTTP.
- Skill oficial: mp-connect, mp-test-setup, mp-webhooks e mp-review v1.0.1.
- Docs oficiais: [Orders criação](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order),
  [credenciais](https://www.mercadopago.com.br/developers/en/docs/checkout-pro-orders/resources/credentials),
  [cartões/cenários](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/integration-test/test-purchase-with-card),
  [notificações](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications),
  [Pages advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/).

**Scores:** official quality: N/A; 7/9 verificações locais passaram, 2 parciais.
**Verdict:** Bloqueado para homologação externa completa e produção.
