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
