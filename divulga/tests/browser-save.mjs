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
 // Publicação: criação real, clique no botão, registro local e persistência após recarga.
 await page.locator('.bottom-nav [data-tab="campanhas"]').click();
 await page.locator('[data-action="campaign-new"]').first().click();
 await page.locator('#campaignForm [name="name"]').fill('Sites profissionais NovaByte');
 await page.locator('#campaignForm [name="text"]').fill('A NovaByte Soluções cria sites profissionais e personalizados para empresas em Mato Grosso.');
 await page.locator('#campaignForm [name="link"]').fill('https://novabytesolucoes.com.br/');
 await page.locator('[data-action="campaign-save"]').click();
 await page.getByText('Publicação “Sites profissionais NovaByte” salva com sucesso.',{exact:false}).first().waitFor();
 assert.match(await page.locator('#campanhas').innerText(),/1 campanha\(s\) salva\(s\)/);
 assert.match(await page.locator('#campanhas').innerText(),/Sites profissionais NovaByte/);
 const storedCampaign=await page.evaluate(()=>JSON.parse(localStorage.getItem('novabyte-divulga-v1')));
 assert.equal(storedCampaign.campaigns.length,1);
 assert.equal(storedCampaign.groups.length,1);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('.bottom-nav [data-tab="campanhas"]').click();
 assert.match(await page.locator('#campanhas').innerText(),/Sites profissionais NovaByte/);
 assert.equal(await page.locator('#campanhas article').count(),1);
 // Um único toque prepara o conteúdo, copia e abre o grupo, sem marcar publicação como concluída.
 await page.locator('.bottom-nav [data-tab="fila"]').click();
 await page.locator('[data-action="start-queue"]').first().click();
 assert.equal(await page.locator('[data-action="queue-prepare-open"]').count(),1);
 await page.evaluate(()=>{
  window.__openedGroup=null;window.__copiedAd=null;
  document.execCommand=function(command){
   if(command!=='copy')return false;
   const field=[...document.querySelectorAll('textarea')].find(el=>el.readOnly);
   if(field){window.__copiedAd=field.value;return true}
   return false;
  };
  window.open=(url)=>{window.__openedGroup=url;return {}};
 });
 await page.locator('[data-action="queue-prepare-open"]').click();
 const shared=await page.evaluate(()=>({
  url:window.__openedGroup,ad:window.__copiedAd,
  groupCount:JSON.parse(localStorage.getItem('novabyte-divulga-v1')).groups.length,
  published:JSON.parse(localStorage.getItem('novabyte-divulga-v1')).history.length
 }));
 assert.equal(shared.url,'https://www.facebook.com/share/g/123456ABC');
 assert.match(shared.ad,/NovaByte Soluções cria sites profissionais/);
 assert.match(shared.ad,/https:\/\/novabytesolucoes.com.br\//);
 assert.equal(shared.groupCount,1);
 assert.equal(shared.published,0);
 assert.match(await page.locator('#fila').innerText(),/No Facebook, toque em criar publicação e cole o anúncio/);

  // Transferência do grupo e anúncio pelo compartilhamento Android, para autorização no APK.
 await page.evaluate(()=>{
  window.__robotShare=null;
  Object.defineProperty(navigator,'share',{configurable:true,value:payload=>{
   window.__robotShare=payload;return Promise.resolve();
  }});
 });
 await page.locator('[data-action="queue-send-robot"]').click();
 const robotPayload=await page.evaluate(()=>window.__robotShare);
 assert.equal(robotPayload.title,'NovaByte Robô — revisão de publicação');
 assert.match(robotPayload.text,/^NOVABYTE_ROBO_V1\nGRUPO=https:\/\/www\.facebook\.com\/share\/g\/123456ABC\nTEXTO:\n/);
 assert.match(robotPayload.text,/A NovaByte Soluções cria sites profissionais/);
 assert.deepEqual(errors,[]);
 console.log('PASSOU: Chrome Android 412px — grupo e campanha salvos, fluxo de um toque com cópia e abertura do grupo, sem falsa publicação.');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
