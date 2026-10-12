import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+'/')&&!file.endsWith('/index.html')){res.writeHead(403);res.end();return}
 try{
  if(!existsSync(file)){res.writeHead(404);res.end('Not found');return}
  res.setHeader('Content-Type',mime[extname(file)]||'text/plain');
  res.setHeader('Cache-Control','no-store');
  res.end(readFileSync(file));
 }catch(e){res.writeHead(500);res.end(String(e))}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browserPath=process.env.CHROME_PATH||'/usr/bin/google-chrome';
let browser;
try{
 browser=await chromium.launch({executablePath:browserPath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:412,height:885},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.goto(base+'/#grupos',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="group-new"]').first().click();
 await page.locator('#groupForm [name="name"]').fill('Lucas anuncia');
 await page.locator('#groupForm [name="url"]').fill('https://www.facebook.com/share/g/123456ABC/?ref=share');
 await page.locator('[data-action="group-save"]').click();
 await page.getByText('Grupo “Lucas anuncia” salvo com sucesso.',{exact:false}).first().waitFor();
 assert.match(await page.locator('#grupos').innerText(),/1 grupo\(s\) salvo\(s\)/);
 assert.match(await page.locator('#groupList').innerText(),/Lucas anuncia/);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('novabyte-divulga-v1')));
 assert.equal(state.groups.length,1);
 assert.equal(state.groups[0].url,'https://www.facebook.com/share/g/123456ABC');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.bottom-nav [data-tab="grupos"]').click();
 assert.match(await page.locator('#groupList').innerText(),/Lucas anuncia/);
 assert.equal(await page.locator('#groupList .item').count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASSOU: Chrome Android 412px — botão Salvar, confirmação, contador e persistência após recarregar.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
