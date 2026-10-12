# NovaByte Robô — protótipo Android 0.1.0

**Experimento separado da central web NovaByte Divulga.** Não publicado na Play Store, não testado na interface real do Facebook e não é um sistema de divulgação em massa.

## O que foi implementado

- Aplicativo Android Java com formulário para **um grupo e um anúncio por execução**.
- Importação de um anúncio pela opção **Compartilhar → NovaByte Robô** no Android, usando pacote de texto `NOVABYTE_ROBO_V1`.
- Permissão de acessibilidade concedida explicitamente pelo usuário nas Configurações do Android.
- Serviço limitado aos aplicativos com pacotes **com.facebook.katana** (Facebook) e **com.facebook.lite** (Lite).
- Após clicar em **INICIAR** e autorizar especificamente aquele grupo, o serviço tenta localizar a criação de publicação, preencher um campo editável com o texto e acionar **Publicar** uma única vez.
- Tempo máximo 75 segundos; se um botão/elemento não aparecer, não força cliques ou gestos por coordenadas, não fica tentando continuamente e não burla verificações.
- Botão **PARAR ROBÔ** na tela principal, estado local, sem backend, senhas, cookies ou transmissão de dados.
- Mensagem final é "acionou Publicar": o sistema não tem como confirmar se a postagem foi publicada ou está em aprovação.

## Como testar

1. Executar o workflow manual **NovaByte Robo - APK experimental Android** no GitHub Actions e obter o artefato `novabyte-robo-android-debug-apk`.
2. Instalar o APK **de teste** no seu aparelho Android. O Android 13+ pode mostrar "Configuração restrita" para aplicativos instalados fora da loja. Não desative proteções gerais; confirme a origem do APK e habilite a permissão apenas se compreender o acesso ampliado.
3. Abrir NovaByte Robô. Ler a explicação de Acessibilidade e, voluntariamente, ativar o serviço no Android.
4. No NovaByte Divulga web, abrir fila de grupos e usar "Enviar ao robô Android". Selecionar NovaByte Robô no menu de compartilhamento. O grupo e o texto serão preenchidos **apenas para revisão**.
5. Escolher Facebook ou Lite, conferir o conteúdo e selecionar a caixa de autorização específica. Tocar **INICIAR**.
6. Voltar à tela do app se for necessário interromper, ou desativar o serviço de acessibilidade.
7. Conferir manualmente a postagem no grupo e o resultado real.

## Limitações e riscos

- A interface do Facebook muda frequentemente; **não há garantia** de que o protótipo reconhecerá a caixa de criação, o campo de texto ou o botão de postar em seu aparelho. Se falhar, não prosseguir à força.
- **Não há envio de imagem nesta primeira prova**, somente texto e link.
- Somente um grupo autorizado por execução; **sem agendamento de posts em massa**, sem simulação de CAPTCHA, ocultação de atividade ou contorno de bloqueios.
- O serviço de Acessibilidade concede ampla visibilidade da interface dos aplicativos selecionados. Não escolha habilitar se não concordar com esse acesso. Não define `isAccessibilityTool=true`, pois este não é um aplicativo para pessoas com deficiência.
- Um APK de debug é assinado para testes e não pode ser publicado na Play Store. Assinaturas de builds distintas podem diferir.
- Pode contrariar regras do Facebook e causar bloqueio/limitação da conta; riscos aceitos pelo usuário não constituem autorização da Meta.
- Google Play exige declaração e consentimento expresso ao usar AccessibilityService e restringe funcionalidades autônomas.

## Código

- `app/src/main/java/br/com/novabytesolucoes/divulgarobo/MainActivity.java` — consentimento, textos, grupo, compartilhamento e início.
- `app/src/main/java/br/com/novabytesolucoes/divulgarobo/PostStore.java` — estado local.
- `app/src/main/java/br/com/novabytesolucoes/divulgarobo/FacebookAssistService.java` — automação estática por elementos da interface, somente Facebook.
