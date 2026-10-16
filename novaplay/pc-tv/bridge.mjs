import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';
import {fetchMedia,fetchXtream} from './transport.mjs';
import {MediaEngine,isEngineUrl,ENGINE_CODES} from './media-engine.mjs';
export {publicIP,destination,fetchMedia,xtreamCandidates,fetchXtream} from './transport.mjs';

function authorized(value,secret){
 const a=Buffer.from(value||''),b=Buffer.from('Bearer '+secret);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export function upstreamReason(error){
 if(['DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_TLS_CERT_ALTNAME_INVALID'].includes(error?.code))return 'UPSTREAM_TLS';
 if(error?.code==='ECONNRESET')return 'UPSTREAM_RESET';
 if(['EAI_AGAIN','ENOTFOUND'].includes(error?.code))return 'UPSTREAM_DNS';
 if(error?.code==='ETIMEDOUT')return 'UPSTREAM_TIMEOUT';
 if(error?.message==='INVALID_DESTINATION')return 'UPSTREAM_DESTINATION';
 return 'UPSTREAM_CONNECTION';
}
export function createBridge({secret,fetchUpstream=fetchMedia,fetchRoot=fetchXtream,engine=null}){
 if(!/^[a-f0-9]{64}$/.test(secret||''))throw Error('NPLAY_BRIDGE_KEY must contain 64 hex characters');
 return http.createServer(async(req,res)=>{
  const json=(status,data)=>{if(res.headersSent||res.destroyed)return;const headers={'Content-Type':'application/json','Cache-Control':'no-store'};if(data.reason)headers['X-NPlay-Bridge-Error']=data.reason;res.writeHead(status,headers);res.end(JSON.stringify(data));};
  if(!authorized(req.headers.authorization,secret)){req.resume();json(401,{error:'AUTH_REQUIRED'});return;}
  if(req.url==='/health'&&req.method==='GET'){json(200,{service:'nplay-pc-tv',version:'0.50.0',capabilities:{xtream:!!engine,media_engine:!!engine}});return;}
  if(req.url==='/engine/status'&&req.method==='GET'){json(200,engine?engine.status():{stage:'unavailable',code:'ENGINE_NOT_INSTALLED'});return;}
  if(!['/fetch','/engine/start','/xtream/inspect'].includes(req.url)||req.method!=='POST'){req.resume();json(404,{error:'NOT_FOUND'});return;}
  const controller=new AbortController();req.on('aborted',()=>controller.abort());
  res.on('close',()=>{if(!res.writableFinished)controller.abort();});
  let media;
  try{
   let length=0;const chunks=[];
   for await(const chunk of req){length+=chunk.length;if(length>8192){json(413,{error:'REQUEST_TOO_LARGE'});req.destroy();return;}chunks.push(chunk);}
   const input=JSON.parse(Buffer.concat(chunks).toString());
   if(typeof input.url!=='string'||(input.range&&!/^bytes=\d*-\d*$/.test(input.range))){json(400,{error:'INVALID_REQUEST'});return;}
   if(input.xtream!==undefined&&typeof input.xtream!=='boolean'){json(400,{error:'INVALID_REQUEST'});return;}
   if(req.url==='/xtream/inspect'){
    if(!engine){json(404,{error:'NOT_FOUND'});return;}
    try{json(200,await engine.client.inspect(input.url,AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])));}
    catch(error){json(200,{ok:false,code:ENGINE_CODES.has(error.code)?error.code:'XTREAM_CATALOG_INVALID'});}
    return;
   }
   if(req.url==='/engine/start'){
    if(!engine){json(404,{error:'NOT_FOUND'});return;}
    try{json(200,await engine.start(input.url,/^[a-f0-9]{64}$/.test(input.owner||'')?input.owner:'default'));}
    catch(error){json(200,{ok:false,code:ENGINE_CODES.has(error.code)?error.code:'ENGINE_PROCESS_FAILED'});}
    return;
   }
   media=isEngineUrl(input.url)&&engine?await engine.asset(input.url):await (input.xtream?fetchRoot:fetchUpstream)(input.url,input.range,controller.signal);
   const {response,url}=media;
   const headers={'Cache-Control':'no-store','X-NPlay-Upstream-Url':url};
   for(const name of ['content-type','content-length','content-range','accept-ranges'])if(response.headers[name])headers[name]=response.headers[name];
   res.writeHead(response.statusCode,headers);await pipeline(response,res,{signal:controller.signal});
  }catch(error){
   media?.response.destroy();if(controller.signal.aborted)return;
   const reason=ENGINE_CODES.has(error.code)?error.code:upstreamReason(error);console.error(JSON.stringify({event:'upstream_failed',code:reason}));
   json(502,{error:'UPSTREAM_UNAVAILABLE',reason});
   if(res.headersSent&&!res.writableEnded)res.destroy();
  }
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const engine=new MediaEngine({mode:process.env.NPLAY_MEDIA_MODE});
 const server=createBridge({secret:process.env.NPLAY_BRIDGE_KEY,engine});
 for(const name of ['SIGTERM','SIGINT'])process.once(name,()=>{void engine.close().finally(()=>{server.close();process.exit(0);});});
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=30;
 server.listen(8788,'0.0.0.0',()=>console.log('NPlay TV-PC pronta na porta 8788.'));
}
