# Pacífica Hair Vendas — NovaByte

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
Interface de demonstração, com catálogo inicial fictício e carrinho interativo. O painel "Admin" permite testar edição de catálogo no navegador, usando localStorage, **não representa armazenamento em servidor nem segurança de produção**. Nenhum pagamento real pode ser feito neste modo.

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
