const CACHE='novabyte-divulga-v1.0.6';
const FILES=['./','./index.html','./style.css?v=1.0.6','./app.js?v=1.0.6','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(FILES.map(file=>cache.add(file)));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('novabyte-divulga-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const r=event.request,u=new URL(r.url);
 if(r.method!=='GET'||u.origin!==self.location.origin||!u.pathname.includes('/divulga/'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const cached=await cache.match(r);
  const isPage=r.mode==='navigate'||u.pathname.endsWith('/index.html');
  if(!isPage&&cached)return cached;
  try{
   const reply=await fetch(r,{cache:isPage?'no-store':'default'});
   if(reply.ok)event.waitUntil(cache.put(r,reply.clone()).catch(()=>{}));
   return reply;
  }catch{
   return cached||(isPage?await cache.match('./index.html'):undefined)||Response.error();
  }
 })());
});