import test from 'node:test';
import assert from 'node:assert/strict';
import {handleIptv,catalogAction,playlist,category} from '../worker/iptv-api.mjs';
import {seal,unseal} from '../worker/hls-relay.mjs';
import worker from '../worker/live-gateway.mjs';
const origin='https://gateway.example',account={ok:true,id:'account',username:'client',expires_at:'2030-01-01T00:00:00Z',max_connections:2,active_connections:0},catalog={ok:true,items:[
 {id:1,kind:'live',ref:'11111111-1111-5111-8111-111111111111',title:'TV & Teste',category:'TV',logo:'https://images.example/logo.png',source_url:'https://private.example/account/secret'},
 {id:2,kind:'vod',ref:'movie',title:'Filme',category:'Ação',description:'Sinopse',r2_key:'private/movie.mp4',duration_seconds:120},
 {id:3,kind:'episode',ref:'ep',title:'Episódio 1',category:'Drama',series_title:'Série',season_number:1,episode_number:1,r2_key:'private/ep.mp4'}
],series:[{id:4,title:'Série'}]};
const env={IPTV_BACKEND_KEY:'private-key',HLS_MEDIA_KEY:Buffer.alloc(32,5).toString('base64url')};
const auth='username=client&password=long-secret-pass';
const validateUrl=s=>new URL(s),upstream=()=>{throw Error('unexpected media');};
async function mocked(run,override){const original=globalThis.fetch;let calls=[];globalThis.fetch=async(raw,options)=>{
 const {p_action:action,p_input:input}=JSON.parse(options.body);calls.push({action,input});
 if(override){const result=await override(action,input);if(result)return result;}
 return Response.json(action==='authenticate'?account:action==='catalog'?catalog:action==='touch'?{ok:true}:action==='start'?{ok:true,session_id:'session',item:catalog.items.find(x=>x.id===input.stream_id),replaced:[]}:{ok:true});};try{await run(calls);}finally{globalThis.fetch=original;}}
test('Xtream login and catalog expose compatibility fields without leaking storage/provider details',async()=>mocked(async()=>{
 const login=await handleIptv(new Request(origin+'/player_api.php?'+auth),env,{}, {validateUrl,upstream});assert.equal((await login.json()).user_info.auth,1);
 for(const action of ['get_live_categories','get_live_streams','get_vod_categories','get_vod_streams','get_series_categories','get_series','get_vod_info','get_series_info']){
 const r=await handleIptv(new Request(origin+'/player_api.php?'+auth+'&action='+action+'&vod_id=2&series_id=4'),env,{}, {validateUrl,upstream});assert.equal(r.status,200,action);const text=await r.text();assert.ok(!text.includes('private.example'));assert.ok(!text.includes('private/movie'));assert.ok(!text.includes('private-key'));
 }
}));
test('series episode IDs, seasons and M3U formats remain stable and contain only NPlay URLs',()=>{
 const info=catalogAction('get_series_info',new URLSearchParams('series_id=4'),catalog);assert.equal(info.episodes[1][0].id,'3');assert.equal(info.seasons[0].episode_count,1);
 const m3u=playlist(catalog,origin,'client','long-secret-pass','hls');assert.match(m3u,/\/live\/client\/long-secret-pass\/1.m3u8/);assert.match(m3u,/\/movie\/client\/long-secret-pass\/2.mp4/);assert.ok(!m3u.includes('private/'));
 assert.equal(catalogAction('get_vod_streams',new URLSearchParams('category_id=missing'),catalog).length,0);
});
test('bad passwords return auth 0 and screen limits do not open media',async()=>{
 await mocked(async()=>{const r=await handleIptv(new Request(origin+'/player_api.php?'+auth),env,{}, {validateUrl,upstream});assert.equal((await r.json()).user_info.auth,0);},async action=>action==='authenticate'?Response.json({ok:false,code:'AUTH'}):null);
 await mocked(async()=>{const r=await handleIptv(new Request(origin+'/live/client/long-secret-pass/1.ts'),env,{}, {validateUrl,upstream});assert.equal(r.status,429);},async action=>action==='start'?Response.json({ok:false,code:'CONNECTION_LIMIT'}):null);
});
test('HLS asset capabilities are encrypted, reject tampering and check current account/session state',async()=>{
 const p={account_id:'account',session_id:'session',owner:'a'.repeat(64),url:'https://media.example/index.m3u8',exp:Date.now()+60000,live:false};
 const token=await seal(JSON.stringify(p),'nplay-iptv-media-v1',env.HLS_MEDIA_KEY);
 await mocked(async calls=>{
  const request=new Request(origin+'/iptv/asset/'+token+'/media.m3u8');const r=await handleIptv(request,env,{}, {validateUrl,upstream:async()=>{const response=new Response('#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\nsegment.ts\n',{headers:{'Content-Type':'application/vnd.apple.mpegurl'}});Object.defineProperty(response,'url',{value:p.url});return response;}});
  assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('media.example'));const resource=text.split('\n').find(x=>x.startsWith(origin));const t=/asset\/([^/]+)/.exec(resource)[1];assert.equal(JSON.parse(await unseal(t,'nplay-iptv-media-v1',env.HLS_MEDIA_KEY)).url,'https://media.example/segment.ts');assert.equal(calls[0].action,'touch');
 });
 await mocked(async()=>{const r=await handleIptv(new Request(origin+'/iptv/asset/'+token+'/media.m3u8'),env,{}, {validateUrl,upstream});assert.equal(r.status,403);},async action=>action==='touch'?Response.json({ok:false,code:'BLOCKED'}):null);
 const r=await handleIptv(new Request(origin+'/iptv/asset/'+token.slice(0,-4)+'abcd/media.m3u8'),env,{}, {validateUrl,upstream});assert.equal(r.status,403);
});
test('R2 VOD supports byte ranges and releases its session when playback completes',async()=>mocked(async calls=>{
 const local={...env,IPTV_VIDEOS:{get:async(key,options)=>{assert.equal(key,'private/movie.mp4');assert.equal(options.range.get('Range'),'bytes=0-3');return {size:100,range:{offset:0,length:4},httpEtag:'"test"',writeHttpMetadata:h=>h.set('Content-Type','video/mp4'),body:new Response(new Uint8Array([1,2,3,4])).body};}}};
 const r=await handleIptv(new Request(origin+'/movie/client/long-secret-pass/2.mp4',{headers:{Range:'bytes=0-3'}}),local,{}, {validateUrl,upstream});assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 0-3/100');assert.equal((await r.arrayBuffer()).byteLength,4);assert.ok(calls.some(x=>x.action==='release'));
}));
test('public IPTV CORS works for native/webview clients while admin API still checks its own permissions',async()=>mocked(async()=>{
 const r=await worker.fetch(new Request(origin+'/player_api.php?'+auth,{headers:{Origin:'http://localhost'}}),env);assert.equal(r.status,200);assert.equal((await r.json()).user_info.auth,1);
 const admin=await worker.fetch(new Request(origin+'/admin/iptv',{headers:{Origin:'http://localhost'}}),env);assert.equal(admin.status,403);
}));
test('XMLTV returns channel identifiers with escaped XML and no invented programmes',async()=>mocked(async()=>{
 const r=await handleIptv(new Request(origin+'/xmltv.php?'+auth),env,{}, {validateUrl,upstream});const text=await r.text();assert.match(text,/TV &amp; Teste/);assert.ok(!text.includes('<programme'));
}));


