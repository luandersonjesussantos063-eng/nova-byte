import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {resolve,dirname,join} from 'node:path';import vm from 'node:vm';import {execFileSync} from 'node:child_process';
const root=resolve('kaia-glow');const files=['index.html','conta.html','privacidade.html','termos-de-uso.html','atendimento.html','sobre.html'];const read=f=>readFileSync(join(root,f),'utf8');
test('all Kaia pages connect to privacy, terms and support and have real local destinations',()=>{
 for(const file of files){const html=read(file);for(const target of ['privacidade.html','termos-de-uso.html','atendimento.html'])assert(html.includes('href="'+target+'"'),file+': '+target);
  if(file==='conta.html'){assert(!html.includes('class="kaia-business-details"'));assert(html.includes('href="./#informacoes"'));assert(html.indexOf('class="kaia-account-site-footer"')>html.indexOf('</main>'));}else{assert.match(html,/KAIA GLOW COMERCIO DE COSMETICOS LTDA/);assert.match(html,/67\.706\.063\/0001-39/);assert.match(html,/usekaiaglow@gmail\.com/);}assert(!/href="[^"]*(?:CONTRATO|CNPJ)[^"]*\.pdf/i.test(html));
  for(const block of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){const schema=JSON.parse(block[1]);assert.equal(schema.legalName,'KAIA GLOW COMERCIO DE COSMETICOS LTDA');}
  if(file!=='conta.html'){assert.match(html,/© 2026 Kaia Glow/);assert.match(html,/terceiros pertencem aos respectivos titulares/);}assert.match(html,/<main[^>]*id="conteudo"/);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,file+': repeated id');
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){const url=new URL(m[1],'https://usekaiaglow.com.br/'+file);if(url.origin!=='https://usekaiaglow.com.br')continue;
   let target=resolve(root,'.'+decodeURIComponent(url.pathname));if(url.pathname.endsWith('/'))target=join(target,'index.html');assert(existsSync(target),file+': '+m[1]);
   if(url.hash&&!/^#(?:produto-\d+|cupons|exclusivos)$/.test(url.hash)){const targetHtml=readFileSync(target,'utf8');assert(targetHtml.includes('id="'+decodeURIComponent(url.hash.slice(1))+'"'),file+': '+m[1]);}
  }
 }
});
test('published privacy copy covers actual personal data and providers; commercial copy is consistent',()=>{
 const privacy=read('privacidade.html'),terms=read('termos-de-uso.html');for(const text of ['CPF','nascimento','telefone','endereço','Supabase','GitHub Pages','30 dias','WhatsApp','correção','exclusão'])assert(privacy.includes(text),text);
 assert(terms.includes('Adicionar itens à sacola não conclui a compra'));assert(terms.includes('Direitos autorais'));assert(terms.includes('sete dias'));assert(!read('index.html').includes('sem vendas reais'));assert(read('conta.html').includes('termsAccepted'));assert(read('conta.js').includes("kaia_terms_version:'2026-11-05'"));
});
test('clearing public preferences preserves authentication and other projects',()=>{
 let handler;const local=new Map([['kaia-demo-favorites','[1]'],['kaia-pending-referral-v1','x'],['kaia-glow-auth-v1','session'],['other-project','preserve']]);const session=new Map([['kaia-referral-seen-v1','1'],['other-session','preserve']]);const status={textContent:''};
 const context={document:{querySelectorAll:()=>[{addEventListener:(_,fn)=>handler=fn}],querySelector:()=>status},localStorage:{removeItem:k=>local.delete(k)},sessionStorage:{removeItem:k=>session.delete(k)}};
 vm.runInNewContext(read('institucional.js'),context);handler();assert(!local.has('kaia-demo-favorites'));assert(!local.has('kaia-pending-referral-v1'));assert.equal(local.get('kaia-glow-auth-v1'),'session');assert.equal(local.get('other-project'),'preserve');assert.equal(session.get('other-session'),'preserve');assert.match(status.textContent,/não foram alterados/);
});
test('changed browser scripts have valid JavaScript syntax',()=>{for(const file of ['app.js','conta.js','institucional.js'])execFileSync(process.execPath,['--check',join(root,file)],{stdio:'pipe'});});
