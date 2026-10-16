// NPlay authorized stream gateway. Deploy separately as a Cloudflare Worker.
// Set ALLOWED_STREAMS as JSON, e.g. {"my-channel":"http://stream.example/live.ts"}.
// Never accept a destination URL from the browser.
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowedOrigin=env.ALLOWED_ORIGIN||'https://novabytesolucoes.com.br';
  const cors={'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET,HEAD,OPTIONS','Access-Control-Allow-Headers':'Range','Vary':'Origin','Cache-Control':'no-store'};
  if(origin&&origin!==allowedOrigin)return new Response('Origin not allowed',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:cors});
  const requestUrl=new URL(request.url),path=requestUrl.pathname;
  if(path==='/resolve'){
   let streams;try{streams=JSON.parse(env.ALLOWED_STREAMS||'{}');}catch{return new Response('Configuration error',{status:503,headers:cors});}
   const source=requestUrl.searchParams.get('source');
   for(const [id,value] of Object.entries(streams)){
    if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))continue;
    try{
     const upstream=new URL(value);
     if(upstream.href!==new URL(source).href||!['http:','https:'].includes(upstream.protocol)||upstream.username||upstream.password||!upstream.hostname.includes('.')||!/\.ts$/i.test(upstream.pathname))continue;
     return Response.json({url:new URL('/stream/'+id+'.ts',requestUrl).href},{headers:cors});
    }catch{}
   }
   return new Response('Stream not authorized',{status:404,headers:cors});
  }
  const id=path.startsWith('/stream/')?decodeURIComponent(path.slice(8)).replace(/\.ts$/i,''):'';
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))return new Response('Not found',{status:404,headers:cors});
  let streams={};try{streams=JSON.parse(env.ALLOWED_STREAMS||'{}');}catch{return new Response('Configuration error',{status:503,headers:cors});}
  if(!Object.prototype.hasOwnProperty.call(streams,id))return new Response('Stream not authorized',{status:404,headers:cors});
  let upstream;try{upstream=new URL(streams[id]);}catch{return new Response('Invalid upstream',{status:503,headers:cors});}
  if(!['http:','https:'].includes(upstream.protocol)||upstream.username||upstream.password||!upstream.hostname.includes('.'))return new Response('Invalid upstream',{status:503,headers:cors});
  if(!/\.ts$/i.test(upstream.pathname))return new Response('Only MPEG-TS sources supported',{status:415,headers:cors});
  const headers=new Headers();const range=request.headers.get('Range');if(range)headers.set('Range',range);
  try{
   const response=await fetch(upstream.toString(),{method:request.method,headers,redirect:'error',cf:{cacheTtl:0}});
   const out=new Headers(cors);
   out.set('Content-Type','video/mp2t');
   for(const key of ['Content-Length','Content-Range','Accept-Ranges']){const value=response.headers.get(key);if(value)out.set(key,value);}
   return new Response(response.body,{status:response.status,headers:out});
  }catch{return new Response('Upstream unreachable',{status:502,headers:cors});}
 }
};
