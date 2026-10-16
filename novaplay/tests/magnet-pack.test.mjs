import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('../admin/admin.js',import.meta.url),'utf8').split('function appendMagnetPack(')[1].split('async function loadMagnetApprovals(')[0];
function setup(job,children=[],error=null){
 const node=tag=>({tag,style:{},dataset:{},children:[],disabled:false,checked:false,textContent:'',append(...nodes){this.children.push(...nodes)},setAttribute(){}});
 const calls=[],errors=[];let loads=0;
 const ctx=vm.createContext({document:{createElement:node},packSaving:false,client:{rpc:async(name,args)=>{calls.push({name,args});return {data:error?null:{created:10,existing:1},error}}},status:(...args)=>errors.push(args),errorText:e=>e.message,loadMagnetApprovals:async()=>{loads++}});
 vm.runInContext('function appendMagnetPack('+code,ctx);
 const box=node('div');ctx.appendMagnetPack(box,job,children);
 const walk=n=>[n,...n.children.flatMap(walk)];
 return {box,calls,errors,walk:()=>walk(box),loads:()=>loads};
}
const job=()=>({id:'parent',title:'Pack',status:'ready',selected_file_index:0,approved_for_processing:true,file_candidates:Array.from({length:11},(_,index)=>({index,name:'pack\\Movie.'+index+'.1080p.mkv',bytes:3000000000}))});
test('all eleven videos are submitted together; the existing video stays disabled',async()=>{
 const x=setup(job());const inputs=x.walk().filter(n=>n.tag==='input');
 assert.equal(inputs.length,11);assert.equal(inputs[0].disabled,true);
 await x.walk().find(n=>n.textContent==='Importar todos os vídeos (11)').onclick();
 assert.equal(x.calls[0].name,'novaplay_select_import_files');
 assert.deepEqual(Array.from(x.calls[0].args.p_indexes),Array.from({length:11},(_,i)=>i));assert.equal(x.loads(),1);
});
test('selected import excludes already queued files and unchecked videos',async()=>{
 const x=setup(job(),[{batch_parent_id:'parent',selected_file_index:2}]);const inputs=x.walk().filter(n=>n.tag==='input');inputs[4].checked=false;
 await x.walk().find(n=>n.textContent==='Importar vídeos selecionados').onclick();
 assert.deepEqual(Array.from(x.calls[0].args.p_indexes),[1,3,5,6,7,8,9,10]);
});
test('samples and nonvideo files are omitted; children do not expose another batch',()=>{
 const j=job();j.file_candidates.push({index:50,name:'pack\\Sample.mkv',bytes:1},{index:51,name:'poster.jpg',bytes:1});
 assert.equal(setup(j).walk().filter(n=>n.tag==='input').length,11);
 j.batch_parent_id='original';assert.equal(setup(j).box.children.length,0);
});
test('failed submission preserves controls and reports the error',async()=>{
 const x=setup(job(),[],{message:'offline'});const button=x.walk().find(n=>n.textContent==='Importar todos os vídeos (11)');await button.onclick();
 assert.equal(button.disabled,false);assert.equal(x.loads(),0);assert.match(x.errors[0][1],/offline/);
});
