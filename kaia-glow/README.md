# Kaia Glow — demonstração Nova Byte

Protótipo independente em `/kaia-glow/`. Não altera a loja original ou a página inicial da Nova Byte.

Catálogo: 54 anúncios públicos encontrados no sitemap da usekaiaglow.com.br em 01/11/2026. Nomes, descrições, variantes, imagens, preços e disponibilidade extraídos das páginas públicas. Imagens servidas pelo CDN original. Sem sincronização automática. Um anúncio de Fino Premium Touch Barbie não tem título na origem e recebe identificação descritiva explícita. A categoria Maquiagem consta na navegação original, mas nenhum dos 54 anúncios consultados estava classificado nela; a prévia mantém estado vazio ao selecioná-la.

Funcionalidades: busca sem distinção de acentos, categoria/marca/preço/disponibilidade/ofertas, ordenação, paginação, favoritos locais, galeria de produto e variantes, quantidade, sacola em memória, cupom demonstrativo e finalização sem pedido. A vitrine não solicita pagamento, envia pedidos nem reserva estoque. A área Minha conta armazena dados de cadastro e registros individuais de indicações e pedidos no Supabase, conforme seção abaixo. Sem analytics. Não indexável.

Publicação pelo GitHub Pages existente, raiz de main. Arquivos independentes; fontes Google Fonts e fotos originais como dependências externas. Validar sintaxe JavaScript e conferir no navegador catálogo, busca, filtros, galeria, variantes, sacola e layout em tela estreita.

## Campanha e carrossel

Direção visual em vinho e rosa, com quatro fotografias de campanha ilustrativas geradas para o protótipo. Cada cena aponta para um produto real (Medicube, Biodance, Celimax e SKIN1004). Imagens locais em assets. Troca automática a cada 3 segundos, fade, indicadores e botões anterior/próximo/pausa, gesto de deslizar no celular. Pausa quando fora de vista, aba oculta, foco de teclado ou diálogo aberto; preferência por movimento reduzido inicia pausado. A vitrine editorial usa fotos reais dos quatro produtos e o catálogo de 54 anúncios permanece disponível.

## WhatsApp

Atendimento conectado ao número comercial fornecido pelo responsável: +55 11 96567-7152. Botão flutuante, atendimento no rodapé e link contextual na ficha dos produtos via wa.me. Os links preenchem a mensagem; o visitante precisa revisar e enviar no WhatsApp. Não há envio automático nem alteração na finalização demonstrativa.

## Marca original

Logotipo original fornecido pela cliente aplicado com maior destaque no centro do cabeçalho e no rodapé. O PNG foi preservado; apenas seu enquadramento usa CSS para reduzir as margens da arte. O crédito Nova Byte permanece no rodapé, e a faixa superior identifica a Kaia Glow e o caráter demonstrativo.

Ajuste de identidade v6: fundo do logotipo removido para aplicação transparente; cabeçalho claro mais compacto, sem a segunda faixa de anúncio. Símbolo e nome mantidos em dourado.

## Vídeo Chronologiste

Seção própria para o vídeo vertical de 16,77 segundos fornecido pelo responsável em 02/11/2026, com áudio, controles, reprodução mediante ação do visitante e pré-carregamento só de metadados. Fotos extraídas do mesmo vídeo; sem uso de imagens geradas para representar os produtos. A consulta de disponibilidade e valores abre o WhatsApp da Kaia Glow. Não foi associado ao anúncio Gloss Absolu, pois são linhas diferentes, nem foram inventados preço ou estoque de Chronologiste.

## Vídeo imersivo v9

Vídeo fora da grade, ocupando toda a largura da tela no celular. Reprodução automática silenciosa ao atingir 20% de visibilidade, loop, controles nativos e botão para ativar áudio. Pausa ao sair de vista, ocultar a aba ou abrir diálogo; respeita pausa manual. Informações de benefícios, indicação, ritual profissional e origem da marca baseadas nas páginas oficiais Kérastase (consultadas em 02/11/2026):
- https://www.kerastase.com.br/descubra/regeneracao-capilar-chronologiste.html?geo=false
- https://www.kerastase.com.br/descubra/nossa-historia.html?geo=false

Sem atribuir país de fabricação de um lote não verificado. Reprodução automática pode ser restringida pelas configurações de economia de energia/dados do navegador; controles mantidos como alternativa.


