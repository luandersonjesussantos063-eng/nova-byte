// OAuth redirect reserved for Nova Byte Connect -> Kaia Glow TikTok Shop.
// Stage 1 only: register a live HTTPS callback; DO NOT exchange or persist codes
// until a secure, admin-initiated state challenge and credential vault exist.
// The callback is intentionally fail-closed to prevent unsolicited account linking.
const html=(title,message,status=200)=>{
 const body=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <meta name="robots" content="noindex,nofollow"><title>${title} | Nova Byte Connect</title>
 <style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f8f6f5;font:15px system-ui,sans-serif;color:#332d33}
 main{box-sizing:border-box;max-width:510px;margin:24px;background:white;border:1px solid #e9e1e4;border-radius:14px;padding:30px;box-shadow:0 12px 30px #00000009}
 small{letter-spacing:.12em;color:#806a77;font-weight:700}h1{font-size:24px;line-height:1.25;margin:15px 0 9px}
 p{line-height:1.65;color:#655963}a{display:inline-block;margin-top:8px;color:#512c41;font-weight:650;text-decoration:underline;text-underline-offset:3px}</style></head>
 <body><main><small>NOVA BYTE CONNECT · TIKTOK SHOP</small><h1>${title}</h1><p>${message}</p>
 <a href="https://usekaiaglow.com.br/admin.html#marketplaces">Voltar ao painel da Kaia Glow</a></main></body></html>`;
 return new Response(body,{status,headers:{
  'content-type':'text/html; charset=utf-8','cache-control':'no-store',
  'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
  'x-robots-tag':'noindex, nofollow','x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
 }});
};
export async function onRequestGet({request}){
 const url=new URL(request.url);
 if(url.protocol!=='https:'||!['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(url.hostname))
  return html('Endereço não autorizado','Acesse a integração somente pelo domínio oficial.',403);
 if(url.searchParams.has('error'))
  return html('Autorização não concluída','A loja não autorizou o acesso. Nenhum estoque ou pedido foi alterado.',400);
 if(url.searchParams.has('code')||url.searchParams.has('auth_code'))
  return html('Autorização aguardando configuração','O aplicativo já possui um endereço de retorno válido. Para proteger a loja, a conexão ainda precisa ser iniciada pelo painel administrativo com verificação de segurança. Nenhuma credencial foi salva.',403);
 return html('Endereço de retorno preparado','Este é o endereço HTTPS configurável para a autorização do TikTok Shop. A conexão da loja ainda não foi iniciada; quando o aplicativo estiver aprovado, configuraremos as credenciais protegidas e a autorização segura.');
}
