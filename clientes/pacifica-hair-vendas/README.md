# Pacífica Hair — NovaByte

Loja virtual em desenvolvimento na branch \`feat/pacifica-hair-vendas\` do repositório NovaByte. **Não está publicada**.

## Identidade
Referência fornecida pela cliente: rosa, magenta, lilás, roxo profundo, banners com chamadas de beleza/autocuidado, categorias ilustradas, vitrines, seção da fundadora Gleizelle, WhatsApp e Instagram. Atendimento **na Região Metropolitana de Belo Horizonte** (não "todo o Brasil"). A fotografia da proprietária foi extraída da captura fornecida — solicitar a foto original em alta resolução antes do lançamento.

## Como testar a interface
\`\`\`bash
cd clientes/pacifica-hair-vendas
npm install
npm run dev
npm test
npm run build
\`\`\`
Interface de demonstração, com catálogo inicial fictício e carrinho interativo. A vitrine ainda contém um painel demonstrativo local (localStorage), sem validade para vendas reais. O painel administrativo protegido em `/admin.html` utiliza a API `/api/admin/*` e a vinculação exclusiva `PACIFICA_DB` do Cloudflare D1. Não confunda as duas interfaces. Nenhum pagamento real pode ser feito no checkout atual.

## Entrega combinada
- Até ~100 produtos suportados, mas somente um pequeno conjunto inicial será preparado pela NovaByte.
- Cadastro dos demais produtos e fornecimento de fotos/preços/tamanhos por conta da cliente.
- Logotipo tipográfico básico e identidade inicial incluídos; ensaio fotográfico e criação das fotos de produtos não inclusos.
- Pix e cartão pelo Mercado Pago; valores diferentes por modalidade a serem validados em testes e regras do provedor.
- Entrega local: motoboy, entrega própria e retirada, para municípios/bairros a confirmar na RMBH.
- Domínio, hospedagem, credenciais MP e regras de frete ainda pendentes.
- Previsão solicitada: **30/11/2026**, condicionada à aprovação e aos materiais da cliente.

## Bloqueios para publicação
1. Back-end durável com autenticação real, permissões de administradora, banco de dados e upload de imagens.
2. Integração Mercado Pago server-side, verificação de webhook, idempotência, confirmação de pagamento e baixa de estoque.
3. Dados completos da loja (CNPJ/CPF adequado ao provedor, endereço, telefone, e-mail, política de privacidade, troca/devolução e entrega, LGPD).
4. Fotos verdadeiras e preços conferidos; retirar todos os itens marcados "Exemplo".
5. Definição das cidades, áreas e tarifas para motoboy/entrega própria/retirada.
6. Testes de ponta a ponta, domínio, SSL e hospedagem. **Não publicar nem divulgar link antes disso.**

O ambiente de protótipo usa apenas informações demonstrativas, sem coleta ou persistência de dados pessoais de compradores.

## Painel administrativo — referência recebida em 23/11/2026

A aba `/admin.html` foi ampliada para refletir o modelo rosa da Pacífica Hair:
- Dashboard com dados reais de cadastro/estoque, valores de vendas somente se houver pedidos pagos.
- Produtos: cadastrar, editar, ativar/desativar, preço/promoção, imagens, quantidade e estoque mínimo configurável.
- Estoque: entrada e saída com atualização condicional por versão e auditoria automática no banco; alertas e histórico.
- Clientes: cadastro administrativo manual e pesquisa. **Não estão sincronizados automaticamente** com o login de clientes Supabase.
- Fiado: registrar saldo devido e vencimento, exibir atrasados/a vencer e lançar recebimentos manuais sem tocar em pagamentos do Mercado Pago. O sistema não envia cobranças.
- Financeiro: gastos lançados, recebimentos manuais de fiado e pedidos realmente pagos, exibidos separadamente. Saldo parcial **não é lucro líquido**.
- Fornecedores: cadastro e consulta. Relatórios: estoque/movimentações. Configurações: informações de prontidão sem revelar credenciais.

### Antes de testar com o banco da Pacífica Hair

1. Garanta um banco D1 da **Pacífica Hair** separado do da Kaia Glow e associe a binding `PACIFICA_DB` ao projeto correspondente. Não reutilize dados ou credenciais da Kaia Glow.
2. Inicialize o esquema de catálogo/contas/sessões/fotos já exigido por `public/_worker.js` (sua migração inicial ainda deve ser documentada no ambiente da implantação). Execute depois `backend/orders.sql` e `backend/management.sql` **nessa ordem**, fazendo backup primeiro. O gatilho de estoque exige a tabela `products` existente.
3. Configure `ADMIN_PASSWORD` como segredo do servidor com no mínimo 12 caracteres. O formulário `/admin.html` exige autenticação, e os endpoints de gestão usam a sessão do administrador.
4. Valide uma entrada e uma saída de estoque, edição e ocultação de produto, criação de cliente, lançamento/recebimento parcial de fiado, cadastro de fornecedor e despesa. Confirme auditoria e valores após recarregar.
5. Teste também concorrência de estoque, falhas de conexão, duplicação de requisições financeiras, política de privacidade/controle de acesso e funcionamento no celular.

### O que falta para vendas reais

- Checkout Mercado Pago implementado exclusivamente no servidor, confirmação autenticada do pagamento, processamento idempotente de webhooks e baixa de estoque vinculada à compra. A existência das tabelas de pedidos **não** ativa cobranças.
- Integração segura dos perfis de clientes da vitrine com o painel e políticas LGPD para armazenamento de informações pessoais e de fiado.
- Integrar recibos do fiado e custos reais de mercadoria à contabilidade, se forem necessários indicadores contábeis de lucro.
- Confirmar endereços, cidades e tarifas de entrega; realizar testes de ponta a ponta e publicação controlada.

Alterações desenvolvidas na branch `feat/pacifica-hair-vendas`; **não foram aplicadas ao banco de produção e não foram publicadas**.
