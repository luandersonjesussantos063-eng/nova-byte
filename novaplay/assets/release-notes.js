/* NPlay: notas editoriais por versão. Atualize junto com a versão do site.
   O teste de publicação exige descrição para a versão atual.
   Apenas alterações efetivamente implementadas devem ser anunciadas. */
(()=>{
"use strict";
const releases=[
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