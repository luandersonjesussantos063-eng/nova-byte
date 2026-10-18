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
  const u=new URL(raw);u.searchParams.set("access_token",session.access_token);u.searchParams.set("viewer",crypto.randomUUID().replaceAll("-",""));return u.href;
 }
 const releasing=new Set();
 function release(raw){
  try{
   if(!protectedUrl(raw))return;
   const u=new URL(raw);if(!u.searchParams.has('viewer'))return;
   u.pathname=u.pathname.replace(/(?:index\.m3u8|stream\.ts)$/,'release');
   const task=fetch(u.href,{method:'POST',keepalive:true}).catch(()=>{}).finally(()=>releasing.delete(task));
   releasing.add(task);return task;
  }catch{}
 }
 async function waitForRelease(){let timer;try{await Promise.race([Promise.allSettled([...releasing]),new Promise(resolve=>{timer=setTimeout(resolve,22000);})]);}finally{clearTimeout(timer);}}
 function failureMessage(code){return ({
 PC_XTREAM_CATALOG_INVALID:'O fornecedor não retornou uma grade Xtream válida para esta conta.',
 PC_XTREAM_LOGIN_RESET:'O servidor encerrou a conexão durante o login Xtream, antes de receber o vídeo. Consulte o receptor no ADM.',
 PC_XTREAM_LOGIN_TIMEOUT:'O login Xtream não respondeu dentro do tempo limite.',
 PC_XTREAM_LOGIN_CONNECTION:'O receptor não conseguiu conectar à API Xtream do fornecedor.',
 PC_XTREAM_LOGIN_INVALID:'A API do fornecedor não retornou um login Xtream válido.',
 PC_XTREAM_LOGIN_DENIED:'O fornecedor não autorizou o login Xtream ou a conta está inativa.',
 PC_XTREAM_TS_UNAVAILABLE:'A conta do fornecedor não oferece MPEG-TS para o receptor.',
 PC_MEDIA_CONNECTION_LIMIT:'Todas as conexões da conta estão em uso. Feche outros players e tente novamente.',
 PC_MEDIA_SOURCE_HTTP:'O login foi aceito, mas o fornecedor recusou o endereço do vídeo.',
 PC_MEDIA_SOURCE_INVALID:'O fornecedor não entregou um sinal de vídeo compatível com o receptor.',
 PC_MEDIA_SOURCE_RESET:'O login Xtream foi aceito, mas a conexão do vídeo foi encerrada pelo caminho até o fornecedor.',
 PC_MEDIA_SOURCE_CONNECTION:'O receptor entrou na conta, mas não conseguiu receber o vídeo.',
 PC_MEDIA_BUSY:'As três vagas de canais simultâneos estão em uso. Feche um canal em outro aparelho e tente novamente.',
 PC_MEDIA_START_TIMEOUT:'O receptor não ficou pronto no tempo limite. Confira o estado no ADM.',
 PC_MEDIA_PROCESS_FAILED:'O receptor recebeu dados, mas não conseguiu gerar o vídeo para o navegador. Confira o ADM.',
 PC_MEDIA_NOT_INSTALLED:'Atualize a TV-PC para instalar o receptor Xtream e FFmpeg.',
 PC_MEDIA_ASSET_GONE:'A sessão deste canal terminou. Abra o canal novamente.',

  PC_BRIDGE_OFFLINE:'A TV pelo PC está desconectada. Confira se o Docker está ligado.',
  PC_BRIDGE_AUTH:'A conexão com o PC precisa ser autorizada novamente no ADM.',
  PC_SOURCE_TLS:'O servidor de vídeo apresentou um certificado HTTPS não confiável. O administrador precisa conferir a fonte.',
  PC_SOURCE_RESET:'O servidor de vídeo encerrou a conexão antes de enviar o sinal. Tente novamente em instantes.',
  PC_SOURCE_DNS:'O PC não conseguiu localizar o servidor de vídeo. Confira a conexão de internet do PC.',
  PC_SOURCE_TIMEOUT:'O servidor de vídeo demorou para responder ao PC. Tente novamente.',
  PC_SOURCE_UNAVAILABLE:'O PC está conectado, mas não conseguiu receber o sinal do fornecedor.'
 })[code]||'';}
 window.NPlayLiveAuth=Object.freeze({protectedUrl,authorize,failureMessage,release,waitForRelease});
})();
