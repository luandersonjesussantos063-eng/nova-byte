# Kaia Glow — homologação isolada (06/11/2026)

Branch: `test/kaia-mercadopago-homologacao`, retomada do commit `4fb37e4`.
Origem comercial: `feat/kaia-loja-real`, commit `38e47ca`. Não mesclar esta branch
na produção: ela constrói somente um laboratório privado de pagamentos.

## Correção: Checkout Pro Orders não exige comprador de teste

A orientação anterior para procurar/criar uma conta de comprador de teste estava
errada para este fluxo. A documentação atual de Checkout Pro com Orders orienta
usar as credenciais **Teste da aplicação** e realizar a compra sem login no Mercado
Pago, em janela anônima. Não é necessário obter e-mail de comprador de teste.

Fonte oficial verificada:
https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/integration-test-introduction

A implementação foi corrigida:
- `KAIA_MP_TEST_BUYER_EMAIL` passou a ser opcional. Se ausente, não envia `payer`
  nem inventa um e-mail; o comprador preenche os dados no checkout de teste.
- `KAIA_MP_TEST_SELLER_ID` também é opcional como pin adicional. Continua obrigatório
  confirmar pela API `/users/me` que a credencial pertence a uma conta `test_user`.
  Credencial de vendedor real continua bloqueada, mesmo com prefixo APP_USR.
- O status privado pode verificar banco e credenciais em modo somente leitura com
  cobranças desabilitadas, sem depender de configuração de frete. Ele informa
  separadamente a pendência de frete e não cria uma order.
- A migração de comprador opcional foi aplicada apenas ao novo Supabase de QA.
  A asserção remota de checkout sem e-mail passou com rollback, preservando os
  cinco pedidos sintéticos existentes. O RPC segue sem EXECUTE para `anon`.
- Dez testes locais passaram, incluindo criação sem `payer`, vendedor não teste
  recusado e consulta de prontidão sem ativar cobranças. Mercado Pago e SuperFrete
  continuam simulados nesses testes; isso não comprova pagamento externo.

A conta de teste do vendedor criada/fornecida pelo Mercado Pago continua sendo
validada pelo backend; não é necessário procurar o ID manualmente para iniciar
a preparação. Produção permanece fora do escopo e pagamentos seguem desabilitados.

## Atualização: Supabase remoto criado após liberação de vaga

O usuário autorizou retirar o projeto PP-MT. O conector não possui exclusão de
projetos e o CLI não estava autenticado; foi executada **pausa**, não exclusão.
PP-MT (`fermfbmhwlafwopwndoj`) está `INACTIVE`; seus dados não foram apagados.
Isso liberou a vaga gratuita necessária. A exclusão permanente solicitada **não
foi executada**; não é necessária para manter o novo ambiente em funcionamento.

Novo projeto: **kaia-glow-homologacao**, ref `ikeqodwmxzigksvvymdw`, organização
`lucas-agora`, região `sa-east-1`, estado `ACTIVE_HEALTHY`.
https://supabase.com/dashboard/project/ikeqodwmxzigksvvymdw

Foram aplicados, exclusivamente no projeto novo, o esquema isolado, as três
fixtures sintéticas e a migração de checkout. As asserções SQL com rollback
passaram no Supabase hospedado, deixando zero pedidos/reservas antes do ensaio.

O ensaio remoto enviou 10 requisições de reserva e obteve 5 reservas e 5 recusas
por estoque. Entretanto, os timestamps registrados demonstram execução
**sequencial** pelo conector; isso não comprova concorrência hospedada. A prova
concorrente continua sendo a de PostgreSQL local/CI registrada abaixo.

No banco novo foram verificados estados sintéticos (2 aprovados, 2 recusados e
1 cancelado, com passagem por pendente), retries de chave e eventos duplicados.
Resultado: 5 auditorias de reserva, 2 baixas, 3 liberações, saldo final de 3 unidades
sintéticas e zero reservas. Não houve chamada de pagamento ao Mercado Pago.
`anon` e `authenticated` não podem executar os RPCs administrativos verificados.

