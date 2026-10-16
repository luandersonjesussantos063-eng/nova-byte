/* Viewer sessions stay on the NPlay gateway, never on provider hosts. */
(()=>{
 const origin="https://nplay-live-gateway.luandersonjesussantos063.workers.dev";
 function protectedUrl(raw){try{const u=new URL(raw);return u.origin===origin&&/^\/live\/[0-9a-f-]{36}\/(?:stream\.ts|index\.m3u8)$/i.test(u.pathname);}catch{return false;}}
 async function authorize(raw){
  if(!protectedUrl(raw))return raw;
  const client=window.NPlayAccessClient||window.supabase?.createClient("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
  let session=(await client?.auth.getSession())?.data?.session;
  if(session?.expires_at*1000<Date.now()+60000)session=(await client.auth.refreshSession())?.data?.session;
  if(!session?.access_token)throw Error("Entre novamente no NPlay para assistir a este canal.");
  const u=new URL(raw);u.searchParams.set("access_token",session.access_token);return u.href;
 }
 function failureMessage(code){return ({
  PC_BRIDGE_OFFLINE:'A TV pelo PC está desconectada. Confira se o Docker está ligado.',
  PC_BRIDGE_AUTH:'A conexão com o PC precisa ser autorizada novamente no ADM.',
  PC_SOURCE_TLS:'O servidor de vídeo apresentou um certificado HTTPS não confiável. O administrador precisa conferir a fonte.',
  PC_SOURCE_RESET:'O servidor de vídeo encerrou a conexão antes de enviar o sinal. Tente novamente em instantes.',
  PC_SOURCE_DNS:'O PC não conseguiu localizar o servidor de vídeo. Confira a conexão de internet do PC.',
  PC_SOURCE_TIMEOUT:'O servidor de vídeo demorou para responder ao PC. Tente novamente.',
  PC_SOURCE_UNAVAILABLE:'O PC está conectado, mas não conseguiu receber o sinal do fornecedor.'
 })[code]||'';}
 window.NPlayLiveAuth=Object.freeze({protectedUrl,authorize,failureMessage});
})();
