import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
vm.runInThisContext(read('admin/m3u-core.js'));
vm.runInThisContext(read('admin/signal-test.js'));
const core=globalThis.NPlayM3u;
test('M3U preserves names, quoted commas, logos, categories and collapsed entries',()=>{
 const list='#EXTM3U#EXTINF:-1 tvg-logo="https://example.org/a.png" group-title="Notícias, Brasil",Canal, SPhttps://example.org/a.m3u8#EXTINF:-1 tvg-name="Canal B",\nhttps://example.org/b.m3u';
 const parsed=core.parseList(list);
 assert.equal(parsed.entries.length,2);assert.equal(parsed.entries[0].title,'Canal, SP');assert.equal(parsed.entries[0].category,'Notícias, Brasil');assert.equal(parsed.entries[0].logo_url,'https://example.org/a.png');assert.equal(parsed.entries[1].title,'Canal B');assert.equal(parsed.entries[1].unsupported,false);
});
test('M3U handles more than 100 entries, reports 500 cap and duplicates',()=>{
 const list=Array.from({length:505},(_,i)=>`#EXTINF:-1,Canal ${i}\nhttps://example.org/${i}.m3u8`).join('\n');
 const result=core.parseList(list+'\n#EXTINF:-1,Repetido\nhttps://example.org/0.m3u8#fragment');
 assert.equal(result.entries.length,500);assert.equal(result.total,505);assert.equal(result.truncated,5);assert.equal(result.duplicates,1);
 assert.equal(core.parseList(list,600).entries.length,505);
});
test('plain lists preserve channel names, commas in URLs and skip comments',()=>{
 const parsed=core.parseList('# Lista\nPremiere Clubes SD\nhttp://example.org/a.m3u8?channels=1,2\n\nCanal B\nhttps://example.org/b.m3u8');
 assert.equal(parsed.entries.length,2);assert.equal(parsed.invalid,0);
 assert.equal(parsed.entries[0].title,'Premiere Clubes SD');assert.equal(parsed.entries[0].url,'http://example.org/a.m3u8?channels=1,2');
 assert.equal(parsed.entries[1].title,'Canal B');
 assert.equal(core.parseList('https://example.org/a.m3u8?channels=1,2').entries[0].title,'Canal 1');
});
test('files above 2 MB load and every batch remains accessible without overlap',()=>{
 const list=Array.from({length:10001},(_,i)=>`#EXTINF:-1 group-title="${'a'.repeat(180)}",Canal ${i}\nhttps://example.org/${i}.m3u8`).join('\n');
 assert.ok(list.length>2*1024*1024);
 const first=core.parseList(list),second=core.parseList(list,500,500),last=core.parseList(list,500,10000);
 assert.equal(first.total,10001);assert.equal(first.entries.length,500);assert.equal(second.entries.length,500);
 assert.equal(first.entries[499].title,'Canal 499');assert.equal(second.entries[0].title,'Canal 500');
 assert.equal(last.entries.length,1);assert.equal(last.entries[0].title,'Canal 10000');assert.equal(last.truncated,0);
 assert.throws(()=>core.parseList(list,500,-1),/Lote inválido/);
});
test('background reader returns only the requested batch and reports invalid files',async()=>{
 let response;
 const context=vm.createContext({URL,Set,self:{postMessage:value=>response=value},importScripts:()=>{}});
 vm.runInContext(read('admin/m3u-core.js'),context);
 vm.runInContext(read('admin/m3u-worker.js'),context);
 const list=Array.from({length:1001},(_,i)=>`#EXTINF:-1,Canal ${i}\nhttps://example.org/${i}.m3u8`).join('\n');
 await context.self.onmessage({data:{file:{size:list.length,text:async()=>list},offset:500}});
 assert.equal(response.result.total,1001);assert.equal(response.result.entries.length,500);assert.equal(response.result.entries[0].title,'Canal 500');
 await context.self.onmessage({data:{file:{size:core.MAX_LIST_BYTES+1,text:()=>{throw Error('must not read');}},offset:0}});
 assert.match(response.error,/100 MB/);
});
test('URL validation, HTTPS, gateway and unsupported formats',()=>{
 assert.throws(()=>core.url('javascript:alert(1)'));assert.throws(()=>core.url('https://user:password@example.org/live'));
 assert.throws(()=>core.playable('http://example.org/live.m3u8'),/HTTPS/);
 assert.match(core.playable('http://95.211.149.215:8081/look/sptv/playlist.m3u8'),/^https:\/\/nplay-sptv/);
 const items=core.parseList('https://example.org/video.mp4\nhttps://example.org/hls?token=123').entries;
 assert.equal(items[0].unsupported,true);assert.equal(items[1].url,'https://example.org/hls?token=123');
 assert.throws(()=>core.parseList('x'.repeat(core.MAX_LIST_BYTES+1)),/100 MB/);
});
class Video extends EventTarget{
 readyState=3;videoWidth=1280;videoHeight=720;currentTime=0;paused=true;cleaned=false;
 canPlayType(){return 'maybe';}
 play(){this.paused=false;return Promise.resolve();}
 pause(){this.paused=true;}
 removeAttribute(name){if(name==='src')delete this.src;}
 load(){this.cleaned=true;}
 tick(time){this.currentTime=time;this.dispatchEvent(new Event('timeupdate'));}
}
test('actual video advancement is required; success releases media',async()=>{
 const video=new Video(),promise=NPlaySignal.testSignal(video,'https://example.org/live',{timeout:1000});
 video.tick(100);video.tick(101);video.tick(102.1);
 const info=await promise;assert.equal(info.width,1280);assert.ok(info.seconds>=2);assert.equal(video.paused,true);assert.equal(video.cleaned,true);assert.equal(video.src,undefined);
});
test('manifest or audio-only playback cannot pass',async()=>{
 const video=new Video();video.videoWidth=0;
 const promise=NPlaySignal.testSignal(video,'https://example.org/live',{timeout:15});
 video.tick(0);video.tick(2);video.tick(4);await assert.rejects(promise,/Nenhum vídeo/);assert.equal(video.cleaned,true);
});
test('cancellation and media errors reject and release resources',async()=>{
 const control=new AbortController(),video=new Video();
 const promise=NPlaySignal.testSignal(video,'https://example.org/live',{signal:control.signal});control.abort();
 await assert.rejects(promise,{name:'AbortError'});assert.equal(video.cleaned,true);
 const failed=new Video(),other=NPlaySignal.testSignal(failed,'https://example.org/live');failed.dispatchEvent(new Event('error'));await assert.rejects(other,/não conseguiu/);
});
test('fatal HLS error destroys the HLS instance',async()=>{
 const video=new Video();video.canPlayType=()=>'';let instance;
 globalThis.Hls=class{static isSupported=()=>true;static Events={ERROR:'error',MANIFEST_PARSED:'manifest'};constructor(){instance=this;this.events={};}on(e,fn){this.events[e]=fn;}attachMedia(){}loadSource(){}destroy(){this.destroyed=true;}};
 const promise=NPlaySignal.testSignal(video,'https://example.org/live');instance.events.error(null,{fatal:true,response:{code:403}});
 await assert.rejects(promise,/403/);assert.equal(instance.destroyed,true);delete globalThis.Hls;
});
test('publishing rejects failed and expired tests and upserts approved metadata',async()=>{
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);};let payload,options,calls=0;
 const context=vm.createContext({document:{getElementById:get},URL,Date,Set,console});
 const code=read('admin/live-embeds.js').replace(/if\(document.readyState==='loading'\)[\s\S]*?\n\}\)\(\);\s*$/, `globalThis.lab={publishItem,fresh,setDb:value=>db=value};\n})();`);
 vm.runInContext(code,context);const lab=context.lab;
 lab.setDb({from:()=>({upsert:async(p,o)=>{calls++;payload=p;options=o;return {error:null};}})});
 await assert.rejects(lab.publishItem({state:'failed'}),/Teste/);
 await assert.rejects(lab.publishItem({state:'passed',testedAt:new Date(Date.now()-31*60000).toISOString()}),/Teste/);assert.equal(calls,0);
 const item={state:'passed',testedAt:new Date().toISOString(),title:'Canal A',playbackUrl:'https://example.org/live',logo_url:'https://example.org/logo.png',category:'Notícias'};
 await lab.publishItem(item);assert.equal(calls,1);assert.equal(options.onConflict,'embed_url');assert.equal(payload.stream_type,'hls');assert.equal(payload.logo_url,item.logo_url);assert.equal(payload.category,'Notícias');assert.equal(item.published,true);assert.equal(payload.is_published,true);
});
test('public player routes explicit and inferred HLS to cinema HLS entry point',()=>{
 const code=read('live-embeds.js').match(/function openChannel\(item\)\{[\s\S]*?\n\}/)[0];let calls=[];
 const context=vm.createContext({console,livePreviews:{stop:()=>{}},window:{NovaPlayPlayer:{openHls:(...args)=>{calls.push(['hls',...args]);return true;},openEmbed:(...args)=>{calls.push(['iframe',...args]);return true;}}}});vm.runInContext(code,context);
 context.openChannel({embed_url:'https://example.org/live',title:'A',stream_type:'hls'});context.openChannel({embed_url:'https://example.org/list.m3u?x=1',title:'B'});context.openChannel({embed_url:'https://example.org/embed',title:'C'});
 assert.deepEqual(calls.map(x=>x[0]),['hls','hls','iframe']);
});
test('TV grade reads published channels only and never restores the fixed provider list',async()=>{
 const source=read('live-embeds.js');
 const load=source.slice(source.indexOf('async function load(){'),source.indexOf('function renderChannels(channels){'));
 let result,notice,filter,failed=false;
 const client={from:()=>({select:()=>({eq:(field,value)=>{filter=[field,value];return {order:async()=>failed?{error:Error('offline')}:{data:[{title:'Aprovado',embed_url:'https://example.org/live'}]}};}})})};
 const context=vm.createContext({$:()=>({}),loadSequence:0,note:message=>notice=message,renderChannels:rows=>result=rows,window:{supabase:{createClient:()=>client}},fetch:()=>{throw Error('Provider must not auto-publish');},Error});
 vm.runInContext(load,context);await context.load();assert.deepEqual(filter,['is_published',true]);assert.equal(result.length,1);assert.equal(result[0].title,'Aprovado');
 failed=true;await context.load();assert.equal(result.length,0);assert.match(notice,/Não foi possível/);assert.equal(source.includes('CHANNEL_SNAPSHOT'),false);assert.equal(source.includes('fetch('),false);
});
test('live playback prefers managed HLS and registers autoplay before loading a manifest',()=>{
 const app=read('app.js'),start=app.indexOf(' function startSource(){');
 const code=app.slice(start,app.indexOf(' if(media.youtube_id){',start));
 let loaded,played=0,nativeSrc,attached=false,instance;
 class Hls{static isSupported=()=>true;static Events={ERROR:'error',MANIFEST_PARSED:'manifest'};static ErrorTypes={NETWORK_ERROR:'network'};constructor(){instance=this;this.handlers={};}destroy(){this.destroyed=true;}on(e,fn){this.handlers[e]=fn;}attachMedia(){attached=true;}loadSource(url){assert.equal(attached,true);loaded=url;assert.equal(typeof this.handlers.manifest,'function');this.handlers.manifest();}}
 const video={canPlayType:()=>true,set src(value){nativeSrc=value;}};
 const context=vm.createContext({window:{Hls},seq:1,attempt:1,src:'https://example.org/live.m3u8',media:{mode:'hls'},item:{kind:'tv'},v:video,hls:null,networkRecoveries:0,fail:message=>{throw Error(message)},playerStatus:()=>{},startAutoplay:()=>played++});
 vm.runInContext(code,context);context.startSource();assert.equal(nativeSrc,undefined);assert.equal(loaded,'https://example.org/live.m3u8');assert.equal(played,1);
 instance.handlers.error(null,{fatal:true,type:'network'});assert.equal(instance.destroyed,true);assert.equal(nativeSrc,loaded);assert.equal(played,2);
 Hls.isSupported=()=>false;context.startSource();assert.equal(nativeSrc,loaded);assert.equal(played,3);
});
test('admin separates new HLS, legacy provider and individual channels with status/search filters',()=>{
 const source=read('admin/live-embeds.js').replace(/if\(document.readyState==='loading'\)[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.groups={channelGroup,filterChannels};\n})();`);
 const context=vm.createContext({document:{getElementById:()=>null},URL,Date,Set});vm.runInContext(source,context);
 const {channelGroup,filterChannels}=context.groups;
 const records=[{title:'Família',category:'Pública',stream_type:'hls',embed_url:'https://example.org/live',is_published:true},{title:'Novo rascunho',embed_url:'https://example.org/live.m3u8',is_published:false},{title:'Antigo',stream_type:'iframe',embed_url:'https://rdcanais.org/gloob',is_published:false},{title:'Oficial',stream_type:'iframe',embed_url:'https://owncast.al.mt.gov.br/embed/video',is_published:true}];
 assert.deepEqual(records.map(channelGroup),['m3u','m3u','legacy','individual']);
 assert.equal(filterChannels(records,'m3u','all','').length,2);assert.equal(filterChannels(records,'m3u','published','familia')[0].title,'Família');assert.equal(filterChannels(records,'m3u','draft','').length,1);assert.equal(filterChannels(records,'legacy','all','')[0].title,'Antigo');assert.equal(filterChannels(records,'individual','all','')[0].title,'Oficial');
 assert.equal(channelGroup({embed_url:'https://rdcanais.org.example.net/embed'}),'individual');
 assert.equal(filterChannels(records,'m3u','published','publica').length,1);
});

test('live channel search matches accented titles and multiple category words without changing publication data',()=>{
 const source=read('live-embeds.js');
 const helper=source.slice(source.indexOf('function filterLiveChannels('),source.indexOf('function renderChannels('));
 const context=vm.createContext({});vm.runInContext(helper,context);
 const rows=[{title:'TV Educação',category:'Pública'},{title:'TV Brasil',category:'Pública'},{title:'Cultura Pará',category:'Educação'}];
 assert.equal(context.filterLiveChannels(rows,'educacao publica')[0].title,'TV Educação');
 assert.equal(context.filterLiveChannels(rows,'  BRASIL  ').length,1);
 assert.equal(context.filterLiveChannels(rows,'inexistente').length,0);
 assert.equal(context.filterLiveChannels(rows,'').length,3);assert.equal(rows.length,3);
});
