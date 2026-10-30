# NovaByte Soluções — portal e vitrine profissional

Site principal: https://novabytesolucoes.com.br/.

## Onde manter a página principal
- `index.html`: apresentação compacta, três grupos de serviços, projetos selecionados, contato e SEO. O catálogo completo permanece em `servicos/` e `projetos/`.
- `studio.css`: layout da página principal e das páginas institucionais, responsividade e redução de movimento.
- `brand.css` e `portal.css`: paleta azul e laranja compartilhada pelas páginas institucionais que já usam esses arquivos.
- `home.js`: menu móvel, filtros de projetos, animações progressivas e pausa das prévias. Sem formulários de envio ou acesso a dados privados.
- `assets/brand/novabyte-n.svg`: símbolo N geométrico azul e laranja da identidade solicitada. `assets/brand/novabyte-studio-blue-orange.jpg`: referência de ambiente enviada pelo proprietário, usada na abertura sem edição de pixels.
- `assets/projects/`: capturas reais de telas públicas, sem dados de clientes ou sessões autenticadas.

O WhatsApp mantém o número existente +55 31 98377-1576 e mensagens distintas por serviço. Instagram: https://www.instagram.com/novabyte.solucoes/.

## Publicação existente
GitHub Pages publica a raiz da branch `main` do repositório `luandersonjesussantos063-eng/nova-byte`; `CNAME` mantém novabytesolucoes.com.br. Não publicar este portal como um novo projeto Sites/Higgsfield e não alterar o domínio para aplicar mudanças visuais.
Aguardar a execução de `pages build and deployment` terminar em sucesso no commit correspondente. Conferir o HTML e os arquivos CSS/JS no domínio real antes de anunciar a atualização. Cabeçalhos e tags existentes de Google Analytics, AdSense e privacidade foram mantidos; não são garantia de aprovação de anúncios ou posicionamento no Google.

## Sistemas independentes
Anuncia Lucas (`anuncia-lucas/`), Studio (`previa/`), Divulga (`divulga/`) e serviços/dados em `supabase/` são sistemas independentes. A reformulação da vitrine de 24/10/2026 não modifica seu código nem dados. W Prime está no projeto Sites existente e repositório estoque-vendas, fora desta publicação.

## Portfólio em 24/10/2026
W Prime Elétrica, Anuncia Lucas e NovaByte Studio. São projetos já desenvolvidos, autorizados pelo proprietário para a vitrine. Para W Prime, a captura e o link mostram o login público; o painel e os dados continuam protegidos. Studio informa que a prévia é conceitual por modelos. O proprietário pediu retirar Digo Petiscaria quando o endereço externo retornou 404; não foram feitas mudanças no site externo.

## Backup e verificação
- Branch remota anterior à reforma: `backup/site-before-turquoise-20261024-a5eccde`, commit a5eccdee8df61392a93a2e00f2c44fd3a4448724.
- Bundle completo local verificado: `/workspace/backups/novabyte-before-turquoise-2026-10-24.bundle`.
- `node --test scripts/tests/home-redesign.test.mjs` valida a identidade, integrações, serviços, projetos, âncoras e recursos locais.
- Testes de navegação executados com Chromium em 320, 390, 768 e 1440 px: menu, filtros, FAQ, pausa das prévias e ausência de rolagem horizontal. Preferência de redução de movimento conferida. Isso é emulação responsiva, não teste em aparelhos físicos.
- Google Analytics e anúncios foram neutralizados somente no navegador local de QA, para não gerar eventos/impressões de teste; os scripts de produção foram preservados.
- `scripts/tests/editorial-review.test.mjs` segue protegendo a pausa das notícias automáticas e os arquivos em revisão. A reforma não muda seu estado editorial.

## Identidade visual — referência corrigida em 27/10/2026
O proprietário rejeitou a aplicação da referência NB metálica e definiu a identidade correta: símbolo N geométrico, Nova azul/Byte laranja, base marinho e visual de empresa de tecnologia. A página inicial passa a usar “Tecnologia para um amanhã melhor.”, foto do ambiente fornecida, botões laranja, serviços sobre fundo claro e portfólio em marinho. Cabeçalhos, rodapés e a marca das nove páginas institucionais acompanham essa direção. O menu compacto, os serviços, projetos, contatos, privacidade, medição e domínio são mantidos. As referências metálicas anteriores deixam de ser usadas.

