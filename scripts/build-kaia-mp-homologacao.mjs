import {mkdir,writeFile,rm,access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'dist/kaia-glow'),marker=path.join(root,'dist/.kaia-glow-generated');
try{await access(out);await access(marker);await rm(out,{recursive:true});}catch(e){
 if(e.code!=='ENOENT')throw e;
 try{await access(out);throw Error('Existing build without ownership marker');}catch(c){if(c.code!=='ENOENT')throw c;}
}
await mkdir(out,{recursive:true});await writeFile(marker,'Kaia isolated payment lab\n');
await writeFile(path.join(out,'index.html'),`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Kaia Glow · homologação privada</title><body><main><h1>Kaia Glow — homologação privada</h1><p>Somente produtos fictícios de teste. A vitrine comercial permanece bloqueada para pagamentos.</p><p id="status" role="status">Verificando configuração…</p><form id="checkout"><label>Produto de teste <select name="sku"><option>TEST-KAIA-SINGLE</option><option>TEST-KAIA-BUNDLE</option><option>TEST-KAIA-BLOCKED</option></select></label><label>Quantidade <input name="quantity" type="number" min="1" max="24" value="1" required></label><label>CEP <input name="cep" pattern="[0-9]{8}" inputmode="numeric" required></label><label>Modalidade SuperFrete <input name="service" inputmode="numeric" pattern="[0-9]{1,3}" required></label><label>Cupom de teste <input name="coupon"></label><button id="pay" disabled>Iniciar pagamento de teste</button></form><p id="result" role="status"></p><p>Retornar do checkout não confirma pagamento. A confirmação depende da consulta autenticada recebida pelo webhook.</p></main><script src="/lab.js" defer></script></body></html>`);
await writeFile(path.join(out,'lab.js'),await readFile(path.join(root,'kaia-glow/payment-lab.js')));
await writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
await writeFile(path.join(out,'_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:[]}));
await writeFile(path.join(out,'_headers'),"/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: private, no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'\n");
await build({entryPoints:[path.join(root,'kaia-glow/backend/qa-worker.js')],outfile:path.join(out,'_worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'});
console.log('Kaia: private QA lab built; no storefront, production clients, products or credentials copied.');
