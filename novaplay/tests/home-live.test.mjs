import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function selectHomeLiveChannels('),app.indexOf('const defaultFeatured=[];'));
const ids=['2a538992-1915-43d7-b115-bf83afe34194','5ca05f1a-72f5-4925-bb91-809b99e99c3c','084c6066-f604-4b5c-8dec-c236ca140ec0','27482c9d-3abf-45c8-9b95-56b3996465a5'];
const rows=ids.map((id,i)=>({id,title:'Published channel '+i,embed_url:'https://video.test/'+i+'.m3u8',stream_type:'hls'}));
function lab(){const context=vm.createContext({window:{},URL,all:[],map:new Map(),homeLiveChannels:[],renderRows(){}});vm.runInContext(source,context);return context;}
test('home live shelf has the four requested channels in order and never adds unrelated streams',()=>{
 const c=lab(),channels=c.selectHomeLiveChannels([...rows].reverse().concat({id:'other',embed_url:'https://video.test/other.m3u8',stream_type:'hls'}));
 assert.equal(channels.map(x=>x.title).join('|'),'Nick Online HD|NTV Brazil|Comedy Central Brasil|SBT Interior SP');assert(channels.every(x=>x.mode==='hls'&&x.live));assert.equal(channels[0].customLabel,'Nick Online HD');assert.match(channels[3].cover,/sbt\.png$/);
});
test('reloads replace home entries, remove withdrawn channels and reject duplicate or unsafe sources',()=>{
 const c=lab();c.window.NPlayHomeLive.setChannels(rows);assert.equal(c.all.length,4);c.window.NPlayHomeLive.setChannels(rows.slice(0,2));assert.equal(c.all.length,2);assert.equal(c.map.size,2);
 assert.equal(c.selectHomeLiveChannels([{...rows[0],embed_url:'http://video.test/live.m3u8'}]).length,0);
 assert.equal(c.selectHomeLiveChannels([{...rows[0],embed_url:'https://user:pass@video.test/live.m3u8'}]).length,0);
 assert.equal(c.selectHomeLiveChannels([rows[0],{...rows[1],embed_url:rows[0].embed_url}]).length,1);
 c.window.NPlayHomeLive.setChannels([]);assert.equal(c.all.length,0);assert.equal(c.map.size,0);
});
