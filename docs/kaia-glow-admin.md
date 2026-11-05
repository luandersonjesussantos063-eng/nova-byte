# Kaia Glow — acesso administrativo (05/11/2026)

**Painel publicado:** https://usekaiaglow.com.br/admin.html

**Projeto:** Cloudflare Pages `kaia-glow`, branch GitHub `feat/kaia-loja-real`, banco Supabase existente `vajlhodqxskozuxxlujv`. A conta oficial autorizada inicialmente é **usekaiaglow@gmail.com**, o e-mail comercial que consta no site.

## Ativação da proprietária

1. Se ainda não possui conta no Supabase da Kaia Glow, usar https://usekaiaglow.com.br/conta.html?modo=cadastro com o **e-mail comercial autorizado** e uma senha forte escolhida pela própria proprietária.
2. Confirmar o cadastro no link de e-mail recebido. O Supabase Auth permite cadastro por e-mail, mas o recebimento, SMTP e redirecionamento precisam ser verificados na prática.
3. Entrar em https://usekaiaglow.com.br/admin.html com esse e-mail e senha. Não enviar senha nem tokens por chat. O painel usa a sessão Supabase Auth da Kaia Glow.
4. Acesso só será concedido a usuário `auth.users` cujo e-mail esteja confirmado e apareça na lista privada `kaia_private.kaia_admin_allowlist`. Em 05/11/2026 não havia cadastro confirmado do e-mail comercial; logo, ninguém foi logado nem teve acesso administrativo concedido artificialmente.

## Funcionalidades

- Listagem dos 69 produtos existentes. Para os 51 com SKU comercial, permite editar nome, descrição, preço de venda, preço anterior, quantidade em estoque, visibilidade e galeria (até 10 fotos).
- Para os produtos antigos sem SKU, preços, descrições, visibilidade e fotos podem ser alterados; não é possível habilitar estoque/checkout de um item sem SKU comercial.
- O painel envia fotos JPG, PNG ou WebP de até 5 MB para o bucket de leitura pública `kaia-product-media` e exige administrador para enviar. Fotos removidas do produto não são apagadas automaticamente do bucket.
- Cupons em percentuais de 1% a 90% ou valor fixo, pedidos mínimos, data de início/fim, ativação, edição e exclusão.
- Alterações são gravadas em `public.kaia_catalog_overrides`, `public.kaia_admin_coupons` e (para SKUs reais) em `public.kaia_sale_inventory`. Registro de alterações restrito em `kaia_private.kaia_admin_change_log`.
- Vitrine carrega alterações dos produtos e cupons ativos pelo Supabase ao abrir a página, sem precisar gerar novo commit a cada edição. Se Supabase estiver indisponível, a vitrine pode temporariamente mostrar dados do catálogo estático; o checkout continuará bloqueado.

## Segurança e limites comerciais

- Sem qualquer chave `service_role` no navegador, repositório ou HTML. Somente chave pública `anon`.
- `anon` não pode ler a tabela de estoque, executar funções administrativas ou enviar arquivos. `authenticated` pode visualizar estoque somente quando a identidade foi aprovada como administradora. RLS habilitado e permissões restritas nas tabelas.
- Funções `security definer` para alterações validam `auth.uid()`, e-mail confirmado e a lista privada, além dos campos e URLs de foto.
- Cupons ativos podem ser visualizados pela vitrine e usados para mostrar uma **prévia do desconto** na sacola. Não são pagamentos e não foram conectados ainda a pedidos transacionais.
- O checkout, Mercado Pago, emissão de etiquetas e reservas de estoque continuam desativados. Ao ativar pagamentos, **o servidor deve validar novamente preços, estoque, cupom, frete, prazo e pedido**, independentemente da apresentação do navegador. Não confiar em valores calculados no cliente.
- A inclusão de SKUs novos e edição de todo o conteúdo institucional/banners não fazem parte desta primeira versão do painel; exigir nova implementação segura com categorias, fotos e validação de estoque.
- Todo o trabalho foi realizado no projeto Kaia Glow e nas tabelas `kaia_*`; não mudar as contas/sites da Nova Byte nem dados dos outros projetos no mesmo Supabase.


## Publicação do painel na versão principal

