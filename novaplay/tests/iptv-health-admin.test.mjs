import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../admin/iptv-accounts.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
const begin=code.indexOf('async function checkIptvServer(){');
const finish=code.indexOf('\nasync function update(',begin);
assert(begin>0&&finish>begin,'connection diagnostic must exist');
const functionCode=code.slice(begin,finish)+'\ncheckIptvServer;';
function testServer(status=401,{failHealth=false}={}){
 const node={disabled:false,textContent:''},button={disabled:false};
 const calls=[];
 const ctx={server:'https://nplay-live-gateway.luandersonjesussantos063.workers.dev',
   $:name=>name==='iptv-check-server'?button:node,
   fetch:async(url,options)=>{
    calls.push({url:String(url),method:options.method});
    if(failHealth)throw Error('offline');
    if(String(url).endsWith('/health'))return {status:200,ok:true};
    return {status,ok:status>=200&&status<300};
   },
   AbortController, setTimeout:()=>1,clearTimeout:()=>{}
 };
 const check=vm.runInNewContext(functionCode,ctx);
 return {run:check,calls,node,button};
}
test('connectivity check exercises gateway health and fake-user authentication safely',async()=>{
 const h=testServer(401);
 await h.run();
 assert.equal(h.calls.length,2);
 assert.equal(h.calls[0].method,'GET');
 assert.equal(h.calls[1].method,'HEAD');
 assert.match(h.calls[1].url,/diag_gateway_check/);
 assert.match(h.node.textContent,/Banco e serviço de login responderam corretamente/);
 assert.equal(h.button.disabled,false);
});
test('database / gateway errors are reported separately without exposing passwords',async()=>{
 const bad=testServer(503);
 await bad.run();
 assert.match(bad.node.textContent,/HTTP 503/);
 const offline=testServer(401,{failHealth:true});
 await offline.run();
 assert.match(offline.node.textContent,/Não foi possível acessar o gateway/);
 assert.doesNotMatch(code,/pass(word)?[:=]\s*['"](?:[a-zA-Z0-9]{12,})['"]/i);
});
test('the admin UI has an explicit test button and shows client expiry time in Mato Grosso',()=>{
 assert.match(html,/id="iptv-check-server"/);
 assert.match(html,/id="iptv-health-result"/);
 assert.match(html,/iptv-accounts\.js\?v=0\.52\.2-check-server/);
 assert.match(code,/timeZone:'America\/Cuiaba'/);
});
