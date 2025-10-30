
/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// ============================================================
// ✅ OneKamer — Service Worker fusionné (PWA + OneSignal officiel)
// Version finale avec affichage du vrai message OneSignal (Render)
// ============================================================

// 1️⃣ Import du SDK OneSignal
importScripts('https://cdn.onesignal.com/sdks/OneSignalSDK.js');
console.log('📡 SDK OneSignal chargé dans le SW fusionné');

// 2️⃣ Gestion du cache PWA
const CACHE_NAME = 'onekamer-cache-v1';
const urlsToCache = ['/', '/index.html', '/offline.html', '/favicon.ico'];

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker fusionné installé');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker fusionné activé');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      )
    )
  );
  self.clients.claim();
});

// 3️⃣ Fallback réseau → cache
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// ============================================================
// 4️⃣ OneSignal Notification Handling (fusionné + ultra-compatible)
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

  console.log('📩 Notification OneSignal reçue:', payload);

  // 🔍 On tente de récupérer le titre et le message depuis toutes les clés possibles
  const title =
    payload.title ||
    payload.headings?.en ||
    payload.notification?.title ||
    payload.data?.title ||
    'OneKamer.co';

  const body =
    payload.body ||
    payload.contents?.en ||
    payload.notification?.body ||
    payload.data?.message || // ✅ C’est cette clé que Render envoie !
    'Nouvelle notification disponible';

  const icon = '/ok_logo.png';
  const url =
    payload.url ||
    payload.launchURL ||
    payload.notification?.data?.url ||
    payload.data?.url ||
    'https://onekamer.co';

  const options = {
    body,
    icon,
    badge: icon,
    data: { url },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5️⃣ Clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const target = event.notification.data?.url || 'https://onekamer.co';
      for (const client of clientList) {
        if (client.url === target && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

console.log('✅ OneKamer SW fusionné (PWA + OneSignal + vrai body) prêt.');
