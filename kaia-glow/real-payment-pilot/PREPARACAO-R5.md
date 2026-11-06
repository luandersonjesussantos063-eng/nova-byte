# Kaia Glow — piloto isolado de compra real (R$ 5,00)

**Estado: PREPARADO PARA REVISÃO, DESABILITADO. NÃO É UM CHECKOUT ATIVO.**
Data da especificação: 2026-11-06. Ambiente de desenvolvimento: branch `test/kaia-mercadopago-homologacao`.
**Nenhuma ordem, cobrança, pagamento, webhook, reembolso ou mudança de produção é autorizada por este arquivo.**

## Identidade da operação (fixa)

- Identificador interno reservado: `KAIA-LIVE-PILOT-500` (NÃO cadastrar no catálogo comercial)
- Descrição ao comprador: `Kaia Glow — validação técnica de pagamento`
- Moeda: BRL
- Valor bruto: **500 centavos (R$ 5,00)**, sem cupom, frete, parcelamento ou variações
- Quantidade: exatamente 1
- Produto físico: NÃO; sem expedição e sem SuperFrete
- Visibilidade: restrita, não indexável, acessível apenas a testador autenticado e previamente autorizado
- Limite de transações: 1 pagamento real aprovado (impedir múltiplos pagamentos por clique, refresh ou retomada)
- Não movimentar nenhum dos 51 SKUs sem preço e 22 embalagens sem verificação
- Não usar a base de homologação `ikeqodwmxzigksvvymdw` para armazenar transações reais

## Portões obrigatórios (todos inicialmente FALHOS/INATIVOS)

- [ ] Validar oficialmente no ambiente específico Checkout Pro + Orders da conta se BRL 5.00 atende mínimos e formas aceitas. **O padrão R$ 5,00 da Loja Integrada NÃO comprova o mínimo universal da Orders API.**
- [ ] Confirmar se o titular está habilitado para receber pagamentos em produção; verificar taxas, impostos, prazos de recebimento e restrições aplicáveis
- [ ] Confirmar se a transação técnica sem entrega/serviço corresponde aos termos e descrição econômica real; não anunciar produto físico fictício
- [ ] Criar uma aplicação/implantação independente da vitrine comercial e do Preview de testes, com restrição de acesso e domínio exclusivo
- [ ] Criar armazenamento transacional isolado de produção, com RLS/autorização apropriadas, trilha de auditoria e migrações revisadas
- [ ] Configurar `KAIA_PILOT_PROD_ACCESS_TOKEN` como secret somente no runtime **separado**, sem impressão, exportação ou API PATCH de mapa completo
- [ ] Configurar segredo de webhook de produção independente, validando assinatura x-signature e Order por consulta autenticada
- [ ] Confirmar recepção do webhook de produção, allowlist da conta e rejeição de eventos inválidos, duplicados e trocados
- [ ] Revisar implementação de pedido com preço fixo no servidor, chave de idempotência, trava de tentativa, sem confiar em valor do navegador
- [ ] Configurar um único testador autorizado e proteção anti-CSRF/antibot e limites por usuário
- [ ] Implementar máquina de estados robusta: `created -> pending -> approved/rejected/cancelled`; não declarar aprovado por redirect
- [ ] Implementar consulta read-only autenticada do provedor para reconciliação de status; sem repetição de cobrança
- [ ] Implementar caminho controlado de devolução total para Order aprovada, com verificação pós-reembolso. Reembolso NÃO é automático nem garantido instantaneamente
- [ ] Validar cobrança com payload de valores: `total_amount:"5.00"`, 1 item × `unit_price:"5.00"`; `type:"online"` e `processing_mode:"manual"` conforme Orders
- [ ] Testes de segurança de regressão e revisão de logs (sem PII ou segredos)
- [ ] Revisão humana e autorização explícita separada ANTES da primeira cobrança real

## Interdições

- Nunca mudar a branch de produção `feat/kaia-loja-real` nem publicar na loja
- Nunca colocar Access Token real em `test/kaia-mercadopago-homologacao` ou em `kaia-glow.pages.dev`
- Nunca misturar Orders de teste e produção, nem usar cartões de teste no pagamento real
- Nunca criar ou finalizar uma cobrança enquanto qualquer portão acima estiver pendente
- Não executar cancelamento ou reembolso automático sem confirmação e autorização explícita
- Evitar tentativa de compra com a mesma conta vendedora quando o provedor proíbe autopagamento

## Evidências a registrar quando futuramente autorizado

- ID da implantação isolada, data e versão do commit revisado
- ID interno e ID da Order de produção (evitar dados pessoais)
- Valor confirmado 500 centavos, resultado e status_detail do Mercado Pago
- ID/assinatura validada de evento webhook, entrega e deduplicação
- Histórico de transições, uma única confirmação, ausência de impacto nos produtos reais
- Eventual reembolso e confirmação por consulta ao provedor

## Fontes

- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/go-to-production
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications
- https://www.mercadopago.com.br/developers/en/docs/checkout-pro-orders/refunds-cancellations
- https://www.mercadopago.com.br/developers/pt/docs/loja-integrada/payment-methods/configure-checkout
