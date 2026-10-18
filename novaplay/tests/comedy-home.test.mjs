import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('app.js');
const native={id:'native',kind:'film',mode:'r2',category:'Comédia'};
const movie={id:'movie',kind:'film',mode:'youtube',youtube_id:'sgycDtk212Y',category:'Filmes completos · Comédia'};
const sketch={id:'sketch',kind:'film',mode:'youtube',youtube_id:'Ag0-vKzRREg',category:'Humor'};
const documentary={id:'documentary',kind:'film',mode:'youtube',youtube_id:'YoNQbyOUJGM',category:'Documentários',title:'Meio século de humor'};

function lab(){
 const holder={children:[],replaceChildren(){this.children=[]},append(row){this.children.push(row)}};
 const catalog=[native,movie,sketch,documentary,{...movie},{...sketch,id:'unpublished',catalogOnly:true}];
 const c=vm.createContext({window:{},db:{films:catalog,channels:[]},uploadedCatalog:[native],homeLivePreviews:null,homeLiveChannels:[],
  $:()=>holder,continued:()=>[],favoriteItems:()=>[],uniqueChannelItems:items=>items,shelf:(title,items,key,live)=>items.length?{title,items,key,live}:null});
 vm.runInContext(read('assets/youtube-core.js'),c);
 c.youtubeFilms=()=>c.window.NPlayYouTube.select(c.db.films);
 vm.runInContext(app.slice(app.indexOf('const genreOrder='),app.indexOf('const defaultFeatured=')),c);
 return {c,holder,core:c.window.NPlayYouTube};
}

test('comedy movies remain in full films while stand-up and sketches stay in Humor',()=>{
 const {core}=lab();
 assert.equal(core.category(movie),'Filmes completos');
 assert.equal(core.category(sketch),'Humor');
 assert.equal(core.category({genre:'Comédia'}),'Humor');
 assert.deepEqual(Array.from(core.comedy([movie,sketch,documentary,{...movie},{...sketch,catalogOnly:true},{...sketch,youtube_id:'invalid'}]),x=>x.id),['movie','sketch']);
});

test('the Home comedy shelf shows new YouTube titles and opens the complete comedy collection',()=>{
 const {c,holder}=lab();
 c.renderRows();
 const row=holder.children.find(x=>x.title==='Comédia para sua sessão');
 assert(row,'YouTube comedy must appear even without four native comedy films');
 assert.equal(row.key,'comedia');
 assert.deepEqual(Array.from(row.items,x=>x.id),['movie','sketch','native']);
 assert.equal(holder.children.filter(x=>x.key==='comedia').length,1);
});

test('Ver todos opens all comedy titles with the normal card and player actions',()=>{
 const {c}=lab(),elements=new Map(),cards=[];
 c.$=id=>{if(!elements.has(id))elements.set(id,{className:'',hidden:false,textContent:'',children:[],replaceChildren(){this.children=[]},append(x){this.children.push(x)}});return elements.get(id)};
 c.card=item=>{cards.push(item);return {id:item.id}};
 vm.runInContext(app.slice(app.indexOf('const categories='),app.indexOf('let searchKind=')),c);
 c.renderCategory('comedia');
 assert.equal(elements.get('category-heading').textContent,'Comédia');
 assert.equal(elements.get('genre-filter-panel').hidden,true);
 assert.deepEqual(cards.map(x=>x.id),['movie','sketch','native']);
});