O advisor de segurança retornou apenas sete avisos INFO de RLS sem policies:
nessas tabelas privadas isso é intencional, pois browser/anon não têm acesso e o
backend usa service_role. [Referência do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

URL e UUID do banco de QA foram configurados somente no preview da Cloudflare.
Nenhuma chave de serviço ou credencial de produção foi copiada; a chave de serviço
**do projeto novo** ainda precisa ser instalada como segredo protegido, junto às
credenciais de teste de Mercado Pago/SuperFrete. Pagamentos permanecem desabilitados.

Evidência sanitizada: `docs/evidence/kaia-homologacao-supabase.json`.

## Retomada: consulta de retorno e cancelamento preparados

- URLs de retorno HTTPS configuradas em `config.online` (success/failure/pending),
  apontando para o preview privado e o ID local. A query string não confirma pagamento.
- `GET /api/kaia/mp-test/order?id=<uuid>` exige o mesmo proprietário autenticado
  pelo Access, consulta a order por API autenticada e compara total/referência/moeda.
  Mostra eventual divergência entre provedor e webhook; **não baixa estoque**.
- `POST` na mesma rota solicita cancelamento somente de order de teste ainda
  cancelável (`created`/`action_required`). Usa chave persistida própria, diferente
  da criação. Após POST, confirma por GET autenticado antes de liberar reserva.
- Timeout no cancelamento não libera estoque. Repetir a solicitação recupera a
  confirmação e a reserva é liberada uma única vez.
- O payload de criação agora é congelado no banco antes do POST ao Mercado Pago;
  um deploy ou ajuste de URL não muda o corpo de uma tentativa idempotente existente.
- O laboratório acompanha o pedido após o retorno, oferece consulta/cancelamento
  e informa quais configurações faltam, mostrando **somente nomes**, nunca valores.
- Migração `20261106174850_kaia_qa_owned_order.sql` aplicada somente ao novo Supabase.
  Asserções de proprietário, payload congelado, chave de cancelamento e permissões
  passaram no banco remoto com rollback; os cinco pedidos sintéticos anteriores
  permaneceram intactos.
- Oito testes locais passaram novamente, com PostgreSQL real e HTTP simulado,
  incluindo retorno adulterado, acesso de outro usuário, timeout e repetição de
  cancelamento. Evidência: `docs/evidence/kaia-homologacao-node-tests-return-cancel.txt`.

Isso não é evidência de uma compra efetiva no Mercado Pago: a autenticação MCP
continua recebendo HTTP 403 e os segredos de Preview ainda estavam ausentes na
última verificação. O responsável informou que fará a autorização no navegador e
configurará os segredos no painel. Essas declarações são intenções, não confirmação
de conclusão. `KAIA_MP_TEST_ENABLED` permanece `false`.

Depois dos segredos, conferir `KAIA_MP_TEST_SF_SERVICES` e
`KAIA_SHIPPING_TECH_CONTACT`. ID de vendedor e e-mail de comprador são opcionais,
conforme a correção descrita no início deste documento.
Nunca derivar modo de teste apenas do prefixo APP_USR: o backend exige conta test_user.

Referências oficiais desta retomada:
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/web-integration/configure-back-urls
- https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro/cancel-order/post

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

### Publicação de preview — evidência da Cloudflare

O commit de código `c26a6a23ddb17aab31b60682e140203f37c969e9` teve deploy de
**preview** concluído com sucesso, ID `9a2e4b16-d4af-4da3-9e72-62eb39b15fda`.
Alias efetivamente fornecido pela Cloudflare (nome truncado da branch):
https://test-kaia-mercadopago-homolo.kaia-glow.pages.dev

A [CI nova passou](https://github.com/luandersonjesussantos063-eng/nova-byte/actions/runs/42262415883).
Nove previews antigos desta mesma branch, ainda em fila/idle e sem aliases,
foram removidos para que builds anteriores ao isolamento não fossem publicados.
Nenhum deploy de produção foi removido, substituído ou revertido.

As sondagens HTTP deste ambiente retornaram **403 com servidor Envoy**, sem
resposta identificável da aplicação, tanto no preview quanto na vitrine.
Isso **não comprova** bloqueio pelo Access nem comportamento do checkout público:
o teste HTTP fim a fim e o login humano no preview continuam pendentes.
O estado de publicação é confirmado pela API Cloudflare; o bloqueio do checkout
comercial é preservado no código da branch de produção, que não foi modificada.

### Supabase — histórico do limite (resolvido na atualização acima)

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
   `KAIA_TEST_SUPABASE_URL`, `KAIA_MP_TEST_DATABASE_ID`,
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
   `https://test-kaia-mercadopago-homolo.kaia-glow.pages.dev/api/kaia/mp-test/webhook`.
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
| 5 | Confirmação autenticada após retorno | Passou no código e teste local; consulta própria autenticada sem confiar no redirect | `order.js`, testes Node |
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
- [x] Liberar vaga por pausa do PP-MT, criar Supabase isolado e aplicar SQL somente nele.
- [ ] Resolver HTTP 403 no MCP e executar setup/qualidade autenticados.
- [ ] Configurar secrets exclusivamente de teste, registrar e testar callback.
- [ ] Confirmar login humano Access, sandbox SuperFrete e concorrência no Supabase.
- [x] Implementar retorno/polling e cancelamento idempotente; validação externa ainda pendente.

### Blockers (must fix before production)
- [ ] Credenciais e pagamentos externos de teste ainda não homologados; banco remoto já criado e ensaiado sequencialmente.
- [ ] Zero preços de venda reais verificados e 22 embalagens pendentes.
- [ ] Produção permanece fora do escopo e depende de autorização explícita.

### Next steps
1. Instalar a chave de serviço do novo Supabase somente em segredo protegido do preview.
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

**Scores:** official quality: N/A; 8/9 verificações locais passaram, 1 parcial (callback externo ainda não cadastrado).
**Verdict:** Bloqueado para homologação externa completa e produção.

