const CACHE="novaplay-v0.49.11";
const CORE=["./","./index.html","./styles.css","./assets/experience.css","./assets/hero-live.js","./assets/casting.js","./access.js","./app.js","./live-embeds.js","./assets/music-core.js","./assets/youtube-core.js","./assets/live-preview.js","./profiles.js","./presence.js","./install.js","./catalog.js","./manifest.webmanifest","./assets/icon.svg","./assets/brand/nplay-wordmark-v0482.svg","./assets/brand/nplay-icon-192-v0482.png","./assets/brand/nplay-icon-512-v0482.png"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  await Promise.allSettled(CORE.map(url=>cache.add(new Request(url,{cache:"reload"}))));
 }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("novaplay-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.includes("/admin/")){event.respondWith(fetch(request,{cache:"no-store"}));return}
 const isNavigation=request.mode==="navigate"||/\/(?:index\.html)?$/.test(url.pathname);
 event.respondWith((async()=>{
  try{
   const response=await fetch(request,isNavigation?{cache:"no-store"}:{cache:"no-cache"});
   if(response.ok&&response.type==="basic"){
    const copy=response.clone();
    event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{}));
   }
   return response;
  }catch(error){
   const cached=await caches.match(request);
   if(cached)return cached;
   if(isNavigation){const home=await caches.match("./index.html");if(home)return home}
   throw error;
  }
 })());
});
