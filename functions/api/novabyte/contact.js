// NovaByte contact: the caller cannot choose a recipient, sender or upstream URL.
const ORIGINS=new Set(['https://novabytesolucoes.com.br','https://www.novabytesolucoes.com.br']);
const HOSTS=new Set(['novabytesolucoes.com.br','www.novabytesolucoes.com.br']);
const PROJECT='https://vajlhodqxskozuxxlujv.supabase.co';
const encode=new TextEncoder();
function response(request,body,status=200){
 const origin=request.headers.get('origin');
 return new Response(status===204?null:JSON.stringify(body),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',Vary:'Origin',
  ...(ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}:{}),
  ...(status===429?{'Retry-After':'3600'}:{})
 }});
}
export async function onRequestOptions({request}){return response(request,{},ORIGINS.has(request.headers.get('origin'))?204:403);}
async function readJson(request){
 const reader=request.body?.getReader();if(!reader)throw Error('EMPTY');
 let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();throw Error('LARGE');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
const validEmail=s=>typeof s==='string'&&s.length<=160&&/^[^\s@<>]+@[^\s@<>]+\.[A-Za-z]{2,}$/.test(s);
export async function onRequestPost({request,env}){
 const reject=(code,status=400)=>response(request,{success:false,code},status);
 if(!ORIGINS.has(request.headers.get('origin'))||new URL(request.url).protocol!=='https:')return reject('ORIGEM_INVALIDA',403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return reject('TIPO_INVALIDO',415);
 if(!env.NOVABYTE_TURNSTILE_SECRET||!env.NOVABYTE_CONTACT_RESEND_KEY||!env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY)return reject('ENVIO_INDISPONIVEL',503);
 let data;try{data=await readJson(request);}catch{return reject('DADOS_INVALIDOS');}
 const f=data?.fields,token=data?.captchaToken;
 if(data?.honeypot||typeof token!=='string'||token.length<10||token.length>2048)return reject('VERIFICACAO_NECESSARIA',403);
 if(!f||typeof f.name!=='string'||f.name.trim().length<2||f.name.length>100||!validEmail(f.email)||
  typeof f.message!=='string'||f.message.trim().length<10||f.message.length>5000||
  typeof f.service!=='string'||f.service.length>120||typeof f.phone!=='string'||f.phone.length>40||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.requestKey||''))return reject('DADOS_INVALIDOS',422);
 try{
  const ip=request.headers.get('CF-Connecting-IP');
  const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(10000),
   body:new URLSearchParams({secret:env.NOVABYTE_TURNSTILE_SECRET,response:token,...(ip?{remoteip:ip}:{})})
  });
  if(!verification.ok)return reject('VERIFICACAO_INDISPONIVEL',503);
  const verified=await verification.json();
  if(verified.success!==true||verified.action!=='contact'||!HOSTS.has(verified.hostname))return reject('VERIFICACAO_INVALIDA',403);
  if(!ip)return reject('REDE_NAO_IDENTIFICADA',503);
  const key=await crypto.subtle.importKey('raw',encode.encode(env.NOVABYTE_TURNSTILE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const identity=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encode.encode(ip)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const service=env.KAIA_MP_PROD_SUPABASE_SERVICE_KEY;
  const quota=await fetch(PROJECT+'/rest/v1/rpc/nb_security_reserve',{
   method:'POST',headers:{apikey:service,...(service.startsWith('eyJ')?{Authorization:'Bearer '+service}:{}),'Content-Type':'application/json'},
   body:JSON.stringify({p_identity:identity,p_scope:'contact'}),signal:AbortSignal.timeout(5000)
  });
  if(!quota.ok)return reject('ENVIO_INDISPONIVEL',503);
  const allowed=await quota.json();if(allowed===false)return reject('LIMITE_TEMPORARIO',429);if(allowed!==true)return reject('ENVIO_INDISPONIVEL',503);
  const sent=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+env.NOVABYTE_CONTACT_RESEND_KEY,'Content-Type':'application/json','Idempotency-Key':'nb-contact:'+data.requestKey},
   body:JSON.stringify({from:'NovaByte Site <contato@auth.novabytesolucoes.com.br>',to:['novabytesolucoes@gmail.com'],reply_to:f.email,
    subject:'Novo pedido pelo site — NovaByte',text:['Solicitação pelo site NovaByte','Nome: '+f.name,'E-mail: '+f.email,
     'WhatsApp: '+f.phone,'Serviço: '+f.service,'','Mensagem:',f.message].join('\n')}),signal:AbortSignal.timeout(10000)
  });
  if(!sent.ok)return reject('ENVIO_NAO_CONFIRMADO',503);
  const result=await sent.json();if(typeof result.id!=='string'||!result.id)return reject('ENVIO_NAO_CONFIRMADO',503);
  return response(request,{success:true});
 }catch{return reject('ENVIO_INDISPONIVEL',503);}
}
