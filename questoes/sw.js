"use strict";
const CACHE="missao-farda-core-v2-pmesp-only";
const CORE=["./","./index.html","./app.js","./banco.js","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",function(event){
  event.waitUntil(caches.open(CACHE).then(function(cache){return cache.addAll(CORE);}).then(function(){return self.skipWaiting();}));
});
self.addEventListener("activate",function(event){
  event.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k.startsWith("missao-farda-core-")&&k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener("fetch",function(event){
  const request=event.request;
  if(request.method!=="GET"||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(request).then(function(response){
    if(response.ok&&new URL(request.url).pathname.includes("/questoes/")){
      const copy=response.clone();caches.open(CACHE).then(function(cache){return cache.put(request,copy);});
    }
    return response;
  }).catch(function(){return caches.match(request).then(function(res){return res||Response.error();});}));
});