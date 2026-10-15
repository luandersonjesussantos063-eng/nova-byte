# NPlay — importador com retomada automática

Requer Python 3.11, FFmpeg/FFprobe, dependências de `requirements.txt` e `.env` privado. Aplique as migrações Supabase antes de iniciar esta versão. O site estático não executa o processador: este computador precisa estar ligado, conectado e com espaço em disco.

## Operação no Windows

Execute `INICIAR-IMPORTADOR.bat` para iniciar manualmente. Para iniciar ao entrar no Windows, execute `INSTALAR-INICIO-AUTOMATICO.ps1` no PowerShell. A tarefa NPlay Validacao de Videos verifica a cada 15 minutos os envios antigos concluídos sem validação; respeita o sinal importer.stop. O supervisor mantém somente uma instância por instalação, reinicia o processo após falha e salva logs em `logs/`.

Para parar sem perder a tarefa atual, crie um arquivo vazio `importer.stop` nesta pasta. O trabalho atual termina; nenhum novo é iniciado. Remova esse arquivo para retomar. A inicialização manual também remove esse sinal. Não encerre o FFmpeg durante uma conversão.

## Fluxo

1. Registre o magnet e a referência de autorização no painel; confirme a liberação do processamento.
2. O banco reserva uma tarefa por vez. A cada 20 segundos o processador confirma que está ativo; reservas sem comunicação expiram em cinco minutos.
3. Um único vídeo principal é escolhido automaticamente. Pacotes com vários vídeos exigem seleção explícita no painel; amostras e trailers não são escolhidos como filme principal. A importação de uma temporada inteira ainda não é automática.
4. Downloads parciais e conversões concluídas ficam em `jobs/<id>/`. Falhas de conexão têm até três tentativas com espera crescente. O painel permite tentar novamente depois disso.
5. FFprobe verifica codecs/duração; FFmpeg converte quando necessário e decodifica amostras do começo, meio e fim. Isso não equivale a decodificar todos os quadros do filme.
6. O upload multipart mantém as partes no R2 e retoma as faltantes. Tamanho e SHA-256 registrado no objeto permitem reconhecer upload já concluído.
7. A conclusão cria um rascunho com duração, tamanho, ano quando presente no título e capa extraída do vídeo. Confira título, sinopse, gênero e direitos. Com a opção automática ativada, o rascunho é publicado quando esses campos e a validação estiverem completos. Retirar do catálogo desativa a publicação automática.

O sistema não adivinha sinopses nem confirma a identidade de um filme apenas pelo nome do torrent. A revisão é necessária nos casos ambíguos. Uploads manuais continuam com seu fluxo separado de revisão.

## Diagnóstico

- `logs/worker.log`: andamento e tipo de falha, sem credenciais.
- `jobs/<id>/manifest.json`: etapas concluídas e upload em andamento. Não apague durante processamento.
- `python -m unittest -v test_pipeline`: testes sem conexão externa.
- `python worker.py --once --job-id UUID --local-file CAMINHO`: recuperação/teste de um trabalho autorizado já na fila. Não cria autorização nem publica o conteúdo.
- `python validate_existing.py`: verifica importações já enviadas e preenche metadados técnicos; não altera a revisão editorial.

`recovery/<id>.mp4` é reaproveitado quando existe. Arquivos de tarefas incompletas ou ainda em rascunho são preservados para recuperação. Fontes que não respondem após três tentativas vão para atenção, com opção de trocar o magnet. Limite de tamanho e falta de espaço exigem ajuste; não geram tentativas automáticas inúteis. O download reserva margem para manter o original e preparar o vídeo. O limite padrão é 16 GiB por vídeo e duas horas por etapa de download/conversão, ajustável no `.env`.

Nunca envie `.env`, credenciais, logs privados ou vídeos ao Git. As chaves do processador ficam apenas no computador/servidor.

## Proteção contra fontes lentas

Uma fonte que entrega menos de 32 KiB/s durante uma janela de cinco minutos libera a fila e é retomada após 15 minutos, com as partes preservadas. Ajuste `IMPORTER_SPEED_WINDOW_SECONDS` e `IMPORTER_MIN_DOWNLOAD_RATE` no `.env`; taxa zero desativa essa proteção. Falhas de metadados aguardam uma hora entre tentativas e, após três tentativas, exigem revisão da fonte. Os prazos de retomada e reserva usam o relógio do banco.

Na preparação, H.264/yuv420p e áudio AAC são copiados sem recodificação quando somente o contêiner precisa mudar. Outros codecs continuam sendo convertidos e a saída passa pela mesma validação técnica.

## Limpeza automática após publicação

O processador verifica as importações concluídas ao iniciar, a cada minuto quando livre e após terminar um trabalho. Só remove os arquivos de `jobs/<id>/` e `recovery/<id>.mp4` quando o trabalho está `ready`, o item correspondente está publicado e validado no catálogo, a chave do objeto é a mesma e o R2 confirma tamanho e SHA-256. O pequeno `manifest.json` fica como comprovante, com `local_cleanup_at`.

Rascunhos, falhas, downloads em andamento e arquivos pessoais fornecidos por `--local-file` fora dessas pastas não são apagados. A limpeza não remove nada do R2 ou do catálogo. Uma falha na consulta ou na conferência adia a limpeza; erro ao apagar tenta novamente na próxima verificação. Importações antigas sem comprovante completo exigem revisão manual.

Para atualizar uma instalação existente no Windows, abra o PowerShell **dentro da pasta do importador**, onde ficam `pipeline.py` e `INICIAR-IMPORTADOR.bat`, e execute:

```powershell
& ([scriptblock]::Create((Invoke-WebRequest -UseBasicParsing 'https://novabytesolucoes.com.br/novaplay/importer/ATUALIZAR-LIMPEZA.ps1').Content))
```

O comando sinaliza parada, espera o supervisor terminar o trabalho atual, instala somente `pipeline.py` e `cleanup.py`, confere a sintaxe, executa a limpeza das tarefas publicadas elegíveis e abre o importador novamente. `.env` e credenciais são preservados. Não feche o FFmpeg durante a espera. Se houver um worker iniciado separadamente, aguarde esse worker parar antes de atualizar.

Também é possível executar somente a conferência e limpeza: `python worker.py --cleanup-only` (com o supervisor parado). Os erros de capacidade existentes continuam exigindo a opção de tentar novamente no painel depois que houver espaço.
