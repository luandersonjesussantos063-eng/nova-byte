import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const window={};
vm.runInNewContext(readFileSync(new URL('../admin/pc-tv.js',import.meta.url),'utf8'),{window,document:{getElementById:()=>null,documentElement:{}},MutationObserver:class{observe(){}},URL});
const parse=window.NPlayPCConnection.parse,secret='b'.repeat(64);
test('connection file imports the full URL and exact key, including Windows CRLF and BOM',()=>{
 const text='\uFEFFENDERECO DO PC: https://example-pc.trycloudflare.com\r\nCHAVE DO PC: '+secret+'\r\n\r\nCole no ADM.';
 const result=parse(text);assert.equal(result.secret,secret);assert.equal(result.url,'https://example-pc.trycloudflare.com');
});
test('unrelated, oversized and invalid-key files cannot populate the connection',()=>{
 for(const text of ['a'.repeat(5000),'CHAVE DO PC: '+secret,'ENDERECO DO PC: https://foreign.example\nCHAVE DO PC: '+secret,'ENDERECO DO PC: https://example-pc.trycloudflare.com\nCHAVE DO PC: short'])assert.throws(()=>parse(text));
});

test('Railway connection file retains the private key and rejects foreign suffixes',()=>{
 assert.equal(parse('ENDERECO DO PC: https://node-test.up.railway.app\nCHAVE DO PC: '+secret).url,'https://node-test.up.railway.app');
 assert.throws(()=>parse('ENDERECO DO PC: https://node-test.up.railway.app.attacker.example\nCHAVE DO PC: '+secret));
});
