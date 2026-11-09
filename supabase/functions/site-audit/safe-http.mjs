import {lookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
export function publicIPv4(ip){
 if(isIP(ip)!==4)return false;
 const [a,b,c]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||
  (a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===88&&c===99))||
  (a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113));
}
function privateIPv6(ip){
 const h=ip.toLowerCase();
 // IPv4-mapped/compatible, transition and non-global ranges are never used.
 return !/^[23][0-9a-f]{3}:/.test(h)||/^2001:(?:db8|0):|^2002:/.test(h);
}
export function validateUrl(raw){
 if(typeof raw!=='string'||raw.length>2048)throw Error('Endereço inválido.');
 const u=new URL(raw),h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.port&&u.port!=='443'||u.username||u.password)
  throw Error('Informe um site público com HTTPS, sem credenciais ou porta personalizada.');
 if(isIP(h.replace(/^\[|\]$/g,''))||!h.includes('.')||h.endsWith('.')||
  !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)||
  /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion|arpa)$/.test(h))
  throw Error('Esse endereço não pode ser analisado.');
 u.hash='';return u;
}
export async function resolvePublicHost(host,resolver=lookup){
 const records=await resolver(host,{all:true,verbatim:true});
 if(!records.length||records.some(r=>r.family===4?!publicIPv4(r.address):privateIPv6(r.address)))
  throw Error('O endereço não corresponde a um site público permitido.');
 const selected=records.find(r=>r.family===4&&publicIPv4(r.address));
 if(!selected)throw Error('Este site não possui um endereço IPv4 público disponível para análise.');
 return selected.address;
}
async function nativeGet(u,address,timeoutMs,maxBytes){
 let socket,expired=false,timer;
 const job=(async()=>{
  socket=await Deno.connect({hostname:address,port:443});
  if(expired){socket.close();throw Error('Tempo limite excedido.');}
  socket=await Deno.startTls(socket,{hostname:u.hostname,alpnProtocols:['http/1.1']});
  if(expired){socket.close();throw Error('Tempo limite excedido.');}
  const wire=new TextEncoder().encode('GET '+u.pathname+u.search+' HTTP/1.1\r\nHost: '+u.hostname+'\r\nAccept: text/html,application/xhtml+xml\r\nAccept-Encoding: identity\r\nUser-Agent: NovaByteAudit/2.0\r\nConnection: close\r\n\r\n');
  let written=0;while(written<wire.length)written+=await socket.write(wire.subarray(written));
  const pieces=[];let bytes=0;const buffer=new Uint8Array(16384);
  while(true){const n=await socket.read(buffer);if(n===null)break;bytes+=n;if(bytes>maxBytes+65536)throw Error('Página acima do limite permitido.');pieces.push(buffer.slice(0,n));}
  const data=new Uint8Array(bytes);let offset=0;for(const p of pieces){data.set(p,offset);offset+=p.length;}
  let split=-1;for(let i=0;i<data.length-3;i++)if(data[i]===13&&data[i+1]===10&&data[i+2]===13&&data[i+3]===10){split=i;break;}
  if(split<0||split>32768)throw Error('Cabeçalhos de resposta inválidos.');
  const lines=new TextDecoder().decode(data.subarray(0,split)).split('\r\n');
  const status=Number(/^HTTP\/1\.[01] (\d{3})/.exec(lines.shift()||'')?.[1]);
  if(status<200||status>599)throw Error('Resposta HTTP inválida.');
  const headers=new Headers();for(const line of lines){const i=line.indexOf(':');if(i<=0)throw Error('Cabeçalho inválido.');headers.append(line.slice(0,i),line.slice(i+1).trim());}
  let body=data.subarray(split+4);
  if(headers.get('transfer-encoding')){
   if(headers.get('transfer-encoding')?.toLowerCase()!=='chunked')throw Error('Transferência não suportada.');
   const decoded=[];let i=0,total=0;
   while(true){let end=i;while(end<body.length-1&&!(body[end]===13&&body[end+1]===10))end++;
    const sizeText=new TextDecoder().decode(body.subarray(i,end)).split(';')[0];
    if(!/^[a-f0-9]{1,8}$/i.test(sizeText))throw Error('Resposta fragmentada inválida.');
    const n=parseInt(sizeText,16);i=end+2;if(n===0)break;
    if(total+n>maxBytes||i+n+2>body.length||body[i+n]!==13||body[i+n+1]!==10)throw Error('Resposta acima do limite ou incompleta.');
    decoded.push(body.slice(i,i+n));total+=n;i+=n+2;
   }
   body=new Uint8Array(total);let pos=0;for(const p of decoded){body.set(p,pos);pos+=p.length;}headers.delete('transfer-encoding');headers.delete('content-length');
  }
  if(body.length>maxBytes)throw Error('Página acima do limite permitido.');
  if(!['','identity'].includes(headers.get('content-encoding')||''))throw Error('Resposta comprimida não suportada.');
  return new Response([204,205,304].includes(status)?null:body,{status,headers});
 })();
 try{return await Promise.race([job,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;try{socket?.close()}catch{}reject(Error('O site demorou para responder.'));},timeoutMs);})]);}
 finally{clearTimeout(timer);try{socket?.close()}catch{}}
}

