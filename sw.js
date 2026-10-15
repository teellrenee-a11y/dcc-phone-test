// Offline cache only. No network calls for answers; answers never pass through here.
const C='m1phone-v5';
const FILES=['./','./index.html','./style.css','./app.js','./data.js','./manifest.webmanifest','./icon.svg'];
const MINE=k=>/^m1phone-v\d+$/.test(k); // never touch other copies' caches (e.g. /aunt/)
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>MINE(x)&&x!==C).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;if(new URL(e.request.url).pathname.includes('/aunt/'))return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));});
