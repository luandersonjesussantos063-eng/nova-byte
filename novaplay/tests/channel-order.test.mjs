import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function core(){const c=vm.createContext({window:{}});vm.runInContext(read('assets/channel-order.js'),c);return c.window.NPlayChannelOrder;}
const row=(title,id,extra={})=>({id,title,stream_type:'hls',category:'Esportes',embed_url:'https://channel.example/'+id+'.m3u8',...extra});

test('quality, codec, copy numbers and programme differences never create repeated station cards',()=>{
 const c=core(),rows=['SPORTV 4K','SPORTV FHD','SPORTV FHD²','SPORTV FHD³','SPORTV HD²','SPORTV HD','SPORTV SD','SPORTV FHDR','SporTV (1080p) [Not 24/7]'].map((title,i)=>row(title,String(i),{epg:{current:{title:'Programa '+i}}}));
 const titles=rows.map(x=>x.title),unique=c.unique(rows);
 assert.equal(unique.length,1);assert.equal(unique[0].title,'SporTV');
 assert.equal(unique[0].id,'1');assert.equal(unique[0].embed_url,rows[1].embed_url);
 assert.equal(unique[0].epg.current.title,'Programa 1');assert.equal(unique[0].channelNames.length,rows.length);
 assert.deepEqual(rows.map(x=>x.title),titles);
});

test('regional channels and spelling aliases share a single name while distinct station names stay available',()=>{
 const c=core(),rows=['GB RJ CAPITAL HD','GB SP CAPITAL FHD','TV Globo','SBT RJ HD','SBT SP FHD','RECORD RJ CAPITAL HD','RECORD SP CAPITAL FHD','BAND SP CAPITAL FHD','BAND RS HD','Nick Online HD','Nickelodeon FHD','Globo News HD','GloboNews FHD','SporTV 2 FHD','SporTV2 HD','SPORTV 3 HD','ESPN 2 HD','ESPN2 FHD','HBO FAMILY HD','HBO 2 HD','TNT SÉRIES HD² [L]','TNT SERIES FHD'].map((title,i)=>row(title,String(i)));
 const names=Array.from(c.unique(rows),x=>x.title);
 for(const expected of ['Globo','SBT','Record','Band','Nickelodeon','GloboNews','SporTV 2','SporTV 3','ESPN 2','HBO FAMILY','HBO 2'])assert.equal(names.filter(x=>x===expected).length,1,expected);
 assert.equal(names.length,12);assert.equal(new Set(names.map(x=>c.key(x))).size,names.length);
});

test('a Brazilian primary FHD signal is preferred and selection stays stable when records arrive in another order',()=>{
 const c=core(),rows=[row('ESPN FHD²','backup'),row('[US] ESPN HD','us'),row('ESPN 4K','4k'),row('ESPN FHD','primary'),row('ESPN FHD [L]','subtitles')];
 assert.equal(c.unique(rows)[0].id,'primary');assert.equal(c.unique([...rows].reverse())[0].id,'primary');
 assert.equal(c.unique(c.unique(rows))[0].channelNames.length,5);
});

test('known subscription channels precede open broadcasters, with extra feeds and international channels later',()=>{
 const c=core(),rows=['Canal desconhecido','Globo HD','SBT HD','SPORTV EXTRA PPV 4 FHD','[US] ESPN NEWS HD','ESPN FHD','HBO FHD','SPORTV FHD','Cartoon Network HD','Telecine Premium HD','Combate FHD'];
 const names=Array.from(c.sort(c.unique(rows.map((x,i)=>row(x,String(i))))),x=>x.title);
 assert.deepEqual(names.slice(0,4),['SporTV','ESPN','Combate','HBO']);
 for(const name of ['HBO','Cartoon Network','Telecine Premium'])assert(names.indexOf(name)<names.indexOf('Globo'));
 assert(names.indexOf('Globo')<names.indexOf('Canal desconhecido'));
 assert(names.indexOf('SPORTV EXTRA PPV 4')>names.indexOf('SBT'));
 assert.equal(names.at(-1),'ESPN NEWS');
});

class Node{
 constructor(){this.children=[];this.style={setProperty(){}};this.textContent='';}
 append(...items){this.children.push(...items)}
 replaceChildren(){this.children=[]}
 setAttribute(key,value){this[key]=value}
}
function grid(){
 const elements=new Map(['iframe-channel-list','nplay-live-count','nplay-live-search'].map(id=>[id,new Node()]));elements.get('nplay-live-search').value='';
 const observed=[],opened=[];
 const c=vm.createContext({URL,window:{NPlayLiveCatalog:{staticChannels:()=>[],isFavorite:()=>true},NPlayEpg:{reset:()=>observed.splice(0),observe:(card,item)=>observed.push(item)}},
  $:id=>elements.get(id),document:{createElement:()=>new Node()},liveScope:'tv',liveChannelData:[],livePreviews:null,
  CHANNEL_LOGOS:{},PROVIDER:'https://channel.example/provider',channelKey:()=>'',titleLogo:()=>'',imageUrl:x=>x,channelName:x=>x,openChannel:item=>opened.push(item)});
 vm.runInContext(read('assets/channel-order.js'),c);vm.runInContext(read('assets/music-core.js'),c);
 const source=read('live-embeds.js');vm.runInContext(source.slice(source.indexOf('function filterLiveChannels('),source.indexOf('function init(')),c);
 return {c,elements,observed,opened};
}

test('the rendered grade and Favorites show one card, with the selected ID used for EPG and playback',()=>{
 const {c,elements,observed,opened}=grid(),rows=[row('SPORTV HD²','hd'),row('SPORTV FHD','fhd'),row('SPORTV 4K','4k')];
 c.renderChannels(rows);
 assert.equal(elements.get('nplay-live-count').textContent,'1 de 1 canais');
 assert.equal(elements.get('iframe-channel-list').children.length,1);
 assert.equal(observed[0].id,'fhd');
 elements.get('iframe-channel-list').children[0].children[0].children[0].onclick();assert.equal(opened[0].id,'fhd');
 vm.runInContext('liveDisplayMode="Favoritos"',c);c.renderChannels(rows);
 assert.equal(elements.get('iframe-channel-list').children.length,1);
 elements.get('nplay-live-search').value='HD²';c.renderChannels(rows);
 assert.equal(elements.get('iframe-channel-list').children.length,1);
});

test('pagination counts unique stations and never repeats a channel when showing more',()=>{
 const {c,elements}=grid(),rows=Array.from({length:65},(_,i)=>[row('Canal '+i+' FHD',i+'f'),row('Canal '+i+' HD²',i+'h')]).flat();
 c.renderChannels(rows);const list=elements.get('iframe-channel-list');
 assert.equal(elements.get('nplay-live-count').textContent,'65 de 65 canais');
 assert.equal(list.children.length,61);assert.equal(list.children.at(-1).textContent,'Mostrar mais canais');
 list.children.at(-1).onclick();assert.equal(list.children.length,65);
 const titles=list.children.map(card=>card.children[1].textContent);assert.equal(new Set(titles).size,65);
});

test('channel grouping loads before the app so initial favorites and Home use the same station names',()=>{
 const html=read('index.html');assert(html.indexOf('assets/channel-order.js')<html.indexOf('src="./app.js'));
 assert(read('sw.js').includes('"./assets/channel-order.js"'));
});