## Minha conta v21

`conta.html` oferece cadastro por e-mail/senha, confirmação por e-mail, login, recuperação de senha, perfil, Minhas indicações e Meus pedidos. SDK Supabase JS 2.118.0 fixado por versão, carregado do jsDelivr com integridade SHA-384; `auth-config.js` contém somente URL e chave publicável, nunca service_role. Sessão isolada com storageKey `kaia-glow-auth-v1`. O SMTP existente do projeto foi preservado; modelos de confirmação e recuperação exibem Kaia para usuários com metadata `kaia_name`, mantendo os modelos anteriores para os demais. URLs de retorno exatas da conta e de recuperação adicionadas à allowlist.

Banco compartilhado autorizado: `vajlhodqxskozuxxlujv`. Tabelas específicas `kaia_customers`, `kaia_referrals`, `kaia_orders`, todas com RLS por usuário e bloqueio de usuários anônimos. Clientes só alteram o próprio nome; códigos são gerados no banco. Indicação é registrada após cadastro confirmado e código válido, uma por pessoa, sem autoindicação. RPC pública invoker delega somente a operação de atribuição a uma função privada com auth.uid(), confirmação de e-mail e validação de código. Não libera brindes automaticamente. Visitantes guardam somente o código público de indicação por no máximo 30 dias. Compartilhar sozinho não gera registros.

A sacola continua demonstrativa: não cria pedidos. A área Meus pedidos lê apenas pedidos vinculados pela equipe por operação administrativa do banco (service_role/SQL autorizado). Não existe painel administrativo neste escopo; aprovação de indicação e estados de brinde são geridos pela equipe, não pelo cliente. Pedido: order_number, user_id, total_cents, status e items JSON no formato [{"name":"Produto","quantity":1}]. Estados de indicação: registered → validated → reward_ready → reward_sent. Estados de pedido: received/confirmed/preparing/shipped/delivered/cancelled.

DDL aplicado: `backend/schema.sql`. Teste transacional `backend/test-isolation.sql` valida isolamento entre duas contas, bloqueio de mudanças em pedido/brinde/código, duplicidade, autoindicação e usuários anônimos. Todos os dados de teste são revertidos. Não modificar dados de outros projetos para operar a Kaia.

## Verificação de e-mail v23

A confirmação no Supabase permanece obrigatória (`mailer_autoconfirm=false`). A tela valida `getUser().user.email_confirmed_at` antes de liberar a área; contas sem confirmação são desconectadas. `backend/verified-email.sql` aplica uma função privada que consulta o registro de Auth do próprio usuário para negar contas sem e-mail confirmado, anônimas, removidas ou bloqueadas. Essa checagem é exigida em todas as políticas RLS da Kaia e na atribuição de indicação. `backend/test-verified-email.sql` cobre também o bloqueio de JWT autenticado com e-mail não confirmado, além do isolamento e das restrições de edição.

Contas já confirmadas no projeto compartilhado podem entrar sem nova confirmação. Um cadastro duplicado não envia outro e-mail; a interface agora diferencia essa situação sem consultar publicamente a existência de endereços. O modelo de recuperação identifica o fluxo Kaia também pela URL de retorno, incluindo contas antigas sem metadata kaia_name. Nenhum cadastro existente foi desconfirmado.

Verificação em 02/11/2026: domínio de envio auth.novabytesolucoes.com.br verificado no Resend; SPF, DKIM e DMARC publicados. Um teste de recuperação foi aceito como Delivered e o responsável confirmou recebimento na caixa de entrada. Isso verifica esse envio, sem garantir a classificação de mensagens futuras em todos os provedores. SMTP e identidade dos demais projetos foram preservados.

## Cadastro completo v28

Cadastro em duas etapas: acesso por e-mail/senha e confirmação; em seguida dados pessoais e de entrega na conta autenticada. Nome completo, CPF com verificação de dígitos, nascimento, telefone com DDD, CEP, rua, número/SN, bairro, cidade e UF obrigatórios; complemento opcional. País Brasil. Contas antigas também completam os dados ao acessar a área. Outras abas são liberadas após salvar o cadastro completo.

