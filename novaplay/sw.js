self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    const prefix = scope.pathname.split('/').filter(Boolean).at(-1) + '-';
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(prefix)).map(key => caches.delete(key)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    await self.registration.unregister();
    await Promise.all(windows.filter(client => {
      const url = new URL(client.url);
      return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
    }).map(client => client.navigate(new URL('/404.html', scope.origin).href)));
  })());
});
