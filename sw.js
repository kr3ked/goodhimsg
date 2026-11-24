// GoodHi: сервис-воркер. Сначала сеть (чтобы обновления доходили сразу), без сети — копия из кэша.
const V='goodhi-v1';
const SHELL=['./','index.html','config.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
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
    fetch(r).then(res=>{
      if(res&&res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp)).catch(()=>{})}
      return res;
    }).catch(()=>caches.match(r).then(m=>m||caches.match('index.html')))
  );
});
