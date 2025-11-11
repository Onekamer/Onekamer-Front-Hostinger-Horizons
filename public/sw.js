/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// ============================================================
// ✅ OneKamer — Service Worker PWA + Web Push natif
// Version : messages + image + son + vibration + actions (sans OneSignal)
// ============================================================

// 2️⃣ Gestion du cache PWA
const CACHE_NAME = 'onekamer-cache-v3';
const urlsToCache = ['/', '/index.html', '/offline.html', '/favicon.ico'];

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker enrichi installé');
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker enrichi activé');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((name) => (name !== CACHE_NAME ? caches.delete(name) : null)))
    )
  );
  self.clients.claim();
});

// 3️⃣ Fallback réseau → cache
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// ============================================================
// 4️⃣ Notification Handling (Web Push natif)
// ============================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    console.warn('⚠️ Impossible de parser la notification');
    return;
  }

  console.log('📩 Notification reçue (natif):', payload);

  // 🔍 Extraction multi-source (titre, message, image, lien…)
  const title = payload.title || payload.headings?.en || payload.notification?.title || payload.data?.title || 'OneKamer.co';
  const body = payload.body || payload.contents?.en || payload.notification?.body || payload.data?.message || 'Nouvelle notification sur OneKamer';
  const icon = payload.icon || payload.data?.icon || '/ok_logo.png';
  const badge = payload.badge || payload.data?.badge || icon;
  const url = payload.url || payload.launchURL || payload.notification?.data?.url || payload.data?.url || 'https://onekamer.co';

  // 🖼️ Image enrichie (si fournie par le serveur)
  const image = payload.data?.image || payload.big_picture || payload.notification?.big_picture || null;

  // 🔊 Son et vibration personnalisés
  const sound = payload.data?.sound || 'default';
  const vibration = [200, 100, 200, 100, 200];

  // ✅ Construction finale de la notification enrichie
  const options = {
    body,
    icon,
    badge,
    image,
    sound,
    vibrate: vibration,
    requireInteraction: true,
    data: { url },
    actions: [
      { action: 'open', title: 'Ouvrir', icon: '/icons/open.png' },
      { action: 'close', title: 'Fermer', icon: '/icons/close.png' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Ouverture de l’URL au clic
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || 'https://onekamer.co';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.some((client) => {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          client.focus();
          return true;
        }
        return false;
      });
      if (!hadWindow && self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 5️⃣ Clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || 'https://onekamer.co';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

console.log('✅ OneKamer SW enrichi (image + vibration + son + actions) prêt 🎨');
