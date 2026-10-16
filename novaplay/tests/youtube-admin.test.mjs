import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const c=vm.createContext({window:{},URL});vm.runInContext(read('admin/youtube-manager.js'),c);
const admin=read('admin/admin.js');vm.runInContext(admin.slice(admin.indexOf('function extractYoutubeId('),admin.indexOf('function parseGoogleDriveLink(')),c);
const api=c.window.NPlayYouTubeAdmin,parse=c.extractYoutubeId;
const values={url:'https://youtu.be/WhWc3b3KhnY',title:'Spring',category:'Curtas e animações',channel:'Blender Studio',description:'Uma animação.',minutes:'8',rights:true,publish:true};
test('new links preserve category, channel, rights confirmation, thumbnail ID and draft choice',()=>{
 const row=api.payload(values,{id:'owner'},parse);
 assert.equal(row.youtube_id,'WhWc3b3KhnY');assert.equal(row.genre,'Curtas e animações');assert.equal(row.duration_seconds,480);
 assert.match(row.description,/^Canal: Blender Studio$/m);assert.equal(row.created_by,'owner');assert.equal(row.rights_reviewed,true);
 assert.equal(api.payload({...values,publish:false,minutes:''},{id:'owner'},parse).is_published,false);
});
test('invalid sources, categories, durations, missing rights and signed-out users never form a payload',()=>{
 for(const changed of [{url:'https://evil.example/watch?v=WhWc3b3KhnY'},{category:'Outra'},{rights:false},{minutes:'NaN'},{minutes:'-1'},{title:'A'}])assert.throws(()=>api.payload({...values,...changed},{id:'owner'},parse));
 assert.throws(()=>api.payload(values,null,parse));
 for(const url of ['https://www.youtube.com/watch?v=WhWc3b3KhnY','https://www.youtube.com/shorts/WhWc3b3KhnY','https://youtu.be/WhWc3b3KhnY?si=test'])assert.equal(parse(url),'WhWc3b3KhnY');
});
function harness({duplicate=false,fail=false}={}){
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,hidden:false,disabled:false,textContent:'',classList:{toggle(){}},addEventListener(){},removeAttribute(){}});return nodes.get(id)};
 get('yt-admin-form').reset=()=>{get('yt-admin-url').value='';};
 for(const [key,id] of Object.entries({url:'url',title:'title',category:'category',channel:'channel',description:'description',minutes:'duration'}))get('yt-admin-'+id).value=values[key];
 get('yt-admin-rights').checked=true;get('yt-admin-publish').checked=false;
 const writes=[];let refreshed=0,locked=false;
 const client={from(){return {
  select:()=>({eq:()=>({limit:async()=>({data:duplicate?[{id:'existing'}]:[],error:null})})}),
  insert(row){writes.push(row);return {select:()=>({single:async()=>fail?{error:new Error('Falha de rede')}:{data:{id:'new',is_published:row.is_published}}})};}
 };}};
 const ctx=vm.createContext({window:{},document:{getElementById:get}});vm.runInContext(read('admin/youtube-manager.js'),ctx);
 ctx.window.NPlayYouTubeAdmin.init({client,getUser:()=>({id:'owner'}),parseId:parse,refresh:async()=>{refreshed++},errorText:e=>e.message,isBusy:()=>locked,setBusy:v=>{locked=v}});
 return {get,writes,refreshed:()=>refreshed,submit:()=>get('yt-admin-form').onsubmit({preventDefault(){}})};
}
test('save uses the authenticated client, stops double submits and preserves draft publication state',async()=>{
 const h=harness();await Promise.all([h.submit(),h.submit()]);assert.equal(h.writes.length,1);assert.equal(h.writes[0].is_published,false);assert.equal(h.refreshed(),1);assert.match(h.get('yt-admin-status').textContent,/rascunho/);assert.equal(h.get('yt-admin-fields').disabled,false);
});
test('duplicate and failed saves keep the entered form and release its controls',async()=>{
 const h=harness({duplicate:true});await h.submit();assert.equal(h.writes.length,0);assert.match(h.get('yt-admin-status').textContent,/já está cadastrado/);assert.equal(h.get('yt-admin-url').value,values.url);
 const f=harness({fail:true});await f.submit();assert.match(f.get('yt-admin-status').textContent,/Falha de rede/);assert.equal(f.get('yt-admin-url').value,values.url);assert.equal(f.get('yt-admin-fields').disabled,false);
});
test('main YouTube playback requests audio and retains the official controls',()=>{
 const app=read('app.js'),start=app.lastIndexOf('if(media.youtube_id){'),end=app.indexOf('}else if(media.google_drive_id)',start),els=new Map();
 const get=id=>{if(!els.has(id))els.set(id,{});return els.get(id)};
 const ctx=vm.createContext({media:{youtube_id:'WhWc3b3KhnY'},$:get,v:{pause(){}},fail:message=>{throw Error(message)}});
 vm.runInContext('(function(){'+app.slice(start,end)+'}})()',ctx);
 const url=new URL(get('fallback-frame').src);assert.equal(url.searchParams.get('mute'),'0');assert.equal(url.searchParams.get('controls'),'1');assert.equal(url.searchParams.get('autoplay'),'1');
 const html=read('admin/index.html');assert(html.includes('data-admin-tab="youtube"'));assert(html.indexOf('src="./youtube-manager.js')<html.indexOf('load("./admin.js'));
});
