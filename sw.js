/* ─────────────────────────────────────────────────────────
   PlantID – Service Worker
   Caches the app shell so it loads instantly and works
   offline (except for the actual AI identification call,
   which obviously needs an internet connection).
───────────────────────────────────────────────────────── */

const CACHE_NAME = 'plantid-v2';

// Files that make up the app shell
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json'
];

/* ── Install: cache the app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_FILES);
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: serve from cache, fall back to network ── */
self.addEventListener('fetch', event => {
  // Never cache the Anthropic API call — always go to network
  if (event.request.url.includes('api.anthropic.com')) {
    return; // let it pass through normally
  }

  // For everything else: cache-first strategy
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cache valid responses for next time
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