Em 05/11/2026 foi identificada uma condição de corrida: a última implantação de produção de um commit mais antigo passou a servir uma versão sem `admin.html` (404), apesar de uma implantação anterior possuir os arquivos corretamente. Esta revisão dispara uma nova implantação a partir da **ponta atual da branch**. Validar o `admin.html`, `admin.js` e `admin.css` no domínio principal e a assinatura de build antes de confirmar a correção.


## Cadastro de novos produtos — 05/11/2026

- A tela `https://usekaiaglow.com.br/admin.html`, aba **Produtos e fotos**, agora possui o botão **+ Novo produto**. O formulário pede nome, marca, categoria, descrição, preço atual e anterior, estoque, visibilidade, até 10 fotos e medidas de embalagem opcionais.
- O cadastro cria um SKU `KG-NEW-<id>` e um ID numérico durável. As tabelas `public.kaia_new_products`, `public.kaia_catalog_overrides` e `public.kaia_sale_inventory` são gravadas atomicamente pela função `kaia_admin_create_product`, restrita aos administradores confirmados. O estoque existente não é alterado.
- O modo **rascunho** é o padrão. Para publicar, marque **Exibir na vitrine** e forneça pelo menos uma imagem real em `storage/kaia-product-media` (JPG, PNG ou WebP, máximo de 5 MB por arquivo). Dados de rascunho dos produtos novos são protegidos por políticas RLS; o público só recebe produtos publicados.
- Novos produtos aparecem automaticamente no catálogo público após o carregamento do Supabase. O usuário pode abrir a ficha do produto, adicionar à sacola e consultar frete quando peso e três dimensões estiverem preenchidos. O checkout continua intencionalmente desabilitado.
- Cada produto novo publicado possui URL dinâmica SEO `/produtos/novo/<id>`, com título, descrição, foto e dados estruturados. O sitemap adicional `https://usekaiaglow.com.br/sitemap-novos.xml` reúne as novas URLs publicadas e está informado em `robots.txt`. As páginas antigas e o sitemap original permanecem.
- `public.kaia_admin_save_product_v2` permite editar marca, categoria, nome, preço, fotos e dimensões de um produto novo depois da criação; para produtos existentes respeita a política já aprovada de preço/estoque e não reescreve medidas antigas.
- Testes realizados sem produto fictício no banco: formulário completo testado em 390 e 1280 px com retorno de API simulado, incluindo criação, edição e upload; vitrine recebeu um novo produto simulado com busca, ficha e inclusão na sacola em ambas as resoluções; páginas dinâmicas e sitemap responderam no domínio oficial. Requisição anônima à função de criação recebeu HTTP 401, conforme esperado.
- Estado do banco após os testes: 0 novos produtos, 51 SKUs preexistentes, 409 unidades originais. A proprietária ainda deverá adicionar seus produtos reais.


## Central de estoque e marketplaces — preparada para conexão

**Data:** 05/11/2026. **Interface:** https://usekaiaglow.com.br/admin.html → **Estoque e marketplaces**.

### Escopo entregue e estado inicial

- Saldo central permanece no banco existente `public.kaia_sale_inventory`, com **51 SKUs e 409 unidades**; nenhum produto, quantidade, preço ou anúncio da Shopee/TikTok foi modificado pela implantação.
- Conexões `shopee` e `tiktok` cadastradas em `public.kaia_marketplace_connections`, ambas em estado **disconnected**. Não há tokens ou IDs de lojas cadastrados.
- `public.kaia_marketplace_links`: relaciona o SKU interno ao ID do produto e modelo/variação de cada plataforma. Vínculos manuais ficam **pending_verification**; não significam que uma integração foi concluída.
- `public.kaia_stock_movements`: histórico auditável de mudanças, incluindo **51 saldos iniciais** apenas como referência. Trigger em `public.kaia_sale_inventory` registra as alterações dos formulários existentes e do novo painel.
- `public.kaia_marketplace_sync_queue`: fila com último saldo desejado por SKU/canal, controle de versão, status, tentativas e erros. Atualizar o banco NÃO envia automaticamente nada aos marketplaces desconectados.
- `public.kaia_marketplace_orders`, `public.kaia_marketplace_order_items`, `public.kaia_marketplace_reservations`: estruturas preparadas para receber pedidos, reservar unidades e tratar cancelamentos quando as credenciais, o webhook assinado e o processamento idempotente forem implementados.
- `public.kaia_marketplace_sync_runs`: estrutura de registro de execuções futuras, sucessos e falhas.
- Admin pode consultar saldo, estoque baixo, movimentações, pedidos importados, reservas, fila e estado de conexão; cadastrar vínculos pendentes, desvincular anúncios, alterar o saldo absoluto ou registrar entradas/saídas com motivo. Todos os comandos de escrita passam por funções administrativas protegidas, com RLS. Sem gravação direta por clientes.
- A vitrine consulta `public.kaia_public_product_availability` para os indicadores **disponível/indisponível** de todos os SKUs. Não expõe quantidades, credenciais ou custo.
- **Checkout Mercado Pago, notificações promocionais e sincronização externa permanecem desligados**. O sistema não confirma nem promete saldo idêntico nas plataformas antes da ativação real.

