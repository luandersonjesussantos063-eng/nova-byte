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

## Cloudflare Pages — homologação

Projeto Pages: `kaia-glow` (plano gratuito). Branch de produção: `feat/kaia-loja-real`. Build: `node scripts/build-kaia-site.mjs`; saída: `dist/kaia-glow`; Node.js 22. Domínio temporário reservado: `kaia-glow.pages.dev`. Publicação e verificação devem ser confirmadas separadamente. Não alterar DNS do cliente nem a hospedagem NovaByte. Mercado Pago, frete, estoque e migração de imagens ainda pendentes.


## Zona Cloudflare ativa e domínio de homologação separado — 05/11/2026

- Registro.br: DNS alterado para `dale.ns.cloudflare.com` e `maria.ns.cloudflare.com`. Zona Cloudflare `usekaiaglow.com.br` confirmada `active` em 05/11/2026, plano gratuito. Registro permanece no Registro.br.
- Preservados os destinos da Nuvemshop: registros A do domínio raiz `185.133.35.21`, `185.133.35.22`, e CNAME de `www` para `kaiaglow.lojavirtualnuvem.com.br`. Não substituir esses destinos enquanto a nova loja não tiver pagamento e frete testados e autorização de migração.
- A configuração isolada de teste da loja no Cloudflare Pages existente `kaia-glow` usa `teste.usekaiaglow.com.br` (CNAME com proxy para `kaia-glow.pages.dev`), sem alterar o DNS raiz nem o `www`. A vinculação Pages foi criada e o DNS verificado; aguardar validação SSL antes de afirmar que o HTTPS está ativo. Este endereço continua com `X-Robots-Tag: noindex` e checkout desativado.
- O arquivo `kaia-glow/auth-config.js` reconhece `teste.usekaiaglow.com.br` como homologação, usa URLs da conta nesse mesmo host e impede cadastro e recuperação por e-mail enquanto a allowlist Supabase não estiver validada. Não alterar URLs compartilhadas de outros projetos.
- O projeto final ainda **não** foi vinculado ao domínio raiz `usekaiaglow.com.br`; lançamento depende de fluxo transacional Mercado Pago, SuperFrete e estoque atual correto. Não desativar Nuvemshop.


## Migração autorizada ao domínio principal — 05/11/2026

- O proprietário autorizou explicitamente **retirar a Nuvemshop do apontamento DNS**, mesmo com pagamento ainda bloqueado, e usar a nossa loja como site principal.
- A zona Cloudflare ativa `usekaiaglow.com.br` tem CNAME proxied `usekaiaglow.com.br` → `kaia-glow.pages.dev`; dois antigos registros A (`185.133.35.21` e `185.133.35.22`) foram removidos.
- `www.usekaiaglow.com.br` agora é CNAME proxied → `kaia-glow.pages.dev`; a antiga entrada CNAME da Nuvemshop foi substituída.
- A Cloudflare confirmou os dois domínios como **active**, com verificação de DNS e certificado TLS/HTTPS **active**. `teste.usekaiaglow.com.br` permanece ligado ao mesmo projeto Pages.
- Testes HTTPS diretos no domínio raiz e `www`: GET da página inicial retornou 200 e conteúdo Kaia Glow. Não foi alterado nenhum domínio, projeto ou serviço Nova Byte.
- **A mudança de DNS não cancela a conta nem assinaturas cobradas pela Nuvemshop.** O proprietário precisa verificar eventual cancelamento diretamente com a plataforma.
- O build do site mantém temporariamente `X-Robots-Tag: noindex,nofollow` e `robots.txt` proibindo rastreamento em todos os hosts enquanto o checkout estiver desativado; **não afirmar que o site principal já está indexável no Google**.