Dados em `kaia_customer_details`, separados de metadata/JWT e de indicação. RLS exige dono, e-mail confirmado, conta ativa e ausência de anonimato. A gravação de nome e detalhes é transacional pela RPC invoker `kaia_save_customer_details`. CPF valida formato/dígitos, não comprova identidade. CEP valida formato, sem consulta externa. Não coleta cartão, Pix ou forma de pagamento. A integração com checkout real permanece pendente; o cadastro apenas prepara os dados para essa futura etapa.

DDL: backend/customer-details.sql; testes transacionais: backend/test-customer-details.sql. Os dados de teste são revertidos e não representam clientes reais. CPF/endereço não são enviados em URLs, logs da aplicação ou armazenamento local; ficam acessíveis ao titular autenticado e à operação autorizada do banco.

## Navegação, documentos e identificação — 05/11/2026

- Páginas próprias `privacidade.html`, `termos-de-uso.html` e `atendimento.html`, conectadas à loja e à conta. Links de informação também no menu lateral (Ajuda e informações), rodapé e cadastro. A navegação institucional funciona sem autenticação.
- Identificação comercial conforme comprovante de CNPJ enviado pelo responsável: KAIA GLOW COMERCIO DE COSMETICOS LTDA, CNPJ 67.706.063/0001-39. E-mail e endereço cadastrais nos rodapés. WhatsApp já configurado preservado; o telefone do CNPJ é exibido separadamente como cadastral. Os PDFs e os dados pessoais dos sócios não foram copiados para o repositório nem publicados.
- Direitos autorais diferenciam a marca Kaia Glow, o desenvolvimento NovaByte e os materiais de terceiros. Não foram inventados CNPJ, titularidades de imagens, horário de atendimento ou e-mail de encarregado.
- A privacidade cobre os dados efetivamente solicitados (inclusive CPF/nascimento/endereço), autenticação, referências de indicação, fornecedores e remoção de preferências locais. O botão de limpeza remove somente favoritos e convite, sem apagar a sessão ou dados de outros projetos.
- Termos e atendimento distinguem sacola demonstrativa de conta real e explicam condições a confirmar para compras, indicações, brindes e entrega. O texto não promete benefício ou prazo universal. O checkout continua sem pagamento/pedido automático; não foram alterados banco, políticas RLS, preços ou estoque.
- Novos cadastros exigem aceite de termos, com conhecimento da política de privacidade antes do envio. O fluxo existente de confirmação de e-mail permanece obrigatório. Versão e data são incluídas nos metadados do novo cadastro; não são prova de aceite imutável nem substituem registro contratual auditável. Contas existentes não foram alteradas.
- Botão do menu informa estado aberto/fechado; links para pular ao conteúdo e foco visível nas páginas institucionais. Os deep links de Meus pedidos/Minhas indicações/Meus dados foram preservados.

Verificação: `node --test scripts/tests/kaia-navigation.test.mjs` (4 testes) e `git diff --check`. Chromium local em 390 e 1280 px: 10 carregamentos das 5 páginas, navegação loja ↔ privacidade, menu e Escape, aceite de cadastro, limpeza de preferências e ausência de erro JavaScript/rolagem horizontal da página. Mais 18 navegações nas três abas da conta com dados inteiramente simulados. Nenhum cadastro, pedido ou alteração no banco real foi feito. Provedores externos e imagens remotas foram bloqueados/substituídos no navegador de QA; isso não testa entrega de e-mail, integrações externas ou conteúdo atual do catálogo de origem.

A consulta ao domínio público e à API de implantação do GitHub recebeu bloqueio HTTP 403 do proxy desta sessão, antes de alcançar os serviços. Isso não indica falha do site. A revisão foi feita sobre o código atualizado de main e no navegador local; não afirmar inspeção HTTP da publicação enquanto essa verificação estiver bloqueada. O domínio já consta na configuração de rede desejada do ambiente, mas a liberação precisa estar aplicada ao runtime para retomar essa conferência.

## Ajuste do rodapé após conferência visual — 05/11/2026
Os dados completos da empresa foram retirados do rodapé interno de Minha conta. O rodapé da loja reúne identificação empresarial, direitos autorais e desenvolvimento; a âncora #informacoes leva diretamente a ele. A conta termina antes de um rodapé geral compacto, com links institucionais e acesso às informações da empresa. Dados, formulários e autenticação permanecem iguais. A privacidade descreve essa organização, sem afirmar que o endereço completo aparece dentro da conta.
