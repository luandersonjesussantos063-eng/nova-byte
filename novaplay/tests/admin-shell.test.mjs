import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../admin/'+path,import.meta.url),'utf8');
const html=read('index.html');
function shell(){
 const names=[...html.matchAll(/data-admin-tab="([^"]+)"/g)].map(x=>x[1]);
 class Node{
  constructor(id=''){this.id=id;this.hidden=false;this.dataset={};this.events={};this.attrs={};this.children=[];this.style={};this.value='';const classes=new Set();this.classList={add:x=>classes.add(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)};}
  addEventListener(e,fn){(this.events[e]??=[]).push(fn);}emit(e,event={}){for(const fn of this.events[e]||[])fn(event);}click(){this.emit('click');}focus(){this.focused=true;}setAttribute(k,v){this.attrs[k]=v;}closest(){return null;}append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}before(){}
 }
 const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Node(m[1])]));
 const library=new Node('library'),editor=new Node('editor'),featured=new Node('featured'),licensed=new Node('licensed'),issues=new Node('issues'),intro=new Node('intro'),stats=new Node('stats'),workspace=new Node('workspace');
 nodes.get('magnet-pending-list').parentElement=null;
 const buttons=names.map(name=>{const node=new Node();node.dataset.adminTab=name;return node;});
 const query={'.workspace .library':library,'.workspace .editor':editor,'.featured-manager':featured,'.licensed-manager':licensed,'.issue-manager':issues,'.intro-text':intro,'.stats':stats,'.workspace':workspace};
 nodes.get('dashboard').querySelector=s=>query[s]||null;nodes.get('dashboard').querySelectorAll=()=>buttons;
 const document={readyState:'complete',getElementById:id=>nodes.get(id)||null,createElement:()=>new Node()};
 const scrolls=[];const window={scrollY:0,scrollTo:x=>scrolls.push(x),addEventListener(){}};let saved='';
 vm.runInNewContext(read('admin-shell.js'),{document,window,sessionStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v}});
 const panels={catalogo:[library],importacoes:[editor],youtube:[nodes.get('youtube-manager')],canais:[nodes.get('live-embed-manager')],online:[nodes.get('nplay-presence-admin')],acessos:[nodes.get('nplay-access-admin')],iptv:[nodes.get('nplay-iptv-admin')],avisos:[nodes.get('nplay-news-admin')],destaques:[featured],ferramentas:[nodes.get('admin-diagnostics'),nodes.get('portal-auth-manager'),licensed,issues]};
 return {nodes,buttons,panels,scrolls};
}
test('every recorded admin area switches independently, including the tools-only diagnostic panel',()=>{
 const h=shell();assert.equal(h.buttons.length,10);
 for(const button of h.buttons){button.click();const selected=button.dataset.adminTab;
  assert.equal(h.nodes.get('admin-area-select').value,selected);assert.equal(button.attrs['aria-selected'],'true');
  for(const [name,panels] of Object.entries(h.panels))for(const panel of panels)assert.equal(panel.hidden,name!==selected,selected+': '+name);
 }
});
test('mobile selection and desktop keyboard navigation use the same tab actions',()=>{
 const h=shell(),select=h.nodes.get('admin-area-select');select.value='iptv';select.emit('change');assert.equal(h.panels.iptv[0].hidden,false);
 let prevented=false;h.buttons[0].emit('keydown',{key:'End',preventDefault:()=>prevented=true});assert(prevented);assert.equal(select.value,'ferramentas');assert(h.buttons.at(-1).focused);
});
test('obsolete previews are removed and diagnostics cannot fall back into the navigation grid',()=>{
 assert(!html.includes('id="tv-preview-admin"'));assert(!html.includes('src="./tv-previews.js'));assert(html.includes('id="iptv-diagnostic-host"'));
 const diagnostics=read('iptv-diagnostics.js');assert(diagnostics.includes("host.append(root)"));assert(!diagnostics.includes('tab.parentElement'));
 for(const id of ['iptv-search','iptv-filter','access-search','access-filter','presence-search','presence-filter'])assert(html.includes('id="'+id+'"'));
});
test('access filters ignore accents and technical user-agent strings are summarized without losing device detail',()=>{
 const code=read('access-admin.js'),window={};vm.runInNewContext(code,{window,document:{readyState:'loading',addEventListener(){}},URL,Set,Date});
 const core=window.NPlayAccessAdmin,rows=[{user_id:'a',display_name:'João',status:'pending'},{user_id:'b',display_name:'Maria',status:'approved'}];
 assert.equal(core.filterRequests(rows,'joao','pending').length,1);assert.equal(core.filterRequests(rows,'','approved')[0].user_id,'b');
 assert.equal(core.deviceName('Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/130 Safari/537'),'Android · Chrome');assert.equal(core.deviceName('iPhone Mac OS AppleWebKit Version/18 Safari/605'),'iPhone · Safari');
});
test('IPTV search distinguishes active, expired and blocked accesses without changing stored accounts',()=>{
 const code=read('iptv-accounts.js'),start=code.indexOf('function filterAccounts('),end=code.indexOf('async function removeAccount(',start);
 const filter=vm.runInNewContext(code.slice(start,end)+'\nfilterAccounts;');const now=Date.now();const rows=[{label:'José',username:'jose',enabled:true,expires_at:new Date(now+1000).toISOString()},{label:'Antigo',username:'old',enabled:true,expires_at:new Date(now-1000).toISOString()},{label:'Bloqueado',username:'block',enabled:false,expires_at:new Date(now+1000).toISOString()}];
 assert.equal(filter(rows,'jose','active',now).length,1);assert.equal(filter(rows,'','expired',now)[0].username,'old');assert.equal(filter(rows,'','blocked',now)[0].username,'block');assert.equal(rows.length,3);
});
