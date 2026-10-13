# Operação de capas NPlay — acompanhamento

Atualizado em 13/10/2026. Issue #2. Nome público: **NPlay**, desde a versão **V 0.39.1**. Manter diretório `novaplay/` e identificadores técnicos antigos por compatibilidade.

## Lote anterior — 5 PNG originais 16:9
- A Casa Monstro — `assets/scene-covers/a_casa_monstro.png`
- A Dama E O Vagabundo — `assets/scene-covers/a_dama_e_o_vagabundo.png`
- A Fuga das Galinhas — `assets/scene-covers/a_fuga_das_galinhas.png`
- A Lenda dos Guardiões — `assets/scene-covers/a_lenda_dos_guardioes.png`
- A Nova Onda do Imperador — `assets/scene-covers/a_nova_onda_do_imperador.png`
Commit anterior: `5254a1557fd6119aa0341cf0c3e1c9b21880c832`.

## Lote atual — 5 SVG originais 16:9
- A Origem dos Guardiões — `assets/scene-covers/a_origem_dos_guardioes.svg`
- A Pequena Sereia — `assets/scene-covers/fantasia_oceano_20261013.svg`
- A Princesa e o Sapo — `assets/scene-covers/fantasia_pantano_20261013.svg`
- Carros — `assets/scene-covers/carros.svg`
- Toy Story — `assets/scene-covers/brinquedos_imaginacao_20261013.svg`

Publicação: commit `7e54b71dd00a54f4f9fbd2a7a9c0d0aaac843423`, deploy GitHub Pages `38347797206` **concluído com sucesso**. A URL pública e o visual em navegador não puderam ser validados diretamente neste ambiente.\n\nCinco arquivos publicados no repositório e vinculados por título normalizado em `assets/cover.js`. Sintaxe de JS e resolução das cinco capas testadas. Ordem capa personalizada > local > YouTube > fallback preservada; textos de marca nas capas temáticas corrigidos para NPlay. Versão pública V 0.39.1 mantida. O novo parâmetro de cache das capas foi incluído no site principal; painel usa o arquivo atualizado pela estratégia network-first.

**Não declarar capa premium aprovada** sem revisão visual no navegador/celular. Teste de reprodução não foi realizado. Não declarar NPlay 1.0 concluída.

**Atenção:** há dois registros com o título A Pequena Sereia no banco sem ano cadastrado; a arte oceânica genérica se aplica a ambos até distinguir as versões. Não considerar arte específica aprovada para um remake sem identificar a edição.\n\n## Próximo lote sugerido
Ratatouille; Procurando Nemo; Shrek; Os Incríveis; Enrolados. Conferir primeiro quais títulos ainda estão publicados e se têm capa enviada manualmente.

## Regras de não regressão
Cards 16:9 com setas; hover compacto e áudio por clique; hero com prévia e pausa ao rolar; player fecha corretamente. Preservar links de vídeo, direitos, status, pagamentos, manifest, dados, Supabase e chaves técnicas. A hierarquia é capa manual > arte local > YouTube > fallback, nunca fotograma do Drive sobre capa própria.

## Lote seguinte — 13/10/2026 — arquivos criados, integração pendente

Quatro artes vetoriais originais 16:9 foram **gravadas e lidas novamente no repositório**:

- Ratatouille — `assets/scene-covers/ratatouille_nplay.svg` — commit `b725ab774fa13a0cecb0793dad43ca194cc17c9a`.
- Procurando Nemo — `assets/scene-covers/procurando_nemo_nplay.svg` — commit `7ca8c3d72662246639e442de0a2fc9ecce70509e`.
- Os Incríveis — `assets/scene-covers/os_incriveis_nplay.svg` — commit `ca68ec88569ff7be43a7334d4d13859876157843`.
- Enrolados — `assets/scene-covers/enrolados_nplay.svg` — commit `d05a88efdd35c47512725f701f5d648138c26392`.

A tentativa de criar a arte de Shrek falhou por bloqueio de segurança da ferramenta; **não há arquivo publicado de Shrek neste lote**. A tentativa de atualizar `assets/cover.js` para vincular os quatro arquivos também foi bloqueada; portanto, **os quatro arquivos existem no GitHub, mas ainda NÃO aparecem automaticamente nos cards**. Não contar como capas integradas nem aprovadas. Não houve mudança no JavaScript, interface, vídeo, pagamentos, direitos ou status. A V 0.39.1 e o nome público NPlay continuam preservados.

Validação: os quatro SVGs foram relidos do GitHub com `viewBox=1280x720` e fecho `</svg>`. O workflow GitHub Pages do commit `b725ab7` foi visto em andamento; não declarar deploy concluído antes do status `success`. URL do domínio e aparência real em navegador/celular **não verificadas**.

**Próxima ação:** integrar os quatro títulos na lista `originalSceneCovers` de `assets/cover.js` por caminho seguro/autorizado; verificar deploy e carregamento; retomar Shrek somente quando houver método de criação permitido. Preservar prioridade das capas e identificadores técnicos.
