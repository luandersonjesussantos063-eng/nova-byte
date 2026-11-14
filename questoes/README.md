# Missão Farda — PMMG

Endereço preservado: https://novabytesolucoes.com.br/questoes/

180 questões dos cadernos fornecidos: aplicação 2018 / CFSd 2019 (40), 2021 / CFSd 2022 (40), 2023 / CFSd 2023 (50), 2024 / CFSd 2025 (50). Quatro alternativas por questão, gabaritos oficiais, anuladas excluídas da pontuação.

Mantém painel, treinos curtos, diagnóstico, revisão espaçada, trilha, evolução, cronômetro opcional, anotações e backups. O progresso PMMG usa chave própria e não incorpora respostas PMSP.

Textos e figuras originais são arquivos locais. A distribuição principal da trilha é a referência histórica do CFSd 2025; disciplinas adicionais identificam o caderno de 2021. Datas e requisitos de futuras edições devem ser conferidos no CRS/PMMG.

Publicação pelo GitHub Pages na branch main. Validar com `node --test scripts/tests/missao-farda.test.mjs scripts/tests/missao-farda-ui.test.mjs`.

2018: Tipo A; questão 27 excluída da nota conforme deferimento do recurso na Nota Técnica 07/2018. Demais edições e progresso preservados.

Identidade visual: azul `#191d5e`, vermelho `#bb2127` e amarelo `#ffcb05`, conforme brasão indicado pelo usuário. Brasão vetorial: https://commons.wikimedia.org/wiki/File:Bras%C3%A3o_PMMG.svg (Polícia Militar de Minas Gerais; domínio público conforme a fonte). Cabeçalho e ícone instalável usam arquivo local; cache da interface atualizado.

## Perfis e sincronização
Luanderson e Jackeline Santana possuem históricos locais separados. O primeiro perfil escolhido preserva o histórico legado. A sincronização automática usa `sync.js` e a função isolada `missao-farda-sync` no projeto Nova Byte. A tabela `mf_profile_sync` nega acesso direto a clientes; somente a função acessa estados após autenticar um código privado aleatório de 256 bits. Os códigos ficam apenas no navegador e são transmitidos no cabeçalho de autorização, nunca em URLs ou backups; o banco guarda somente SHA-256.

Para conectar outro aparelho, copie o código do perfil em “Sincronização”, escolha o mesmo nome no outro aparelho e cole em “Conectar”. O histórico de ambos é unido. Alterações são enviadas após 900 ms sem edições, ao recuperar conexão, ao retornar ao app e a cada 20 segundos. Sem internet, o estado segue salvo localmente. Gravações usam revisão com comparação atômica e tentam novamente após conflito. Respostas são unidas sem duplicação; campos, tópicos e preferências usam marcas de alteração; edições concorrentes do mesmo campo mantêm a mais recente. O treino em andamento é o mais recentemente alterado. Backups permanecem disponíveis e não contêm o código privado.

Validar: `node --test scripts/tests/missao-farda.test.mjs scripts/tests/missao-farda-ui.test.mjs scripts/tests/missao-farda-sync.test.mjs`.
