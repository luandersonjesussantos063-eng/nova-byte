/* NPlay: notas editoriais por versão. Atualize junto com a versão do site.
   O teste de publicação exige descrição para a versão atual.
   Apenas alterações efetivamente implementadas devem ser anunciadas. */
(()=>{
"use strict";
const releases=[
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