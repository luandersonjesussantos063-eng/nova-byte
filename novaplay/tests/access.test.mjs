import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../access.js',import.meta.url),'utf8');
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};
function lab(initial={}){
 const state={status:null,admin:false,session:true,authError:null,queryError:null,insertError:null,inserts:0,anonymous:0,reloads:0,...initial},nodes=new Map();let poll;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,textContent:'',dataset:{}});return nodes.get(id);};
 const user={id:'a26aa953-1111-4111-8111-111111111111'};
 const client={auth:{getSession:async()=>({data:{session:state.session?{user}:null}}),getUser:async()=>({data:{user:state.authError?null:user},error:state.authError}),signInAnonymously:async()=>{state.anonymous++;state.session=true;return {data:{user}};},refreshSession:async()=>({data:{session:{user}}})},from(table){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='novaplay_admins'?(state.admin?{user_id:user.id}:null):(state.status?{status:state.status}:null),error:state.queryError};},async insert(){state.inserts++;if(!state.insertError||state.insertError.code==='23505')state.status='pending';return {error:state.insertError};}};}};
 const document={readyState:'complete',hidden:false,getElementById:node,addEventListener(){}};
 vm.runInNewContext(source,{document,window:{supabase:{createClient:()=>client}},navigator:{userAgent:'Test browser'},location:{reload:()=>state.reloads++},setTimeout,clearTimeout,setInterval:fn=>poll=fn});
 return {state,node,poll:()=>poll(),click:id=>node(id).onclick()};
}
test('first access explains the next step and shows the device code without an error message',async()=>{
 const l=lab({session:false});await settle();assert.equal(l.node('nplay-access-title').textContent,'Solicite seu acesso');assert.equal(l.node('nplay-access-request').hidden,false);assert.equal(l.node('nplay-access-code').textContent,'A26AA953');assert.equal(l.state.anonymous,1);assert.match(l.node('nplay-access-hint').textContent,/1\. Toque/);
 await l.click('nplay-access-request');assert.equal(l.state.inserts,1);assert.equal(l.node('nplay-access-title').textContent,'Pedido enviado!');assert(l.node('nplay-access-request').hidden);assert.match(l.node('nplay-access-hint').textContent,/automaticamente/);
});
test('approval after a pending request opens and reloads the catalog, including on a manual check',async()=>{
 const l=lab({status:'pending'});await settle();l.state.status='approved';await l.click('nplay-access-retry');assert.equal(l.node('nplay-access-wall').hidden,true);assert.equal(l.state.reloads,1);
});
test('already approved viewers and admins enter directly without a reload loop',async()=>{
 for(const state of [{status:'approved'},{admin:true}]){const l=lab(state);await settle();assert(l.node('nplay-access-wall').hidden);assert.equal(l.state.reloads,0);assert.equal(l.state.inserts,0);}
});
test('network failures retain the device identity and show actionable copy without raw backend errors',async()=>{
 const l=lab();await settle();l.state.authError={status:0,message:'Failed to fetch Supabase internal'};await l.click('nplay-access-request');assert.equal(l.node('nplay-access-title').textContent,'Não conseguimos conectar agora');assert.equal(l.node('nplay-access-retry').textContent,'Tentar novamente');assert.equal(l.node('nplay-access-code').textContent,'A26AA953');assert.equal(l.state.anonymous,0);assert.equal(l.state.inserts,0);assert(!l.node('nplay-access-status').textContent.includes('Supabase'));
 l.state.authError=null;await l.click('nplay-access-retry');assert.equal(l.node('nplay-access-title').textContent,'Solicite seu acesso');
});
test('duplicate requests read existing status while revoked or denied access cannot be overwritten',async()=>{
 const l=lab({insertError:{code:'23505'}});await settle();await l.click('nplay-access-request');assert.equal(l.node('nplay-access-title').textContent,'Pedido enviado!');
 for(const status of ['revoked','denied']){const denied=lab({status});await settle();assert(denied.node('nplay-access-request').hidden);assert.equal(denied.node('nplay-access-title').textContent,'Fale com o responsável');await denied.click('nplay-access-request');assert.equal(denied.state.inserts,0);}
});
