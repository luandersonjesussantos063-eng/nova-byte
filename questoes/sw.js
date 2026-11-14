"use strict";
/* Cache apenas a interface. Enunciados e cadernos de terceiros exigem internet. */
const CACHE="missao-farda-pmmg-v14-avatares";
const CORE=["./","./index.html","./ui.css?v=14-pmmg-avatares","./banco-transcrito.js?v=14-pmmg-avatares","./core.js?v=14-pmmg-avatares","./sync.js?v=14-pmmg-avatares","./app.js?v=14-pmmg-avatares","./manifest.webmanifest","./icon.svg","./brasao-pmmg.svg","./avatares/luanderson.webp","./avatares/jackeline.webp"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("missao-farda-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok&&new URL(req.url).pathname.includes("/questoes/")){
   const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
  }
  return response;
 }).catch(()=>caches.match(req).then(cached=>cached||Response.error())));
});