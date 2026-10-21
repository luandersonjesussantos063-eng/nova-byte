import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../assets/monetization.js',import.meta.url),'utf8');
function lab({app=true,approved=false,selected=false,kids=false,visible=true}={}){
 const scripts=[],events=new Map(),nodes=new Map();let changed;
 if(app){nodes.set('nplay-access-wall',{hidden:approved});nodes.set('nplay-profile-gate',{hidden:selected});}
 const document={readyState:'complete',visibilityState:visible?'visible':'hidden',documentElement:{dataset:{nplayAccess:approved?'approved':'loading'}},getElementById:id=>nodes.get(id),querySelector:()=>scripts[0],createElement:()=>({dataset:{}}),head:{append:s=>scripts.push(s)},addEventListener:(n,f)=>events.set(n,f)};
 const window={NPlayProfiles:{current:()=>({kids})},addEventListener:(n,f)=>events.set(n,f)};
 vm.runInNewContext(source,{document,window,MutationObserver:class{constructor(f){changed=f;}observe(){}}});
 return {scripts,document,nodes,event:n=>events.get(n)?.(),changed:()=>changed?.()};
}
test('public presentation loads the existing publisher only once',()=>{
 const l=lab({app:false});assert.equal(l.scripts.length,1);assert.match(l.scripts[0].src,/client=ca-pub-2466231259507657$/);assert.equal(l.scripts[0].async,true);assert.equal(l.scripts[0].crossOrigin,'anonymous');l.event('visibilitychange');assert.equal(l.scripts.length,1);
});
test('access approval AND profile selection are required; loading state cannot advertise',()=>{
 const l=lab({selected:true});assert.equal(l.scripts.length,0);
 l.nodes.get('nplay-access-wall').hidden=true;l.changed();assert.equal(l.scripts.length,0);
 l.document.documentElement.dataset.nplayAccess='approved';l.event('nplay-access-state');assert.equal(l.scripts.length,1);
 const other=lab({approved:true});assert.equal(other.scripts.length,0);other.nodes.get('nplay-profile-gate').hidden=true;other.changed();assert.equal(other.scripts.length,1);other.changed();assert.equal(other.scripts.length,1);
});
test('no ad script is requested for an initially selected kids profile or hidden tab',()=>{
 assert.equal(lab({approved:true,selected:true,kids:true}).scripts.length,0);
 const l=lab({app:false,visible:false});assert.equal(l.scripts.length,0);l.document.visibilityState='visible';l.event('visibilitychange');assert.equal(l.scripts.length,1);
});
test('public pages have canonical indexable URLs; access/admin protections remain',()=>{
 const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
 const robots=read('robots.txt');
 assert(!/^Disallow:\s*\/novaplay\/\s*$/m.test(robots));assert(robots.includes('Disallow: /novaplay/admin/'));
 for(const file of ['index.html','sobre.html','privacidade.html']){
  const html=read('novaplay/'+file);const url='https://novabytesolucoes.com.br/novaplay/'+(file==='index.html'?'':file);
  assert(html.includes('href="'+url+'"'));assert(html.includes('content="index,follow,max-image-preview:large"'));assert(read('sitemap.xml').includes('<loc>'+url+'</loc>'));
 }
 const main=read('novaplay/index.html');assert(main.includes('id="nplay-access-wall"'));assert(main.includes('./access.js?v='));assert(main.includes('id="nplay-profile-gate"'));
 assert(read('novaplay/admin/index.html').includes('noindex'));assert.match(read('ads.txt'),/google\.com, pub-2466231259507657, DIRECT, f08c47fec0942fa0/);
});
