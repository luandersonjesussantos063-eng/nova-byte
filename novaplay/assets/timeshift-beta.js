/* NPlay: canais experimentais visíveis somente a administradores autenticados.
   Sinais e senha do laboratório nunca são enviados nesta página. */
(()=>{
"use strict";
const base="https://nplay-timeshift-gateway.luandersonjesussantos063.workers.dev";
let pending=null;
async function getChannels(){
 if(pending)return pending;
 pending=(async()=>{
  try{
   const db=window.NPlayAccessClient||window.supabase?.createClient?.("https://vajlhodqxskozuxxlujv.supabase.co","sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3");
   const session=(await db?.auth?.getSession())?.data?.session;
   if(!session?.access_token)return [];
   const {data,error}=await db.from("novaplay_admins").select("user_id").limit(1);
   if(error||!data?.length)return [];
   return [
    {id:"timeshift-test-a",title:"Discovery H&H · Estável (teste)",category:"Laboratório · teste privado",stream_type:"timeshift",labChannel:"a",embed_url:base+"/status?channel=a",logo_url:""},
    {id:"timeshift-test-b",title:"Discovery · Estável (teste)",category:"Laboratório · teste privado",stream_type:"timeshift",labChannel:"b",embed_url:base+"/status?channel=b",logo_url:""}
   ];
  }catch{return [];}
 })();
 setTimeout(()=>{pending=null;},30000);
 return pending;
}
window.NPlayTimeShiftBeta=Object.freeze({getChannels});
})();