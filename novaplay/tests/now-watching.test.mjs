import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../watching.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve))};
function setup(){
 const handlers=new Map(),elementEvents=new Map(),sent=[],requests=[];
 let profile={id:'11111111-1111-4111-8111-111111111111',name:'Teste'};
 let auth=true,pulseCount=0,visible='visible';
 const layer={hidden:false};
 const video={hidden:false,paused:false,readyState:4,
   addEventListener:(event,handler)=>elementEvents.set(event,handler)};
 const elements={'player-layer':layer,video,
   'nplay-access-wall':{hidden:true},'nplay-profile-gate':{hidden:true}};
 const window={
  NPlayPresence:{tabId:'33333333-3333-4333-8333-333333333333',pulse:async()=>{pulseCount++}},
  NPlayProfiles:{current:()=>profile},
  NPlayAccessClient:{
   supabaseUrl:'https://example.supabase.co',supabaseKey:'publishable-key',
   auth:{getSession:async()=>({data:{session:auth?{access_token:'valid-test-token'}:null}})},
   rpc:async(name,args)=>{sent.push({name,args});return {data:true,error:null}}
  },
  addEventListener:(event,handler)=>handlers.set('window:'+event,handler)
 };
 const document={hidden:false,get visibilityState(){return visible},getElementById:id=>elements[id],
  addEventListener:(event,handler)=>handlers.set('document:'+event,handler)};
 const timers=[],fetch=async(url,options)=>{requests.push({url,options})};
 vm.runInNewContext(source,{window,document,navigator:{onLine:true},console:{warn(){}},
  setInterval:(handler,period)=>timers.push({handler,period}),fetch,Date,JSON,
 });
 return {window,document,layer,video,sent,requests,timers,handlers,elementEvents,
  send:async detail=>{handlers.get('window:nplay:watch')({detail});await flush()},
  media:async kind=>{elementEvents.get(kind)();await flush()},
  hide:async()=>{visible='hidden';handlers.get('document:visibilitychange')();await flush()},
  show:async()=>{visible='visible';handlers.get('document:visibilitychange')();await flush()},
  switchProfile:async()=>{profile={id:'22222222-2222-4222-8222-222222222222',name:'Outro'};handlers.get('window:nplay-profile-change')();await flush()},
  setAuth:val=>auth=val,pulseCount:()=>pulseCount
 };
}
test('the real NPlay player dispatches safe title-only activity events',()=>{
 assert.match(app,/function notifyPlayback\(item,episode,state\)/);
 assert.match(app,/candidate\)\?candidate:'live-channel'/);
 assert.match(app,/notifyPlayback\(item,episode,'open'\)/);
 assert.match(app,/notifyPlayback\(current\.item,null,'open'\)/);
 assert.match(app,/notifyPlayback\(null,null,'stopped'\)/);
 assert.match(html,/watching\.js\?v=0\.51\.9-admin-watch-1/);
 assert.match(html,/name="nplay-version" content="0\.51\.9"/);
});
test('native videos appear as opening, playing, paused and stopped',async()=>{
 const h=setup();
 await h.send({id:'upload-123abc',title:'Filme autorizado',kind:'film',state:'open'});
 assert.equal(h.sent.at(-1).args.p_state,'open');
 assert.equal(h.sent.at(-1).args.p_title,'Filme autorizado');
 assert.equal(h.sent.at(-1).args.p_content_id,'upload-123abc');
 await h.media('playing');assert.equal(h.sent.at(-1).args.p_state,'playing');
 await h.media('pause');assert.equal(h.sent.at(-1).args.p_state,'paused');
 await h.media('ended');assert.equal(h.sent.at(-1).args.p_state,'stopped');
 assert.equal(h.sent.at(-1).args.p_title,null);
 assert(h.pulseCount()>0);
});
test('YouTube embeds cannot be falsely confirmed as playing',async()=>{
 const h=setup();
 h.video.hidden=true;
 await h.send({id:'upload-yt-1',title:'Vídeo YouTube',kind:'youtube',state:'open'});
 assert.equal(h.sent.at(-1).args.p_state,'open');
 const count=h.sent.length;
 await h.media('playing');assert.equal(h.sent.length,count);
});
test('client never sends IPTV URLs, tokens, or invalid content IDs to the database',async()=>{
 const h=setup();
 await h.send({id:'live-https://upstream.example/watch?token=private',title:'Canal',kind:'tv',state:'open'});
 assert.equal(h.sent.length,0);
 await h.send({id:'live-channel',title:'Canal',kind:'tv',state:'open'});
 assert.equal(h.sent.at(-1).args.p_content_id,'live-channel');
 assert(!JSON.stringify(h.sent).includes('upstream.example'));
});
test('background, close and profile switch clear now-watching state',async()=>{
 const h=setup();
 await h.send({id:'film-1',title:'Documentário',kind:'film',state:'open'});
 await h.media('playing');
 await h.hide();assert.equal(h.sent.at(-1).args.p_state,'stopped');
 h.video.paused=true;
 await h.show();assert.equal(h.sent.at(-1).args.p_state,'paused');
 await h.switchProfile();assert.equal(h.sent.at(-1).args.p_state,'stopped');
 assert.equal(h.sent.at(-1).args.p_profile,'11111111-1111-4111-8111-111111111111');
});
test('pagehide sends only authorized keepalive to mark playback stopped',async()=>{
 const h=setup();
 await h.send({id:'film-1',title:'Meu filme',kind:'film',state:'open'});
 h.handlers.get('window:pagehide')();
 await flush();
 assert.equal(h.requests.length,1);
 assert.equal(h.requests[0].options.keepalive,true);
 assert.equal(h.requests[0].options.headers.authorization,'Bearer valid-test-token');
 assert.equal(JSON.parse(h.requests[0].options.body).p_state,'stopped');
});
test('unauthenticated clients cannot record playback',async()=>{
 const h=setup();
 h.setAuth(false);
 await h.send({id:'film-1',title:'Conteúdo',kind:'film',state:'open'});
 assert.equal(h.sent.length,0);
});
test('admin-only fixes do not generate new customer-release notifications',()=>{
 const notices=fs.readFileSync(new URL('../assets/notifications.js',import.meta.url),'utf8');
 assert.match(notices,/const current=selected\?convert\(selected\):null/);
 assert.doesNotMatch(notices,/Uma atualização do aplicativo está disponível/);
 assert(!html.includes('release-notes.js?v=0.52'));
});
