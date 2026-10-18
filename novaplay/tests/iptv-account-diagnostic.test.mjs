import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../admin/iptv-accounts.js',import.meta.url),'utf8');
const start=source.indexOf('async function diagnoseIptvAccount(');
const end=source.indexOf('\nasync function update(',start);
assert(start>0&&end>start,'missing account diagnostic implementation');
const body=source.slice(start,end)+'\ndiagnoseIptvAccount;';

function setup({accepted=true,streams=[{stream_id:1},{stream_id:2}],catalogHttp=200,fail=false}={}){
 const requests=[],messages=[];
 const secret='my-long-test-password';
 const scope={
  server:'https://gateway.example',
  URLSearchParams,AbortController,
  setTimeout,clearTimeout,
  fetch:async(url,options)=>{
   if(fail)throw Error('offline');
   const parsed=new URLSearchParams(options.body.toString());
   requests.push({url:String(url),options,params:parsed});
   assert.equal(String(url),'https://gateway.example/player_api.php');
   assert.equal(options.method,'POST');
   assert.equal(options.credentials,'omit');
   assert.equal(options.referrerPolicy,'no-referrer');
   assert.equal(options.cache,'no-store');
   assert.equal(parsed.get('username'),'cliente_1');
   assert.equal(parsed.get('password'),secret);
   if(parsed.has('action'))return {status:catalogHttp,ok:catalogHttp===200,json:async()=>streams};
   return {status:200,ok:true,json:async()=>({user_info:{auth:accepted?1:0,status:accepted?'Active':'Disabled',active_cons:0,max_connections:1}})};
  }
 };
 return {run:vm.runInNewContext(body,vm.createContext(scope)),requests,messages,secret,
  report:t=>messages.push(t)};
}

test('valid credentials authenticate and load Xtream channels without putting passwords in URLs',async()=>{
 const s=setup();
 const result=await s.run('cliente_1',s.secret,s.report);
 assert.equal(result.ok,true);
 assert.equal(result.count,2);
 assert.equal(s.requests.length,2);
 assert.equal(s.requests[0].params.get('action'),null);
 assert.equal(s.requests[1].params.get('action'),'get_live_streams');
 assert(s.messages.at(-1).includes('Grade Xtream carregada: 2 canais'));
 assert(!JSON.stringify(s.messages).includes(s.secret));
 assert(s.requests.every(r=>!r.url.includes(s.secret)));
});

test('invalid client password is diagnosed before requesting the catalog',async()=>{
 const s=setup({accepted:false});
 const result=await s.run('cliente_1',s.secret,s.report);
 assert.equal(result.ok,false);
 assert.equal(result.stage,'login');
 assert.equal(s.requests.length,1);
 assert.match(s.messages.at(-1),/não autenticou/);
});

test('accepted login but failed catalog is identified as a separate fault',async()=>{
 const s=setup({catalogHttp:503});
 const result=await s.run('cliente_1',s.secret,s.report);
 assert.equal(result.stage,'catalog');
 assert.equal(s.requests.length,2);
 assert.match(s.messages.at(-1),/Falha ao carregar a grade.*HTTP 503/);
});

test('accepted login and empty catalog are not treated as a working stream service',async()=>{
 const s=setup({streams:[]});
 const result=await s.run('cliente_1',s.secret,s.report);
 assert.equal(result.stage,'catalog-empty');
 assert.equal(result.ok,false);
 assert.match(s.messages.at(-1),/grade veio vazia/);
});

test('network failures and missing credentials display safe errors only',async()=>{
 const s=setup({fail:true});
 const result=await s.run('cliente_1',s.secret,s.report);
 assert.equal(result.stage,'network');
 assert.match(s.messages.at(-1),/Não foi possível completar/);
 assert(!JSON.stringify(s.messages).includes(s.secret));
 const missing=setup();
 const invalid=await missing.run('cliente_1','short',missing.report);
 assert.equal(invalid.stage,'input');
 assert.equal(missing.requests.length,0);
});
