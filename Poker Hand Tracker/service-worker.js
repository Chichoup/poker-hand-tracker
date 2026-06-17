const CACHE = 'pht-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/js/config.js',
  '/assets/js/calc.js',
  '/assets/js/db.js',
  '/assets/js/app.js',
  '/assets/js/chart.umd.min.js',
  '/assets/js/supabase.umd.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // No interceptar llamadas a Supabase
  if (url.hostname.includes('supabase.co')) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
