import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../assets/tv-spotlight.js',import.meta.url),'utf8');
function setup({denyAudio=false,pendingAuth=false,mobile=false,autoProgress=true}={}){
 const elements=new Map(),windowEvents={},documentEvents={},instances=[],released=[],authorized=[],events=[],stored=new Map(),timers=new Map();let serial=0,resolveAuth;
 const classes=()=>{const s=new Set();return {add:(...v)=>v.forEach(x=>s.add(x)),remove:(...v)=>v.forEach(x=>s.delete(x)),contains:v=>s.has(v)};};
 class Node{
  constructor(tag='div'){this.tag=tag;this.children=[];this.style={};this.classList=classes();this.attrs={};this.handlers={};this.hidden=false;this.scrollTop=0;this.scrollLeft=0;this.muted=true;this.parentElement=null;}
  setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}addEventListener(k,f){(this.handlers[k]??=[]).push(f);}emit(k,e={}){for(const f of this.handlers[k]||[])f(e);}
  append(...nodes){for(const n of nodes){n.remove?.();n.parentElement=this;this.children.push(n);}}replaceChildren(...n){for(const c of this.children)c.parentElement=null;this.children=[];this.append(...n);}remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}}
  pause(){this.paused=true;}load(){}canPlayType(){return true;}
  play(){if(denyAudio&&!this.muted){denyAudio=false;return Promise.reject(Object.assign(Error('autoplay'),{name:'NotAllowedError'}));}this.paused=false;this.emit('playing');let ancestor=this;while(ancestor){if(ancestor.hidden)return Promise.resolve();ancestor=ancestor.parentElement;}if(!this.progressed&&autoProgress){this.progressed=true;this.videoWidth=640;this.videoHeight=360;this.readyState=3;for(let i=0;i<=3;i++){this.currentTime=i;this.emit('timeupdate');}}return Promise.resolve();}
  getBoundingClientRect(){
   if(this.hidden)return {left:0,top:0,right:0,bottom:0,width:0,height:0};
   if(mobile&&this===elements.get('tv-spotlight-frame'))return {left:18,top:100,right:372,bottom:299,width:354,height:199};
   if(mobile&&this===elements.get('tv-spotlight-rail'))return {left:18,top:460,right:372,bottom:610,width:354,height:150};
   if(mobile&&this.parentElement===elements.get('tv-spotlight-rail')){const p=this.parentElement,i=p.children.filter(n=>!n.hidden).indexOf(this),left=18+i*197-p.scrollLeft;return {left,top:460,right:left+185,bottom:610,width:185,height:150};}
   if(this===elements.get('tv-spotlight-frame'))return {left:20,top:100,right:660,bottom:460,width:640,height:360};
   if(this===elements.get('tv-spotlight-rail'))return {left:700,top:100,right:950,bottom:580,width:250,height:480};
   if(this.parentElement===elements.get('tv-spotlight-rail')){const p=this.parentElement,i=p.children.filter(n=>!n.hidden).indexOf(this),top=100+i*190-p.scrollTop;return {left:700,top,right:950,bottom:top+180,width:250,height:180};}
   return {left:0,top:0,right:0,bottom:0,width:0,height:0};
  }
 }
 const ids=['tv-spotlight','tv-spotlight-rail','tv-spotlight-frame','tv-spotlight-status','tv-spotlight-sound','tv-spotlight-title','tv-spotlight-category','tv-spotlight-favorite','tv-spotlight-next','tv-spotlight-watch','view-category','nplay-profile-gate','nplay-access-wall','player-layer'];
 for(const id of ids)elements.set(id,new Node());
 for(const id of ['nplay-profile-gate','nplay-access-wall','player-layer'])elements.get(id).hidden=true;
 elements.get('tv-spotlight').append(elements.get('tv-spotlight-frame'),elements.get('tv-spotlight-rail'));
 const body=new Node('body');
 class Hls{
  static isSupported=()=>true;static Events={MANIFEST_PARSED:'manifest',ERROR:'error'};
  constructor(){this.events={};instances.push(this);}on(k,f){this.events[k]=f;}attachMedia(v){this.video=v;}loadSource(url){this.url=url;this.events.manifest();}destroy(){this.destroyed=true;}
 }
 const context=vm.createContext({console,URL,innerWidth:mobile?390:1000,innerHeight:mobile?844:800,location:{hash:'#tv',href:'https://novabytesolucoes.com.br/novaplay/#tv'},sessionStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},MutationObserver:class{observe(){}},setTimeout:(f)=>{timers.set(++serial,f);return serial;},clearTimeout:id=>timers.delete(id),CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},document:{body,hidden:false,getElementById:id=>elements.get(id),createElement:t=>new Node(t),addEventListener:(k,f)=>documentEvents[k]=f},window:{Hls,NPlayLiveAuth:{waitForRelease:async()=>{},authorize:async url=>{authorized.push(url);if(pendingAuth)return new Promise(r=>resolveAuth=r);return url+'?access_token=private&viewer=test';},release:url=>{if(url)released.push(url);}},NPlayLiveCatalog:{isFavorite:()=>false,toggleFavorite:id=>events.push({type:'favorite',id})},addEventListener:(k,f)=>(windowEvents[k]??=[]).push(f),dispatchEvent:e=>{events.push(e);for(const f of windowEvents[e.type]||[])f(e);}}});
 vm.runInContext(source,context);const realApi=context.window.NPlayTvSpotlight;const api={...realApi,setChannels:(items,selection=items.map(item=>item.id))=>realApi.setChannels(items,selection)};
 const items=Array.from({length:7},(_,i)=>({id:'channel-'+i,title:'Canal '+i,embed_url:'https://media.example/'+i+'.m3u8',stream_type:'hls'}));
 function emit(type,detail){context.window.dispatchEvent({type,detail});}
 const flush=async()=>{for(let i=0;i<5;i++){api.sync();await new Promise(r=>setImmediate(r));}};
 const videos=()=>instances.filter(x=>!x.destroyed&&x.video.parentElement);
 return {api,items,elements,context,emit,flush,videos,instances,released,authorized,events,stored,documentEvents,timers,resolveAuth:value=>resolveAuth(value)};
}
test('TV entry starts an audible feature and at most two muted visible previews, including on touch layouts',async()=>{
 const s=setup();s.api.setChannels(s.items);s.api.sync();await s.flush();
 assert.equal(s.videos().length,3);assert.equal(s.videos().filter(x=>!x.video.muted).length,1);
 assert.equal(s.elements.get('tv-spotlight-title').textContent,'Canal 0');assert.equal(s.authorized.length,3);
 assert.equal(s.elements.get('tv-spotlight-sound').attrs['aria-pressed'],'true');
});
test('leaving stops and releases all streams; re-entering rotates the feature without a page reload',async()=>{
 const s=setup();s.api.setChannels(s.items);s.api.sync();await s.flush();
 s.emit('nplay:navigate',{page:'filmes'});assert.equal(s.videos().length,0);assert.equal(s.released.length,3);assert.equal(s.elements.get('tv-spotlight').hidden,true);
 s.emit('nplay:navigate',{page:'tv'});s.api.sync();await s.flush();
 assert.equal(s.elements.get('tv-spotlight-title').textContent,'Canal 1');assert.equal(s.videos().length,3);assert.equal(s.videos().filter(x=>!x.video.muted).length,1);
 s.api.setChannels(s.items);assert.equal(s.elements.get('tv-spotlight-title').textContent,'Canal 1');
});
test('an autoplay denial falls back to muted playback and exposes a working sound button',async()=>{
 const s=setup({denyAudio:true});s.api.setChannels(s.items);s.api.sync();await s.flush();
 assert.equal(s.videos().filter(x=>!x.video.muted).length,0);assert.equal(s.elements.get('tv-spotlight-sound').disabled,false);
 s.elements.get('tv-spotlight-sound').onclick();await s.flush();assert.equal(s.videos().filter(x=>!x.video.muted).length,1);
});
test('scrolling the rail releases offscreen previews and never exceeds three active streams',async()=>{
 const s=setup();s.api.setChannels(s.items);s.api.sync();await s.flush();const old=s.videos().slice(1);
 s.elements.get('tv-spotlight-rail').scrollTop=570;s.api.sync();await s.flush();
 assert.equal(s.videos().length,3);assert(old.every(x=>x.destroyed));assert(s.released.length>=2);
});
test('favorites and full-player actions preserve channel identity and release preview resources',async()=>{
 const s=setup();s.api.setChannels(s.items);s.api.sync();await s.flush();
 s.elements.get('tv-spotlight-favorite').onclick();assert(s.events.some(e=>e.type==='favorite'&&e.id==='channel-channel-0'));
 s.elements.get('tv-spotlight-watch').onclick();assert.equal(s.videos().length,0);assert(s.events.some(e=>e.type==='nplay:channel-play'&&e.detail.id==='channel-0'));
});
test('late authorization after leaving is cancelled and released instead of starting hidden playback',async()=>{
 const s=setup({pendingAuth:true});s.api.setChannels([s.items[0]]);s.api.sync();await s.flush();s.api.leave();
 s.resolveAuth('https://media.example/0.m3u8?viewer=late');await s.flush();
 assert.equal(s.videos().length,0);assert.equal(s.instances.length,0);assert(s.released.some(url=>url.includes('viewer=late')));
});
test('unavailable feature signals fail over within a bounded number of attempts; duplicate sources are collapsed',async()=>{
 const s=setup();s.api.setChannels([...s.items,{...s.items[0],id:'duplicate',title:'Canal 0 FHD'}]);s.api.sync();await s.flush();
 assert.equal(s.elements.get('tv-spotlight-rail').children.length,7);
 const featured=s.videos().find(x=>!x.video.muted);featured.events.error(null,{fatal:true});await s.flush();
 assert.equal(featured.destroyed,true);assert.equal(s.elements.get('tv-spotlight-title').textContent,'Canal 1');assert(s.videos().length<=3);
 s.context.document.hidden=true;s.documentEvents.visibilitychange();assert.equal(s.videos().length,0);
});

