import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const id='00142c6f-bb22-5f18-8e42-4d852d8d7c00',key='novaplay-favorites-v2';
function setup(storage=new Map()){
 const handlers={},events=[],messages=[],button={hidden:true,setAttribute(k,v){this[k]=v;}};
 const item={id:'channel-'+id,title:'Canal A',kind:'tv',liveRecord:{id,embed_url:'https://example.org/live.m3u8'}};
 const context=vm.createContext({console,URL,CustomEvent:class{constructor(type){this.type=type;}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},window:{addEventListener:(type,fn)=>handlers[type]=fn,dispatchEvent:event=>events.push(event.type)},$:()=>button,toast:m=>messages.push(m),icon:()=>'<svg/>',refreshFavoriteButton(){},renderCategory(){},renderRows(){},play(item){context.played=item;}});
 const helpers=app.slice(app.indexOf('function favoriteId('),app.indexOf('const searchText='));
 const functions=app.slice(app.indexOf('function favLabel('),app.indexOf('function progressItem('));
 vm.runInContext(`const favKey='${key}'; function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};const all=[];const map=new Map();let current=null,selected=null,view='tv';${helpers}${functions};globalThis.lab={favoriteId,isFavorite,favoriteItems,toggleFavorite,refreshPlayerFavorite,add:item=>{all.push(item);map.set(item.id,item)},watch:item=>{current={item};refreshPlayerFavorite()}};`,context);
 context.lab.add(item);context.lab.add({id:'live-'+id,title:'Canal A',kind:'tv'});
 return {context,lab:context.lab,storage,handlers,events,messages,button,item};
}
test('home, grid, player and old saved channel aliases share a single favorite after reload',()=>{
 const storage=new Map([[key,JSON.stringify(['live-'+id,'channel-'+id])]]),s=setup(storage);
 assert.equal(s.lab.isFavorite(id),true);assert.equal(s.lab.favoriteItems().length,1);
 assert.equal(s.lab.toggleFavorite(s.item),true);assert.deepEqual(JSON.parse(storage.get(key)),[]);
 assert.equal(s.lab.toggleFavorite({id:'live-'+id}),true);
 assert.deepEqual(JSON.parse(storage.get(key)),['channel-'+id]);
 assert.equal(setup(storage).lab.isFavorite('channel-'+id),true);
});
test('saving before a channel finishes loading is persistent instead of silently ignored',()=>{
 const s=setup();assert.equal(s.lab.toggleFavorite({id:'channel-another-channel'}),true);
 assert.equal(setup(s.storage).lab.isFavorite('channel-another-channel'),true);
});
test('player heart saves and removes the current channel without opening or closing playback',()=>{
 const s=setup();s.lab.watch(s.item);assert.equal(s.button.hidden,false);assert.equal(s.button['aria-pressed'],'false');
 s.button.onclick();assert.equal(s.button['aria-pressed'],'true');assert.equal(s.lab.isFavorite(id),true);
 s.button.onclick();assert.equal(s.button['aria-pressed'],'false');assert.equal(s.lab.isFavorite(id),false);
 assert.deepEqual(s.events,['nplay:favorites-change','nplay:favorites-change']);
});
test('storage errors do not pretend that a favorite was saved; other tabs synchronize the heart',()=>{
 const s=setup();s.lab.watch(s.item);s.context.localStorage.setItem=()=>{throw Error('quota');};
 assert.equal(s.lab.toggleFavorite(s.item),false);assert.equal(s.lab.isFavorite(id),false);assert.match(s.messages[0],/Não foi possível/);
 s.storage.set(key,JSON.stringify(['channel-'+id]));s.handlers.storage({key});assert.equal(s.button['aria-pressed'],'true');
 s.storage.clear();s.handlers.storage({key:null});assert.equal(s.button['aria-pressed'],'false');
});
test('authorized HLS playback keeps the catalog ID and never uses a session URL as favorite identity',()=>{
 const s=setup();vm.runInContext(app.slice(app.indexOf('function liveFavoriteItem('),app.indexOf('function openLiveEmbed('))+app.slice(app.indexOf('function openLiveHls('),app.indexOf('window.NPlayLiveCatalog=')),s.context);
 s.context.openLiveHls('https://example.org/live.m3u8?access_token=private&viewer=temporary','Canal A','hls',false,{id});
 assert.equal(s.context.played.id,'channel-'+id);assert.equal(s.context.played.mode,'hls');
 s.lab.toggleFavorite(s.context.played);assert.equal(s.storage.get(key).includes('private'),false);
});
