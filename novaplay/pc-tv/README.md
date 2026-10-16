# NPlay TV pelo PC

Ponte temporaria com Docker Desktop: busca os sinais HTTP/HLS, inclusive redirects
para IPv4 publico, e os entrega ao gateway autenticado NPlay por um Quick Tunnel.
Nao baixa a lista inteira nem inicia todos os canais simultaneamente. Cada
reproducao usa a conexao e o upload do PC. Os limites de conexao do fornecedor continuam valendo.

Execute INICIAR-TV-PC.ps1 com PowerShell -ExecutionPolicy Bypass. Ele instala
em %LOCALAPPDATA%\NPlay\TV-PC, gera uma chave privada local e abre CONEXAO-ADM.txt.
Cole o endereco e a chave em ADM > Canais > TV pelo PC e conecte. O botao de
grade completa publica somente os canais da nova lista HLS, apos verificar a ponte.
Nao envie o arquivo .env ou CONEXAO-ADM.txt ao GitHub.

O PC e o Docker precisam permanecer ligados. O Quick Tunnel e para testes;
seu endereco pode mudar ao reiniciar. Execute o script novamente e atualize
o endereco no ADM. Para parar, execute PARAR-TV-PC.bat. Para remover a ponte
do NPlay, use Desconectar PC no ADM; os canais e seu historico sao preservados.

O gateway continua validando o JWT e o acesso de cada aparelho. A chave do PC
fica cifrada com AES-GCM no banco; so o gateway consegue decifra-la. A ponte
rejeita requisicoes sem chave, destinos locais, metadata, enderecos privados,
IPv6 e DNS com respostas privadas; cada redirect e resolvido e validado.
As conexoes DNS sao fixadas ao IPv4 validado, sem desativar verificacao TLS.
URLs do fornecedor e credenciais nao aparecem nos logs.

## Reprodução Xtream (0.49.29)
O gateway usa os canais já cadastrados, sem uma nova importação. Ao abrir um canal,
a ponte tenta a rota padrão Xtream `/live/` e mantém a rota original como alternativa
apenas para 404 ou conexão encerrada. Não troca DNS, não ignora certificados e não
repete pedidos rejeitados com 401/403. As requisições de segmentos e chaves não são
reescritas. O player tenta HLS e, se suportado pelo navegador, MPEG-TS em sequência.
O endereço final de redirecionamento é usado internamente para resolver segmentos
relativos e nunca é encaminhado para o cliente. A reprodução no PC precisa ser
confirmada após atualizar a ponte; testes locais não provam acesso ao fornecedor.

## Receptor IPTV Xtream + FFmpeg (0.50.0)

O receptor autentica a conta em `player_api.php`, confere situação e limite de
conexões e só então abre um canal MPEG-TS. Cookies de login ficam restritos à
origem do fornecedor. O sinal entra no FFmpeg por um pipe: o processo de mídia
não recebe endereços do fornecedor e não pode abrir URLs de playlists ou arquivos
escolhidos pelo usuário. A saída padrão é H.264/AAC, até 720p, com dois threads.
Isso usa mais CPU que a ponte antiga e foi limitado a um canal recebido por PC.

O HLS gerado contém somente nomes de segmentos temporários. O gateway os entrega
por identificadores cifrados e exige a sessão e as permissões normais do NPlay.
Um canal é recebido sob demanda; várias consultas à mesma sessão reaproveitam o
processo. Sessões de proprietários diferentes não substituem um canal ativo.
Após 25 segundos sem consulta, o receptor encerra o processo e limpa seus arquivos.
O diretório temporário do contêiner tem limite de 128 MB, sem persistência.

Na primeira atualização para 0.50.0, baixe a versão atual de `INICIAR-TV-PC.ps1`
do site NPlay e execute-a (o instalador antigo ainda não conhece os módulos novos).
Reconecte o arquivo `CONEXAO-ADM.txt`
se o túnel mudar. No ADM, use **Verificar receptor IPTV** para consultar login,
recebimento, processamento, quantidade de dados e o código de eventual falha.
Teste primeiro um rascunho com **Testar para publicar**; só publique após confirmar
sinal. Não é preciso republicar toda a lista para testar o receptor.

A conversão não garante acesso a uma origem que encerre a conexão. Os códigos
`XTREAM_LOGIN_RESET` e `ENGINE_SOURCE_RESET` distinguem se o encerramento ocorreu
no login da API ou na abertura do vídeo. A validação local com FFmpeg verifica
HLS decodificável com H.264 e AAC; o acesso real a este fornecedor precisa ser
confirmado no PC onde o receptor está instalado. Mantenha os outros players
fechados se a conta permitir somente uma conexão.

Para preservar o vídeo original em um PC de baixa capacidade, a configuração
opcional `NPLAY_MEDIA_MODE=copy` no `.env` evita transcodificar vídeo (mantém áudio
AAC). A compatibilidade do codec de vídeo original passa a depender do navegador.

### Reconectar sem copiar a chave

`REPARAR-CONEXAO.ps1` pode ser baixado do site e executado isoladamente. Ele nao
recria os containers nem troca a chave. Le a chave do container em execucao,
confere `/health` localmente e pelo tunel atual e so entao regrava
`CONEXAO-ADM.txt`. Isso evita divergencias entre `.env`, variaveis de ambiente
do Windows/Docker Compose e a chave realmente usada pela ponte. O instalador
agora usa esse mesmo procedimento apos iniciar o Docker.

A chave e capturada em memoria; o script nao a imprime no terminal. Carregue o
arquivo atualizado no ADM e clique em **Conectar PC**. A verificacao da ponte
nao testa o fornecedor: falhas no login Xtream continuam sendo uma etapa distinta.
