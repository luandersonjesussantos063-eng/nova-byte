// Olist ERP API v3 OAuth redirect for the Kaia Glow storefront.
// Registration-only endpoint. This intentionally does not exchange OAuth
// codes until an admin-initiated, CSRF-protected connection flow is installed.
// Never log, expose or store authorization codes supplied via query params.
function page(title,message,status=200){
 const body=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title} | Kaia Glow</title>
<style>body{margin:0;min-height:100dvh;background:#f8f5f3;color:#342c32;font:15px system-ui,sans-serif;display:grid;place-items:center}
main{width:min(510px,calc(100vw - 42px));box-sizing:border-box;border-radius:14px;background:#fff;padding:28px;border:1px solid #e6dce0}
small{font-weight:700;letter-spacing:.13em;color:#795666}h1{font-size:24px;line-height:1.2;margin:15px 0}
p{color:#625862;line-height:1.65}a{color:#54283d;font-weight:650;text-decoration:underline}</style>
</head><body><main><small>KAIA GLOW · NOVA BYTE · OLIST</small>
<h1>${title}</h1><p>${message}</p>
<a href="https://usekaiaglow.com.br/admin.html#marketplaces">Voltar ao painel de estoque</a>
</main></body></html>`;
 return new Response(body,{status,headers:{
  'content-type':'text/html; charset=utf-8',
  'cache-control':'private, no-store, max-age=0',
  'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
  'x-robots-tag':'noindex, nofollow','x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
 }});
}
export async function onRequestGet({request}){
 const url=new URL(request.url);
 if(url.protocol!=='https:'||url.pathname!=='/api/kaia/olist/callback'||!
   ['usekaiaglow.com.br','www.usekaiaglow.com.br'].includes(url.hostname))
   return page('Endereço não autorizado','Use o domínio oficial da Kaia Glow.',403);
 if(url.searchParams.has('error')||url.searchParams.has('error_description'))
   return page('Acesso não autorizado','A autorização na Olist não foi concluída. Nenhum produto, estoque ou pedido foi alterado.',400);
 // Do not consume codes before client credentials and a validated OAuth state
 // have been provisioned. This is only a safe redirect URI for app registration.
 if(url.searchParams.has('code')||url.searchParams.has('state'))
   return page('Conexão ainda não ativada','A URL de retorno já está cadastrável, mas a autorização deve ser iniciada pelo painel com proteção de segurança após configurar as credenciais da Olist. Nenhum dado foi sincronizado.',403);
 return page('URL de redirecionamento preparada','Este é o endereço HTTPS para cadastrar no aplicativo API da Olist. O próximo passo é configurar as permissões e credenciais de maneira protegida. A sincronização continua desligada.');
}
