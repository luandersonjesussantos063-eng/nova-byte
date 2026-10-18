import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),scripts={
 changelog:read('assets/release-notes.js'),
 notifications:read('assets/notifications.js')
};
const version=html.match(/<meta name="nplay-version" content="([^"]+)"/)?.[1];

function boot(){
 const listeners=new Map();
 const document={
  readyState:'loading',
  querySelector:selector=>selector==='meta[name="nplay-version"]'?{content:version}:null,
  addEventListener:(event,handler)=>listeners.set(event,handler),
  getElementById:()=>null
 };
 const window={};
 const scope=vm.createContext({document,window,console});
 vm.runInContext(scripts.changelog,scope);
 vm.runInContext(scripts.notifications,scope);
 return {core:window.NPlayNotificationCore,releases:window.NPlayReleaseNotes};
}

test('the published NPlay version always has specific editorial release notes',()=>{
 assert.match(version,/^\d+\.\d+\.\d+$/);
 assert.equal((html.match(/release-notes\.js\?v=0\.51\.20/g)||[]).length,1);
 assert(html.indexOf('release-notes.js?v=0.51.20')<html.indexOf('notifications.js?v=0.51.20'),'changelog must load before bell');
 const {releases}=boot();
 const current=releases.filter(r=>r.version===version);
 assert.equal(current.length,1);
 assert(current[0].title.includes(version));
 assert(current[0].changes.length>=2);
 assert(current[0].changes.every(x=>typeof x==='string'&&x.length>20));
});

test('current version describes the restored NPlay logo and staggered opening',()=>{
 const {core,releases}=boot(),{old}=core.releaseEntries();
 const current=releases.find(r=>r.version==='0.51.10');
 assert.equal(current.version,'0.51.10');
 assert(current.changes.some(c=>/reflexo suave/.test(c)));
 assert(current.changes.some(c=>/letras aparecem/.test(c)));
 assert.equal(current.action,'preview-intro-audio');
 assert.match(current.actionLabel,/Ouvir som/);
 assert.equal(core.releaseEntries().current.version,version);
 assert.equal(old.length,releases.length-1);
 assert(old.every(entry=>entry.historical&&entry.action==null));
 assert(old.some(entry=>entry.version==='0.51.3'&&entry.changes.some(c=>/som da abertura/.test(c))));
});

test('version IDs preserve the previous notifications-read state',()=>{
 const {core}=boot();
 assert.equal(core.versionId('0.51.3'),-51003);
 assert.equal(core.versionId('0.51.4'),-51004);
 assert.equal(core.versionId('0.51.5'),-51005);
 assert.equal(core.versionId('0.51.6'),-51006);
 assert.equal(core.versionId('0.51.7'),-51007);
 assert.equal(core.versionId('0.51.8'),-51008);
 assert.equal(core.versionId('0.51.9'),-51009);
 assert.equal(core.versionId('0.51.10'),-51010);
 assert.equal(core.versionId('invalid'),null);
 assert(core.versionId('0.51.3')>core.versionId('0.51.4'));
});

test('release details are safe text and distinct from admin messages',()=>{
 assert.match(scripts.notifications,/li\.textContent=change/);
 assert.match(scripts.notifications,/body\.textContent=entry\.body/);
 assert.match(scripts.notifications,/window\.NPlayIntroAudio\?\.preview\?\.\(\)/);
 assert.match(scripts.notifications,/novaplay_announcements/);
 assert.match(html,/id="nplay-notice-history"/);
 assert.match(html,/nplay-notice-changes/);
});
