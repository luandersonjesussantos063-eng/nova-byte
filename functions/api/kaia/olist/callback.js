// Olist OAuth: single-use callback with privacy-safe stage diagnostics.
// The user sees only a fixed error category. No codes or credentials logged.
import {db,PaymentError} from '../checkout-validacao/_core.js';
import {credentials,guardOrigin,hashState,CALLBACK,tokenRequest,persistTokens,successPage} from './_oauth.js';
const allowedCodes=new Set([
 'OLIST_CLIENTE_INVALIDO','OLIST_CODIGO_RECUSADO','OLIST_APLICATIVO_NAO_AUTORIZADO',
 'OLIST_SOLICITACAO_INVALIDA','OLIST_TIPO_AUTORIZACAO_INVALIDO','OLIST_CREDENCIAIS_RECUSADAS',
 'OLIST_LIMITE_DE_REQUISICOES','OLIST_SERVICO_RECUSOU_TOKEN','OLIST_FALHA_COMUNICACAO',
 'OLIST_RESPOSTA_TOKEN_INVALIDA','OLIST_TOKEN_INCOMPLETO',
 'OLIST_CRIPTOGRAFIA_INDISPONIVEL','OLIST_GRAVACAO_INDISPONIVEL','REGISTRO_INDISPONIVEL',
 'AUTORIZACAO_EXPIRADA','AUTORIZACAO_INVALIDA','CREDENCIAIS_OLIST_AUSENTES',
 'DOMINIO_INVALIDO','ROTA_INVALIDA'
]);
export async function onRequestGet({request,env}){
 let stateHash=null,claimed=false;
 try{
  guardOrigin(request);credentials(env);
  const url=new URL(request.url);
  if(url.pathname!=='/api/kaia/olist/callback')
   throw new PaymentError('ROTA_INVALIDA',404);
  if(url.searchParams.has('error'))
   return successPage('Autorização não concluída',
    'A Olist não autorizou o acesso. Nenhum produto ou pedido foi alterado.',400);
  const state=url.searchParams.get('state'),code=url.searchParams.get('code');
  if(!state&&!code)return successPage('Endereço preparado',
   'A URL de retorno está ativa. Abra o painel e toque em Conectar Olist.');
  if(!state||!/^[a-f0-9]{64}$/.test(state)||!code||code.length>4000)
   throw new PaymentError('AUTORIZACAO_INVALIDA',403);
  stateHash=await hashState(state);
  const at=new Date().toISOString();
  // Atomic, one-time consume. A replay or expired request cannot exchange.
  const rows=await db(env,'kaia_olist_oauth_state?state_hash=eq.'+stateHash+
   '&consumed_at=is.null&expires_at=gt.'+encodeURIComponent(at),'PATCH',{
   consumed_at:at,exchange_stage:'exchanging',last_transition_at:at
  });
  if(!Array.isArray(rows)||rows.length!==1)
   throw new PaymentError('AUTORIZACAO_EXPIRADA',403);
  claimed=true;
  const tokens=await tokenRequest(env,{grant_type:'authorization_code',code,redirect_uri:CALLBACK});
  // Diagnostic writes must never prevent already-issued OAuth codes from
  // being saved. A code can be exchanged only once.
  try{await db(env,'kaia_olist_oauth_state?state_hash=eq.'+stateHash,'PATCH',{
   exchange_stage:'token_received',last_transition_at:new Date().toISOString()
  });}catch{}
  await persistTokens(env,tokens,rows[0].admin_id);
  try{await db(env,'kaia_olist_oauth_state?state_hash=eq.'+stateHash,'PATCH',{
   exchange_stage:'completed',error_code:null,last_transition_at:new Date().toISOString()
  });}catch{}
  return successPage('Olist autorizada com sucesso',
   'A autorização foi salva de forma protegida. Nenhum saldo, pedido ou preço foi alterado. Volte ao painel e teste a leitura de produtos.');
 }catch(e){
  const code=e instanceof PaymentError&&allowedCodes.has(e.code)?e.code:'OLIST_FALHA_INTERNA';
  if(claimed&&stateHash){
   try{
    await db(env,'kaia_olist_oauth_state?state_hash=eq.'+stateHash,'PATCH',{
     exchange_stage:'failed',error_code:code,last_transition_at:new Date().toISOString()
    });
   }catch{/* Do not expose or log raw error details. */}
  }
  const advice={
   OLIST_CLIENTE_INVALIDO:'As credenciais cadastradas foram recusadas pela Olist. Verifique se Client ID e Client Secret pertencem ao mesmo aplicativo e não foram renovados.',
   OLIST_CREDENCIAIS_RECUSADAS:'A Olist recusou as credenciais do aplicativo. Confira as chaves de acesso na Olist e no Cloudflare.',
   OLIST_CODIGO_RECUSADO:'O código de autorização expirou ou não corresponde à URL cadastrada. Inicie a conexão novamente e confira a URL de redirecionamento.',
   OLIST_FALHA_COMUNICACAO:'Não conseguimos comunicar com a Olist. Tente novamente após conferir a disponibilidade do serviço.',
   OLIST_TOKEN_INCOMPLETO:'A Olist respondeu, mas não enviou todos os dados necessários para manter a autorização. Será preciso revisar o formato da resposta.'
  };
  return successPage('Não foi possível concluir a conexão',
   (advice[code]||'A conexão não pôde ser concluída. Retorne ao painel para iniciar outra autorização.')+
   ' Referência do erro: '+code+'. Nenhum estoque ou pedido foi alterado.',
   e instanceof PaymentError&&e.status>=400&&e.status<500?403:503);
 }
}
