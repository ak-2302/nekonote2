const CACHE_NAME = 'torikakari-shell-v3';
const APP_SHELL = [
    './',
    './register/',
    './register/index.html',
    './timer/',
    './timer/index.html',
    './asset/universal.css',
    './asset/api.js',
    './asset/pwa.js',
    './register/asset/style.css',
    './register/asset/script.js',
    './timer/asset/style.css',
    './timer/asset/main.js',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith('torikakari-shell-') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // APIと外部リソースは保存せず、必ずネットワークから取得する。
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true })
            .then((cached) => cached || fetch(event.request))
    );
});
