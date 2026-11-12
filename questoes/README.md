# Missão Farda — PMESP · edição 3

Endereço: https://novabytesolucoes.com.br/questoes/

Aplicativo estático publicado pelo GitHub Pages na raiz \`main\`. **Exclusivo Soldado PMESP**: 2026 VUNESP (60 questões), 2025 FGV Tipo 1 (60), 2024 FGV Tipo 1 (60). As questões são referências à prova real, não são questões inventadas. Os cadernos oficiais e gabaritos são abertos nas fontes respectivas.

**Limitação importante:** por respeito à fidelidade dos textos e para evitar erros em imagens, tabelas e destaques, os enunciados são consultados diretamente na fonte (ou no leitor PDF opcional), enquanto a resposta é marcada no app. O app usa gabaritos definitivos, mas **não finge ter explicações oficiais por questão**. Conteúdo original depende de internet; painel, seleções e histórico podem funcionar offline após carregamento.

## Direção pedagógica

- Micro sessões de 2, 5, 10 ou 20 questões para facilitar a retomada sem culpa por interrupções.
- Diagnóstico inicial de 10 questões, não é avaliação clínica e não prediz aprovação.
- Revisão espaçada; erro retorna no dia seguinte, acerto após 3, 7, 14, 30 dias conforme repetições corretas. Agenda heurística, não protocolo médico.
- Estatísticas por tentativas válidas e disciplinas, fase de prática, progresso de tópicos e redação com armazenamento local.
- Sem recompensa punitiva por sequência perdida. Nenhum cronômetro é obrigatório.
- Até a prova prevista de 28/02/2027, consultar sempre retificações e as datas oficiais.

## Arquivos

- \`index.html\`: semântica, navegação, controles, acessibilidade.
- \`ui.css\`: identidade responsiva.
- \`banco.js\`: 180 referências reais e respostas oficiais (não alterar letras sem fonte).
- \`core.js\`: cálculo da evolução, agrupamento, revisão, algoritmo de seleção, datas.
- \`app.js\`: interface, armazenamento, migração do histórico anterior, resumo, sessões e backup.
- \`sw.js\`: cache do aplicativo; fontes externas precisam de conexão.
- \`manifest.webmanifest\`: instalação Android como PWA.
- \`../../scripts/tests/missao-farda.test.mjs\`: integridade do banco, datas, revisões e estatística.

## Dados e publicação

\`localStorage["missao-farda-state-v3"]\` contém progresso e rascunho. Nenhuma resposta ou texto é enviado ao servidor do aplicativo. Usuários podem exportar um backup JSON e importar no mesmo ou em outro dispositivo. Evitar apagar cache e dados antes de exportar. Os dados anteriores da versão v1 migram automaticamente se a versão v3 não existir.

Roteiro e ponderação: Edital DP-4/321/26, publicado em 05/11/2026 (20 Português, 15 Matemática, 15 Conhecimentos Gerais, 5 Informática, 5 Administração Pública, mais redação). Fonte: https://doe.sp.gov.br/executivo/secretaria-da-seguranca-publica/edital-de-concurso-publico-n-dp-4-321-26-202611041336161962254080

**Testes:** \`node --test scripts/tests/missao-farda.test.mjs\`, \`node --check questoes/app.js\`, validar o status do workflow, e confirmar domínio público após o deploy.

Esta é uma ferramenta independente. PMESP, VUNESP e FGV não a endossam.
