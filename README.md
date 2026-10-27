# NovaByte Soluções — portal e vitrine profissional

Site principal: https://novabytesolucoes.com.br/.

## Onde manter a página principal
- `index.html`: apresentação, sete serviços, projetos reais, diferenciais, processo, contatos e SEO.
- `studio.css`: layout exclusivo da página principal, responsividade e redução de movimento.
- `brand.css` e `portal.css`: paleta turquesa compartilhada pelas páginas institucionais que já usam esses arquivos.
- `home.js`: menu móvel, filtros de projetos, animações progressivas e pausa das prévias. Sem formulários de envio ou acesso a dados privados.
- `assets/brand/novabyte-metal-reference.jpg`: imagem de identidade NB enviada pelo proprietário em 27/10/2026, com grafite, prata e vidro turquesa. `novabyte-metal-mark.svg` usa a própria imagem incorporada e enquadrada para o cabeçalho/rodapé, sem dependência externa. A assinatura completa aparece na abertura, inclusive no celular.
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

## Identidade visual — 27/10/2026
O proprietário pediu adaptar o portal à referência NB metálica enviada. A página inicial usa fundo prata, cartões grafite e detalhes turquesa; as nove páginas institucionais compartilham a marca e a navegação. Conteúdo, projetos, contatos, domínio, integrações de privacidade e medição são preservados. Sistemas independentes, incluindo W Prime, não recebem mudanças. A imagem enviada é mantida localmente sem edição de pixels; o enquadramento é feito em CSS/SVG.
