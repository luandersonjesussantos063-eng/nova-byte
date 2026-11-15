# PMMG — acesso unificado

O único app de estudo está em **https://ppmt.novabytesolucoes.com.br/**, repositório `luandersonjesussantos063-eng/PP-MT`. Ele substituiu o PPMT e preserva infraestrutura, login e configurações.

`/questoes/` foi desativado como app em 15/11/2026. A página apenas encaminha ao app principal e oferece backups compatíveis com Evolução → Restaurar backup quando existem históricos locais antigos. Não remove localStorage nem chama o antigo serviço de sincronização. Sem histórico local, encaminha automaticamente.

O service worker remove apenas caches com prefixo `missao-farda-` desta origem e atualiza abas do escopo `/questoes/`. Nenhum dado do app principal ou de outros sistemas é alterado. O manifesto legado é mantido apenas para identificar instalações antigas, e não é anunciado pelo HTML de transição.

Fontes históricas e banco permanecem recuperáveis no Git; toda manutenção de funcionalidades passa a ser no PP-MT.
