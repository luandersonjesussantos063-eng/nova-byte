# Diagnóstico de autenticação Ministra/Stalker

Worker separado: `nplay-portal-test`. A tela administrativa fica em Ferramentas.
O servidor valida o JWT no Supabase e exige registro em `novaplay_admins` antes de
consultar o provedor. O JWT da NPlay nunca é encaminhado ao provedor.

Configure `ALLOWED_PORTAL_ORIGINS` no Worker como um array JSON de origens exatas
(esquema, host e porta). URLs, caminhos, identificadores e tokens não são gravados
pelo diagnóstico. Não inserir MAC, SN, SNCUT, DEV ou tokens neste repositório.
CORS limitado a `https://novabytesolucoes.com.br`; redirecionamentos recusados;
corpos e respostas têm limites de tamanho e as conexões têm timeout.

O teste faz handshake e consulta de perfil, sem gerar identificadores, modificar
contas, buscar canais ou reproduzir conteúdo. Um token de handshake sozinho não
é aprovação. Uma resposta sem perfil reconhecido continua não confirmada. Alguns
provedores exigem uma API ou cliente específico; esse diagnóstico não implementa
todas as versões de Ministra nem confirma a validade contratual de uma conta.

Validação: `node --test novaplay/tests/portal-auth.test.mjs`. Os testes são
simulados e não confirmam uma assinatura real no provedor.
