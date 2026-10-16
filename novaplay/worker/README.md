# Gateways do testador de canais

O testador tenta HTTPS no mesmo endereço, preservando porta, caminho e query.
Em páginas HTTP também tenta a fonte HTTP diretamente. Em páginas HTTPS, o
navegador bloqueia HTTP: é necessário um gateway HTTPS que permita CORS.
Uma alternativa só é aprovada após imagem e pelo menos dois segundos de vídeo.

URLs `get.php` com `type=m3u_plus` fornecem listas, não vídeo. O testador identifica
essas entradas sem tentar autenticar contas. Importe o arquivo da sua lista por
**Abrir arquivo M3U** ou cole seu conteúdo (até 100 MB; seleção de lotes com até 500 canais). Listas simples podem ter o
nome do canal acima da URL. Páginas paste.sh e texto Base64 não são sinais de
vídeo. Os resultados ocultam parâmetros de usuário, senha e token.
O arquivo selecionado fica fora da caixa de texto. A leitura e análise acontecem
em um Web Worker, que retorna somente o lote de até 500 canais. O botão **Parar
testes** também interrompe a leitura. A interface monta os resultados em etapas.

Configure `../admin/gateway-config.js` antes de publicar o site:

- `NPLAY_AUTHORIZED_GATEWAYS`: mapa exato de URL HTTP para URL HTTPS de
  reprodução autorizada. Inclua caminhos e queries completos. Não grave tokens
  privados nesse arquivo público.
- `NPLAY_GATEWAY_URLS`: origens HTTPS de gateways autorizados que implementem
  `GET /resolve?source=URL`. A resposta JSON deve conter `url`, com uma URL HTTPS
  de reprodução na mesma origem do gateway. A consulta tem limite de cinco
  segundos por gateway, até cinco gateways. Respostas sem autorização devem
  retornar 404. Não é uma pesquisa em proxies públicos na internet.

O mapeamento SPTV existente continua disponível. Novos gateways precisam ser
configurados; o testador não cria serviços nem comprova autorização de terceiros.

`authorized-ts-gateway.js` pode ser implantado separadamente como Cloudflare
Worker. Configure `ALLOWED_ORIGIN` com a origem do site e `ALLOWED_STREAMS` com
um JSON de IDs para fontes autorizadas, por exemplo:

```json
{"meu-canal":"http://stream.example/live.ts"}
```

Adicione a origem HTTPS desse Worker a `NPLAY_GATEWAY_URLS`. `/resolve` só procura
correspondências exatas nessa lista e retorna `/stream/meu-canal.ts`. A rota de
stream aceita apenas IDs configurados, não URLs arbitrárias, e recusa redirects.
Este Worker suporta MPEG-TS; HLS exige um gateway próprio que também sirva as
playlists, segmentos e chaves por HTTPS. O resultado final deve permitir CORS.

Se todas as tentativas falharem, o item fica inválido para reprodução neste site
e não pode ser publicado. Isso não é prova de que a fonte HTTP esteja fora do ar.

Validação local: `node --test novaplay/tests/http-channel.test.mjs
novaplay/tests/live-channels.test.mjs novaplay/tests/saved-channel-bulk.test.mjs`
na raiz do repositório. Os testes usam fontes simuladas; não validam disponibilidade
de emissoras nem implantação remota do Worker.
