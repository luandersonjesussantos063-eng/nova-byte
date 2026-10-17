# NPlay — gateway protegido para TV estabilizada (prévia administrativa)

Código: `timeshift-gateway.mjs`, Worker Cloudflare `nplay-timeshift-gateway`.

A NPlay v0.50.1 mostra os canais A e B somente a usuários autenticados que possam consultar `novaplay_admins`. O player utiliza listas VOD HLS por bloco e transiciona para gravações novas, sem divulgar o endereço ou a senha do fornecedor nos arquivos do site.

## Configuração privada pendente

No painel Cloudflare, selecionar **Workers & Pages → nplay-timeshift-gateway → Settings → Variables and Secrets**. Criar a variável **secret** `TIMESHIFT_VIEW_PIN` com a senha atual do laboratório Railway `nplay-timeshift-lab`. Nunca registrar esse valor em GitHub, arquivos públicos, URL ou captura de tela.

A variável de texto `TIMESHIFT_BASE_URL` deve apontar para `https://nplay-timeshift-lab-production.up.railway.app/` e já foi incluída no envio inicial do Worker. Não copiar variáveis com credenciais IPTV para a Cloudflare.

Testes depois da configuração:

1. Verificar GET `/healthz`, que deve mostrar o serviço disponível (não valida os segmentos).
2. Entrar na NPlay como administrador, abrir **TV ao vivo** e selecionar A ou B na categoria de testes privados.
3. Confirmar imagem e áudio em 2 dispositivos, transição de blocos, encerramento ao fechar o player e isolamento dos usuários sem privilégios.
4. Não publicar esses canais à audiência geral sem confirmação contratual dos direitos e dos limites do provedor.

**Limitação importante:** o laboratório grava alternadamente 30 segundos de cada canal. Isso não equivale a capturar dois canais continuamente; partes da programação podem não ser gravadas.

O Worker autoriza o Supabase JWT do administrador em cada requisição, reescreve playlists HLS para entregar somente segmentos autorizados e usa o cookie do laboratório exclusivamente no servidor. O site nunca deve receber o valor `TIMESHIFT_VIEW_PIN`.
