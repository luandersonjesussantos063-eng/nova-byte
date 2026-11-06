// PREVIEW-ONLY guard: DO NOT merge into the production Kaia Glow branch.
// Requires Cloudflare Access + verified JWT + allowlisted test email.
// Fails CLOSED if Zero Trust/Access is not configured, including for static assets.
function reject(status,message){
 return new Response(JSON.stringify({code:'KAIA_PREVIEW_RESTRITO',message}),{
  status,headers:{'content-type':'application/json; charset=utf-8',
   'cache-control':'no-store','x-content-type-options':'nosniff',
   'x-robots-tag':'noindex, nofollow'}
 });
}
function decodeB64Url(value){
 const base64=value.replace(/-/g,'+').replace(/_/g,'/');
 const bytes=atob(base64.padEnd(Math.ceil(base64.length/4)*4,'='));
 return Uint8Array.from(bytes,c=>c.charCodeAt(0));
}
function jsonB64(value){
 return JSON.parse(new TextDecoder().decode(decodeB64Url(value)));
}
export async function onRequest({request,env,next}){
 const issuer=String(env.KAIA_TEST_ACCESS_ISSUER||'').replace(/\/$/,'');
 const audience=String(env.KAIA_TEST_ACCESS_AUD||'');
 const approved=String(env.KAIA_TEST_EMAIL_ALLOWLIST||'')
  .split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)
  ||!audience||approved.length===0){
  return reject(503,'Preview fechado: autenticação de usuários de teste não configurada.');
 }
 const token=request.headers.get('cf-access-jwt-assertion')||'';
 const parts=token.split('.');
 if(parts.length!==3||token.length>12000)return reject(403,'Faça login como usuário de teste autorizado.');
 try{
  const header=jsonB64(parts[0]),payload=jsonB64(parts[1]);
  const now=Math.floor(Date.now()/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'
   ||payload.iss!==issuer
   ||!Array.isArray(payload.aud)||!payload.aud.includes(audience)
   ||typeof payload.exp!=='number'||payload.exp<=now
   ||typeof payload.nbf==='number'&&payload.nbf>now
   ||typeof payload.email!=='string'
   ||!approved.includes(payload.email.toLowerCase())){
   return reject(403,'Conta não autorizada para homologação.');
  }
  const result=await fetch(issuer+'/cdn-cgi/access/certs',{
   headers:{accept:'application/json'},signal:AbortSignal.timeout(4000)
  });
  if(!result.ok)throw Error('Cloudflare Access cert lookup failed');
  const certs=await result.json();
  const jwk=(certs.keys||[]).find(k=>k.kid===header.kid&&k.kty==='RSA');
  if(!jwk)throw Error('No trusted signing key');
  const key=await crypto.subtle.importKey('jwk',jwk,
   {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const good=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,
   decodeB64Url(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  if(!good)return reject(403,'Assinatura de acesso inválida.');
  const response=await next();
  const secured=new Response(response.body,response);
  secured.headers.set('X-Robots-Tag','noindex, nofollow');
  secured.headers.set('Cache-Control','private, no-store');
  return secured;
 }catch{
  return reject(403,'Não foi possível validar o acesso ao preview.');
 }
}
