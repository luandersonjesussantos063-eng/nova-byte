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
 window.NPlayLiveAuth=Object.freeze({protectedUrl,authorize});
})();
