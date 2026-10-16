import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx=vm.createContext({window:{}});vm.runInContext(read('assets/music-core.js'),ctx);const music=ctx.window.NPlayMusic;
const audit=JSON.parse(read('audits/portuguese-2026-10-15.json')).live_hidden.filter(x=>x.reason==='music_channel');
test('all 17 previously withdrawn music channels move to Music, including FM O Dia classified as radio',()=>{
 const rows=audit.map((x,i)=>({...x,category:i===8?'Rádio':'Entretenimento',embed_url:'https://example.org/'+i+'.m3u8'}));
 assert.equal(music.select(rows,'musica').length,17);assert.equal(music.select(rows,'tv').length,0);
});
test('new music categories, accents and old imported encoding are classified without moving general entertainment',()=>{
 for(const category of ['Música','Music','Music;Religious','Entertainment;General;Movies;Music','MÃºsica'])assert(music.isMusic({category}),category);
 assert.equal(music.isMusic({category:'Entretenimento',title:'Multishow'}),false);
});
test('music and TV stay separate and duplicate streams appear once',()=>{
 const rows=[{id:'a',category:'Música',embed_url:'https://example.org/music.m3u8'}, {id:'b',category:'Music',embed_url:'https://example.org/music.m3u8#duplicate'}, {id:'tv',category:'Notícias',embed_url:'https://example.org/news.m3u8'}];
 assert.equal(music.select(rows,'musica').length,1);assert.equal(music.select(rows,'tv')[0].id,'tv');assert.equal(rows.length,3);
});
test('Music navigation opens the live panel and dispatches its own event without a film empty state',()=>{
 const app=read('app.js'),elements=new Map(),events=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',replaceChildren(){},append(){throw Error('Film placeholder should not appear')}});return elements.get(id)};
 const c=vm.createContext({$:get,window:{dispatchEvent:e=>events.push(e.type)},Event,db:{films:[],channels:[],series:[]},all:[],categories:{musica:['MÚSICA · NPLAY','Música','Canais musicais',[]]}});
 vm.runInContext(app.slice(app.indexOf('function renderCategory('),app.indexOf('function renderSearch(')),c);
 c.renderCategory('musica');assert.deepEqual(events,['nplay:music-open']);assert.equal(get('category-heading').textContent,'Música');assert.equal(get('genre-filter-panel').hidden,true);
 const html=read('index.html');assert.equal((html.match(/data-nav="musica"/g)||[]).length,2);
 assert(app.includes('embeddedPanel.hidden=chosen!=="tv"&&chosen!=="musica"'));
 assert(html.indexOf('assets/music-core.js')<html.indexOf('src="./app.js'));
});
