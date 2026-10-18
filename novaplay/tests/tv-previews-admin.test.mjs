import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../admin/tv-previews.js',import.meta.url),'utf8');
function boot(){const calls=[];const context=vm.createContext({URL,Date,Set,Map,JSON,DOMException,setTimeout,document:{getElementById:()=>null},window:{NPlayLiveAuth:{authorize:async (url,options)=>{calls.push(['authorize',url,options]);return url+'?viewer=private';},release:url=>calls.push(['release',url]),waitForRelease:async()=>{}}}});vm.runInContext(source,context);return {core:context.window.NPlayTvPreviewAdmin,calls};}
const item={id:'00142c6f-bb22-5f18-8e42-4d852d8d7c00',title:'Canal A',embed_url:'https://media.example/live.m3u8',stream_type:'hls',is_published:true};
test('only a current moving-image confirmation for the exact published HLS source enables adding it',()=>{
 const {core}=boot();const now=Date.now(),proof={at:now,url:item.embed_url};
 assert.equal(core.canAdd(item,proof,now),true);assert.equal(core.canAdd(item,null,now),false);
 assert.equal(core.canAdd(item,{...proof,at:now-25*60*60000},now),false);
 assert.equal(core.canAdd({...item,embed_url:'https://other.example/live.m3u8'},proof,now),false);
 assert.equal(core.canAdd({...item,is_published:false},proof,now),false);
 assert.equal(core.eligible({...item,embed_url:'http://media.example/a.m3u8'}),false);
});
test('a real-format preview test authorizes, requires two seconds of image and always releases the viewer',async()=>{
 const {core,calls}=boot();let input;
 const proof=await core.verify({},item,{test:async(v,url,options)=>{input={url,options};return {width:640,height:360,seconds:2.5};}});
 assert.equal(proof.url,item.embed_url);assert.equal(input.options.audioOnly,false);assert.equal(input.options.seconds,2);assert(input.url.includes('viewer=private'));
 assert.equal(calls.filter(c=>c[0]==='release').length,1);
 await assert.rejects(core.verify({},item,{test:async()=>({width:0,height:0,seconds:10})}),/imagem em movimento/);
 await assert.rejects(core.verify({},item,{test:async()=>{throw Error('Sinal indisponível');}}),/indisponível/);
 assert.equal(calls.filter(c=>c[0]==='release').length,3);
});
test('saving touches only the preview selection and refuses false successes or denied writes',async()=>{
 const {core}=boot();let table,payload,filter;
 const client={from:t=>{table=t;return {update:p=>{payload=p;return {eq:(...args)=>{filter=args;return {select:()=>({single:async()=>({data:{tv_spotlight_ids:p.tv_spotlight_ids},error:null})})};}};}};}};
 const ids=[item.id];await core.persist(client,ids);assert.equal(table,'novaplay_featured');assert.deepEqual(Object.keys(payload),['tv_spotlight_ids']);assert.deepEqual(filter,['id',1]);
 const denied={from:()=>({update:()=>({eq:()=>({select:()=>({single:async()=>({data:null,error:Error('RLS denied')})})})})})};
 await assert.rejects(core.persist(denied,ids),/RLS denied/);await assert.rejects(core.persist(client,[...ids,...ids]),/diferentes/);
 const missing={from:()=>({update:()=>({eq:()=>({select:()=>({single:async()=>({data:{tv_spotlight_ids:[]},error:null})})})})})};
 await assert.rejects(core.persist(missing,ids),/confirmar o salvamento/);
});
test('admin controls and mobile header spacing are integrated into the published interfaces',()=>{
 const admin=readFileSync(new URL('../admin/index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../assets/tv-spotlight.css',import.meta.url),'utf8');
 for(const id of ['tv-preview-admin','tv-preview-search','tv-preview-selected','tv-preview-save','tv-preview-video','tv-preview-test-all','tv-preview-filter','tv-preview-progress'])assert(admin.includes('id="'+id+'"'));
 assert(admin.includes('tv-previews.js?v=0.51.19'));assert(css.includes('padding-top:calc(130px + env(safe-area-inset-top,0px))'));
});

