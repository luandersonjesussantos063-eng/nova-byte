import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=relative=>fs.readFileSync(new URL('../'+relative,import.meta.url),'utf8');
const css=read('assets/cinema-refresh.css');
const original=read('styles.css');
const app=read('app.js');
const index=read('index.html');

test('YouTube sections stay full width instead of inheriting category-grid columns',()=>{
 assert.match(app,/content\.className="category-grid youtube-selection"/);
 assert.match(original,/\.category-grid\s*\{\s*grid-template-columns\s*:/);
 assert.match(css,/\.category-grid\.youtube-selection\s*\{\s*display:block;/);
 assert.match(css,/\.category-grid\.youtube-selection\s*>\s*\.shelf\s*\{[^}]*width:100%/s);
 assert.match(css,/\.category-grid\.youtube-selection\s+\.shelf-track\s*\{[^}]*display:flex;[^}]*flex-wrap:nowrap;[^}]*overflow-x:auto/s);
 const version=index.match(/<meta name="nplay-version" content="([^"]+)"/)?.[1];
 assert(version&&index.includes('cinema-refresh.css?v='+version));
});

test('YouTube cards remain wide with 16:9 thumbnails, not a strip of tiny thumbnails',()=>{
 assert.match(css,/\.category-grid\.youtube-selection\s+\.shelf-track\s*>\s*\.poster-card\.youtube-card\s*\{[^}]*flex:0 0 clamp\(230px,23vw,330px\)/s);
 assert.match(css,/\.category-grid\.youtube-selection\s+\.shelf-track\s*>\s*\.poster-card\.youtube-card\s+\.cover\s*\{[^}]*aspect-ratio:16\/9/s);
 assert.match(css,/\.category-grid\.youtube-selection\s+\.poster-card\.youtube-card h3\s*\{[^}]*-webkit-line-clamp:2/s);
});

test('YouTube mobile view retains horizontal scrolling and large touch targets',()=>{
 assert.match(css,/@media\(max-width:760px\)\s*\{[\s\S]*?\.category-grid\.youtube-selection\s+\.shelf-track\s*>\s*\.poster-card\.youtube-card\s*\{[\s\S]*?flex:0 0 min\(70vw,290px\)/);
 assert.match(css,/min-width:min\(70vw,290px\)/);
 assert.match(app,/const row=shelf\(name,items,"continuar"\)/);
});
