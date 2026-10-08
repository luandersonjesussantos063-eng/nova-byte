# NovaByte Studio de prévias

Rota: /previa/. GitHub Pages serve a interface; a função Supabase novabyte-preview serve geração e links.

## Estado de ativação
Sem os secrets abaixo, o studio funciona em modo por modelos, explicitamente identificado na tela. Não é IA nesse modo: seleciona conteúdo por ramo e aplica cor/aparência. O modo IA usa conteúdo JSON validado e renderização própria, sem executar código do modelo.

Para ativar, no projeto Supabase vajlhodqxskozuxxlujv > Edge Functions > Secrets:
- NOVABYTE_OPENAI_API_KEY: chave de um projeto OpenAI com faturamento/créditos configurados. Nunca incluir no GitHub ou frontend.
- NOVABYTE_AI_ENABLED: true
- NOVABYTE_OPENAI_MODEL: gpt-4o-mini (opcional; padrão testado estruturalmente)

A assinatura ChatGPT não substitui a conta de API. Configure também limites/alertas no provedor. Desligamento: definir NOVABYTE_AI_ENABLED=false. A homepage anuncia prévias, sem prometer IA ativa. O status da função controla a descrição no studio.

## Limites e proteção
3 tentativas por sessão de 24h (criação + 2 ajustes, erros de provedor também consomem tentativa). No modo IA: 6 por identificador de rede/dia e 30 no total/dia UTC. Modelos: 20 por rede/dia e 300 global/dia. Limite global atômico no banco, não apenas localStorage. Até 1800 tokens de saída/requisição e entrada limitada. Sessões HMAC assinadas e validadas no servidor. API pública aceita apenas chave publicável esperada e origens permitidas. Esses controles não substituem CAPTCHA/WAF para uma campanha de grande volume. Não há garantia de identificar cada pessoa: redes podem ser compartilhadas.

Storage service-only: tabelas com RLS e sem permissões para anon/authenticated. Função SQL SECURITY INVOKER executável só por service_role. Preview ID aleatório não listado atua como capacidade de leitura; quem tem link pode ver spec, não briefing nem token de edição. Cada ajuste salva uma versão imutável. Links expiram em 30 dias. Sessão guardada apenas no próprio navegador.

O iframe não tem allow-same-origin, rede, formulários, popups ou navegação de topo. Somente código fixo de demonstração; strings do cliente/modelo são escapadas. Dados de sistemas são fictícios. WhatsApp prepara o texto sem enviar automaticamente. Não há cobrança ou orçamento automático.

## Desenvolvimento e implantação
- node --test tests/preview.test.js
- Servir raiz via python3 -m http.server 8080
- Modelo compartilhado: previa/model.js; copiar para supabase/functions/novabyte-preview/model.js antes do deploy (teste confere igualdade).
- Schema: supabase/preview-schema.sql, aplicado com migração remota novabyte_preview_studio.
- Deploy Edge Function novabyte-preview com index.ts, model.js e deno.json, verify_jwt=false pois possui autenticação própria (chave publicável + sessão HMAC nas operações de geração/edição).
- Nunca enviar secrets em logs. Falhas retornam mensagem genérica.

## Testes e limites de validação
Testes de unidade cobrem validação, escape, isolamento, temas e seleção por ramo. Testes de UI verificam desktop/mobile, erro, revisão e link de orçamento. Integração real verifica persistência, quotas e acesso negado às tabelas. A chamada real ao modelo requer os secrets de ativação; sem eles não se pode afirmar que a geração IA foi testada de ponta a ponta.
