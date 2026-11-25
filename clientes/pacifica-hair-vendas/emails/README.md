# E-mails de autenticação — Pacífica Hair

Modelos de e-mail preparados para usar no **Supabase Auth** da Pacífica Hair (`nifvycrvqnzbxgglhlky`). Os modelos são HTML responsivo, em português e com a identidade rosa/bordô da loja. **Os arquivos do repositório não alteram automaticamente os templates hospedados no Supabase**: é necessário instalá-los no projeto, em Authentication → Email Templates.

| Evento Supabase | Assunto a configurar | Arquivo |
| --- | --- | --- |
| Confirm signup | Pacífica Hair | Confirme seu e-mail para começar | `confirmar-cadastro.html` |
| Reset password | Pacífica Hair | Crie uma nova senha com segurança | `recuperar-senha.html` |
| Magic link | Pacífica Hair | Seu link seguro de acesso | `link-acesso.html` |

**IMPORTANTE:** Os símbolos `{{ .ConfirmationURL }}` usados nos links são variáveis do Go Template do Supabase, preenchidas pelo Auth com um token temporário válido. Não reescreva com URLs fixas, não envie exemplos com tokens de clientes e não inclua informações pessoais no HTML estático. Os templates não disparam mensagens adicionais nem alteram o fluxo de login.

## Para ativar no projeto existente

1. Acesse https://supabase.com/dashboard/project/nifvycrvqnzbxgglhlky/auth/templates e abra **Confirm signup**. Insira o assunto indicado e o HTML de `confirmar-cadastro.html`, depois salve.
2. Faça o mesmo em **Reset password**, usando `recuperar-senha.html`.
3. Configure **Magic link** com `link-acesso.html` para evitar a mensagem de acesso em inglês, inclusive nos links de confirmação usados pela área administrativa.
4. Em **Authentication → URL Configuration**, confirme o **Site URL** `https://xn--pacficahair-qcb.com.br/` e a **Redirect URL** `https://xn--pacficahair-qcb.com.br/conta.html**`; mantenha demais URLs realmente utilizadas.
5. Em **Authentication → SMTP Settings**, mantenha um remetente autenticado. Quando o domínio Pacífica for verificado no Resend e houver credenciais SMTP válidas, configure o nome de remetente **Pacífica Hair** e o e-mail **contato@xn--pacficahair-qcb.com.br** (não substitua credenciais existentes por outras de empresa diferente). Não exponha chave de SMTP no frontend nem no GitHub.
6. Teste com conta nova de e-mail de sua propriedade: confirmar e-mail, redefinir senha, garantir que redireciona ao domínio correto, verificar entrada e spam em Gmail e Outlook, e verificar cabeçalhos **SPF=pass, DKIM=pass, DMARC=pass**. Os três últimos dependem da autenticação DNS e de alinhamento com o remetente. O status "delivered" no Resend não prova entrega na caixa principal.

## Verificações de entregabilidade

- Domínio específico de envio criado no Resend: `xn--pacficahair-qcb.com.br`, região `sa-east-1`, **aguardando configuração DNS e verificação**. Os registros SPF, DKIM e retorno de bounces devem ser inseridos na zona Cloudflare pelo responsável autorizado. Verifique se já existe registro SPF no mesmo hostname antes de criar outro.
- Depois da verificação, publique um DMARC inicial de monitoramento para `_dmarc.xn--pacficahair-qcb.com.br` e analise relatórios antes de adotar `quarantine`/`reject`. Um endereço `rua` real para receber os relatórios precisa existir antes de ser indicado.
- Não habilite rastreamento de cliques/aberturas em mensagens de recuperação. Não use encurtadores. Assuntos claros e volume baixo ajudam mais do que promessas de "não cair no spam".
- Use URL de confirmação gerada pelo Supabase, domínio autenticado e corpo em HTML legível, com instrução explícita para ignorar o e-mail caso não tenha solicitado.

Referências: https://supabase.com/docs/guides/auth/auth-email-templates e https://supabase.com/docs/guides/auth/auth-smtp.
