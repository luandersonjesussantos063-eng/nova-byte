import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEpg,epgUrl,channelEpg,programmeTitle} from '../worker/epg.mjs';
import worker from '../worker/live-gateway.mjs';
const now=1800000000000;
test('EPG selects now and next using timestamps, decodes UTF-8 and rejects expired/ambiguous times',()=>{
 const title=Buffer.from('Sessão da tarde').toString('base64');
 const result=normalizeEpg([{title:'Old',start_timestamp:now/1000-200,end_timestamp:now/1000-100},{title,start_timestamp:now/1000-50,stop_timestamp:now/1000+50},{title:'Jornal',start_timestamp:now/1000+50,end_timestamp:now/1000+100},{title:'Timezone unknown',start:'2027-01-01 12:00:00',end:'2027-01-01 13:00:00'}],now);
 assert.equal(result.current.title,'Sessão da tarde');assert.equal(result.next.title,'Jornal');assert.equal(normalizeEpg([{title:'A',start_timestamp:now/1000-50,end_timestamp:now/1000}],now).current,null);
 assert.equal(programmeTitle('<img src=x onerror=alert(1)>Hello'),'Hello');
});
test('only saved Xtream stream roots are converted to the fixed metadata action',()=>{
 const u=new URL(epgUrl('https://provider.example/live/a/b/45.m3u8'));assert.equal(u.pathname,'/player_api.php');assert.equal(u.searchParams.get('stream_id'),'45');assert.equal(u.searchParams.get('action'),'get_short_epg');
 assert.equal(epgUrl('https://provider.example/arbitrary'),null);assert.equal(epgUrl('https://provider.example/a/b/45.ts?redirect=x'),null);
});
test('cached EPG is reused, expires at programme end and never returns credentials',async()=>{
 let calls=0;const entries=new Map();const cache={match:async k=>entries.get(k.url)?.clone(),put:async(k,r)=>entries.set(k.url,r)};
 const opts={id:'id',source:'https://provider.example/user/password/45.ts',origin:'https://gateway.example',now,cache,readJson:r=>r.json(),deliver:async()=>{calls++;return Response.json({epg_listings:[{title:'Live',start_timestamp:now/1000-10,end_timestamp:now/1000+10}]});}};
 const a=await channelEpg(opts);assert.equal(a.current.title,'Live');assert.equal(a.expires_at,now+10000);assert.ok(!JSON.stringify(a).includes('password'));
 await channelEpg(opts);assert.equal(calls,1);await channelEpg({...opts,now:now+10001});assert.equal(calls,2);
});
test('EPG requires authorization and rejects excessive batches before any supplier request',async()=>{
 const req=(body,token='viewer')=>new Request('https://gateway.example/epg',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
 assert.equal((await worker.fetch(req({ids:[]},''),{})).status,401);
 assert.equal((await worker.fetch(req({ids:Array(7).fill('11111111-1111-5111-8111-111111111111')}),{})).status,400);
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;return Response.json([]);};
 try{const r=await worker.fetch(req({ids:['11111111-1111-5111-8111-111111111111']}),{});assert.deepEqual(await r.json(),{channels:{}});assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
