import {PACIFICA_AUTH as config} from "./auth-config.mjs";
let client=null;
export function authClient(detectSession=false){
 if(!config.url||!config.publishableKey||!window.supabase)return null;
 if(!client)client=window.supabase.createClient(config.url,config.publishableKey,{auth:{storageKey:config.storageKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:detectSession,flowType:"pkce"}});
 return client;
}
export async function verifiedUser(){
 const sb=authClient();if(!sb)return null;
 try{const {data,error}=await sb.auth.getUser();const u=data?.user;return !error&&u?.email_confirmed_at&&!u.is_anonymous?u:null}catch{return null}
}
export function emailReady(){return config.emailRedirectReady===true}
export async function hasDeliveryDetails(user){
 if(!user)return false;
 const sb=authClient();if(!sb)return false;
 const {data,error}=await sb.from("pacifica_customer_details").select("postal_code").eq("user_id",user.id).maybeSingle();
 return !error&&/^\d{8}$/.test(data?.postal_code||"");
}
