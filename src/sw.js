const CACHE_NAME = 'the-count-v1';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon.svg',
    './css/base.css',
    './css/components.css',
    './css/themes.css',
    './js/db.js',
    './js/store.js',
    './js/utils.js',
    './components/count-app.js',
    './components/app-header.js',
    './components/info-panel.js',
    './components/dashboard-view.js',
    './components/create-view.js',
    './components/count-view.js'
];

const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
    'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js',
    'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js'
];

// Install: pre-cache all known assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cache local assets first
            await cache.addAll(PRECACHE_ASSETS);
            // Cache CDN assets (non-blocking, best-effort)
            for (const url of CDN_ASSETS) {
                try {
                    await cache.add(url);
                } catch (err) {
                    console.warn('Failed to cache CDN asset:', url, err);
                }
            }
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: cache-first for all requests, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Cache successful responses for future offline use
                if (networkResponse && networkResponse.ok) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // If both cache and network fail, return a fallback for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('', { status: 408, statusText: 'Offline' });
            });
        })
    );
});
