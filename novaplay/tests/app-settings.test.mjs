import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function core(){const context={window:{},document:{readyState:'loading',addEventListener(){}},URL,Date};vm.runInNewContext(read('assets/app-settings.js'),context);return context.window.NPlaySettingsCore;}
class Node{
 constructor(tag='div',document){this.tagName=tag.toUpperCase();this.document=document;this.children=[];this.handlers={};this.attributes={};this.hidden=false;this.disabled=false;this.checked=false;this.style={setProperty(name,value){this[name]=value;}};this._text='';const classes=new Set();this.classList={add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n)};}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 set textContent(value){this._text=String(value);this.children=[];}
 append(...nodes){for(const node of nodes){if(node.parent)node.parent.children=node.parent.children.filter(n=>n!==node);this.children.push(node);node.parent=this;}}
 replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
 setAttribute(name,value){this.attributes[name]=String(value);}
 focus(){this.document.activeElement=this;}
 emit(name,data={}){const event={target:this,stopPropagation(){this.stopped=true;},preventDefault(){this.prevented=true;},...data};this['on'+name]?.(event);for(const fn of this.handlers[name]||[])fn(event);return event;}
 contains(node){return this===node||this.children.some(n=>n.contains(node));}
 querySelectorAll(selector){const tags=selector.split(',').map(s=>s.split(/[:\[]/)[0].toUpperCase());return this.children.flatMap(n=>[...(tags.includes(n.tagName)&&!n.disabled?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){if(selector==='[type="submit"]')return this.submitButton??=new Node('button',this.document);return this.querySelectorAll(selector)[0]||null;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 canPlayType(){return 'probably';}
}
function ui({profiles=false}={}){
 const values=new Map(),sessionValues=new Map([['nplay-profile-selected','1']]),events=new Map(),ids=new Map();let historyDepth=0,previewed=0;
 const document={readyState:'complete',activeElement:null,documentElement:{dataset:{nplayAccess:'approved'}},addEventListener(name,fn){(events.get('doc:'+name)||events.set('doc:'+name,[]).get('doc:'+name)).push(fn);},querySelector:selector=>selector.startsWith('meta')?{content:'0.51.26'}:null};
 document.createElement=tag=>new Node(tag,document);document.createElementNS=(_,tag)=>document.createElement(tag);document.body=document.createElement('body');
 document.getElementById=id=>{const explicit=ids.get(id);if(explicit)return explicit;const find=node=>node.id===id?node:node.children.map(find).find(Boolean);return find(document.body)||null;};
 const add=(id,tag='div')=>{const n=document.createElement(tag);n.id=id;ids.set(id,n);document.body.append(n);return n;};
 add('nplay-device-code','button').textContent='Aparelho: ABCD1234';
 const storage=map=>({getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)});
 const window={addEventListener(name,fn){(events.get(name)||events.set(name,[]).get(name)).push(fn);},dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);},matchMedia:()=>({matches:false}),devicePixelRatio:2,NPlayProfiles:{current:()=>({name:'Meu perfil'})},NPlayIntroAudio:{enabled:()=>true,setEnabled(){},preview(){previewed++;}}};
 const history={pushState(){historyDepth++;},back(){historyDepth--;window.dispatchEvent({type:'popstate'});}};
 const caches={keys:async()=>[]},context={window,document,history,location:{href:'https://example.test/novaplay/#inicio'},screen:{width:400,height:900},navigator:{userAgent:'Test browser',onLine:true,storage:{estimate:async()=>({usage:123,quota:10000})}},localStorage:storage(values),sessionStorage:storage(sessionValues),crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},Event:class{constructor(type){this.type=type;}},URL,Date,AbortController,setTimeout,clearTimeout};
 window.caches=caches;vm.createContext(context);vm.runInContext(read('assets/app-settings.js'),context);
 if(profiles){
  for(const id of ['nplay-profile-gate','nplay-profile-grid','profile-trigger','nplay-profile-edit','nplay-profile-form','nplay-profile-slot','nplay-profile-name','nplay-profile-dialog','nplay-avatar-picker','nplay-profile-feedback','nplay-profile-add','nplay-profile-remove','nplay-profile-cancel'])add(id,id==='profile-trigger'||id==='nplay-profile-edit'?'button':id==='nplay-profile-name'?'input':'div');
  ids.get('nplay-profile-gate').hidden=true;
  values.set('nplay-profiles-v2',JSON.stringify([{id:'11111111-1111-4111-8111-111111111111',name:'Cliente',avatar:0},{id:'22222222-2222-4222-8222-222222222222',name:'Família',avatar:1}]));
  vm.runInContext(read('profiles.js'),context);
 }
 const root=()=>document.getElementById('nplay-settings');
 const buttons=parent=>(parent||root()).querySelectorAll('button');
 const click=text=>{const node=buttons().find(n=>n.textContent.includes(text));assert(node,'missing button '+text);node.emit('click');return node;};
 return {api:window.NPlaySettings,window,document,context,values,sessionValues,events,root,buttons,click,get historyDepth(){return historyDepth;},get previewed(){return previewed;}};
}
test('preferences persist per browser, reject unknown data modes, and report denied storage honestly',()=>{
 const c=core(),values=new Map();let changed=0;
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},store=c.createStore(storage,()=>changed++);
 assert.equal(store.get().videoData,'auto');assert(store.set({videoData:'economy',notifications:false,resume:false,statistics:false}));
 assert.equal(c.createStore(storage).get().statistics,false);assert.equal(changed,1);
 assert(store.set({videoData:'invalid',accessToken:'never-store'}));assert.equal(store.get().videoData,'auto');assert(!values.get(c.KEY).includes('never-store'));
 const denied=c.createStore({getItem(){throw Error();},setItem(){throw Error();}});assert.equal(denied.get().resume,true);assert.equal(denied.set({resume:false}),false);
});
test('economy mode caps adaptive video at the best available rendition up to 480p and respects OS data saver',()=>{
 const c=core(),hls={levels:[{height:1080,bitrate:4000000},{height:360,bitrate:500000},{height:480,bitrate:1000000},{height:720,bitrate:2000000}]};
 c.configureHls(hls,{videoData:'economy'});assert.equal(hls.autoLevelCapping,2);assert.equal(hls.capLevelToPlayerSize,false);
 c.configureHls(hls,{videoData:'auto'},{saveData:true});assert.equal(hls.autoLevelCapping,2);
 c.configureHls(hls,{videoData:'maximum'},{saveData:true});assert.equal(hls.autoLevelCapping,-1);assert.equal(hls.capLevelToPlayerSize,false);
 c.configureHls(hls,{videoData:'auto'});assert.equal(hls.autoLevelCapping,-1);assert(hls.capLevelToPlayerSize);
});
test('economy falls back to the smallest available rendition without inventing qualities on a fixed source',()=>{
 const c=core(),hls={levels:[{height:1080,bitrate:4000000},{height:720,bitrate:2000000}]};
 c.configureHls(hls,{videoData:'economy'});assert.equal(hls.autoLevelCapping,1);
 const fixed={levels:[{height:1080,bitrate:4000000}]};c.configureHls(fixed,{videoData:'economy'});assert.equal(fixed.autoLevelCapping,0);
 assert.doesNotThrow(()=>c.configureHls(null,{videoData:'auto'}));
});
test('cache cleanup deletes only NPlay cache buckets and never touches auth, favorites or other apps',async()=>{
 const c=core(),names=['novaplay-v0.51.25-tvspotlight1','novaplay-v0.51.26-tvspotlight1','pp-mt-v2','anuncia-lucas','supabase-auth'];const deleted=[];
 assert.equal(await c.clearCache({keys:async()=>names,delete:async name=>{deleted.push(name);return true;}}),2);
 assert.deepEqual(deleted,names.slice(0,2));await assert.rejects(()=>c.clearCache(null));
});
test('storage shows a site-origin estimate while counting only NPlay cached files',async()=>{
 const c=core(),opened=[];const result=await c.storageInfo({estimate:async()=>({usage:400,quota:1000})},{keys:async()=>['novaplay-a','other-app'],open:async name=>{opened.push(name);return {keys:async()=>[1,2,3]};}});
 assert.equal(result.usage,400);assert.equal(result.quota,1000);assert.equal(result.files,3);assert.deepEqual(opened,['novaplay-a']);
 const unknown=await c.storageInfo(null,null);assert.equal(unknown.quota,null);assert.equal(c.bytes(null),'Não informado');
});
test('network check verifies a fresh manifest response instead of treating a cached page as online',async()=>{
 const c=core(),calls=[];let time=10;const controller=new AbortController();
 const result=await c.networkCheck({base:'https://example.test/novaplay/#inicio',signal:controller.signal,now:()=>time,fetchFn:async(url,options)=>{calls.push({url,options});time=60;return {ok:true,json:async()=>({name:'NPlay'})};}});
 assert.equal(result.latency,50);assert(calls[0].url.includes('/novaplay/manifest.webmanifest?nplay-diagnostic='));assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.signal,controller.signal);
 await assert.rejects(()=>c.networkCheck({base:'https://example.test/novaplay/',now:()=>time,fetchFn:async()=>({ok:true,json:async()=>({})})}));
});
test('speed test bounds data use, bypasses caches and stops after enough measurement time',async()=>{
 const c=core(),calls=[];let time=0;
 const result=await c.speedCheck({base:'https://example.test/novaplay/',now:()=>time,fetchFn:async(url,options)=>{calls.push({url,options});time+=600;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(528168)};}});
 assert.equal(result.requests,3);assert.equal(result.bytes,3*528168);assert.equal(result.elapsed,1800);assert(result.mbps>0);
 assert.equal(new Set(calls.map(c=>c.url)).size,3);assert(calls.every(c=>c.options.cache==='no-store'&&c.url.includes('nplay-diagnostic=speed-')));
 time=0;const fast=await c.speedCheck({base:'https://example.test/novaplay/',now:()=>time,fetchFn:async()=>{time++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(528168)};}});assert.equal(fast.requests,15);assert(fast.bytes<8000000);
});
test('cancellation and network failures propagate instead of reporting a fictional speed',async()=>{
 const c=core(),controller=new AbortController();controller.abort();
 await assert.rejects(()=>c.speedCheck({base:'https://example.test/novaplay/',signal:controller.signal,now:()=>0,fetchFn:async(_,options)=>{assert(options.signal.aborted);throw Object.assign(Error('cancelled'),{name:'AbortError'});}}),{name:'AbortError'});
 await assert.rejects(()=>c.speedCheck({base:'https://example.test/novaplay/',now:()=>0,fetchFn:async()=>({ok:false})}));
});
test('the real settings screen opens from the profile sheet, saves data preference and returns to the sheet',()=>{
 const l=ui({profiles:true});l.document.getElementById('profile-trigger').emit('click');const menu=l.document.getElementById('nplay-account-menu');assert(!menu.hidden);
 l.buttons(menu).find(n=>n.textContent.includes('Configurações do aplicativo')).emit('click');assert(menu.hidden);assert(!l.root().hidden);assert.equal(l.historyDepth,1);
 l.click('Uso de dados');l.click('Economizar dados');assert.equal(l.api.get().videoData,'economy');
 l.root().querySelectorAll('button')[0].emit('click');assert(l.root().hidden);assert(!menu.hidden);assert.equal(l.historyDepth,0);
});
test('new profile sheet switches profiles and exits to the chooser without revoking the device identity',()=>{
 const l=ui({profiles:true});l.document.getElementById('profile-trigger').emit('click');let menu=l.document.getElementById('nplay-account-menu');
 l.buttons(menu).find(n=>n.textContent==='Família').emit('click');assert.equal(l.window.NPlayProfiles.current().name,'Família');assert(menu.hidden);
 l.document.getElementById('profile-trigger').emit('click');l.buttons(menu).find(n=>n.textContent==='Sair do perfil›').emit('click');
 assert.equal(l.sessionValues.get('nplay-profile-selected'),undefined);assert(!l.document.getElementById('nplay-profile-gate').hidden);assert.equal(l.document.documentElement.dataset.nplayAccess,'approved');
});
test('notification, resume, statistics and intro controls persist their real underlying preferences',()=>{
 const l=ui();l.api.open();const toggle=label=>{const input=l.root().querySelectorAll('input').find(n=>n.attributes['aria-label']===label);assert(input);input.checked=false;input.emit('change');};
 toggle('Avisos no aplicativo');toggle('Retomar de onde parei');assert.equal(l.api.get().notifications,false);assert.equal(l.api.get().resume,false);
 l.click('Ouvir som da abertura');assert.equal(l.previewed,1);
 l.click('Privacidade e dados');toggle('Estatísticas opcionais');assert.equal(l.api.get().statistics,false);
});
test('entering cache cleanup asks for a separate deliberate action and keeps unrelated cached apps',async()=>{
 const l=ui(),deleted=[];l.window.caches={keys:async()=>['novaplay-old','other-app'],open:async()=>({keys:async()=>[]}),delete:async name=>{deleted.push(name);return true;}};
 l.api.open();l.click('Limpar arquivos temporários');assert.deepEqual(deleted,[]);l.click('Limpar cache da NPlay');
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(deleted,['novaplay-old']);assert.equal(l.document.documentElement.dataset.nplayAccess,'approved');
});
test('browser Back closes settings and account actions do not reopen a sheet over the profile chooser',()=>{
 const l=ui({profiles:true});l.api.open();l.context.history.back();assert(l.root().hidden);
 l.api.open('account',{onClose:()=>{throw Error('must not reopen');}});l.click('Sair do perfil');assert(l.root().hidden);assert(!l.document.getElementById('nplay-profile-gate').hidden);
});
test('settings are connected before playback, profile and notices, while diagnostics bypass service-worker cache',()=>{
 const html=read('index.html'),app=read('app.js'),notices=read('assets/notifications.js'),sw=read('sw.js'),profiles=read('profiles.js');
 assert(html.indexOf('assets/app-settings.js')<html.indexOf('src="./app.js'));assert(html.indexOf('assets/app-settings.js')<html.indexOf('src="./profiles.js'));
 assert(sw.includes('./assets/app-settings.js'));assert(sw.includes('./assets/app-settings.css'));assert(sw.includes('url.searchParams.has("nplay-diagnostic")'));
 assert(sw.indexOf('url.searchParams.has("nplay-diagnostic")')<sw.indexOf('caches.match(request)'));
 assert(app.includes('window.NPlaySettings?.get().statistics===false'));assert(app.includes('window.NPlaySettings?.get().resume===false?null:progressItem(id)'));assert(app.includes('window.NPlaySettings?.configureHls(hls)'));
 assert(notices.includes('badge.hidden=count===0||!enabled'));assert(profiles.includes('Configurações do aplicativo'));assert(!profiles.includes('signOut('));
});
