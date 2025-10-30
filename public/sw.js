/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// ============================================================
// 🧠 Service Worker fusionné (PWA + OneSignal)
// Compatible Android / Chrome / PWA Hostinger & Render
// ============================================================

importScripts('https://cdn.onesignal.com/sdks/OneSignalSDK.js');

// ✅ Cache PWA
const CACHE_NAME = 'onekamer-cache-v1';
const urlsToCache = ['/', '/index.html', '/offline.html', '/favicon.ico'];

self.addEventListener('install', (event) => {
  console.log('✅ Service Worker fusionné installé');
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker fusionné activé');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(cacheNames.map((name) => name !== CACHE_NAME && caches.delete(name)))
    )
  );
  self.clients.claim();
});

// ✅ Fallback réseau → cache
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// ✅ OneSignal Push Notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  console.log('📩 Notification reçue via OneSignal:', payload);
  const title = payload.notification?.title || 'OneKamer.co';
  const body = payload.notification?.body || 'Nouvelle notification reçue.';
  const icon = '/ok_logo.png';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      data: payload.notification,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      if (event.notification?.data?.url) return clients.openWindow(event.notification.data.url);
      return clients.openWindow('/');
    })
  );
});
