import {contentSecurityPolicy,securityHeaders} from '../kaia-glow/security-policy.js';
const MAX_BODY=32768;
function reject(){return new Response(JSON.stringify({code:'DADOS_EXCESSIVOS'}),{status:413,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...securityHeaders}});}
export async function onRequest(context){
 const {request}=context;
 let forwarded=request;
 if(request.body){
  if(Number(request.headers.get('content-length')||0)>MAX_BODY)return reject();
  const reader=request.body.getReader();let size=0;const chunks=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();return reject();}chunks.push(value);}}
  finally{reader.releaseLock();}
  const body=new Uint8Array(size);let offset=0;for(const value of chunks){body.set(value,offset);offset+=value.length;}
  forwarded=new Request(request,{body});
 }
 const original=await context.next(forwarded);
 const response=new Response(original.body,original);
 for(const [name,value] of Object.entries(securityHeaders))response.headers.set(name,value);
 response.headers.set('Content-Security-Policy',contentSecurityPolicy());
 if(new URL(request.url).pathname.startsWith('/api/kaia/'))response.headers.set('Cache-Control','no-store');
 return response;
}
