# Kaia Glow — preparação para loja independente

Destino informado pelo proprietário: https://usekaiaglow.com.br/. A Nuvemshop será substituída; o proprietário solicitou pagamento e frete diretamente no site, não finalização por WhatsApp.

## Estado desta versão

Preparação em branch `feat/kaia-loja-real`; **não publicar como loja pronta** e não integrar a main enquanto o fluxo de compra estiver bloqueado. A main continua com a versão anterior. O CNAME da NovaByte e o DNS da cliente não foram modificados.

- Revisão de textos da vitrine, sacola, cadastro e páginas legais, removendo referências a prévia/teste/demonstração.
- Entrada “Sobre a Kaia Glow” aponta para a seção real da marca, sem modal de apresentação de protótipo.
- Cupons fictícios removidos da lista e retirado o código de desconto de demonstração aceito como fallback. Nenhuma oferta real foi inventada.
- Links canônicos, identificação da organização, URL de retorno do acesso e convites preparados para usekaiaglow.com.br. Crédito NovaByte usa URL absoluta para não apontar incorretamente ao novo domínio.
- A tentativa de finalizar permanece bloqueada com mensagem de indisponibilidade e canal de atendimento. Isso é uma proteção temporária desta branch, não a implementação de checkout e não a escolha de finalizar pelo WhatsApp. Não existe confirmação fictícia de pagamento ou de pedido.
- Chaves e nomes internos de armazenamento foram preservados para não perder favoritos e dados do navegador sem necessidade. Documentação histórica não foi apagada para esconder limitações anteriores.

## Dependências externas ainda pendentes

1. Pagamento definido pelo proprietário: Mercado Pago. A conta ainda será criada. O serviço de frete ainda não foi escolhido; a sugestão de Melhor Envio não constitui uma contratação nem configuração.
2. Autorizar a integração/deploy do backend e configurar as credenciais pelos ambientes seguros dos serviços. Esta sessão não tem ferramenta Supabase administrativa, integração de gateway, hospedagem ou segredos configurados. Não enviar tokens, senhas ou dados de cartão no chat.
3. Obter exportação atual da Nuvemshop com catálogo, variantes, preços, estoque, peso e dimensões. O proprietário informou que ainda não consegue exportar; retomar essa solicitação depois, sem repetir agora. Disponibilidade booleana no catálogo público não é quantidade de estoque e não permite inferir peso/dimensões.
4. Migrar as imagens para armazenamento controlado pela cliente. Os URLs atuais apontam para CDNs da Nuvemshop; não dependê-los após desativar a plataforma. Preservar fotos e permissões de uso.
5. Definir origem dos envios, serviços contratados e embalagens para cotação real, sem inventar tarifas ou prazos.

## Requisitos para ativação

- Preços, descontos, estoque e total calculados no servidor com dados atuais; não confiar no preço enviado pelo navegador.
- Pedido vinculado ao titular autenticado, idempotência de confirmação, reserva/baixa de estoque e tratamento de falhas/cancelamentos. Não ampliar permissões de escrita das clientes sobre as tabelas existentes.
- Cotação de frete real vinculada a CEP, itens e embalagem; exibição do total antes da autorização de pagamento.
- Gateway integrado pelo servidor com suas verificações e webhook autenticado. Retorno de URL ou texto do navegador não confirma pagamento.
- Testes em ambiente de homologação do gateway, sem movimentar dinheiro real para QA. Conferir pagamento aprovado/recusado/pendente e reenvio do webhook; conferir cotação indisponível e estoque alterado.
- Permitir no Supabase as URLs exatas de confirmação e recuperação do novo domínio, preservando as demais aplicações do projeto compartilhado. Validar e-mails e acesso no destino, sem resetar cadastros.
- Publicar frontend e backend no destino somente após as dependências e testes; então validar o pedido completo e acompanhar a troca de domínio. O site principal NovaByte permanece separado.

A limpeza de textos, isoladamente, não configura venda, frete nem pagamento. Esta versão não foi anunciada como comercialmente pronta.

## Dependências identificadas no catálogo
O arquivo atual contém 54 produtos e 184 imagens distintas hospedadas em dcdn-us.mitiendanube.com. Uma consulta ao CDN foi bloqueada pelo proxy desta sessão. A migração dos arquivos ainda não ocorreu; manter essa dependência como pendência real, sem afirmar que as imagens estão no armazenamento da cliente.

## Resultado da revisão editorial local
As cinco páginas HTML não exibem textos de prévia, teste de sacola ou demonstração. Cupons fictícios e seu fallback foram removidos; benefícios comerciais não foram ativados sem confirmação. Quatro testes de navegação/privacidade passaram. Chromium em 390 e 1280 px verificou o texto comercial, o estado sem cupons e o bloqueio explícito do fechamento sem gateway, sem criar pedido ou cobrança. Isso não valida um checkout real.


## Relatório de homologação — 05/11/2026

### Publicação independente e verificação

