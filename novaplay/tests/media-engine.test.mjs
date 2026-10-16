import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {spawn,spawnSync} from 'node:child_process';
import {XtreamClient} from '../pc-tv/xtream-client.mjs';
import {MediaEngine,ENGINE_ORIGIN} from '../pc-tv/media-engine.mjs';
import {bridgeUpstream} from '../worker/pc-bridge.mjs';
import {createBridge} from '../pc-tv/bridge.mjs';
import worker from '../worker/live-gateway.mjs';
import {encryptBridge} from '../worker/pc-bridge.mjs';
const source='http://provider.example/user/pass/152812.m3u8';
function reply(body,headers={}){return Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]),{statusCode:200,headers});}
test('Xtream authenticates first, scopes API cookies to the provider and refuses inactive or exhausted accounts',async()=>{
 let calls=[],account={auth:1,status:'Active',active_cons:'0',max_connections:'1',allowed_output_formats:['m3u8','ts']};
 const client=new XtreamClient({fetcher:async(url,_range,_signal,session)=>{calls.push(url);if(url.includes('player_api.php'))return {url,response:reply({user_info:account},{'set-cookie':['PHPSESSID=test; HttpOnly; Path=/']})};assert.equal(session.cookie,'PHPSESSID=test');assert.equal(session.origin,'http://provider.example');return {url,response:Object.assign(Readable.from([Buffer.from([71])]),{statusCode:200,headers:{'content-type':'video/mp2t'}})};}});
 const login=await client.login(source,new AbortController().signal);assert.equal(login.account.active,true);const media=await client.openTs(login,new AbortController().signal);media.response.destroy();assert.equal(calls.length,2);assert.match(calls[0],/player_api.php/);assert.match(calls[1],/\/live\/user\/pass\/152812.ts$/);
 account={...account,active_cons:'1'};await assert.rejects(client.login(source,new AbortController().signal),{code:'XTREAM_CONNECTION_LIMIT'});
 account={...account,auth:0};await assert.rejects(client.login(source,new AbortController().signal),{code:'XTREAM_LOGIN_DENIED'});
});
test('login reset is reported before any video or FFmpeg startup; no raw credentials appear in status',async()=>{
 const client=new XtreamClient({fetcher:async()=>{throw Object.assign(Error('private-user private-password'),{code:'ECONNRESET'});}});
 const engine=new MediaEngine({client});
 try{await assert.rejects(engine.start(source),{code:'XTREAM_LOGIN_RESET'});const status=engine.status();assert.equal(status.code,'XTREAM_LOGIN_RESET');assert.equal(status.channels_receiving,0);assert.ok(!JSON.stringify(status).includes('password'));}finally{await engine.close();}
});
test('engine control uses bounded JSON and preserves an explicit login failure instead of reporting generic source unavailable',async()=>{
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url)=>{assert.match(url,/\/engine\/start$/);return Response.json({ok:false,code:'XTREAM_LOGIN_RESET'});};
  const transport=await bridgeUpstream({url:'https://test.trycloudflare.com',secret:'a'.repeat(64)},s=>new URL(s),'b'.repeat(64));
  await assert.rejects(transport(source,new AbortController().signal,null,{xtream:true}),{code:'PC_XTREAM_LOGIN_RESET'});
 }finally{globalThis.fetch=old;}
});
test('FFmpeg receives live video/audio through a pipe and serves decodable HLS through the authenticated bridge', {timeout:25000},async t=>{
 if(spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).status!==0){t.skip('FFmpeg is required for integration media test');return;}
 let opens=0,generator;
 const client={login:async()=>({account:{active:true,connections:0,limit:1,formats:['ts']}}),openTs:async(_login,signal)=>{
  opens++;
  generator=spawn('ffmpeg',['-hide_banner','-loglevel','error','-re','-f','lavfi','-i','testsrc2=size=320x180:rate=25','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-c:v','libx264','-preset','ultrafast','-threads','1','-g','50','-c:a','aac','-f','mpegts','pipe:1'],{stdio:['ignore','pipe','ignore']});
  signal.addEventListener('abort',()=>generator.kill('SIGKILL'),{once:true});return {response:generator.stdout,url:source};
 }};
 const engine=new MediaEngine({client,idleMs:20000,readyMs:17000}),secret='a'.repeat(64),server=createBridge({secret,engine});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,headers={Authorization:'Bearer '+secret,'Content-Type':'application/json'};
 try{
  assert.equal((await fetch(base+'/engine/status')).status,401);
  const control=await fetch(base+'/engine/start',{method:'POST',headers,body:JSON.stringify({url:source,owner:'b'.repeat(64)})});const data=await control.json();assert.equal(data.ok,true,JSON.stringify(data));assert.ok(data.manifest.includes('#EXTINF:'));assert.equal(new URL(data.base).origin,ENGINE_ORIGIN);assert.ok(!JSON.stringify(data).includes('provider.example'));
  const duplicate=await engine.start(source,'b'.repeat(64));assert.equal(duplicate.base,data.base);assert.equal(opens,1);
  await assert.rejects(engine.start(source.replace('152812','152813'),'c'.repeat(64)),{code:'ENGINE_BUSY'});
  const segment=data.manifest.split('\n').find(x=>/^seg\d+\.ts$/.test(x));assert.ok(segment);
  const media=await fetch(base+'/fetch',{method:'POST',headers,body:JSON.stringify({url:new URL(segment,data.base).href})});assert.equal(media.status,200);const bytes=Buffer.from(await media.arrayBuffer());assert.ok(bytes.length>10000);assert.equal(bytes[0],71);assert.equal(bytes[188],71);
  // Real decoder validation: the transport packets must contain both image/audio.
  const probe=spawnSync('ffprobe',['-v','error','-f','mpegts','-show_entries','stream=codec_name,codec_type','-of','json','pipe:0'],{input:bytes,maxBuffer:1000000});assert.equal(probe.status,0);const streams=JSON.parse(probe.stdout).streams;assert.ok(streams.some(s=>s.codec_name==='h264'));assert.ok(streams.some(s=>s.codec_name==='aac'));
  const realFetch=globalThis.fetch,key=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),id='11111111-1111-5111-8111-111111111111',gateway='https://nplay-live-gateway.luandersonjesussantos063.workers.dev',safe=gateway+'/live/'+id+'/index.m3u8';
  const cipher=await encryptBridge({url:'https://test.trycloudflare.com',secret},key);
  try{
   globalThis.fetch=async(url,options)=>{
    if(String(url).includes('novaplay_live_embeds'))return Response.json([{embed_url:safe}]);
    if(String(url).includes('novaplay_featured'))return Response.json([{pc_bridge_config:cipher}]);
    assert.ok(String(url).startsWith('https://test.trycloudflare.com/'));return realFetch(String(url).replace('https://test.trycloudflare.com',base),options);
   };
   const env={HLS_MEDIA_KEY:key,LIVE_SOURCES:{get:async()=>({url:source})}};
   const response=await worker.fetch(new Request(safe+'?access_token=viewer'),env);assert.equal(response.status,200);const manifest=await response.text();assert.ok(!manifest.includes(ENGINE_ORIGIN));assert.ok(!manifest.includes('provider.example'));assert.ok(!manifest.includes('user/pass'));assert.equal(response.headers.has('X-NPlay-Upstream-Url'),false);
   const resource=manifest.split('\n').find(x=>x.startsWith(gateway+'/live/'));assert.ok(resource);
   const delivered=await worker.fetch(new Request(resource),env);assert.equal(delivered.status,200);assert.equal(new Uint8Array(await delivered.arrayBuffer())[0],71);assert.equal(opens,1);
  }finally{globalThis.fetch=realFetch;}
  const status=await(await fetch(base+'/engine/status',{headers})).json();assert.equal(status.stage,'playing');assert.ok(status.bytes_received>0);assert.equal(status.channels_receiving,1);
  for(const path of ['../../etc/passwd','seg000000000.ts?x=1'])await assert.rejects(engine.asset(data.base.replace('index.m3u8',path)),{code:'ENGINE_ASSET_GONE'});
  await engine.close();assert.equal(engine.status().channels_receiving,0);
 }finally{await engine.close();generator?.kill('SIGKILL');server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('Xtream grade inspection returns categories, channel and decoded EPG without source credentials',async()=>{
 const client=new XtreamClient({fetcher:async(url)=>{const u=new URL(url),action=u.searchParams.get('action');let body;
 if(!action)body={user_info:{auth:1,status:'Active',active_cons:1,max_connections:1,allowed_output_formats:['ts']}};
 else if(action==='get_live_categories')body=[{category_id:1,category_name:'Documentários'}];
 else if(action==='get_live_streams')body=[{stream_id:152812,name:'Discovery',direct_source:'http://secret.example/user/pass'}];
 else body={epg_listings:[{title:Buffer.from('Programa de teste').toString('base64'),start:'2026-10-16 18:00:00'}]};
 return {url,response:reply(body)};}});
 const info=await client.inspect(source,new AbortController().signal);assert.equal(info.channel_count,1);assert.equal(info.categories[0].name,'Documentários');assert.equal(info.epg[0].title,'Programa de teste');assert.ok(!JSON.stringify(info).includes('secret.example'));assert.ok(!JSON.stringify(info).includes('password'));
});
