// pdlgtg Service Worker — offline caching for full PWA support
const CACHE_NAME = 'pdlgtg-v1';

// On install, precache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/menu-react.css',
        '/menu-react.js',
        '/controller.html',
        '/controller.js',
        '/manifest.json',
      ]);
    })
  );
  self.skipWaiting();
});

// On activate, clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first strategy: try network, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET and socket.io requests
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/socket.io')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, serve the main page
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