test('TV applications receive small category IDs and each category returns its actual channels',()=>{
 const groupNames=['INFANTIS','4K & FHDR','GLOBO SUL','BAND','SBT','GLOBO CENTRO-OESTE','TELECINE'];
 const sample={items:groupNames.map((name,index)=>({id:index+20,kind:'live',title:'Exemplo '+name,category:name}))};
 const params=new URLSearchParams();
 const categories=catalogAction('get_live_categories',params,sample);
 const all=catalogAction('get_live_streams',params,sample);
 assert.equal(categories.length,groupNames.length);
 assert.equal(all.length,groupNames.length);
 for(const group of categories){
  const id=Number(group.category_id);
  assert(Number.isSafeInteger(id)&&id>=10000&&id<910000,'small signed-safe category identifier');
  const filtered=catalogAction('get_live_streams',new URLSearchParams({category_id:group.category_id}),sample);
  assert.equal(filtered.length,1,'category '+group.category_name+' must have a channel');
  assert.equal(filtered[0].category_id,group.category_id);
 }
 assert.equal(new Set(categories.map(x=>x.category_id)).size,categories.length);
 assert.equal(category('INFANTIS'),'207441');
 assert.equal(category('4K & FHDR'),'689034');
});

test('previously cached unsigned and negative signed IDs remain usable after category-ID migration',()=>{
 const sample={items:[{id:42,kind:'live',title:'Infantil HD',category:'INFANTIS'},{id:51,kind:'live',title:'SBT HD',category:'SBT'}]};
 for(const legacy of ['3520097441','-774869855']){
  const items=catalogAction('get_live_streams',new URLSearchParams({category_id:legacy}),sample);
  assert.equal(items.length,1);
  assert.equal(items[0].stream_id,42);
  assert.equal(items[0].category_id,category('INFANTIS'));
 }
 assert.equal(catalogAction('get_live_streams',new URLSearchParams({category_id:'-1'}),sample).length,2);
});

test('Xtream login reports secure HTTPS 443 as its primary and HTTPS port',async()=>mocked(async()=>{
 const response=await handleIptv(new Request(origin+'/player_api.php?'+auth),env,{}, {validateUrl,upstream});
 const json=await response.json();
 assert.equal(json.user_info.auth,1);
 assert.equal(json.server_info.server_protocol,'https');
 assert.equal(json.server_info.port,'443');
 assert.equal(json.server_info.https_port,'443');
}));
