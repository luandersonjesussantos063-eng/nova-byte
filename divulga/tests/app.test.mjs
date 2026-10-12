import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8');
const app=read('app.js'),html=read('index.html'),sw=read('sw.js');
test('seis páginas, acessibilidade básica e identidade visual',()=>{
 for(const name of ['inicio','grupos','campanhas','fila','historico','config'])assert.ok(html.includes('id="'+name+'"'),name);
 assert.match(html,/NovaByte Divulga/);
 assert.match(html,/viewport-fit=cover/);
 assert.match(read('style.css'),/\.bottom-nav/);
});
test('PWA offline tem escopo isolado e não interfere no site NovaByte',()=>{
 assert.match(sw,/novabyte-divulga-v1\.0\.0/);
 assert.match(sw,/pathname\.includes\('\/divulga\/'\)/);
 assert.match(sw,/CACHE/);
 const manifest=JSON.parse(read('manifest.webmanifest'));
 assert.equal(manifest.scope,'./');
 assert.equal(manifest.display,'standalone');
});
test('links Facebook são validados e normalizados antes de cadastrar',()=>{
 const fn=app.slice(app.indexOf('function escapeUrl('),app.indexOf('\nfunction simpleUrl('));
 const valid=new Function(fn+';return escapeUrl;')();
 assert.equal(valid('https://www.facebook.com/groups/abc123?ref=share'),'https://www.facebook.com/groups/abc123');
 assert.equal(valid('https://m.facebook.com/groups/123/'),'https://www.facebook.com/groups/123');
 for(const bad of ['javascript:alert(1)','https://fakefacebook.com/groups/123','https://facebook.com/profile.php?id=1','https://facebook.com.evil.test/groups/1','ftp://facebook.com/groups/1'])assert.equal(valid(bad),null,bad);
});
test('variações de campanha retornam quatro anúncios editáveis',()=>{
 const fn=app.slice(app.indexOf('function adVariants('),app.indexOf('\nfunction adText('));
 const variants=new Function(fn+';return adVariants;')();
 for(const service of ['Criação de sites','Landing pages','Cardápio digital','Aplicativos','Sistemas personalizados']){
  const texts=variants(service,'Lucas do Rio Verde');
  assert.equal(texts.length,4);
  assert.ok(texts.every(text=>text.includes('NovaByte Soluções')));
 }
});
test('divulgação assistida exige confirmação humana e registra histórico local',()=>{
 assert.match(app,/data-action/);
 assert.match(app,/queue-done/);
 assert.match(app,/queue-skip/);
 assert.match(app,/type:'published'/);
 assert.match(app,/localStorage\.setItem/);
 assert.match(app,/window\.open/);
 assert.doesNotMatch(app,/facebook\.com\/v\d+\/.*\/feed|publish_to_groups|document\.execCommand\('click'\)/);
});
test('inicialização abre a página principal sem dependências externas',()=>{
 const el=new Map(),listeners=new Map();
 const get=id=>{if(!el.has(id))el.set(id,{id:id.slice(1),innerHTML:'',hidden:false,style:{},classList:{toggle(){}},focus(){}});return el.get(id)};
 const screens=['inicio','grupos','campanhas','fila','historico','config'].map(id=>get('#'+id));
 const local=new Map();
 const document={
  querySelector:get,
  querySelectorAll:selector=>selector==='.screen'?screens:[],
  addEventListener:(type,fn)=>listeners.set(type,fn),
  body:{style:{}},
 };
 const window={addEventListener(){},scrollTo(){},Capacitor:null};
 const context={document,window,history:{replaceState(){}},location:{hash:''},localStorage:{getItem:key=>local.get(key)||null,setItem:(key,val)=>local.set(key,val)},navigator:{},setInterval:()=>0,setTimeout:()=>0,clearTimeout(){},crypto:{randomUUID:()=>'test-uuid'},URL,Date,Math,Number,String,Array,JSON,console};
 assert.doesNotThrow(()=>vm.runInNewContext(app,context,{timeout:2500}));
 assert.match(get('#inicio').innerHTML,/Iniciar divulgação/);
 assert.match(get('#inicio').innerHTML,/0/);
});
