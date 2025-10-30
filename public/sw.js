/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// ============================================================
// ✅ OneKamer — Service Worker fusionné (PWA + OneSignal officiel)
// Compatible Android / Chrome / PWA Hostinger & Render
// ============================================================

// 1️⃣ Import du SDK OneSignal (obligatoire pour push)
importScripts('https://cdn.onesignal.com/sdks/OneSignalSDK.js');
console.log('📡 SDK OneSignal chargé dans le SW fusionné');

// 2️⃣ Gestion du cache PWA classique
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
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ============================================================
// 4️⃣ OneSignal Notification Handling (fusionné)
// ============================================================

// Réception de la notification
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  console.log('📩 Notification OneSignal reçue:', payload);

  const title = payload.notification?.title || 'OneKamer.co';
  const body = payload.notification?.body || 'Nouvelle notification disponible';
  const icon = '/ok_logo.png';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      data: payload.notification || {},
    })
  );
});

// Clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      if (event.notification?.data?.url)
        return clients.openWindow(event.notification.data.url);
      return clients.openWindow('/');
    })
  );
});

console.log('✅ OneKamer SW fusionné (PWA + OneSignal) prêt.');
