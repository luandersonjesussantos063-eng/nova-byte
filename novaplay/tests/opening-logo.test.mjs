import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const index=read('index.html');
const css=read('assets/cinema-refresh.css');
const js=read('assets/soft-opening.js');
const original=read('assets/brand/nplay-wordmark-v0482.svg');
const audio=read('assets/intro-audio.js');
const opening=index.split('<div id="nplay-soft-opening" aria-hidden="true">')[1]?.split('<header class="app-header"')[0]||'';
const outlines=x=>[...x.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m=>m[1]);

test('opening preserves exactly the original approved NPlay lettering and icon',()=>{
 assert(opening.includes('<svg')&&opening.includes('viewBox="0 0 530 190"'));
 assert.equal(outlines(opening).length,6);
 assert.deepEqual(outlines(opening),outlines(original));
 assert.doesNotMatch(opening,/nplay-opening-logo"\s+src=|nplay-opening-symbol|nplay-opening-name/);
 assert.match(opening,/nplay-opening-reflection/);
});
test('N and P-l-a-y fade in separately in the right order',()=>{
 for(const name of ['n','p','l','a','y'])assert.match(opening,new RegExp('nplay-opening-letter-'+name));
 const delays=['.05s','.32s','.48s','.64s','.80s'];
 for(let i=0;i<5;i++)assert(css.includes('.nplay-opening-letter-'+['n','p','l','a','y'][i]+'{animation-delay:'+delays[i]+'}'));
 assert.match(css,/nplay-glyph-reveal/);
 const animation=css.split('@keyframes nplay-glyph-reveal')[1]?.split('}')[0]||'';
 assert(!animation.includes('translateY'),'glyph transforms should not override original SVG positioning');
 assert.match(css,/nplay-opening-underlight/);
});
test('letter animation starts only at verified access approval with recorded audio',()=>{
 assert.match(js,/root\.classList\.add\("is-playing"\)/);
 assert.match(js,/state==="approved"\)approve\(\)/);
 assert.match(js,/window\.NPlayIntroAudio\?\.play/);
 assert.match(audio,/nplay-opening-original-final\.m4a/);
 assert(!js.includes('sessionStorage.setItem'));
});
test('registered clients receive the current opening assets while keeping the player intact',()=>{
 const sw=read('sw.js'),app=read('app.js');
 assert.match(index,/name="nplay-version" content="0\.51\.18"/);
 assert.match(index,/cinema-refresh\.css\?v=0\.51\.18/);
 assert.match(index,/soft-opening\.js\?v=0\.51\.18/);
 assert(sw.includes('novaplay-v0.51.18-tvspotlight'));
 assert(app.includes('./sw.js?v=0.51.18-tvspotlight'));
 assert(sw.includes('./assets/nplay-opening-original-final.m4a'));
});
