import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
function setup(records,group,{deny=[],sharedFailure=false}={}){
 const elements=new Map(),writes=[];
 const node=()=>({style:{},value:'',checked:false,textContent:'',append(){},replaceChildren(){},setAttribute(){},remove(){},focus(){}});
 const get=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id);};get('live-channel-status').value='draft';
 const db={from:()=>({select:()=>{const query={order:()=>query,range:async(start,end)=>({data:records.slice(start,end+1)})};return query;},update:payload=>{
  const result=ids=>({select:async()=>{const data=[];for(const item of records)if(ids.includes(item.id)&&!deny.includes(item.id)){Object.assign(item,payload);writes.push(item.id);data.push({id:item.id});}return {data};}});
  return {in:(_,ids)=>result(ids),eq:(_,id)=>result([id])};
 }})};
 const context=vm.createContext({document:{getElementById:get,createElement:node},URL,Date,Set,AbortController,NPlayM3u:{playable:x=>x},NPlaySignal:{testSource:async(_,url)=>{if(sharedFailure){const error=Error('Acesso ao servidor recusado');error.sharedFailure=true;throw error;}if(url.includes('bad'))throw Error('Sinal indisponível');return {playbackUrl:url};}}});
 let source=readFileSync(new URL('../admin/live-embeds.js',import.meta.url),'utf8');
 source=source.replace(/if\(document.readyState==='loading'\)[\s\S]*?\n\}\)\(\);\s*$/,`globalThis.lab={unpublishSaved,publishSaved,selectedSaved,refresh,savedVisible,count:()=>savedChannels.length,setup:(client,items,group)=>{db=client;savedChannels=items;selectedChannelGroup=group;}};\n})();`);
 vm.runInContext(source,context);context.lab.setup(db,records,group);return {lab:context.lab,writes,get};
}
const item=(id,group,published=false)=>({id,title:id,embed_url:group==='legacy'?'https://rdcanais.org/'+id:'https://example.org/'+id+'.m3u8',stream_type:group==='legacy'?'iframe':'hls',rights_confirmed:true,is_published:published});
test('selected draft publication stays within current origin/status/selection',async()=>{
 const records=[item('a','legacy'),item('b','legacy'),item('published','legacy',true),item('other','m3u')];const {lab,writes}=setup(records,'legacy');
 lab.selectedSaved.add('a');lab.selectedSaved.add('published');lab.selectedSaved.add('other');await lab.publishSaved(true);
 assert.deepEqual(writes,['a']);assert.equal(records[1].is_published,false);assert.equal(records[3].is_published,false);
});
test('HLS bulk publication requires actual successful signal test and preserves failures as drafts',async()=>{
 const records=[item('good','m3u'),item('bad','m3u')];const {lab,writes,get}=setup(records,'m3u');await lab.publishSaved();
 assert.deepEqual(writes,['good']);assert.equal(records[1].is_published,false);assert.match(get('live-saved-progress').textContent,/1 publicados · 1 não publicados/);
});
test('bulk publication counts only rows returned by the database',async()=>{
 const records=[item('a','legacy'),item('denied','legacy')];const {lab,writes,get}=setup(records,'legacy',{deny:['denied']});await lab.publishSaved();
 assert.deepEqual(writes,['a']);assert.equal(records[1].is_published,false);assert.match(get('live-saved-progress').textContent,/1 publicados · 1 não publicados/);
});

test('a shared gateway failure pauses the batch without marking every remaining channel as failed',async()=>{
 const records=Array.from({length:1000},(_,i)=>item('channel-'+i,'m3u'));
 const {lab,writes,get}=setup(records,'m3u',{sharedFailure:true});await lab.publishSaved();
 assert.equal(writes.length,0);assert.match(get('live-saved-progress').textContent,/Lote pausado por falha comum/);assert.match(get('live-saved-progress').textContent,/999 restantes/);assert.ok(records.every(x=>!x.is_published));
});
test('admin pagination retrieves all 2807 saved channels instead of stopping at 1000',async()=>{
 const records=Array.from({length:2807},(_,i)=>item('channel-'+i,'m3u'));
 const {lab,get}=setup(records,'m3u');await lab.refresh();assert.equal(lab.count(),2807);assert.match(get('live-channel-count').textContent,/2807 canais carregados/);
});

test('the new HLS source filter separates the replacement account from prior and other streams',()=>{
 const owned='https://nplay-live-gateway.luandersonjesussantos063.workers.dev/live/';
 const records=[{...item('new','m3u'),embed_url:owned+'new/index.m3u8'},{...item('previous','m3u'),embed_url:owned+'previous/stream.ts',stream_type:'mpegts'},item('other','m3u')];
 const {lab,get}=setup(records,'m3u');get('live-list-family').value='new-hls';assert.deepEqual(Array.from(lab.savedVisible(),x=>x.id),['new']);get('live-list-family').value='previous';assert.deepEqual(Array.from(lab.savedVisible(),x=>x.id),['previous','other']);
});

test('three consecutive playback failures pause a large batch and preserve untested drafts',async()=>{
 const records=Array.from({length:100},(_,i)=>item('bad-'+i,'m3u'));
 const {lab,writes,get}=setup(records,'m3u');await lab.publishSaved();
 assert.equal(writes.length,0);assert.match(get('live-saved-progress').textContent,/3 não publicados · 97 restantes/);assert.match(get('live-saved-progress').textContent,/3 falhas seguidas/);assert.match(get('live-saved-progress').textContent,/Sinal indisponível/);
});

test('removing selected published channels preserves other filters, drafts and saved rows',async()=>{
 const records=[item('a','m3u',true),item('b','m3u',true),item('draft','m3u'),item('other','legacy',true)];
 const {lab,writes,get}=setup(records,'m3u');get('live-channel-status').value='all';lab.selectedSaved.add('a');lab.selectedSaved.add('other');await lab.unpublishSaved(true);
 assert.deepEqual(writes,['a']);assert.equal(records.length,4);assert.equal(records[0].is_published,false);assert.equal(records[1].is_published,true);assert.equal(records[3].is_published,true);
});
test('removing an entire filtered list uses batches beyond 1000 and counts only returned rows',async()=>{
 const records=Array.from({length:1001},(_,i)=>item('channel-'+i,'m3u',true));records.push(item('other','legacy',true));
 const {lab,writes,get}=setup(records,'m3u',{deny:['channel-3']});get('live-channel-status').value='published';await lab.unpublishSaved();
 assert.equal(writes.length,1000);assert.equal(records[3].is_published,true);assert.equal(records.at(-1).is_published,true);assert.match(get('live-saved-progress').textContent,/1 não foram alterados/);
});
