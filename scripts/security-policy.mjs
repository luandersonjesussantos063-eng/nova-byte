import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd();
const exclude=new Set(['.git','node_modules','dist','.openai','kaia-glow','divulga','anuncia-lucas','novaplay','supabase','assets']);
async function files(dir=root){let result=[];for(const f of await readdir(dir,{withFileTypes:true})){if(exclude.has(f.name))continue;const p=path.join(dir,f.name);if(f.isDirectory())result.push(...await files(p));else if(f.name.endsWith('.html'))result.push(p);}return result;}
const hash=s=>"'sha256-"+createHash('sha256').update(s).digest('base64')+"'";
let count=0;
for(const file of await files()){
 let html=(await readFile(file,'utf8')).replace(/\r\n?/g,'\n').replace(/[ \t]+$/gm,'');
 html=html.replace(/<meta[^>]+data-nb-security[^>]*>/g,'').replace(/<script[^>]+src="\/security-frame-guard.js(?:\?[^\"]*)?"[^>]*><\/script>/g,'');
 const hashes=[...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>hash(m[1]));
 const handlers=[...html.matchAll(/\son[a-z]+\s*=\s*(["'])(.*?)\1/gi)].map(m=>hash(m[2].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&')));
 const scriptHosts="https://www.googletagmanager.com https://*.googlesyndication.com https://*.doubleclick.net https://cdn.jsdelivr.net https://unpkg.com https://challenges.cloudflare.com";
 const policy=["default-src 'self'",`script-src 'self' 'wasm-unsafe-eval' 'unsafe-hashes' ${[...new Set([...hashes,...handlers])].join(' ')} ${scriptHosts}`,"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com","font-src 'self' data: https://fonts.gstatic.com","img-src 'self' data: blob: https:","connect-src 'self' https://vajlhodqxskozuxxlujv.supabase.co https://kaia-glow.pages.dev https://challenges.cloudflare.com https://*.google-analytics.com https://*.analytics.google.com https://*.googlesyndication.com https://*.doubleclick.net https://api.qrserver.com https://*.google.com https://cdn.jsdelivr.net https://unpkg.com","frame-src 'self' https://challenges.cloudflare.com https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com https://*.googlesyndication.com https://*.doubleclick.net https://www.instagram.com","worker-src 'self' blob:","object-src 'none'","base-uri 'self'","form-action 'self'","upgrade-insecure-requests"].join('; ');
 const meta='<meta data-nb-security="csp" http-equiv="Content-Security-Policy" content="'+policy.replaceAll('"','&quot;')+'"><meta data-nb-security="referrer" name="referrer" content="strict-origin-when-cross-origin"><script src="/security-frame-guard.js?v=20261109"></script>';
 // Place CSP before scripts/styles; charset remains first for correct decoding.
 if(/<meta\s+charset[^>]*>/i.test(html))html=html.replace(/(<meta\s+charset[^>]*>)/i,'$1'+meta);
 else html=html.replace(/<head[^>]*>/i,'$&'+meta);
 await writeFile(file,html);count++;
}
console.log(`Security policy refreshed on ${count} NovaByte pages.`);
