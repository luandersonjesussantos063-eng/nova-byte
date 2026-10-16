import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ctx=vm.createContext({window:{}});vm.runInContext(read('assets/youtube-core.js'),ctx);
const core=ctx.window.NPlayYouTube;
test('YouTube genres fill the four shelves, with accents and legacy genre names',()=>{
 for(const [genre,expected] of [['Filmes completos',0],['Documentário',1],['Documentários',1],['Comédia',2],['Humor',2],['Animação',3],['Curta-metragem',3]])assert.equal(core.category({category:genre}),core.categories[expected]);
});
test('the selection excludes placeholders, malformed IDs and duplicates without mutating the catalog',()=>{
 const one={mode:'youtube',youtube_id:'WhWc3b3KhnY'},items=[one,{...one},{mode:'r2',youtube_id:'SkVqJ1SGeL0'},{...one,catalogOnly:true},{mode:'youtube',youtube_id:'<script>'}];
 assert.deepEqual(Array.from(core.select(items)),[one]);assert.equal(items.length,5);
 assert.equal(core.channel({description:'Uma história.\nCanal: Blender Studio\nFonte: https://youtube.com'}),'Blender Studio');
 assert.equal(core.channel({description:'Sem atribuição cadastrada'}),'YouTube');
});
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.parts={};this.textContent='';}
 append(...children){this.children.push(...children)}
 replaceChildren(){this.children=[]}
 setAttribute(k,v){this.attributes[k]=v}
 querySelector(selector){return this.parts[selector]??=new Element('button')}
}
test('category chips filter the feature and shelves; play and details keep working after a filter change',()=>{
 const content=new Element('div'),rows=[],played=[],opened=[];
 const c=vm.createContext({window:ctx.window,document:{createElement:t=>new Element(t)},escapeText:s=>String(s),icon:()=>'',startWatching:x=>played.push(x.id),openDetails:x=>opened.push(x.id),empty:title=>({empty:title}),shelf:(title,items)=>{if(!items.length)return null;const row={title,items};rows.push(row);return row}});
 const app=read('app.js');vm.runInContext(app.slice(app.indexOf('let selectedYouTubeCategory='),app.indexOf('const categories=')),c);
 const items=core.categories.map((category,i)=>({id:i,title:category,category,description:'Canal: Canal '+i,duration:'10 min',cover:'https://i.ytimg.com/vi/WhWc3b3KhnY/hqdefault.jpg'}));
 c.renderYouTubeSelection(content,items);assert.equal(rows.length,4);assert.equal(content.children[0].children.length,5);
 content.children[0].children[3].onclick();
 assert.equal(content.children[0].children[3].attributes['aria-pressed'],'true');
 assert.equal(content.children[1].textContent,'1 vídeo na seleção');assert.equal(content.children.length,4);
 const feature=content.children[2];feature.querySelector('.youtube-feature-play').onclick();feature.querySelector('.youtube-feature-details').onclick();
 assert.deepEqual(played,[2]);assert.deepEqual(opened,[2]);assert.equal(content.children[3].title,'Humor');
 c.renderYouTubeSelection(content,[]);assert.equal(content.children.at(-1).empty,'Nenhum vídeo nesta categoria');
});
test('the core loads before the app and is available in the offline shell',()=>{
 const html=read('index.html');assert(html.indexOf('assets/youtube-core.js')<html.indexOf('src="./app.js'));
 assert(read('sw.js').includes('"./assets/youtube-core.js"'));
});
