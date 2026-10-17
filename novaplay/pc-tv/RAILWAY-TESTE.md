# Receptor NPlay em teste gratuito na Railway

Reutiliza o receptor 0.50.1 com Node e FFmpeg. Não publica canais, não importa
outra lista e não altera a TV-PC do Windows. O teste só é considerado aprovado
após login, vídeo, áudio e reprodução contínua dentro da NPlay.

## Serviço temporário

- Plano da conta: Trial, sem contratar Hobby ou adicionar cartão.
- Imagem oficial: `node:24-alpine`.
- Uma réplica; a conta do fornecedor permite um canal recebido por vez.
- Sem volume persistente; o receptor remove os segmentos ao encerrar a sessão.
- Porta do domínio HTTPS: `8788`.
- Configure uma chave aleatória de 64 caracteres hexadecimais exclusivamente em
  `NPLAY_BRIDGE_KEY`, nas variáveis privadas do serviço. Não a grave no GitHub.
- O comando de início baixa e executa `START-RAILWAY.sh` deste repositório. Esse
  script baixa somente os módulos públicos da versão testada do receptor e usa
  o usuário `node` para executar o serviço após instalar FFmpeg.
- `NPLAY_MEDIA_MODE=compatible` gera H.264/AAC. `copy` preserva o vídeo original
  e exige que o aparelho suporte seu codec; não habilitar sem conferir a fonte.
- No ambiente de nuvem, o primeiro teste usa o endereço HTTP fornecido pelo
  proprietário. A exceção HTTPS da TV-PC é opcional e não é ativada aqui.

O domínio público exige a chave em todas as rotas, inclusive `/health`.
O gateway NPlay continua exigindo sessão e acesso ao canal. Usuários não recebem
o endereço do fornecedor nem suas credenciais. A chave não aparece nos logs.

## Etapas de validação

1. Confirmar que a conta Trial tem rede externa liberada.
2. Iniciar o serviço; conferir a identificação autenticada em `/health`.
3. Autenticar a conta do fornecedor e inspecionar um canal ainda em rascunho.
4. Testar a recepção e a geração de HLS.
5. Testar imagem, áudio e reprodução contínua na NPlay com a sessão do ADM.
6. Parar o serviço após o teste para preservar o crédito. Não fazer upgrade
   automático, não cadastrar pagamento e não publicar a grade sem validação.

Os créditos e limites vigentes precisam ser conferidos no painel da conta.
Receber sinal neste ambiente não garante acesso por outra região ou provedor.
