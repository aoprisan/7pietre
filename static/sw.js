// 7 Pietre service worker — offline-first app shell. Bump CACHE on every release.
const CACHE = '7pietre-v4';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Neighborhood backdrop art is optional (procedural fallback if missing), so cache
// it best-effort rather than failing the whole install when a file isn't present.
const OPTIONAL = [
  './art/dusk-courtyard.webp',
  './art/noon-courtyard.webp',
  // moving-object sprites (procedural fallback if missing)
  './art/sprites/player-a.webp',
  './art/sprites/player-b.webp',
  './art/sprites/ball.webp',
  './art/sprites/stone-0.webp',
  './art/sprites/stone-1.webp',
  './art/sprites/stone-2.webp',
  './art/sprites/stone-3.webp',
  './art/sprites/stone-4.webp',
  './art/sprites/stone-5.webp',
  './art/sprites/stone-6.webp',
  './art/sprites/stone-7.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(ASSETS);
      await Promise.all(OPTIONAL.map((u) => cache.add(u).catch(() => {})));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // App navigations: serve cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Static assets: cache-first, then network (and populate cache).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
