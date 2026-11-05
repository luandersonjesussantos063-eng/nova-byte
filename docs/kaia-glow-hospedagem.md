# Hospedagem separada da Kaia Glow

O domínio usekaiaglow.com.br continua registrado no Registro.br. Registrar domínio e hospedar arquivos são serviços distintos; não comprar outro domínio nem transferir o registro. Proposta: frontend no plano gratuito Cloudflare Pages e backend no Supabase existente, com futura integração Mercado Pago e serviço de frete a definir. Não houve contratação, configuração de conta Cloudflare nem mudança de DNS nesta sessão.

## Preparação feita

Branch: feat/kaia-loja-real. Comando: `node scripts/build-kaia-site.mjs`. Saída: `dist/kaia-glow`.

O build copia exclusivamente HTML, JS/CSS da Kaia e assets aprovados. Não publica o portal NovaByte, o CNAME de novabytesolucoes.com.br, SQL do banco, documentação, PDFs ou outros projetos. Inclui página 404 própria e cabeçalhos de homologação sem indexação. O pacote ainda utiliza as imagens remotas do catálogo; essa dependência deve ser migrada antes de desativar a Nuvemshop.

## Configuração no painel Cloudflare

1. Entrar ou criar uma conta em https://dash.cloudflare.com/.
2. Abrir Workers & Pages e criar um projeto **Pages**, conectado ao GitHub.
3. Autorizar o repositório luandersonjesussantos063-eng/nova-byte.
4. Escolher a branch feat/kaia-loja-real. Raiz do projeto: raiz do repositório.
5. Preset: None. Comando de build: `node scripts/build-kaia-site.mjs`. Diretório de saída: `dist/kaia-glow`. Usar Node.js 22.
6. Publicar inicialmente no endereço temporário pages.dev que o painel realmente atribuir. Não inventar esse endereço antes da criação.

A configuração é para homologação: conta do Mercado Pago, frete, estoque/pesos e backend transacional ainda não estão configurados. O checkout permanece bloqueado. Não chamar essa publicação de loja pronta para receber pagamentos.

## Domínio após a homologação

Para usar o domínio raiz em Cloudflare Pages, a zona precisa ser configurada na conta Cloudflare, com os servidores DNS atribuídos por ela. O domínio continua registrado no Registro.br; trocar delegação DNS não é transferir o registro. Antes dessa mudança, ler e preservar a zona completa, inclusive e-mail e verificações, e registrar os valores exatos fornecidos pela Cloudflare. Não fornecer servidores ou IPs de exemplo como se fossem o destino da cliente.

Os registros atuais informados pelo proprietário são os dois A da Nuvemshop e o CNAME de www. Eles continuam necessários enquanto a loja antiga for o destino. Não alterados por este trabalho. Apontamento final depende de projeto real criado, SSL, checkout e validação da migração.
