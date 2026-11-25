// GoodHi: сервис-воркер. Сначала сеть (обновления доходят сразу), без сети - копия из кэша. Плюс push-уведомления.
const V='goodhi-v3';
const SHELL=['./','index.html','config.js','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin)return; // Firebase, EmailJS и шрифты идут напрямую
  e.respondWith(
    fetch(r,{cache:'no-cache'}).then(res=>{
      if(res&&res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp)).catch(()=>{})}
      return res;
    }).catch(()=>caches.match(r).then(m=>m||caches.match('index.html')))
  );
});
// ---------- push ----------
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch{}
  e.waitUntil((async()=>{
    const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    if(cs.some(c=>c.visibilityState==='visible'&&c.focused))return; // приложение открыто - обычные уведомления внутри него
    await self.registration.showNotification(d.title||'GoodHi',{body:d.body||'',icon:'icon-192.png',badge:'favicon-48.png',tag:d.tag||undefined,renotify:!!d.tag,data:{ck:d.ck||''}});
  })());
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){if('focus' in c)return c.focus()}
    return self.clients.openWindow('./');
  }));
});
