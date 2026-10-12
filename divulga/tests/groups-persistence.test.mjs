import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const storage=new Map();

function openApp(hash){
 const elements=new Map(),listeners=new Map();
 const get=(selector)=>{
  if(!elements.has(selector))elements.set(selector,{
   innerHTML:'',textContent:'',value:'',hidden:false,style:{},classList:{toggle(){}},focus(){},
   dataset:{},getAttribute:()=>null
  });
  return elements.get(selector);
 };
 const screens=['inicio','grupos','campanhas','fila','historico','config'].map(id=>get('#'+id));
 const document={
  querySelector:get,
  querySelectorAll:selector=>selector==='.screen'?screens:[],
  addEventListener:(name,cb)=>listeners.set(name,cb),
  body:{style:{}},
  hidden:false
 };
 const location={hash,hostname:'novabytesolucoes.com.br',host:'novabytesolucoes.com.br',origin:'https://novabytesolucoes.com.br'};
 const window={addEventListener(){},scrollTo(){}};
 const context={
  document,window,location,history:{replaceState(){}},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)},
  crypto:{randomUUID:()=>Math.random().toString(16).slice(2)},
  navigator:{},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,
  FormData:class{constructor(form){this.data=form.values}get(k){return this.data[k]??null}},
  URL,Date,Number,Math,String,Array,JSON,console
 };
 vm.runInNewContext(app,context,{timeout:2500});
 return {listeners,get};
}
test('novo grupo aparece imediatamente na lista e permanece após reabrir o site',()=>{
 storage.clear();
 const first=openApp('#grupos');
 const form={id:'groupForm',values:{
  name:'Ofertas e Classificados Lucas',
  url:'https://www.facebook.com/groups/123456789?ref=share',
  city:'Lucas do Rio Verde',cooldown:'24',rules:'Anúncios permitidos',notes:''
 }};
 first.listeners.get('submit')({target:form,preventDefault(){}});
 const stored=JSON.parse(storage.get('novabyte-divulga-v1'));
 assert.equal(stored.groups.length,1);
 assert.equal(stored.groups[0].name,'Ofertas e Classificados Lucas');
 assert.match(first.get('#groupList').innerHTML,/Ofertas e Classificados Lucas/);
 assert.match(first.get('#grupos').innerHTML,/1 grupo\(s\) salvo\(s\)/);
 const reopened=openApp('#grupos');
 assert.match(reopened.get('#groupList').innerHTML,/Ofertas e Classificados Lucas/);
 assert.match(reopened.get('#grupos').innerHTML,/1 grupo\(s\) salvo\(s\)/);
});
test('o botão atualizar lista e o backup existem na aba Grupos',()=>{
 const opened=openApp('#grupos');
 assert.match(opened.get('#grupos').innerHTML,/data-action="groups-reload"/);
 assert.match(opened.get('#grupos').innerHTML,/data-action="export"/);
});
test('o cadastro usa a mesma chave de dados sem limpar os registros',()=>{
 assert.match(app,/const KEY='novabyte-divulga-v1'/);
 assert.match(app,/state\.groups=id\?state\.groups\.map/);
 assert.doesNotMatch(app,/localStorage\.clear\(\)/);
});


test('cadastro mostra botão de colar link e explica que sugestão do teclado não preenche o campo',()=>{
 storage.clear();
 const screen=openApp('#inicio');
 screen.listeners.get('click')({target:{closest:selector=>selector==='[data-action]'?{dataset:{action:'group-new',id:''}}:null}});
 const modal=screen.get('#modalBody').innerHTML;
 assert.match(modal,/data-action="group-paste-link"/);
 assert.match(modal,/id="groupUrl"/);
 assert.match(modal,/O link precisa aparecer dentro deste campo/);
 assert.match(modal,/data-action="group-save"/);
 assert.match(modal,/id="groupFormError"/);
});
test('o usuário não consegue enviar um grupo quando o link está vazio',()=>{
 storage.clear();
 const screen=openApp('#inicio');
 const form=screen.get('#groupForm');
 let submits=0,focuses=0;
 form.elements={name:{value:'Lucas anuncia',focus(){focuses++}},url:{value:'',focus(){focuses++}}};
 form.requestSubmit=()=>{submits++};
 screen.listeners.get('click')({target:{closest:selector=>selector==='[data-action]'?{dataset:{action:'group-save'}}:null}});
 assert.equal(submits,0);
 assert.equal(focuses,1);
 assert.match(screen.get('#groupFormError').textContent,/link ainda não foi colado/);
 assert.equal(storage.has('novabyte-divulga-v1'),false);
 form.elements.url.value='https://www.facebook.com/share/g/AbcdEfGh';
 screen.listeners.get('click')({target:{closest:selector=>selector==='[data-action]'?{dataset:{action:'group-save'}}:null}});
 assert.equal(submits,1);
});