test('batch tests sequentially, reuses identical sources and reports failures without auto selecting',async()=>{
 const {core}=boot();const rows=[item,{...item,id:'duplicate'},{...item,id:'bad',embed_url:'https://bad.example/a.m3u8'}];
 let active=0,max=0,calls=0;const results=[],progress=[];
 const summary=await core.scan(rows,{check:async channel=>{calls++;active++;max=Math.max(active,max);await Promise.resolve();active--;if(channel.id==='bad')throw Error('offline');return {url:channel.embed_url,at:Date.now()};},onResult:(channel,result)=>results.push([channel.id,!!result.proof]),onProgress:value=>progress.push(value.done)});
 assert.equal(max,1);assert.equal(calls,2);assert.equal(summary.done,3);assert.equal(summary.passed,2);assert.equal(summary.failed,1);assert.equal(summary.stopped,false);assert.deepEqual(results,[[item.id,true],['duplicate',true],['bad',false]]);assert.equal(progress.at(-1),3);
});
test('stopping a batch keeps completed results and never marks an interrupted preview as failed',async()=>{
 const {core}=boot();const signal={aborted:false};let calls=0;const results=[];
 const summary=await core.scan([item,{...item,id:'second',embed_url:'https://second.example/a.m3u8'}, {...item,id:'third'}],{signal,check:async channel=>{calls++;if(calls===2){signal.aborted=true;throw new DOMException('Stopped','AbortError');}return {url:channel.embed_url,at:Date.now()};},onResult:channel=>results.push(channel.id)});
 assert.equal(calls,2);assert.equal(summary.done,1);assert.equal(summary.failed,0);assert.equal(summary.stopped,true);assert.deepEqual(results,[item.id]);
});

test('same-account auth notifications during authorization never interrupt the running batch',async()=>{
 const {core}=boot();let listener,invalidations=0;const signal={aborted:false};
 const client={auth:{onAuthStateChange:fn=>{listener=fn;}}};
 core.watchAuth(client,{getUserId:()=> 'admin-a',onInvalidate:()=>{invalidations++;signal.aborted=true;},onReady:()=>{throw Error('Must not reload confirmed results');}});
 const summary=await core.scan([item,{...item,id:'second',embed_url:'https://second.example/a.m3u8'}],{signal,check:async channel=>{
  for(const event of ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'])listener(event,{user:{id:'admin-a'}});
  await new Promise(resolve=>setTimeout(resolve,5));return {url:channel.embed_url,at:Date.now()};
 }});
 assert.equal(invalidations,0);assert.equal(summary.done,2);assert.equal(summary.passed,2);assert.equal(summary.stopped,false);
 listener('SIGNED_IN',{user:{id:'admin-b'}});await new Promise(resolve=>setTimeout(resolve,5));assert.equal(invalidations,1);
 listener('SIGNED_OUT',null);await new Promise(resolve=>setTimeout(resolve,5));assert.equal(invalidations,2);
});
test('preview verification passes the existing admin client to the gateway authorization helper',async()=>{
 const {core,calls}=boot();const client={auth:{}};
 await core.verify({},item,{client,test:async()=>({width:640,height:360,seconds:2})});
 assert.equal(calls.find(call=>call[0]==='authorize')[2].client,client);
});
test('live authorization reuses the supplied client without creating another auth subscription',async()=>{
 const code=readFileSync(new URL('../assets/live-auth.js',import.meta.url),'utf8');let sessions=0,refreshes=0;
 const client={auth:{getSession:async()=>{sessions++;return {data:{session:{access_token:'test-token',expires_at:Date.now()/1000+3600}}};},refreshSession:async()=>{refreshes++;throw Error('unexpected refresh');}}};
 const context=vm.createContext({URL,Date,Set,Promise,setTimeout,clearTimeout,crypto:{randomUUID:()=> 'viewer-unique'},window:{supabase:{createClient:()=>{throw Error('Must reuse existing admin client');}}}});vm.runInContext(code,context);
 const url=await context.window.NPlayLiveAuth.authorize('https://nplay-live-gateway.luandersonjesussantos063.workers.dev/live/00142c6f-bb22-5f18-8e42-4d852d8d7c00/index.m3u8',{client});
 assert.equal(sessions,1);assert.equal(refreshes,0);assert.equal(new URL(url).searchParams.get('access_token'),'test-token');
});
