import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {iptvAdmin} from '../worker/iptv-api.mjs';
const source=readFileSync(new URL('../admin/iptv-accounts.js',import.meta.url),'utf8');
const start=source.indexOf('async function removeAccount('),end=source.indexOf('\nwindow.NPlayIptvAdmin',start);
const remove=vm.runInNewContext(source.slice(start,end)+'\nremoveAccount;');
const item={id:'11111111-1111-5111-8111-111111111111',label:'Cliente teste',username:'teste_1'};
test('delete requires confirmation and submits only the selected account ID',async()=>{
 let calls=0,payload,action;
 const request=async(a,p)=>{calls++;action=a;payload=p;return {ok:true,id:item.id};};
 assert.equal(await remove(item,{confirmDelete:()=>false,request}),false);assert.equal(calls,0);
 assert.equal(await remove(item,{confirmDelete:message=>{assert(message.includes(item.username));return true;},request}),true);assert.equal(calls,1);assert.equal(action,'delete');assert.equal(payload.id,item.id);assert.deepEqual(Object.keys(payload),['id']);
});
test('failed or unconfirmed deletions cannot claim success',async()=>{
 await assert.rejects(remove(item,{confirmDelete:()=>true,request:async()=>({ok:true,id:'different'})}),/confirmar a exclusão/);
 await assert.rejects(remove(item,{confirmDelete:()=>true,request:async()=>{throw Error('Denied');}}),/Denied/);
});
test('the gateway forwards delete through the admin-authenticated RPC without private keys',async()=>{
 const previous=globalThis.fetch;let request;
 globalThis.fetch=async(url,options)=>{request={url,options};return Response.json({ok:true,id:item.id});};
 try{
 const result=await iptvAdmin(new Request('https://gateway.example/admin/iptv',{method:'POST',body:JSON.stringify({action:'delete',data:{id:item.id}})}),'admin-jwt');
 assert.equal(result.status,200);assert.equal(request.options.headers.Authorization,'Bearer admin-jwt');const body=JSON.parse(request.options.body);assert.equal(body.p_action,'delete');assert.equal(body.p_input.id,item.id);
 }finally{globalThis.fetch=previous;}
});
