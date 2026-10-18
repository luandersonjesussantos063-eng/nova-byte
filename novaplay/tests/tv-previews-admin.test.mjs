import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../admin/tv-previews.js',import.meta.url),'utf8');
function boot(){const calls=[];const context=vm.createContext({URL,Date,Set,Map,JSON,DOMException,document:{getElementById:()=>null},window:{NPlayLiveAuth:{authorize:async url=>{calls.push(['authorize',url]);return url+'?viewer=private';},release:url=>calls.push(['release',url]),waitForRelease:async()=>{}}}});vm.runInContext(source,context);return {core:context.window.NPlayTvPreviewAdmin,calls};}
const item={id:'00142c6f-bb22-5f18-8e42-4d852d8d7c00',title:'Canal A',embed_url:'https://media.example/live.m3u8',stream_type:'hls',is_published:true};
test('only a current moving-image confirmation for the exact published HLS source enables adding it',()=>{
 const {core}=boot();const now=Date.now(),proof={at:now,url:item.embed_url};
 assert.equal(core.canAdd(item,proof,now),true);assert.equal(core.canAdd(item,null,now),false);
 assert.equal(core.canAdd(item,{...proof,at:now-31*60000},now),false);
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
 for(const id of ['tv-preview-admin','tv-preview-search','tv-preview-selected','tv-preview-save','tv-preview-video'])assert(admin.includes('id="'+id+'"'));
 assert(admin.includes('tv-previews.js?v=0.51.14'));assert(css.includes('padding-top:calc(130px + env(safe-area-inset-top,0px))'));
});
