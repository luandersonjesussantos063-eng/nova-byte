# Acessos IPTV NPlay

O ADM → **Acessos IPTV** cria usuários específicos para apps compatíveis com a API Xtream e listas M3U. Servidor: `https://nplay-live-gateway.luandersonjesussantos063.workers.dev`.

Disponíveis: `player_api.php`, `get.php`, `xmltv.php`, `/live/usuario/senha/id.ts`, `/live/usuario/senha/id.m3u8`, `/movie/usuario/senha/id.mp4` e `/series/usuario/senha/id.mp4`. A API inclui categorias, informações de filmes, temporadas e episódios. O XMLTV identifica os canais; a programação não é inventada e depende de uma futura fonte de EPG licenciada.

Só aparecem canais publicados com confirmação de direitos e saída direta pelo gateway, e filmes/episódios publicados com direitos revisados, arquivo R2 ou fonte HTTPS direta. YouTube, Drive e itens de catálogo sem vídeo não são extraídos nem exportados.

## Contas e sessões

- A senha é gerada no navegador e armazenada somente como bcrypt no banco. A entrega pode ser copiada na criação ou após redefinir a senha.
- Administradores podem bloquear, renovar e redefinir o acesso. Alterar a conta invalida suas sessões atuais.
- Limite por conta de 1 a 3 transmissões. Isso não altera as três vagas de canais diferentes do receptor. O mesmo canal continua compartilhado entre espectadores.
- O player é identificado pelo endereço de rede, User-Agent e `device_id` quando fornecido. Dois aplicativos com o mesmo IP e User-Agent, sem identificador próprio, podem ser indistinguíveis; para separar clientes, crie credenciais individuais. É um limite de sessões de reprodução, não uma identificação garantida de aparelhos físicos.
- Sessões são renovadas durante a reprodução e expiram após 90 segundos sem tráfego. A troca de canal substitui a sessão do mesmo player. Streams TS/VOD encerram a sessão quando a conexão termina; playlists HLS usam a expiração como proteção para saídas sem aviso.

## Fronteira de segurança

As quatro tabelas estão no schema privado `nplay_iptv_private`, sem privilégios para `anon` ou `authenticated` e com RLS que nega acesso direto. `nplay_iptv_admin` exige um administrador verificado por `auth.uid()`.

`nplay_iptv_backend` é uma capacidade interna: o Worker envia um segredo aleatório de 256 bits cujo hash fica no banco. A função só é executável por `anon` para permitir o transporte pelo PostgREST, mas rejeita toda chamada sem essa capacidade; não usa nem distribui a chave `service_role`. Sua execução com privilégios elevados é intencional e restrita. As observações genéricas do [Database Linter](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) foram verificadas por testes de segredo inválido, usuário sem ADM, conta bloqueada, expiração e limite de sessões.

Segredos: `IPTV_BACKEND_KEY` novo, `HLS_MEDIA_KEY` existente. Bindings: `IPTV_VIDEOS` → R2 `nplay-filmes`; `IPTV_LOGIN_LIMIT` limita tentativas por IP. Os endereços reais e a configuração do receptor nunca aparecem nas listas dos clientes. Recursos HLS usam locators AES-GCM e continuam verificando a conta/sessão no banco.

Preserve `keep_bindings: ["secret_text"]` nas publicações do Worker. Logs de invocação e traces ficam desativados; parâmetros de consulta são removidos dos logs. Nenhum código deve registrar URLs com credenciais.

## Validação

`node --test novaplay/tests/iptv-api.test.mjs novaplay/tests/viewer-release.test.mjs novaplay/tests/media-engine.test.mjs novaplay/tests/xtream-playback.test.mjs novaplay/tests/pc-bridge.test.mjs`

Também foram testados no banco real: autenticação, catálogo, limite, troca de canal, bloqueio, expiração, isolamento do administrador e segredo interno. Uma conta temporária é usada na verificação de publicação e removida ao encerrar os testes.
