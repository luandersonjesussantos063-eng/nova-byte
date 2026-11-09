import test from 'node:test';import assert from 'node:assert/strict';
import {validateUrl,resolvePublicHost,publicIPv4,safeFetch,pinnedFetch} from '../supabase/functions/site-audit/safe-http.mjs';
import {EventEmitter} from 'node:events';
test('blocks private addresses, alternate encodings, credentials, non-HTTPS and custom ports',()=>{
 for(const url of ['https://127.0.0.1','https://[::1]','https://[fd00::1]','https://[::ffff:127.0.0.1]','https://2130706433','https://0x7f000001','http://example.com','https://example.com:8443','https://user:pass@example.com','https://foo.local','https://example.com.'])assert.throws(()=>validateUrl(url),url);
 assert.equal(validateUrl('https://novabytesolucoes.com.br/path?q=1#x').href,'https://novabytesolucoes.com.br/path?q=1');
});
test('rejects private DNS answers and mixed public/private answers',async()=>{
 for(const rows of [[{address:'10.1.2.3',family:4}],[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}],[{address:'::1',family:6}]])await assert.rejects(()=>resolvePublicHost('example.com',async()=>rows));
 assert.equal(await resolvePublicHost('example.com',async()=>[{address:'8.8.8.8',family:4}]),'8.8.8.8');
});
test('blocks reserved IPv4 ranges',()=>{
 for(const ip of ['0.0.0.0','100.64.0.1','169.254.169.254','172.31.1.1','192.168.1.1','192.0.2.1','198.18.0.1','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255'])assert.equal(publicIPv4(ip),false,ip);
});
test('connects to pinned approved IP with original Host and TLS identity',async()=>{
 let options;
 const transport=(config,callback)=>{
  options=config;const req=new EventEmitter();req.destroy=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'text/html'};res.destroy=()=>{};callback(res);res.emit('data',Buffer.from('<h1>Safe</h1>'));res.emit('end');};return req;
 };
 const result=await pinnedFetch('https://example.com/page',{resolver:async()=>[{address:'8.8.8.8',family:4}],transport});
 assert.equal(options.hostname,'8.8.8.8');assert.equal(options.servername,'example.com');assert.equal(options.headers.Host,'example.com');assert.equal(options.rejectUnauthorized,true);assert.equal(await result.text(),'<h1>Safe</h1>');
});
test('redirect destinations are revalidated before another network request',async()=>{
 let calls=0;await assert.rejects(()=>safeFetch(new URL('https://example.com'),1000,3,async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://[::1]/'}});}));assert.equal(calls,1);
});