### Endereços reservados — ainda respondem 503, de propósito

- Shopee OAuth callback: `https://usekaiaglow.com.br/api/kaia/shopee-callback`
- Shopee webhook: `https://usekaiaglow.com.br/api/kaia/shopee-webhook`
- TikTok Shop OAuth callback: `https://usekaiaglow.com.br/api/kaia/tiktok-callback`
- TikTok Shop webhook: `https://usekaiaglow.com.br/api/kaia/tiktok-webhook`

Os callbacks e webhooks NÃO processam autorizações nem pedidos nesta fase: são rotas **fail-closed** para evitar aceite de tokens e eventos sem validação de assinatura, mapeamento e testes. Não configurar estes endpoints como webhooks de produção até concluir seu código, pois atualmente a plataforma receberia HTTP 503.

### Pendências objetivas para conexão amanhã

1. **Shopee**: acesso da vendedora ao Seller Center, app autorizado no Shopee Open Platform (Partner ID/Partner Key aprovados em modo live), Shop ID, escopos de produtos/estoque/pedidos, autorização oficial da loja, configuração de callback e pushes assinados. Conferir requisitos por país.
2. **TikTok Shop**: acesso Seller/Partner Center, aprovação do app com App Key/App Secret e escopos adequados, autorização da loja, Shop ID/shop cipher, callback OAuth e eventos de pedidos/inventário assinados. O webhook *Inventory Changed By Shop (tipo 71)* inclui snapshots e alterações: deduplicar pelos IDs oficiais e NÃO aplicar o snapshot e o delta como duas alterações.
3. **Credenciais**: trocar códigos de autorização em servidor, guardar tokens de acesso/renovação somente em segredo criptografado, nunca em JavaScript, chat, log ou repositório. Implementar e testar verificação HMAC das notificações antes de alterar estoque.
4. **Conciliação**: importar catálogo/anúncios reais e confirmar correspondência de cada SKU/variação. Determinar a fonte inicial da quantidade em cada plataforma; divergências devem ir para revisão manual, não sobrescrever automaticamente.
5. **Sincronização**: implementar job de fila com retry seguro, prevenção de concorrência, refresh de tokens, status de envio, idempotência por pedido/evento, reservas e liberações por cancelamento/devolução. Homologar em sandbox/testes antes de ligar em contas reais.
6. **Ativação**: só mudar as conexões para `connected` quando as permissões, operações de leitura/escrita e webhooks estiverem comprovados. Começar com lote restrito, validar estoque e expandir.

**Não é uma integração Shopify:** a vitrine atual é a Kaia Glow em Cloudflare Pages/Supabase. A arquitetura foi preparada para a loja própria, Shopee e TikTok Shop, como solicitado. Uma integração Shopify adicional exigiria uma quarta conexão separada.

### Controles de segurança

Todas as tabelas de marketplaces têm RLS habilitado e somente administradores previamente autorizados podem lê-las. As tabelas não concedem INSERT/UPDATE/DELETE a navegadores; alterações manuais usam `kaia_admin_adjust_stock`, `kaia_admin_map_listing` e `kaia_admin_unmap_listing`, que revalidam `kaia_is_store_admin()`. Sem permissões administrativas, o site não pode alterar estoque. Eventos de sincronização e pedidos são apenas estruturas de dados; não há ingestão externa ativa.

**Fontes das especificações para ativação:** Shopee Open Platform `https://open.shopee.com/` e documentação TikTok Shop Partner Center `https://partner.tiktokshop.com/docv2/api-document`. Detalhes exatos de OAuth, app review e escopos precisam ser revisados com as contas de produção no momento da conexão.
