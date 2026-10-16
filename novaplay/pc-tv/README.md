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
