# NPlay — importação M3U Plus protegida

O arquivo `m3uplus-import.js` é um modelo de Cloudflare Worker para importar **metadados e URLs de canais autorizados** para uma tabela privada de revisão, sem publicar automaticamente.

## Configuração

1. Execute `novaplay/worker/m3uplus-staging.sql` no Supabase SQL Editor.
2. Crie um Worker privado com o código `m3uplus-import.js`.
3. Configure como **Secrets** do Worker: `PLAYLIST_URL` (URL completa da lista HTTPS), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `IMPORT_ADMIN_TOKEN` (token forte e exclusivo).
4. Acione `POST /import` por ferramenta administrativa de confiança, com `Authorization: Bearer <token>`. **Não coloque esse token no JavaScript do site**.
5. Revise as entradas em `novaplay_import_staging`, valide as permissões e teste os sinais antes de transferir qualquer canal para `novaplay_live_embeds`.

**Não é uma retransmissão/proxy de mídia**: o importador apenas baixa a lista e cria rascunhos privados. O teste MPEG-TS/HLS, CORS, HTTP/HTTPS, direitos de retransmissão e capacidade de streaming exigem configuração e validação separadas.

**Segurança:** rotacione as credenciais anteriormente compartilhadas e nunca as registre no GitHub. O endpoint não deve ser chamado pelo navegador do visitante. URLs importadas podem conter credenciais embutidas; não as exponha em respostas públicas ou logs.
