/* NPlay: notas editoriais por versão. Atualize junto com a versão do site.
   O teste de publicação exige descrição para a versão atual.
   Apenas alterações efetivamente implementadas devem ser anunciadas. */
(()=>{
"use strict";
const releases=[
 {"version": "0.51.31", "date": "2026-10-21", "title": "Informações públicas e publicidade · versão 0.51.31", "intro": "A NPlay ganhou páginas de apresentação e privacidade, além da integração com o AdSense do domínio.", "changes": ["Links Sobre a NPlay e Privacidade disponíveis antes e depois da escolha de perfil, com informações sobre autorização, recursos e tratamento de dados.", "Configuração de busca atualizada com URL principal, mapa do site e páginas públicas. A inclusão nos resultados depende do rastreamento e da decisão do Google.", "Integração do AdSense com o identificador já usado pela NovaByte. Anúncios no aplicativo aguardam autorização e seleção do perfil; disponibilidade depende das configurações do Google."]},
 {version:"0.51.26",date:"2026-10-19",title:"Configurações do aplicativo · versão 0.51.26",intro:"O menu do perfil ganhou uma área de configurações com preferências de reprodução e diagnóstico deste aparelho.",changes:["Menu de perfil com avatares, gerenciamento, conta, ajuda e opção de sair do perfil. As configurações também podem ser abertas na tela de liberação do aparelho.","Preferências de uso de dados, retomada dos vídeos, som da abertura, avisos no sino e estatísticas opcionais ficam salvas neste navegador. Economizar dados limita a qualidade em fontes adaptativas que oferecem outras versões.","Consulta de armazenamento e limpeza somente do cache da NPlay, mantendo perfis, favoritos e liberação. Testes de rede e velocidade, informações do aparelho, formatos de reprodução e links de privacidade e licenças."]},
 {version:"0.51.25",date:"2026-10-19",title:"Nova tela de reprodução · versão 0.51.25",intro:"Controles reorganizados conforme o novo modelo, com título centralizado e reprodução no meio da tela.",changes:["Voltar e avançar 10 segundos ficam ao lado de reproduzir/pausar. Dois toques no lado esquerdo ou direito da imagem também voltam ou avançam, dentro do trecho disponível do vídeo.","Brilho da imagem na lateral, trava dos controles no topo, progresso vermelho e tempo restante na parte inferior. Barra de volume e botão de silenciar foram removidos.","Menus para velocidade, áudio e legendas disponíveis na fonte. Recortar permite escolher um trecho para assistir e depois retornar ao vídeo completo. Favoritos e transmissão para TV continuam no player."]},
 {version:"0.51.24",date:"2026-10-19",title:"Recuperação do vídeo · versão 0.51.24",intro:"O player recebeu melhorias de buffer e reconexão para lidar com oscilações durante a reprodução.",changes:["TV ao vivo usa uma reserva maior de vídeo à frente, com menos dados antigos retidos e tentativas de carregar novamente o sinal antes de trocar de formato.","O player monitora o avanço da imagem e tenta recuperar uma parada persistente, com limite de tentativas e cancelamento ao fechar ou trocar o vídeo.","Recuperação mantém o ponto de reprodução quando disponível, reduz a próxima qualidade em fontes adaptativas e respeita pausa, busca e transmissão para a TV."]},
 {version:"0.51.23",date:"2026-10-18",title:"Canais sem repetição · versão 0.51.23",intro:"Uma única entrada por canal na grade da TV ao vivo, com os canais mais conhecidos primeiro.",changes:["Variações de qualidade, cópias e sinais regionais de um mesmo nome ficam agrupados em um cartão; o nome exibido fica sem HD, FHD, 4K e marcas de cópia.","Canais por assinatura conhecidos aparecem antes dos canais abertos; sinais extras e internacionais ficam depois da seleção principal.","A busca, a contagem e o botão Mostrar mais usam a lista agrupada. Favoritos já salvos em outras versões do canal continuam marcados na grade e no player."]},
 {version:"0.51.22",date:"2026-10-18",title:"Mais comédia na Home · versão 0.51.22",intro:"Filmes completos e vídeos de humor do YouTube também aparecem na seleção de comédia da Home.",changes:["Adicionados 5 filmes completos de comédia e 14 vídeos de humor de NetMovies Comédia, Afonso Padilha, Barbixas e Porta dos Fundos.","A faixa Comédia para sua sessão reúne os novos vídeos e os filmes de comédia da NPlay; Ver todos abre a coleção completa.","Vídeos com incorporação disponível foram conferidos no YouTube. As miniaturas e a reprodução continuam usando o player oficial do canal."]},
 {version:"0.51.21",date:"2026-10-18",title:"Painel administrativo reorganizado · versão 0.51.21",intro:"Navegação mais compacta e ferramentas organizadas por área.",changes:["Menu compacto no celular e navegação lateral no computador; diagnóstico IPTV transferido para Ferramentas.","Buscas e filtros de situação para acessos IPTV, autorizações e perfis online. Dados técnicos e permissões administrativas ficam em detalhes expansíveis.","Fila de importações em primeiro plano e formulários de criação e ações em lote recolhidos. Controles de prévias desativadas removidos do ADM."]},
 {version:"0.51.20",date:"2026-10-18",title:"Excluir acessos IPTV e identificar clientes · versão 0.51.20",intro:"O ADM permite excluir acessos IPTV e identifica os perfis online pelo cadastro.",changes:["Botão Excluir acesso em cada conta IPTV, com confirmação antes de apagar o login e suas sessões salvas.","Perfis online exibem como nome principal a pessoa informada no cadastro; o perfil do aplicativo aparece na identificação adicional."]},
 {version:"0.51.19",date:"2026-10-18",title:"Prévias da TV desativadas · versão 0.51.19",intro:"A tela TV ao vivo volta a exibir somente a grade de canais.",changes:["A faixa de destaque e suas prévias automáticas foram desativadas na tela TV ao vivo.","Os canais publicados, favoritos, botão de transmitir e seleção salva no ADM foram preservados."]},
 {version:"0.51.18",date:"2026-10-18",title:"Transmitir canais ao vivo para TV · versão 0.51.18",intro:"O player dos canais protegidos também oferece a opção de transmitir para TV.",changes:["Botão TV disponível no player dos canais ao vivo protegidos, usando Google Cast, AirPlay ou o seletor compatível do aparelho.","Autorizações temporárias são restritas ao canal escolhido e mantêm a sessão de login fora dos endereços enviados à TV. A compatibilidade depende da televisão e do sinal HLS."]},
 {version:"0.51.17",date:"2026-10-18",title:"Exibição dos canais selecionados · versão 0.51.17",intro:"A faixa de TV prepara o vídeo sem ocultar o player durante o carregamento.",changes:["O player de destaque mantém dimensões visíveis durante a preparação da prévia, com aviso de conexão e liberação das miniaturas após confirmar imagem.","As miniaturas iniciam somente após o destaque confirmar imagem em movimento, mantendo ocultas as prévias indisponíveis."]},
 {version:"0.51.16",date:"2026-10-18",title:"Correção do teste de prévias · versão 0.51.16",intro:"Testes continuam durante a renovação normal da sessão.",changes:["Eventos normais de autenticação da mesma conta não interrompem mais o teste individual ou em lote.","O testador usa a conexão administrativa existente para autorizar o vídeo, evitando criar clientes de autenticação durante cada teste."]},
 {version:"0.51.15",date:"2026-10-18",title:"Teste de todas as prévias no ADM · versão 0.51.15",intro:"Teste a grade e escolha os canais com imagem funcionando.",changes:["Botão para testar todas as prévias, com progresso, contagem e opção de parar.","Filtro para escolher somente os canais com imagem confirmada; seleção e salvamento continuam manuais."]},
  {
  version:"0.51.14",date:"2026-10-18",title:"Prévias escolhidas no ADM · versão 0.51.14",
  intro:"A faixa de TV agora mostra somente os canais escolhidos e testados pelo administrador.",
  changes:[
   "No ADM, em TV ao vivo, teste a imagem de um canal, adicione à seleção e salve a ordem dos destaques.",
   "O destaque só aparece depois de receber imagem em movimento; prévias que falharem ou pararem são escondidas.",
   "Sem canais escolhidos ou sem sinal confirmado, a faixa fica oculta. O topo da tela também foi ajustado no celular."
  ]
 },
 {
  version:"0.51.13",date:"2026-10-18",title:"TV em destaque · versão 0.51.13",
  intro:"Descubra o que está passando antes de escolher seu canal.",
  changes:[
   "A tela TV ao vivo ganhou uma transmissão em destaque no topo e uma faixa rolável com prévias silenciosas de outros canais.",
   "O destaque muda ao sair e voltar para a tela. O áudio é iniciado quando o navegador permite, com botão para ativar o som.",
   "As prévias fora da tela são encerradas. Você pode favoritar o destaque ou abrir o player completo."
  ]
 },
 {
  version:"0.51.12",
  date:"2026-10-18",
  title:"Favoritos no player · versão 0.51.12",
  intro:"Salve seus canais favoritos também enquanto assiste.",
  changes:[
   "Os favoritos dos canais usam a mesma identificação na tela inicial, na grade e na reprodução.",
   "O coração na tela de reprodução permite salvar ou remover o canal sem fechar o vídeo.",
   "A lista permanece salva neste navegador e acompanha as alterações feitas em outras abas."
  ]
 },
 {
  version:"0.51.11",
  date:"2026-10-18",
  title:"Programação ao vivo · versão 0.51.11",
  intro:"Consulte o que está passando nos canais com guia do fornecedor.",
  changes:[
   "Os canais com guia mostram o programa atual, o horário e uma barra de progresso.",
   "O próximo programa aparece quando informado pelo fornecedor; canais sem guia mostram Programação indisponível."
  ]
 },
 {
  version:"0.51.10",
  date:"2026-10-18",
  title:"Novidades da NPlay · versão 0.51.10",
  intro:"A abertura voltou à identidade que você conhece, agora com animação de letras.",
  changes:[
   "Restauramos a logo original da NPlay e o reflexo suave de luz azul abaixo dela.",
   "As letras aparecem uma por uma, sincronizadas com a abertura.",
   "O som original escolhido permanece o mesmo, sem trocar a gravação."
  ],
  action:"preview-intro-audio",
  actionLabel:"▶ Ouvir som da abertura"
 },
 {
  version:"0.51.9",
  date:"2026-10-17",
  title:"Novidades da NPlay · versão 0.51.9",
  intro:"A aba YouTube recebeu uma correção de visualização para facilitar a escolha dos vídeos.",
  changes:[
   "Capas dos vídeos maiores e na proporção horizontal 16:9, sem miniaturas achatadas.",
   "Cada categoria agora ocupa uma fileira inteira, com rolagem horizontal no computador e no celular.",
   "Títulos mais legíveis, exibidos em até duas linhas, sem mexer nos vídeos cadastrados."
  ]
 },
 {
  version:"0.51.8",
  date:"2026-10-17",
  title:"Novidades da NPlay · versão 0.51.8",
  intro:"Melhoramos o acompanhamento dos perfis online no painel administrativo.",
  changes:[
   "Perfis conectados enviam sinais de atividade a cada 15 segundos enquanto a NPlay estiver visível.",
   "No ADM, a lista de perfis é atualizada a cada 10 segundos e o tempo de sessão avança em tempo real.",
   "Aparelhos sem sinal por 45 segundos passam a ser mostrados como offline, e a troca de perfil registra a mudança mais rapidamente."
  ]
 },
 {
  version:"0.51.7",
  date:"2026-10-17",
  title:"Novidades da NPlay · versão 0.51.7",
  intro:"A abertura está mais limpa, com a marca NPlay em um único logotipo horizontal.",
  changes:[
   "Substituímos o N separado e o texto duplicado por uma única marca horizontal.",
   "A logo fica centralizada e se adapta ao tamanho da tela do celular ou do computador.",
   "Mantivemos o som original da abertura, as transições e a segurança de acesso."
  ],
  action:"preview-intro-audio",
  actionLabel:"▶ Ouvir áudio da abertura"
 },
 {
  version:"0.51.6",
  date:"2026-10-17",
  title:"Novidades da NPlay · versão 0.51.6",
  intro:"A abertura agora toca o trecho exato escolhido para a NPlay.",
  changes:[
   "O som de abertura passou a usar a gravação selecionada, em vez de uma recriação eletrônica.",
   "Apenas a parte final do áudio foi aproveitada, sem as batidas anteriores.",
   "A animação foi sincronizada ao trecho e você pode ouvi-lo pelo sininho ou pelas configurações do perfil."
  ],
  action:"preview-intro-audio",
  actionLabel:"▶ Ouvir áudio da abertura"
 },
 {
  version:"0.51.5",
  date:"2026-10-17",
  title:"Novidades da NPlay · versão 0.51.5",
  intro:"Refinamos o som da abertura para ficar mais suave e cinematográfico.",
  changes:[
   "Novo efeito de encerramento: uma ressonância leve e profunda, inspirada apenas na parte final do áudio de referência.",
   "Removemos as duas batidas fortes da introdução anterior.",
   "Ouça o resultado pelo sininho ou em Perfil → Configurações → Ouvir som da abertura."
  ],
  action:"preview-intro-audio",
  actionLabel:"▶ Ouvir novo som da abertura"
 },
 {
  version:"0.51.4",
  date:"2026-10-17",
  title:"Novidades da NPlay · versão 0.51.4",
  intro:"Atualizamos a NPlay! Veja o que mudou nesta versão:",
  changes:[
   "Novo som de abertura: dois impactos de energia, com efeito futurista e uma vibração curta.",
   "O sino agora explica as melhorias de cada versão, em vez de mostrar apenas um aviso genérico.",
   "Você pode experimentar o som aqui mesmo e ligá-lo ou desligá-lo nas configurações do perfil."
  ],
  action:"preview-intro-audio",
  actionLabel:"▶ Experimentar novo som"
 },
 {
  version:"0.51.3",
  date:"2026-10-17",
  title:"NPlay · versão 0.51.3",
  intro:"A assinatura sonora chegou à introdução.",
  changes:[
   "Primeira versão do som da abertura NPlay.",
   "Controle para ligar, desligar e ouvir o efeito nas configurações do perfil."
  ]
 },
 {
  version:"0.51.2",
  date:"2026-10-17",
  title:"NPlay · versão 0.51.2",
  intro:"A entrada no aplicativo ficou mais direta.",
  changes:[
   "Aparelhos já autorizados veem a introdução sem passar pela tela de solicitação.",
   "O pedido de liberação permanece para aparelhos novos ou ainda não aprovados."
  ]
 },
 {
  version:"0.51.1",
  date:"2026-10-17",
  title:"NPlay · versão 0.51.1",
  intro:"Uma interface mais organizada e cinematográfica.",
  changes:[
   "Destaque principal de filme ou série na tela inicial.",
   "Capas menores e fileiras de conteúdo mais alinhadas para celular e computador.",
   "Animação de abertura NPlay mais suave e tela de perfis simplificada."
  ]
 }
];
window.NPlayReleaseNotes=Object.freeze(releases.map(item=>Object.freeze({
 ...item,changes:Object.freeze([...item.changes])
})));
})();