# Reformulação da vitrine NovaByte — 24/10/2026

## Escopo solicitado e decisões
- Identidade turquesa/branca (#16C6D5, #20D5DC, #FFFFFF, #06131D, #EAF4F5), com tons auxiliares para contraste.
- Perfil oficial confirmado pelo proprietário: https://www.instagram.com/novabyte.solucoes/. Logotipo copiado do avatar público em arquivo local, sem dependência da URL temporária da CDN.
- Hero com a frase solicitada, sete serviços e WhatsApp com mensagem distinta por serviço, quatro etapas de contratação, diferenciais, seção local e chamada final.
- Portfólio preserva Anuncia Lucas. Após confirmar que o endereço da Digo retornava 404, o proprietário pediu sua retirada e inclusão de outros projetos já feitos: W Prime Elétrica, NPlay e NovaByte Studio. As capturas são de páginas públicas reais e não exibem dados de clientes. W Prime continua exigindo CPF/senha; nenhuma credencial foi compartilhada.
- Prévia automática de Anuncia Lucas mantida com carregamento por proximidade, pausa e redução de movimento. Filtros antes meramente visuais agora funcionam.
- Mantidos links para Studio, ferramentas, guias, oferta de criação, avaliações no Google, políticas e contato. Não foram inventados novos depoimentos, avaliações, métricas de audiência ou resultados comerciais.
- Analytics existente, AdSense, identificadores, canonical, sitemap e URLs preservados; título/descrição, logo e sameAs atualizados. Nenhuma promessa de classificação no Google ou aprovação de anúncios.

## Integridade e backup
- Base antes da alteração: a5eccdee8df61392a93a2e00f2c44fd3a4448724.
- Backup remoto: backup/site-before-turquoise-20261024-a5eccde.
- Bundle completo verificado: /workspace/backups/novabyte-before-turquoise-2026-10-24.bundle.
- Nenhum arquivo de novaplay/, anuncia-lucas/, previa/, divulga/ ou supabase/ foi alterado. W Prime é outro repositório/projeto Sites e também não foi alterado.
- Somente página principal, estilos institucionais compartilhados, recursos próprios do portfólio, script de interação, documentação e testes foram modificados. Nenhuma página foi removida; lista de URLs do sitemap permaneceu igual, com lastmod da home atualizado.

## Testes realizados
- Cinco testes estáticos/editoriais passaram: âncoras, recursos, sete mensagens de serviço distintas, quatro projetos, integrações e manutenção da pausa de notícias automáticas.
- Navegação Chromium em 320, 390, 768 e 1440 px: sem rolagem horizontal e sem exceções JavaScript na página. Menu abre/fecha por clique, link e Escape; filtros, FAQ e pausa de prévias passaram.
- Redução de movimento desativa animações e informa o estado do controle de prévias.
- Axe WCAG 2 A/AA e WCAG 2.1 AA em 390 e 1440 px: zero violações detectadas no escopo automatizado depois de corrigir contraste e nome acessível do botão móvel. Isso não substitui auditoria manual completa ou teste em aparelho físico.
- Capturas locais em /workspace/qa-novabyte/. Relatórios em docs/novabyte-home-qa-2026-10-24.json. Chamadas de anúncios/Analytics neutralizadas apenas no navegador de QA.
- GitHub Pages confirmado com branch main, caminho /, CNAME novabytesolucoes.com.br, https_enforced=true e certificado approved. Instagram e tela pública W Prime responderam HTTP 200/TLS verificado. A demonstração da Digo (404) não ficou como link quebrado.

## Publicação
Publicação confirmada para o commit 34a531be2958e499a4e1463dbd894d94a147c41c: GitHub Pages execução 40103550573 e validação da vitrine 40103550386 concluíram com sucesso. No domínio real, index.html, três CSS, home.js, logotipo, três capturas de projetos e sitemap responderam HTTP 200 e tiveram SHA-256 igual ao arquivo versionado. HTTPS respondeu 200 com validação TLS normal.

Navegação repetida no domínio publicado em 320, 390, 768 e 1440 px: menu, filtros dos quatro projetos, FAQ, pausa de prévias e redução de movimento passaram; sem rolagem horizontal ou exceções JavaScript. Versão de HTML 2026.10.24. As chamadas de Analytics/AdSense continuaram neutralizadas apenas nos contextos dos testes, sem mudar o código de produção.

Não houve mudança de DNS, hospedagem, conta Google ou dados dos sistemas independentes. Esta confirmação descreve publicação e QA, não promete novos clientes, classificação de busca ou aprovação de anúncios.
