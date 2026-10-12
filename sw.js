// Sismo Panamá v0.7.1 — caché PWA y receptor de Web Push.
// IMPORTANTE: el receptor push no envía alertas por sí solo. Hace falta un servidor/proveedor push.
const CACHE_NAME = 'sismo-panama-shell-v071';
const CACHE_PREFIX = 'sismo-panama-shell-';
const APP_SHELL = [
  './', 'index.html', 'styles.css', 'config.js', 'core.js', 'app.js',
  'manifest.webmanifest', 'push-client.js', 'privacidad.html', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png',
  'icons/logo-circulo.png', 'icons/logo-completo.jpg',
  'icons/notif-icon-192.png', 'icons/badge-96.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(APP_SHELL);
        await cache.add('sounds/alerta_libre.mp3').catch(() => {});
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(async () => {
        return (await caches.match(request)) || (await caches.match(new URL('index.html', self.registration.scope).href)) || Response.error();
      })
    );
    return;
  }

  // Network-first: obtener correcciones al conectarse, pero poder abrir los recursos ya visitados sin internet.
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(async () => (await caches.match(request)) || Response.error())
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Sismo Panamá', body: 'Hay una actualización sísmica. Consulta las fuentes oficiales.', url: './' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) {}
  const title = String(data.title || 'Sismo Panamá').slice(0, 120);
  const body = String(data.body || 'Consulta los datos y sigue las instrucciones de las autoridades.').slice(0, 500);
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: new URL('icons/notif-icon-192.png', self.registration.scope).href,
    badge: new URL('icons/badge-96.png', self.registration.scope).href,
    tag: String(data.tag || 'sismo-panama-push').slice(0, 120),
    renotify: false,
    requireInteraction: true,
    vibrate: [700, 200, 700, 200, 1000],
    data: { url: String(data.url || './') }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target;
  try { target = new URL(event.notification.data && event.notification.data.url || './', self.registration.scope); }
  catch (_) { target = new URL('./', self.registration.scope); }
  // Solo abrir direcciones del mismo origen para evitar que un payload externo redirija al usuario.
  if (target.origin !== self.location.origin) target = new URL('./', self.registration.scope);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target.href);
    if (existing) return existing.focus();
    return self.clients.openWindow(target.href);
  }));
});