Validação: testes automatizados e recursos locais das nove páginas conferidos. A publicação é feita no mesmo GitHub Pages; conferir a execução do commit e o domínio antes de anunciar conclusão. A revisão visual no navegador cobre desktop; a configuração responsiva é revisada no CSS, sem alegar teste em aparelho físico.

## Consolidação visual — 29/10/2026

A direção azul e laranja de `6936570` prevalece. `brand.css` é a fonte dos tokens: base `#0B1526`, superfícies `#101F35`/`#15263F`, azul `#3475D6`/`#79ABF3`, laranja `#F39869`/`#F5AF8A` e papel `#F6F5F2`. Carregar esse arquivo depois dos estilos locais. Não reintroduzir a referência metálica, verde-limão ou roxo como identidade da NovaByte.

`brand-shell.css` e `brand-shell.js` unificam a assinatura, navegação acessível e rodapé de artigos e páginas comerciais. Ferramentas e editor PDF preservam seus controles; verde e vermelho continuam disponíveis para estados funcionais. Os cartões de serviços claros e o portfólio marinho compartilham o tratamento entre a inicial e os catálogos internos.

O favicon é o N geométrico. A imagem de compartilhamento é `assets/brand/novabyte-share-blue-orange.png`, com fonte editável SVG ao lado; `og-image.png` permanece compatível com links antigos. O cartão específico de avaliação mantém a arte do proprietário. Versão de cache dos estilos: `20261029-unified`.

Verificação desta consolidação: seis testes existentes aprovados; recursos locais, IDs e dados estruturados conferidos nas 57 páginas públicas afetadas. Scripts funcionais das ferramentas, integrações, URLs canônicas e regras editoriais preservados. Os sistemas independentes listados acima permanecem fora do escopo.

Conferência no domínio publicado: navegação do menu compartilhado, filtro de projetos e busca de ferramentas operacionais em navegador desktop. Ajustados o contraste da introdução de serviços no fundo claro e a numeração duplicada do catálogo. Revisão responsiva no CSS; não foi realizado teste em aparelho físico.

## Contato e mapa

`contato.html`, `contact.css` e `contact.js` apresentam os canais de contato e o mapa oficial obtido pelo recurso “Incorporar um mapa” do Perfil da Empresa no Google. O mapa só se conecta ao Google após o visitante tocar em “Carregar mapa do Google”; o endereço e o link externo funcionam sem carregar o iframe. A página orienta combinar atendimento presencial previamente. A política de privacidade descreve esse carregamento.

O formulário com envio por e-mail usa FormSubmit, integração e teste autorizados explicitamente pelo proprietário em 29/10/2026. Campos: nome, e-mail, WhatsApp opcional, serviço e mensagem. O destinatário é novabytesolucoes@gmail.com. A confirmação exigida pelo provedor deve ser concluída nessa caixa de entrada antes de anunciar entrega de pedidos validada. A página de retorno é contato-enviado.html, fora da indexação. Não desativar a proteção antispam.

Teste automatizado de envio: FormSubmit respondeu HTTP 403 / Cloudflare 1010, recusando o cliente deste ambiente. Não houve confirmação de entrega nem de envio de e-mail de ativação. O proprietário deve enviar um teste pela página publicada no navegador e, caso solicitado pelo provedor, confirmar a ativação em novabytesolucoes@gmail.com. Não repetir o teste automatizado ou contornar o bloqueio.

## Recuperação do contato após indisponibilidade do provedor

O proprietário confirmou erro HTTP 521 no envio humano ao FormSubmit. O formulário não envia mais solicitações a esse provedor: prepara uma mensagem localmente e oferece um link explícito para continuar no WhatsApp. Não há envio automático, armazenamento local ou confirmação falsa de recebimento. O visitante precisa enviar a mensagem no aplicativo. E-mail pelo formulário continua pendente de uma integração validada. O link mailto permanece disponível. Não reativar o FormSubmit nem trocar o destinatário/provedor sem validação e autorização para a nova integração.

## Web3Forms — integração preparada

O proprietário autorizou o Web3Forms como novo processador. A branch contato-web3forms prepara envio por JSON com confirmação de sucesso, timeout, preservação dos dados em caso de falha e alternativa pelo WhatsApp. `contact-config.js` deve manter emailEnabled=false e accessKey vazio até o acesso à conta do destinatário novabytesolucoes@gmail.com, criação da chave do formulário e validação do envio. A chave de formulário é um alias público do Web3Forms; não inserir credenciais de login nesse arquivo. O novo serviço exige login/criação de conta e aceite dos termos pelo proprietário. Não publicar como funcional antes dessa etapa.
