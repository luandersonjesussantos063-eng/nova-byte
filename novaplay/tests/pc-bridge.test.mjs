import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createBridge,publicIP,destination} from '../pc-tv/bridge.mjs';
import {bridgeUrl,encryptBridge,decryptBridge,bridgeUpstream,checkBridge} from '../worker/pc-bridge.mjs';
import worker from '../worker/live-gateway.mjs';
const secret='a'.repeat(64),key=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
test('PC health and media use Workers-compatible redirect modes and refuse redirects without forwarding the key',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(_url,options)=>{
   // workerd supports only follow/manual; Node alone also accepts error.
   if(!['follow','manual'].includes(options.redirect))throw TypeError('Invalid redirect value');
   assert.equal(options.redirect,'manual');calls++;
   return new Response(null,{status:302,headers:{Location:'https://foreign.example/private','X-NPlay-Upstream-Url':'http://provider.example/private'}});
  };
  const health=await checkBridge('https://test.trycloudflare.com',secret,r=>r.json());assert.equal(health.code,'PC_TUNNEL_REDIRECT');assert.equal(calls,1);
  const transport=await bridgeUpstream({url:'https://test.trycloudflare.com',secret},url=>new URL(url));
  await assert.rejects(transport('http://provider.example/private',new AbortController().signal),{code:'PC_BRIDGE_OFFLINE'});assert.equal(calls,2);
  globalThis.fetch=async(_url,options)=>{assert.equal(options.redirect,'manual');return Response.json({service:'nplay-pc-tv'});};
  assert.equal((await checkBridge('https://test.trycloudflare.com',secret,r=>r.json())).ok,true);
 }finally{globalThis.fetch=previous;}
});
test('PC health diagnostics distinguish key rejection, tunnel denial, origin failure and invalid replies without leaking secrets',async()=>{
 const previous=globalThis.fetch;
 try{
  for(const [status,code] of [[401,'PC_TUNNEL_AUTH'],[403,'PC_TUNNEL_DENIED'],[502,'PC_LOCAL_UNREACHABLE'],[530,'PC_TUNNEL_ADDRESS']]){
   globalThis.fetch=async()=>new Response('private provider contents',{status});
   const result=await checkBridge('https://test.trycloudflare.com',secret,r=>r.json());assert.equal(result.code,code);assert.equal(result.status,status);assert.ok(!JSON.stringify(result).includes(secret));assert.ok(!JSON.stringify(result).includes('private provider'));
  }
  globalThis.fetch=async()=>Response.json({error:'AUTH_REQUIRED'},{status:401});assert.equal((await checkBridge('https://test.trycloudflare.com',secret,r=>r.json())).code,'PC_KEY_REJECTED');
  globalThis.fetch=async()=>new Response('<html>not the bridge</html>');assert.equal((await checkBridge('https://test.trycloudflare.com',secret,r=>r.json())).code,'PC_RESPONSE_INVALID');
  globalThis.fetch=async()=>{throw new DOMException('private URL','TimeoutError');};assert.equal((await checkBridge('https://test.trycloudflare.com',secret,r=>r.json())).code,'PC_TUNNEL_TIMEOUT');
  globalThis.fetch=async()=>{throw Error('private key');};assert.equal((await checkBridge('https://test.trycloudflare.com',secret,r=>r.json())).code,'PC_TUNNEL_CONNECTION');
 }finally{globalThis.fetch=previous;}
});
test('PC destinations reject private, loopback, metadata, IPv6 and mixed DNS answers',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.2','172.16.1.1','100.64.1.1','168.63.129.16','::1'])assert.equal(publicIP(ip),false,ip);
 assert.equal(publicIP('93.184.216.34'),true);
 await assert.rejects(destination('http://provider.example/live',async()=>[{address:'93.184.216.34'},{address:'127.0.0.1'}]));
 await assert.rejects(destination('http://user:password@provider.example/live'));
 const target=await destination('http://provider.example/live',async()=>[{address:'93.184.216.34'}]);assert.equal(target.address,'93.184.216.34');
});
test('local bridge authenticates health and fetch requests and streams bytes with final manifest base',async()=>{
 let reads=0;
 const server=createBridge({secret,fetchUpstream:async(url,range)=>{reads++;assert.equal(range,'bytes=0-3');const response=Readable.from([Buffer.from([71,0,1,2])]);response.statusCode=200;response.headers={'content-type':'video/mp2t'};return {response,url:'http://93.184.216.34/private/base/index.m3u8'};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(url+'/health')).status,401);assert.equal(reads,0);
  const headers={Authorization:'Bearer '+secret,'Content-Type':'application/json'};
  assert.equal((await(await fetch(url+'/health',{headers})).json()).service,'nplay-pc-tv');
  const r=await fetch(url+'/fetch',{method:'POST',headers,body:JSON.stringify({url:'http://provider.example/private',range:'bytes=0-3'})});
  assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,4);assert.match(r.headers.get('X-NPlay-Upstream-Url'),/private\/base/);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('PC configuration is encrypted and rejects tampering, foreign domains and wrong keys',async()=>{
 const config={url:'https://example-pc.trycloudflare.com',secret};
 const cipher=await encryptBridge(config,key);assert.ok(!cipher.includes(config.url));assert.ok(!cipher.includes(secret));assert.deepEqual(await decryptBridge(cipher,key),config);
 await assert.rejects(decryptBridge(cipher.slice(0,-5)+'AAAAA',key));
 for(const url of ['http://example.trycloudflare.com','https://example.com','https://example.trycloudflare.com/extra','https://example.trycloudflare.com?secret=a'])assert.throws(()=>bridgeUrl(url));
});
test('bridge transport keeps provider request and PC secret off viewer responses',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://example-pc.trycloudflare.com/fetch');assert.equal(options.headers.Authorization,'Bearer '+secret);assert.equal(JSON.parse(options.body).url,'http://provider.example/private');return new Response('#EXTM3U\n',{headers:{'X-NPlay-Upstream-Url':'http://93.184.216.34/base/index.m3u8'}});};
  const transport=await bridgeUpstream({url:'https://example-pc.trycloudflare.com',secret},url=>new URL(url));const r=await transport('http://provider.example/private',new AbortController().signal);
  assert.equal(r.url,'http://93.184.216.34/base/index.m3u8');
 }finally{globalThis.fetch=previous;}
});
test('only an admin can configure the PC; denied users cannot trigger a bridge request',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url)=>{calls++;assert.match(String(url),/supabase\.co/);return Response.json([]);};
  const r=await worker.fetch(new Request('https://nplay-live-gateway.luandersonjesussantos063.workers.dev/admin/pc-bridge',{method:'POST',headers:{Authorization:'Bearer denied'},body:JSON.stringify({url:'https://example.trycloudflare.com',secret})}),{HLS_MEDIA_KEY:key});
  assert.equal(r.status,403);assert.equal(calls,1);
 }finally{globalThis.fetch=previous;}
});
test('admin connection checks the PC and saves only encrypted configuration',async()=>{
 const previous=globalThis.fetch;let saved;
 try{
  globalThis.fetch=async(url,options)=>{
   if(String(url).includes('novaplay_admins'))return Response.json([{user_id:'admin'}]);
   if(String(url).endsWith('/health')){assert.equal(options.headers.Authorization,'Bearer '+secret);return Response.json({service:'nplay-pc-tv'});}
   assert.equal(options.method,'PATCH');saved=JSON.parse(options.body);return Response.json([{id:1}]);
  };
  const r=await worker.fetch(new Request('https://nplay-live-gateway.luandersonjesussantos063.workers.dev/admin/pc-bridge',{method:'POST',headers:{Authorization:'Bearer admin'},body:JSON.stringify({url:'https://example-pc.trycloudflare.com',secret})}),{HLS_MEDIA_KEY:key});
  assert.equal(r.status,200);assert.equal((await r.json()).connected,true);assert.ok(!saved.pc_bridge_config.includes(secret));assert.deepEqual(await decryptBridge(saved.pc_bridge_config,key),{url:'https://example-pc.trycloudflare.com',secret});
 }finally{globalThis.fetch=previous;}
});
test('a viewer streams an IP-based HLS manifest and segment through the PC with RLS and encrypted locators',async()=>{
 const previous=globalThis.fetch,id='11111111-1111-5111-8111-111111111111',root='https://nplay-live-gateway.luandersonjesussantos063.workers.dev/live/'+id+'/index.m3u8';
 const cipher=await encryptBridge({url:'https://example-pc.trycloudflare.com',secret},key);let bridgeCalls=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(String(url).includes('novaplay_live_embeds'))return Response.json([{embed_url:root}]);
   if(String(url).includes('novaplay_featured'))return Response.json([{pc_bridge_config:cipher}]);
   assert.equal(url,'https://example-pc.trycloudflare.com/fetch');assert.equal(options.headers.Authorization,'Bearer '+secret);bridgeCalls++;
   const input=JSON.parse(options.body);
   if(bridgeCalls===1)return new Response('#EXTM3U\n#EXTINF:4,\nsegment.ts\n',{headers:{'Content-Type':'application/x-mpegurl','X-NPlay-Upstream-Url':'http://93.184.216.34/private/index.m3u8'}});
   assert.equal(input.url,'http://93.184.216.34/private/segment.ts');return new Response(new Uint8Array([71,0,1,2]),{headers:{'Content-Type':'video/mp2t','X-NPlay-Upstream-Url':input.url}});
  };
  const env={HLS_MEDIA_KEY:key,LIVE_SOURCES:{get:async()=>({url:'http://provider.example/private/index.m3u8'})}};
  const r=await worker.fetch(new Request(root+'?access_token=approved-viewer'),env);assert.equal(r.status,200);assert.equal(r.headers.get('X-NPlay-Upstream-Url'),null);
  const manifest=await r.text();assert.ok(!manifest.includes('private'));assert.ok(!manifest.includes(secret));
  const segment=manifest.split('\n').find(x=>x.startsWith('https:'));const media=await worker.fetch(new Request(segment),env);assert.equal(media.status,200);assert.equal((await media.arrayBuffer()).byteLength,4);assert.equal(bridgeCalls,2);
 }finally{globalThis.fetch=previous;}
});
