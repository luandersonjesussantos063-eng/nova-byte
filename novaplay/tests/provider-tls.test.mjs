import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {X509Certificate} from 'node:crypto';
import {ProviderTlsTrust} from '../pc-tv/provider-tls.mjs';

async function fixture(dir,name){
 const key=join(dir,name+'.key'),cert=join(dir,name+'.pem');
 const r=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=generic-provider'],{stdio:'ignore'});
 assert.equal(r.status,0,'OpenSSL certificate generation');
 return {key:await readFile(key),cert:await readFile(cert)};
}
function get(url,options={}){
 return new Promise((resolve,reject)=>{
  const q=https.get(url,{...options,lookup:(_h,o,cb)=>cb(null,o.all?[{address:'127.0.0.1',family:4}]:'127.0.0.1',4),headers:{Authorization:'Bearer fixture-only'},agent:false},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});
  q.on('error',reject);q.setTimeout(3000,()=>q.destroy(Error('timeout')));
 });
}
test('only the independently approved certificate can receive HTTP credentials, even with a generic CN',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nplay-tls-'));let server;
 try{
  const first=await fixture(dir,'first'),second=await fixture(dir,'second');let requests=0;
  server=https.createServer(first,(_q,r)=>{requests++;r.end('fixture');});
  server.on('tlsClientError',()=>{});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='https://provider.example:'+server.address().port;
  const fingerprint=new X509Certificate(first.cert).fingerprint256;
  await assert.rejects(get(origin),{code:'DEPTH_ZERO_SELF_SIGNED_CERT'});assert.equal(requests,0);
  const trust=new ProviderTlsTrust({origin,fingerprint});
  const options=await trust.options(new URL(origin),'127.0.0.1',AbortSignal.timeout(5000));
  assert.equal(requests,0,'certificate bootstrap sends no HTTP request');
  assert.equal(options.rejectUnauthorized,true);
  assert.equal(await get(origin,options),200);assert.equal(requests,1);
  const wrong=new ProviderTlsTrust({origin,fingerprint:'00'.repeat(32)});
  await assert.rejects(wrong.options(new URL(origin),'127.0.0.1'),{code:'NPLAY_TLS_PIN_MISMATCH'});
  assert.equal(requests,1,'wrong certificate gets no HTTP credentials');
  assert.deepEqual(await trust.options(new URL('https://other.example'),'127.0.0.1'),{});
  assert.deepEqual(await trust.options(new URL('https://provider.example'),'127.0.0.1'),{});
  assert.ok(options.checkServerIdentity('other.example',new X509Certificate(first.cert).toLegacyObject()));
  server.setSecureContext(second);
  await assert.rejects(get(origin,options));assert.equal(requests,1,'certificate rotation fails before HTTP');
 }finally{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  await rm(dir,{recursive:true,force:true});
 }
});
test('HTTPS upgrades are limited to the configured host and standard port; Xtream cookies use the HTTPS origin',()=>{
 const fingerprint='12'.repeat(32),trust=new ProviderTlsTrust({origin:'https://provider.example',fingerprint});
 assert.equal(trust.normalize('http://provider.example/user/pass/1.m3u8').href,'https://provider.example/user/pass/1.m3u8');
 assert.equal(trust.normalize('http://provider.example:8080/a').protocol,'http:');
 assert.equal(trust.normalize('http://other.example/a').protocol,'http:');
 assert.equal(trust.normalize('http://provider.example.evil.example/a').protocol,'http:');
 assert.throws(()=>new ProviderTlsTrust({origin:'https://provider.example',fingerprint:'invalid'}),{code:'NPLAY_TLS_CONFIG'});
 const r=spawnSync(process.execPath,['--input-type=module','-e',"import {xtreamIdentity} from './novaplay/pc-tv/xtream-client.mjs'; console.log(xtreamIdentity('http://provider.example/user/pass/1.m3u8').origin)"],{cwd:new URL('../../',import.meta.url),env:{...process.env,NPLAY_TLS_PINNED_HOST:'provider.example',NPLAY_TLS_PINNED_SHA256:fingerprint},encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'https://provider.example');
});