- Cloudflare Pages existente: `kaia-glow`; produção de homologação em `https://kaia-glow.pages.dev` vinculada à branch `feat/kaia-loja-real`. Build `node scripts/build-kaia-site.mjs`; diretório `dist/kaia-glow`; Node.js 22. O domínio `usekaiaglow.com.br` **não foi apontado** e a Nuvemshop e a NovaByte **não foram modificadas**.
- Teste HTTP/navegação: seis rotas `/`, `/sobre.html`, `/atendimento.html`, `/privacidade.html`, `/termos-de-uso.html` e `/conta.html` com status 200, verificadas em 390 px e 1280 px. Catálogo carrega 54 produtos; busca 'medicube' retorna 11; filtro Cabelos retorna 8; sacola abre; checkout continua indisponível e não inicia cobrança.
- Migração de imagem: workflow independente, apenas nesta branch, baixou e conferiu 184 fotografias públicas de `dcdn-us.mitiendanube.com`, salvou-as em `kaia-glow/assets/catalog/` e atualizou `catalog.js` para links locais. `docs/kaia-glow-image-manifest.json` guarda as URLs anteriores. Conferência remota de 184/184 imagens publicadas retornou HTTP 200 + content-type de imagem. Os arquivos estão agora dentro da publicação Pages e do repositório público da agência; validar o controle/cessão das imagens e sua autorização de uso com a cliente antes da transferência final. Nenhum documento privado foi publicado.
- Validação no Supabase compartilhado: projeto ativo. As quatro tabelas públicas `kaia_customers`, `kaia_referrals`, `kaia_orders`, `kaia_customer_details` mantêm RLS; `kaia_orders` somente permite `SELECT` do titular. `kaia_private.has_verified_email()` confirma no Auth a existência de e-mail validado e bloqueia contas anônimas; nada foi alterado no banco.
- E-mail da homologação: `auth-config.js` seleciona `https://kaia-glow.pages.dev/conta.html` para o domínio temporário e seus aliases de implantação. **Novos cadastros, reenvio de confirmação e recuperação por e-mail permanecem bloqueados somente na homologação** enquanto as URLs não estiverem confirmadas na allowlist do Supabase. Teste automatizado confirmou que tentativa de cadastro bloqueada não enviou requisição de signup. O login existente não teve dados de cliente alterados e precisa de teste real autorizado.

### Pendências verificadas e bloqueios de lançamento

1. **Nuvemshop:** exportação atual de produtos/variantes/preço/estoque/SKU/medidas, ainda não entregue. O catálogo mantém preços históricos, não homologados. No banco de fotos há 54 produtos, mas não há quantidade, SKU, peso nem dimensões de frete atuais para nenhuma variante. `docs/kaia-glow-catalogo-conferencia.csv` contém 54 linhas pré-identificadas e colunas vazias para validação, sem inventar valores. Guia oficial: `https://atendimento.nuvemshop.com.br/pt_BR/importar-e-exportar-produtos/como-exportar-os-produtos-da-minha-nuvemshop` → Produtos → Lista de produtos → Exportar e Importar → Exportar (incluir descrições).
2. **Supabase Auth:** confirmar em Authentication → URL Configuration as URLs adicionais `https://kaia-glow.pages.dev/conta.html` e `https://kaia-glow.pages.dev/conta.html?redefinir=1`, além de manter os retornos finais `https://usekaiaglow.com.br/conta.html` e `https://usekaiaglow.com.br/conta.html?redefinir=1` e os já usados por outros projetos. Somente após confirmar no painel alterar `stagingEmailRedirectReady` para `true`. Não modificar Site URL ou SMTP globais sem avaliação de impacto. Testar login, recuperação, novo cadastro com caixa de teste autorizada.
3. **Mercado Pago:** a proprietária ainda criará conta empresarial e aplicação de integração. Só depois definir Checkout Pro/Bricks, credenciais sandbox e secrets de produção, validação do `x-signature` no webhook, consulta server-to-server do estado e idempotência de eventos. Não armazenar token no frontend nem testar cobrança real. Qualquer backend deverá calcular total a partir de catálogo confiável, frete real e estoque reservado de forma transacional, não confiar em subtotal ou preço enviado pelo navegador.
4. **Frete:** escolher transportadoras/plataforma, CEP de postagem real (não confundir com cadastro do CNPJ), pesos e dimensões dos pacotes. Exibir modalidades, tarifas e prazos reais antes de cobrar. Sem serviço contratado.
5. **Pedidos/estoque:** backend financeiro transacional e controle de reserva/baixa ainda não criados. Não criar pedidos reais nem permitir venda acima do saldo. Manter RLS do Supabase e as apps não relacionadas intocadas.
6. **Go-live:** retestar pagamentos em homologação, falha/recusa, webhooks duplicados, falha de frete e estoque concorrente. Revisar termos/privacidade após integrações. Só então configurar domínio personalizado no projeto Pages, snapshot dos registros DNS (incluindo MX/TXT), delegação no Registro.br, TLS e validação ponta a ponta. Não cancelar Nuvemshop nem liberar indexação antes dos testes.