test('empty or withdrawn catalogs clear the feature and cannot play an old unpublished source',async()=>{
 const s=setup();s.api.setChannels([]);assert.match(s.elements.get('tv-spotlight-status').textContent,/Nenhum sinal/);
 s.api.setChannels(s.items);s.api.sync();await s.flush();s.api.setChannels([]);
 assert.equal(s.videos().length,0);assert.equal(s.elements.get('tv-spotlight-watch').disabled,true);
 s.elements.get('tv-spotlight-watch').onclick();assert.equal(s.events.filter(e=>e.type==='nplay:channel-play').length,0);
});
test('live authorization waits for every pending preview release before reusing the receiver',async()=>{
 const resolvers=[],calls=[];
 const context=vm.createContext({URL,console,setTimeout,clearTimeout,fetch:()=>new Promise(resolve=>{resolvers.push(()=>resolve({ok:true}));}),window:{}});
 vm.runInContext(readFileSync(new URL('../assets/live-auth.js',import.meta.url),'utf8'),context);
 const auth=context.window.NPlayLiveAuth,origin='https://nplay-live-gateway.luandersonjesussantos063.workers.dev';
 auth.release(origin+'/live/00142c6f-bb22-5f18-8e42-4d852d8d7c00/index.m3u8?viewer=one');
 auth.release(origin+'/live/00187705-6436-58a8-b8b7-85a910f2fade/index.m3u8?viewer=two');
 const waiting=auth.waitForRelease().then(()=>calls.push('ready'));
 resolvers[1]();await new Promise(r=>setImmediate(r));assert.equal(calls.length,0);
 resolvers[0]();await waiting;assert.deepEqual(calls,['ready']);
});

