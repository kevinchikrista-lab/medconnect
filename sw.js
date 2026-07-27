// Bump this on every deploy that changes app code so the old cache is dropped.
const CACHE_NAME = 'medconnect-v3';
const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'js/config.js',
  'js/store.js',
  'js/router.js',
  'js/app.js',
  'js/pages/auth.js',
  'js/pages/admin.js',
  'js/pages/doctor.js',
  'js/pages/patient.js',
  'js/pages/pharmacy.js',
  'js/pages/homecare.js',
  'assets/icons/icon-192.svg',
  'assets/icons/icon-512.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Is this a request for application CODE (HTML/JS)? Those must always be fresh
// when online — a stale JS file mixed with a newer one breaks the whole page.
function isCodeRequest(request) {
  const url = request.url;
  return request.mode === 'navigate'
    || request.destination === 'document'
    || request.destination === 'script'
    || url.endsWith('.js')
    || url.endsWith('.html');
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Live data / third parties: always go to the network (never cache).
  if (request.url.includes('/api/') || request.url.includes('supabase') || request.url.includes('docs.google.com')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // App code (HTML/JS): NETWORK-FIRST. Always fetch the latest when online;
  // fall back to cache only when offline. This prevents stale-code breakage
  // after an update — the #1 cause of "features suddenly break" post-deploy.
  if (isCodeRequest(request)) {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Other assets (icons, images, fonts): cache-first with background refresh.
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