export async function pinnedFetch(url,{timeoutMs=12000,maxBytes=1200000,resolver=lookup,transport=httpsRequest}={}){
 const u=validateUrl(String(url));
 // Resolve once, validate all answers, then connect to the exact approved IP.
 // TLS certificate validation and SNI still use the original hostname.
 let dnsTimer;
 const address=await Promise.race([resolvePublicHost(u.hostname,resolver),new Promise((_,reject)=>{dnsTimer=setTimeout(()=>reject(Error('Não foi possível resolver o endereço do site.')),5000);})]).finally(()=>clearTimeout(dnsTimer));
 if(globalThis.Deno?.connect&&transport===httpsRequest)return nativeGet(u,address,timeoutMs,maxBytes);
 return new Promise((resolve,reject)=>{
  let settled=false,req;
  const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{req?.destroy();done(Error('O site demorou para responder.'));},timeoutMs);
  try{
   req=transport({hostname:address,family:4,port:443,servername:u.hostname,rejectUnauthorized:true,
    path:u.pathname+u.search,method:'GET',agent:false,
    headers:{Host:u.hostname,Accept:'text/html,application/xhtml+xml','Accept-Encoding':'identity','User-Agent':'NovaByteAudit/2.0 (+https://novabytesolucoes.com.br/auditoria-de-site.html)'}},res=>{
    const status=res.statusCode||502,headers=new Headers();
    for(const [k,v] of Object.entries(res.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(', '):String(v));
    if([301,302,303,307,308].includes(status)){res.destroy();done(null,new Response(null,{status,headers}));return;}
    if(!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(headers.get('content-type')||'')){res.destroy();done(Error('O endereço não retornou uma página HTML.'));return;}
    if(!['','identity'].includes(headers.get('content-encoding')||'')){res.destroy();done(Error('O site não forneceu uma resposta compatível para análise.'));return;}
    const chunks=[];let bytes=0;
    res.on('data',part=>{bytes+=part.length;if(bytes>maxBytes){res.destroy();done(Error('A página excedeu o limite de tamanho para análise.'));return;}chunks.push(part);});
    res.on('end',()=>{const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}done(null,new Response([204,205,304].includes(status)?null:body,{status,headers}));});
    res.on('error',()=>done(Error('Não foi possível ler a resposta do site.')));
   });
   req.on('error',error=>{console.error('audit_transport_failure',error?.code||error?.name);done(Error('Não foi possível conectar com segurança ao site.'));});req.end();
  }catch{done(Error('Não foi possível iniciar a conexão segura.'));}
 });
}
export async function safeFetch(start,timeoutMs=12000,maxRedirects=3,fetcher=pinnedFetch){
 let current=validateUrl(String(start));const started=performance.now();
 for(let i=0;i<=maxRedirects;i++){
  const remaining=timeoutMs-(performance.now()-started);if(remaining<=0)throw Error('O site demorou para responder.');
  const res=await fetcher(current,{timeoutMs:remaining});
  if([301,302,303,307,308].includes(res.status)){
   const to=res.headers.get('location');if(!to)throw Error('Redirecionamento inválido.');
   current=validateUrl(new URL(to,current).href);continue;
  }
  return {res,url:current,elapsed:Math.round(performance.now()-started)};
 }
 throw Error('O site redirecionou muitas vezes.');
}