test('mobile horizontal scrolling plays only the visible previews and leaves the feature audible',async()=>{
 const s=setup({mobile:true});s.api.setChannels(s.items);s.api.sync();await s.flush();
 assert.equal(s.videos().length,3);const firstThumb=s.videos()[1];
 s.elements.get('tv-spotlight-rail').scrollLeft=394;s.api.sync();await s.flush();
 assert.equal(firstThumb.destroyed,true);assert.equal(s.videos().length,3);assert.equal(s.videos().filter(x=>!x.video.muted).length,1);
});

test('an unconfigured selection never auto-promotes arbitrary HLS channels',async()=>{
 const s=setup();s.context.window.NPlayTvSpotlight.setChannels(s.items);s.api.sync();await s.flush();
 assert.equal(s.videos().length,0);assert.equal(s.elements.get('tv-spotlight').hidden,true);
});
test('the pending player stays laid out while unconfirmed thumbnails stay hidden until moving video is confirmed',async()=>{
 const s=setup({autoProgress:false});s.api.setChannels([s.items[0]]);s.api.sync();await s.flush();
 const root=s.elements.get('tv-spotlight'),v=s.videos()[0].video;assert.equal(root.hidden,false);assert(root.classList.contains('is-loading'));assert.equal(s.videos().length,1);
 v.readyState=3;v.videoWidth=0;for(const t of [0,1,2,3]){v.currentTime=t;v.emit('timeupdate');}
 assert(root.classList.contains('is-loading'));
 v.videoWidth=640;for(const t of [4,5,6]){v.currentTime=t;v.emit('timeupdate');}
 assert.equal(root.hidden,false);assert.equal(root.classList.contains('is-loading'),false);assert.equal(root.attrs['aria-busy'],'false');assert.equal(v.muted,false);
});
test('failed thumbnails disappear instead of displaying unavailable preview cards',async()=>{
 const s=setup();s.api.setChannels(s.items);s.api.sync();await s.flush();const preview=s.videos()[1],node=preview.video.parentElement.parentElement;
 preview.events.error(null,{fatal:true});assert.equal(node.hidden,true);assert.equal(preview.destroyed,true);assert(!node.children.some(n=>n.textContent==='Prévia indisponível'));
});

test('mobile media does not need to decode inside a display-none ancestor to reveal the saved selection',async()=>{
 const s=setup({mobile:true});s.api.setChannels(s.items,[s.items[3].id,s.items[4].id]);await s.flush();
 assert.equal(s.elements.get('tv-spotlight').hidden,false);assert.equal(s.elements.get('tv-spotlight').classList.contains('is-loading'),false);
 assert.equal(s.elements.get('tv-spotlight-title').textContent,'Canal 3');assert(s.videos().some(x=>x.video.videoWidth>0));
});
