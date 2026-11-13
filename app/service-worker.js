const CACHE_NAME = 'torikakari-shell-v10';
// 1件でも取得に失敗するとインストール全体が失敗するので、実在するファイルだけを並べる
const APP_SHELL = [
    './register/index.html',
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
    const { request } = event;
    const url = new URL(request.url);

    // APIと外部リソースは保存せず、必ずネットワークから取得する。
    if (
        request.method !== 'GET'
        || url.origin !== self.location.origin
        || url.pathname.startsWith('/api/')
    ) return;

    // ?task= の違いで保存が増えないよう、クエリを除いたURLで保存する
    const cacheKey = `${url.origin}${url.pathname}`;

    // 更新がすぐ届くようネットワークを優先し、つながらないときだけ保存済みの内容を使う
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy)));
                }
                return response;
            })
            .catch(() => caches.match(cacheKey).then((cached) => cached || Response.error()))
    );
});

// サーバーから届いたタスク開始の通知を表示する
self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { title: 'トリカカリ', body: event.data?.text() || '' };
    }
    event.waitUntil(
        self.registration.showNotification(payload.title || 'トリカカリ', {
            body: payload.body || '',
            icon: new URL('./icons/icon-192.png', self.registration.scope).href,
            badge: new URL('./icons/icon-192.png', self.registration.scope).href,
            tag: payload.task_id ? `task-${payload.task_id}` : undefined,
            data: { task_id: payload.task_id }
        })
    );
});

// 通知をタップしたら、そのタスクのタイマー画面を開く
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const taskId = event.notification.data?.task_id;
    const target = new URL(
        taskId ? `./timer/index.html?${new URLSearchParams({ task: taskId })}` : './register/index.html',
        self.registration.scope
    ).href;

    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        // 既に開いている画面があれば、それをタイマー画面へ切り替えて前面に出す
        for (const client of windows) {
            if (!client.url.startsWith(self.registration.scope)) continue;
            if ('navigate' in client) {
                const navigated = await client.navigate(target).catch(() => null);
                if (navigated) return navigated.focus();
            }
        }
        return self.clients.openWindow(target);
    })());
});
