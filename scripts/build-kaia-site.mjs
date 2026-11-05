import {readFile,writeFile,mkdir,rm,readdir,lstat,copyFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'kaia-glow'),output=path.join(root,'dist','kaia-glow');
const pages=['index.html','admin.html','conta.html','sobre.html','atendimento.html','privacidade.html','termos-de-uso.html'];
const scripts=['app.js','shipping-popup.js','catalog-overrides.js','catalog.js','admin.js','admin-coupons.js','auth-config.js','conta.js','customer-validation.js','menu-account.js','institucional.js'];
const styles=['style.css','shipping-popup.css','admin.css','conta.css','institucional.css'];
const marker=path.join(root,'dist','.kaia-glow-generated');
try{await access(output);await access(marker);await rm(output,{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;try{await access(output);throw Error('A pasta de destino existe sem identificação de build. Preserve seu conteúdo antes de continuar.');}catch(check){if(check.code!=='ENOENT')throw check;}}
await mkdir(output,{recursive:true});await writeFile(marker,'Kaia Glow generated static deployment\n');let count=0;
async function copy(relative){const src=path.join(source,relative),dest=path.join(output,relative),stat=await lstat(src);if(stat.isSymbolicLink()||!stat.isFile())throw Error('Arquivo de origem inválido: '+relative);await mkdir(path.dirname(dest),{recursive:true});await copyFile(src,dest);count++;}
for(const file of [...pages,...scripts,...styles])await copy(file);
async function assets(relative='assets'){for(const entry of await readdir(path.join(source,relative),{withFileTypes:true})){const file=path.join(relative,entry.name);if(entry.isSymbolicLink())throw Error('Link simbólico não permitido: '+file);if(entry.isDirectory())await assets(file);else{if(!/\.(?:png|jpe?g|webp|avif|gif|svg|ico|mp4|webm|woff2?)$/i.test(file))throw Error('Tipo de arquivo não permitido nos assets: '+file);await copy(file)}}}
await assets();
// Staging remains outside search until payments, shipping and stock are ready.
await writeFile(path.join(output,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n  X-Robots-Tag: noindex, nofollow\n\n/conta\n  Cache-Control: no-store\n\n/conta.html\n  Cache-Control: no-store\n');
await writeFile(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
// Invoke only Kaia API routes with Pages Functions; all static assets stay static.
await writeFile(path.join(output,'_routes.json'),JSON.stringify({version:1,include:['/api/kaia/*'],exclude:[]},null,2)+'\n');
await writeFile(path.join(output,'404.html'),'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Página não encontrada · Kaia Glow</title><link rel="stylesheet" href="/institucional.css"></head><body class="kaia-info-page"><main class="kaia-info-shell kaia-info-main"><p class="kaia-info-eyebrow">KAIA GLOW</p><h1>Página não encontrada</h1><p>O endereço pode ter mudado. Volte à loja ou fale com a nossa equipe.</p><a class="kaia-info-button" href="/">Voltar à Kaia Glow</a><p><a href="/atendimento.html">Atendimento</a></p></main></body></html>');
// Verify local resources rather than publishing the repository or SQL/documents.
for(const file of pages){const html=await readFile(path.join(output,file),'utf8');for(const match of html.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)){const href=match[1];if(/^[a-z]+:|^\/\//i.test(href))continue;const relative=href.replace(/^\//,'');let destination=path.resolve(output,path.dirname(file),relative);if(href.startsWith('/'))destination=path.resolve(output,relative);if(!destination.startsWith(output+path.sep)&&destination!==output)throw Error('Referência externa ao pacote: '+href);const stat=await lstat(destination).catch(()=>null);if(!stat)throw Error('Recurso local ausente: '+file+' → '+href);}}
console.log('Kaia Glow: '+count+' arquivos selecionados, mais 404/headers/robots, preparados em dist/kaia-glow.');console.log('Pacote de homologação; checkout real ainda não está ativo.');
