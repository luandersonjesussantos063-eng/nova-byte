// Admin-only connection diagnostic. Credentials stay in request memory.
const SITE='https://novabytesolucoes.com.br';
const DB='https://vajlhodqxskozuxxlujv.supabase.co';
const KEY='sb_publishable_uT0b4y0Bex1k1QWZoyIfKg_K0pm-yS3';
class DiagnosticError extends Error{constructor(message,status=400,stage='validation'){super(message);this.status=status;this.stage=stage;}}
async function readJson(response,max=65536){
 const reader=response.body?.getReader();if(!reader)throw new DiagnosticError('Resposta vazia.',502,'response');
 const parts=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new DiagnosticError('Resposta maior que o limite do diagnóstico.',502,'response');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new DiagnosticError('O portal retornou uma página ou texto, não uma resposta de autenticação compatível.',502,'response');}
}
export function settings(input,allowed){
 let portal;try{portal=new URL(input.portal);}catch{throw new DiagnosticError('Informe a URL completa do portal.');}
 let origins;try{origins=JSON.parse(allowed||'[]');}catch{throw new DiagnosticError('Configuração do servidor indisponível.',503);}
 if(!['http:','https:'].includes(portal.protocol)||portal.username||portal.password||portal.search||portal.hash||!origins.includes(portal.origin))throw new DiagnosticError('Este portal ainda não está configurado no servidor da NPlay.',403);
 const mac=String(input.mac||'').trim().toUpperCase();
 if(!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac))throw new DiagnosticError('MAC inválido. Use seis pares, separados por dois-pontos.');
 const sn=String(input.sn||'').trim(),dev1=String(input.dev1||'').trim(),dev2=String(input.dev2||'').trim();
 if(!/^[A-Za-z0-9_-]{1,64}$/.test(sn))throw new DiagnosticError('Informe o SN fornecido pelo seu provedor.');
 if(!/^[A-Fa-f0-9]{64}$/.test(dev1)||!/^[A-Fa-f0-9]{64}$/.test(dev2))throw new DiagnosticError('DEV1 e DEV2 precisam ter 64 caracteres hexadecimais.');
 let base=portal.pathname.replace(/\/(?:c\/?|portal\.php|server\/load\.php)$/,'/');
 if(!base.endsWith('/'))base+='/';
 if(!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))throw new DiagnosticError('Caminho de portal inválido.');
 if(!['portal','load'].includes(input.endpoint))throw new DiagnosticError('Selecione o tipo de API do provedor.');
 const endpoint=new URL(base+(input.endpoint==='load'?'server/load.php':'portal.php'),portal.origin);
 return {portal,endpoint,mac,sn,dev1,dev2};
}
async function portalCall(config,action,token=''){
 const url=new URL(config.endpoint);url.searchParams.set('type','stb');url.searchParams.set('action',action);url.searchParams.set('JsHttpRequest','1-xml');
 if(action==='get_profile'){
  for(const [key,value] of Object.entries({sn:config.sn,device_id:config.dev1,device_id2:config.dev2,auth_second_step:'1',stb_type:'MAG250',client_type:'STB',hd:'1'}))url.searchParams.set(key,value);
 }
 const headers={'Accept':'application/json','Cookie':'mac='+encodeURIComponent(config.mac.toLowerCase())+'; stb_lang=en; timezone=America%2FCuiaba','User-Agent':'NPlay-Portal-Diagnostic/1.0','X-User-Agent':'Model: MAG250; Link: Ethernet','Referer':config.portal.href};
 if(token)headers.Authorization='Bearer '+token;
 let response;try{response=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new DiagnosticError('Sem resposta do portal no prazo, ou redirecionamento não permitido. A autenticação não foi confirmada.',502,action);}
 if(!response.ok)throw new DiagnosticError('O portal respondeu HTTP '+response.status+'. Isso não confirma se os identificadores são válidos.',502,action);
 return readJson(response);
}
export async function diagnose(config){
 const started=Date.now(),handshake=await portalCall(config,'handshake');
 const token=handshake?.js?.token;
 if(typeof token!=='string'||!/^[A-Za-z0-9._~=-]{8,1024}$/.test(token))return {ok:false,stage:'handshake',message:'Portal respondeu, mas não forneceu uma sessão válida. Autenticação não confirmada.'};
 const response=await portalCall(config,'get_profile',token),profile=response?.js;
 const blocked=profile?.blocked===true||profile?.blocked===1||profile?.blocked==='1';
 const valid=profile&&typeof profile==='object'&&!Array.isArray(profile)&&/^\d+$/.test(String(profile.id||''))&&Number(profile.id)>0&&!blocked;
 if(!valid)return {ok:false,stage:'profile',message:blocked?'O portal informou que este acesso está bloqueado.':'Sessão recebida, mas o portal não confirmou um perfil autorizado. Confira o SN, os DEV e o tipo de API com o provedor.'};
 return {ok:true,stage:'profile_received',message:'O portal retornou um perfil para os dados enviados. Isso não confirma assinatura ativa nem reprodução dos vídeos.',elapsed_ms:Date.now()-started};
}
export default {async fetch(request,env){
 const route=new URL(request.url),origin=request.headers.get('Origin');
 const cors={'Access-Control-Allow-Origin':SITE,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const reply=(body,status=200)=>Response.json(body,{status,headers:cors});
 if(route.pathname==='/health'&&request.method==='GET')return reply({ok:true,version:'portal-test-1'});
 if(origin!==SITE)return reply({ok:false,message:'Origem não autorizada.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST'||route.pathname!=='/test')return reply({ok:false,message:'Rota inválida.'},404);
 const token=(request.headers.get('Authorization')||'').match(/^Bearer ([^\s]{20,8192})$/)?.[1];
 if(!token)return reply({ok:false,message:'Entre no painel administrativo para testar.'},401);
 try{
  const headers={apikey:KEY,Authorization:'Bearer '+token};
  const auth=await fetch(DB+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply({ok:false,message:'Sua sessão expirou. Entre novamente no painel.'},401);
  const user=await readJson(auth);if(!/^[0-9a-f-]{36}$/i.test(user.id||''))return reply({ok:false,message:'Sessão inválida.'},401);
  const admin=await fetch(DB+'/rest/v1/novaplay_admins?user_id=eq.'+user.id+'&select=user_id',{headers,signal:AbortSignal.timeout(8000)});
  if(!admin.ok||!(await readJson(admin))?.length)return reply({ok:false,message:'Somente administradores podem executar este teste.'},403);
  const input=await readJson(request,8192),config=settings(input,env.ALLOWED_PORTAL_ORIGINS);
  return reply(await diagnose(config));
 }catch(error){return reply({ok:false,stage:error.stage||'connection',message:error instanceof DiagnosticError?error.message:'Não foi possível concluir a conexão. Tente novamente.'},error.status||502);}
}};
