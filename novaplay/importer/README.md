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

`recovery/<id>.mp4` é reaproveitado quando existe. Os arquivos locais são preservados para recuperação; verifique o espaço antes de remover arquivos de tarefas comprovadamente concluídas. Fontes que não respondem após três tentativas vão para atenção, com opção de trocar o magnet. Limite de tamanho e falta de espaço exigem ajuste; não geram tentativas automáticas inúteis. O download reserva margem para manter o original e preparar o vídeo. O limite padrão é 16 GiB por vídeo e duas horas por etapa de download/conversão, ajustável no `.env`.

Nunca envie `.env`, credenciais, logs privados ou vídeos ao Git. As chaves do processador ficam apenas no computador/servidor.

## Proteção contra fontes lentas

Uma fonte que entrega menos de 32 KiB/s durante uma janela de cinco minutos libera a fila e é retomada após 15 minutos, com as partes preservadas. Ajuste `IMPORTER_SPEED_WINDOW_SECONDS` e `IMPORTER_MIN_DOWNLOAD_RATE` no `.env`; taxa zero desativa essa proteção. Falhas de metadados aguardam uma hora entre tentativas e, após três tentativas, exigem revisão da fonte. Os prazos de retomada e reserva usam o relógio do banco.

Na preparação, H.264/yuv420p e áudio AAC são copiados sem recodificação quando somente o contêiner precisa mudar. Outros codecs continuam sendo convertidos e a saída passa pela mesma validação técnica.
