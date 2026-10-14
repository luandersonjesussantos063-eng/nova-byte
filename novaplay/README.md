# NPlay — guia central do projeto

Este é o ponto de entrada para manutenção da NPlay. A versão de produção deve ser alterada **a partir do último commit da branch main**, preservando modificações anteriores.

## Endereços e publicação
- Aplicativo: https://novabytesolucoes.com.br/novaplay/
- Painel: https://novabytesolucoes.com.br/novaplay/admin/
- Fonte: `novaplay/` na branch `main` do repositório `nova-byte`.
- Domínio configurado no `CNAME` da raiz do repositório.
- A atualização de arquivos no GitHub não confirma, por si só, que o GitHub Pages publicou a versão. Conferir a publicação antes de informar sucesso.

## Mapa único dos componentes
| Componente | Arquivos de referência |
| --- | --- |
| Aplicativo público | `index.html`, `app.js`, `catalog.js`, `styles.css`, `sw.js`, `manifest.webmanifest` |
| Painel administrativo | `admin/index.html`, `admin/admin.js`, `admin/admin.css`, `admin/live-embeds.js` |
| Imagens | `assets/` — múltiplos formatos e versões podem estar referenciados no banco de dados, não apagar por semelhança de nome |
| Importação local | `importer/worker.py`, `importer/pipeline.py`, `importer/supervisor.py` |
| Instruções do importador | `importer/README.md` |
| Auditorias e registros de trabalho | `auditoria_catalogo_2026-10-12.csv`, `exclusoes_auditoria_2026-10-12.csv`, `operacao_capas_progresso.md` |

## Recuperação antes de limpeza
A branch `backup-novaplay-2026-10-14` preserva o estado completo do repositório anterior à limpeza. Ela é um ponto de restauração, **não** uma fonte de produção. Não mesclar automaticamente essa branch em `main`.

## Critérios de exclusão
1. Não apagar arquivo com referência direta no código, nos manifestos, nos dados do Supabase ou em URLs públicas.
2. Arquivos de imagem com o mesmo título **não são necessariamente duplicados**: podem ter resoluções, cortes e formatos diferentes.
3. Não eliminar versões anteriores de capas antes de confirmar que nenhum registro do catálogo aponta para elas.
4. Não mover `index.html`, `admin/`, `assets/` ou `importer/` sem atualizar referências e confirmar a publicação.
5. Preservar a importação manual, a retomada dos downloads e a fila de fontes indisponíveis.

## Resultado da auditoria de 14/10/2026
Foram encontrados 118 arquivos em `novaplay/`. Não há arquivos de conteúdo binário **exatamente idêntico** dentro dessa pasta, conforme hashes de blobs do Git. As capas com nomes semelhantes possuem hashes diferentes. Portanto, nenhuma exclusão de capa foi considerada segura apenas por nome.

**Decisão:** manter os ativos e fluxos em uso; concentrar a documentação e a estrutura de manutenção neste guia, sem executar exclusões especulativas.
