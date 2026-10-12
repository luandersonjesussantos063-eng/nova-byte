# NovaByte Divulga — V 1.0.0

Central de divulgação da NovaByte Soluções para Android (versão inicial web instalável/PWA e projeto Capacitor de teste).

## O que funciona

- Cadastro e importação de links diretos de grupos Facebook, com validação, remoção de duplicados, cidade, regras e intervalo entre divulgações.
- Campanhas para sites, landing pages, cardápios, aplicativos e sistemas, com modelos de texto editáveis, imagens locais comprimidas e link.
- Botão Iniciar divulgação assistida: fila, copiar anúncio, abrir grupo no Facebook, marcar como publicado ou pular.
- Histórico apenas de publicações confirmadas manualmente, estatísticas honestas, backup JSON e restauração.
- Lembretes enquanto o painel está aberto (limitação da versão web), uso offline após primeiro acesso e instalação na tela inicial do Android.
- Os dados ficam apenas no armazenamento local deste navegador; sem conta nem sincronização remota. Sem login Facebook nem solicitação de senha.

## Limitações importantes

NÃO publica automaticamente nos grupos. A API de postagem em grupos de terceiros não está disponível e o aplicativo não simula cliques, burla limites ou usa acessibilidade para automatizar posts em massa. Você confirma cada publicação no Facebook. O histórico é sua confirmação, não uma verificação do Facebook.

A URL é pública, mas os dados não são enviados ao servidor. Em outro aparelho a central estará vazia. Outras pessoas no mesmo navegador poderão acessar os dados locais. Faça backup antes de limpar dados. Não guarde credenciais neste painel.

## Teste Android

Abra https://novabytesolucoes.com.br/divulga/ no Chrome. No menu, escolha Adicionar à tela inicial ou Instalar aplicativo (se disponível). Recursos básicos funcionam offline após primeiro acesso, exceto abrir Facebook.

## APK de teste

Integração Capacitor separada em mobile/ e workflow Android no GitHub Actions. APK debug não é Play Store nem instalação automática. Pode exigir chave de assinatura estável para atualização do APK anterior. Para produção, acrescentar revisão de políticas, backup/sincronização e testes em aparelhos reais.

## Privacidade

Sem Google Analytics, Facebook SDK, pixels ou rastreamento no painel. Grupos, campanhas e histórico ficam no localStorage com chave novabyte-divulga-v1. As imagens são comprimidas localmente. Backups são baixados no dispositivo.
