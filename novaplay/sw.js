const CACHE="novaplay-v0.35.3";
const CORE=["./","./index.html","./styles.css","./app.js","./assets/cover.js","./assets/card-hover.js","./catalog.js","./manifest.webmanifest","./assets/icon.svg",
"./assets/posters/autoral.svg","./assets/posters/nosferatu.svg","./assets/posters/lua.svg","./assets/posters/caligari.svg","./assets/posters/lostworld.svg",
"./assets/posters/pauline.svg","./assets/posters/phantom.svg","./assets/posters/camara.svg","./assets/posters/brasil.svg","./assets/posters/cultura.svg","./assets/backdrops/lostworld-hero.svg"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(names=>Promise.all(names.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 const url=new URL(e.request.url);
 if(url.origin!==self.location.origin)return;
 // O painel administrativo não pode carregar contagens antigas do cache offline.
 if(url.pathname.includes("/admin/")){
   e.respondWith(fetch(e.request,{cache:"no-store"}));
   return;
 }
 e.respondWith(fetch(e.request).then(res=>{if(res.ok&&res.type==="basic"){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{})}return res}).catch(()=>caches.match(e.request)));
});
