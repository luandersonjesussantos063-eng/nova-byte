// Kaia Glow service worker: displays only user-approved push notifications.
// There is no automatic sending until the merchant has enabled checkout and campaigns.
self.addEventListener('push',event=>{
 event.waitUntil(self.registration.showNotification('Kaia Glow · Sua oferta chegou', {
  body:'Um carinho para sua próxima compra: confira seu cupom VOLTA10 de 10% de desconto.',
  icon:'/kaia-icon.svg',
  badge:'/kaia-icon.svg',
  tag:'kaia-promocao-volta10',
  renotify:false,
  data:{url:'/?cupom=VOLTA10'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||'/',self.location.origin).href;
 if(new URL(url).origin!==self.location.origin)return;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  const existing=list.find(c=>c.url.startsWith(self.location.origin));
  if(existing){existing.focus();existing.navigate(url);return;}
  return clients.openWindow(url);
 }));
});
