import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM,VirtualConsole} from 'jsdom';
const read=path=>readFileSync('questoes/'+path,'utf8');
const TARGET='https://ppmt.novabytesolucoes.com.br/';
function open(seed={}){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',error=>{if(!error.message.includes('navigation'))errors.push(error.message)});
 const dom=new JSDOM(read('index.html'),{url:'https://novabytesolucoes.com.br/questoes/',runScripts:'outside-only',virtualConsole:vc});
 for(const [key,value] of Object.entries(seed))dom.window.localStorage.setItem(key,typeof value==='string'?value:JSON.stringify(value));
 dom.window.eval(read('app.js'));return {dom,w:dom.window,errors};
}
test('old address only exposes the canonical PMMG and no second training app or install manifest',()=>{
 const a=open();try{
  const d=a.w.document;assert.equal(d.querySelector('link[rel=canonical]').href,TARGET);assert.equal(d.querySelector('#open-main-app').href,TARGET);
  assert.equal(d.querySelector('link[rel=manifest]'),null);assert.equal(d.querySelector('#daily-start'),null);
  assert.deepEqual([...d.scripts].map(s=>s.getAttribute('src')),['./app.js?v=15-unificado']);
  let destination;a.w.MFRetirement.start({navigate:url=>{destination=url}});assert.equal(destination,TARGET);assert.deepEqual(a.errors,[]);
 }finally{a.w.close()}
});
test('existing progress stops automatic redirection and exports separate compatible profile backups without clearing data',()=>{
 const first={version:3,events:[{id:'pmmg2024-1',correct:false}],progress:{'pmmg2024-1':{correct:false}},settings:{goal:5}},second={version:3,events:[],progress:{},settings:{goal:2}};
 const a=open({'missao-farda-pmmg-state-v3-luanderson':first,'missao-farda-pmmg-state-v3-jackeline':second,otherApp:{keep:true}});try{
  let destination;a.w.MFRetirement.start({navigate:url=>{destination=url}});assert.equal(destination,undefined);assert.equal(a.w.document.querySelector('#legacy-backups').hidden,false);assert.equal(a.w.document.querySelectorAll('#backup-buttons button').length,2);
  const backups=JSON.parse(JSON.stringify(a.w.MFRetirement.collectBackups(a.w.localStorage)));assert.equal(backups[0].data.app,'missao-farda-pmmg');assert.equal(backups[0].data.version,3);assert.equal(backups[0].data.profile.id,'luanderson');assert.deepEqual(backups[0].data.state,first);assert.deepEqual(backups[1].data.state,second);
  assert.deepEqual(JSON.parse(a.w.localStorage.getItem('missao-farda-pmmg-state-v3-luanderson')),first);assert.deepEqual(JSON.parse(a.w.localStorage.getItem('otherApp')),{keep:true});assert.deepEqual(a.errors,[]);
 }finally{a.w.close()}
});
test('legacy progress can be backed up and corrupt JSON does not stop access',()=>{
 const a=open({'missao-farda-pmmg-state-v3':'bad-json','missao-farda-pmmg-progress-v1':{'pmmg2021-1':{correct:false}}});try{
  const backups=a.w.MFRetirement.collectBackups(a.w.localStorage);assert.equal(backups.length,1);assert.equal(backups[0].data.state.progress['pmmg2021-1'].correct,false);assert.equal(a.w.localStorage.getItem('missao-farda-pmmg-state-v3'),'bad-json');
 }finally{a.w.close()}
});
test('stale HTML loading the updated entry script leaves the old UI',()=>{
 const a=open();try{a.w.document.querySelector('#consolidated-access').remove();let destination;a.w.MFRetirement.start({navigate:url=>{destination=url}});assert.equal(destination,'https://novabytesolucoes.com.br/questoes/?acesso=unificado')}finally{a.w.close()}
});
test('retirement service worker invalidates only legacy caches and reloads only its controlled scope',async()=>{
 const handlers={},deleted=[],navigated=[],cached=[];
 const scope='https://novabytesolucoes.com.br/questoes/';
 const ctx={URL,fetch:async()=>{},caches:{open:async()=>({addAll:async files=>cached.push(...files)}),keys:async()=>['missao-farda-pmmg-v14-avatares','missao-farda-unificado-v15','kaia-glow','nova-byte'],delete:async key=>deleted.push(key)},self:{location:{origin:'https://novabytesolucoes.com.br'},registration:{scope},skipWaiting:async()=>{},addEventListener:(name,fn)=>{handlers[name]=fn},clients:{claim:async()=>{},matchAll:async()=>[{url:scope,navigate:async url=>navigated.push(url)},{url:'https://novabytesolucoes.com.br/',navigate:async url=>navigated.push(url)}]}}};vm.runInNewContext(read('sw.js'),ctx);
 let work;handlers.install({waitUntil:value=>{work=value}});await work;assert.ok(cached.includes('./app.js?v=15-unificado'));assert.ok(cached.every(path=>!path.includes('banco')&&!path.includes('sync')));
 handlers.activate({waitUntil:value=>{work=value}});await work;assert.deepEqual(deleted,['missao-farda-pmmg-v14-avatares']);assert.deepEqual(navigated,[scope+'?acesso=unificado']);
});
