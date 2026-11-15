'use strict';
// Somente o acesso de transição: não carrega mais o segundo motor de estudo.
const CACHE='missao-farda-unificado-v15';
const FILES=['./','./index.html','./app.js?v=15-unificado','./brasao-pmmg.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('missao-farda-')&&key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
 for(const client of await self.clients.matchAll({type:'window'}))if(client.url.startsWith(self.registration.scope))await client.navigate(self.registration.scope+'?acesso=unificado');
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){event.respondWith(fetch(new URL('./index.html',self.registration.scope),{cache:'no-store'}).catch(()=>caches.match(new URL('./index.html',self.registration.scope))));return;}
 if(!['/app.js','/brasao-pmmg.svg'].some(path=>url.pathname.endsWith(path)))return;
 event.respondWith(fetch(request).catch(()=>caches.match(request,{ignoreSearch:true})));
});
