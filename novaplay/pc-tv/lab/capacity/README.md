# NPlay — preparação para testes de capacidade (homologação)

## Situação atual (17/10/2026)

- Referência estável: branch `nplay-timeshift-lab`, commit `d3341fc282f442f19eff86081008ff805195d241`.
- Laboratório estável já validado manualmente em dois aparelhos. **Não modificar nem reiniciar esse serviço durante testes de carga.**
- Produção principal `node` também fica intocada.
- Este branch `nplay-capacity-lab` serve para **testar entrega de conteúdo armazenado a vários espectadores**.
- Gravar um canal alternadamente a cada 30 s não conserva a programação completa. Não anunciar que 2 canais reproduzidos a partir de gravações equivalem a 2 capturas ao vivo contínuas.
- Limites e direitos de distribuição do fornecedor continuam em vigor. Não usar testes para aumentar, contornar ou ocultar conexões de origem.

## Fase 1 — Serviço independente (criar apenas depois de aprovar o custo)

Provisionar um novo serviço Railway chamado `nplay-capacity-lab`, conectado ao mesmo repositório, mas à branch **`nplay-capacity-lab`**, usando:
- Root directory: `/novaplay/pc-tv/lab`
- Dockerfile: `Dockerfile`
- Start command: `node playable-timeshift.mjs`
- Health check: `/healthz`
- Porta: definida pela Railway por `PORT`
- **Não** reutilizar o volume persistente nem o domínio do laboratório estável.
- `TIMESHIFT_VIEW_PIN`: segredo exclusivo e forte, definido apenas nas variáveis privadas do novo serviço.
- `TIMESHIFT_MAX_SEGMENTS=90` e `TIMESHIFT_ROTATE_SECONDS=30` (valores de teste; monitorar o disco)
- `TIMESHIFT_REAL_M3U_URL`: **NÃO CONFIGURAR**; o serviço testa com os dois canais sintéticos do FFmpeg.
- `TIMESHIFT_DATA_DIR`: **NÃO CONFIGURAR**; armazenamento temporário apenas na homologação.
- Não copiar credenciais Xtream, Cloudflare ou Supabase da produção.

Um serviço adicional pode aumentar os custos na Railway; obter autorização antes de provisioná-lo.

## Fase 2 — Simulação de espectadores HLS

O script `capacity/viewer-simulator.mjs` lê **somente** segmentos já gravados, sem abrir conexões com o fornecedor IPTV. Tem restrições:
- Só acessa `localhost` ou domínio contendo `nplay-capacity-lab`.
- É **dry-run** por padrão; tráfego só começa com `--run`.
- Exige `NPLAY_LAB_PIN` como variável de ambiente; a senha não deve aparecer em argumentos, prints ou código versionado.
- Simula no máximo 50 espectadores (um segmento a cada aproximadamente 2 s), alternando entre A e B.
- Repete um bloco armazenado quando não existe outro mais recente. Mede capacidade de ENTREGA e NÃO continuidade da programação.
- Interrompe etapas posteriores se o êxito ficar abaixo de 98% ou houver erros de rede.
- Não mede decodificação, travamento ou experiência real no navegador. Validar visualmente depois.

Usando Windows PowerShell (no diretório `novaplay/pc-tv/lab/capacity`):

```powershell
node .\viewer-simulator.mjs --base https://SEU-nplay-capacity-lab.up.railway.app/ --stages 2,5,10,25,50 --seconds 60

# Apenas após criar o serviço e autorizar o teste:
$env:NPLAY_LAB_PIN = "SENHA_PRIVADA_DO_SERVICO_DE_TESTE"
node .\viewer-simulator.mjs --base https://SEU-nplay-capacity-lab.up.railway.app/ --stages 2,5,10,25,50 --seconds 60 --run
Remove-Item Env:\NPLAY_LAB_PIN
```

Substituir o endereço de exemplo pelo domínio **real retornado pela Railway**. Nunca apontar o teste para o serviço estável `nplay-timeshift-lab-production.up.railway.app` ou para produção.

Antes de carga, verificar `/healthz` e aguardar pelo menos um bloco pronto de cada canal. Fazer um teste de 2 espectadores primeiro e aumentar gradualmente.

## Fase 3 — Critérios indicativos (ajustar conforme capacidade e orçamento)

| Critério | Meta inicial de homologação |
| --- | --- |
| 2, 5, 10, 25, 50 leitores concorrentes | Sem derrubar a instância |
| HTTP 5xx | < 1% |
| Entregas bem-sucedidas no simulador | >= 99% |
| p95 dos segmentos | <= 1500 ms, interpretando a distância entre cliente e região |
| Buffer e playback em 2 navegadores reais | Sem travamentos perceptíveis |
| Disco | Com folga; preferir < 75% para não esgotar |
| RAM e CPU | Sem saturação contínua |

Acompanhar métricas Railway: `CPU_USAGE`, `MEMORY_USAGE_GB`, `DISK_USAGE_GB`, `NETWORK_TX_GB`, respostas HTTP e p95. Arquivar o JSON de cada etapa. Essas metas não são garantias de capacidade futura.

## Fase 4 — Expandir canais só com origens autorizadas

**Espectadores:** 10 ou 50 clientes podem receber a mesma gravação do laboratório sem abrir 10 ou 50 conexões adicionais ao upstream; isso tem custo de banda e armazenamento.

**Canais distintos simultâneos:** para vídeo verdadeiramente ao vivo, cada fonte independente precisa ser capturada continuamente, com a quantidade de conexões e direitos correspondente ao contrato. Alternar 30 s entre canais inevitavelmente perde cenas, ainda que os arquivos gravados sejam reproduzidos com boa qualidade.

Antes de aumentar canais:
1. Confirmar direitos de retransmissão e número de conexões simultâneas autorizadas.
2. Dimensionar largura de banda de saída, bitrate e espaço de buffer por canal.
3. Isolar ingestão, gravação/transcodificação e distribuição em serviços separados.
4. Adotar cache/CDN e controle de acesso apropriados ao número de usuários e às licenças.
5. Validar os testes antes de integrar qualquer alteração à NPlay principal.

**Nada deste branch deve ser incorporado ao serviço estável automaticamente.**
