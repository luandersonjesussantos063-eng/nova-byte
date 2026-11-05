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
