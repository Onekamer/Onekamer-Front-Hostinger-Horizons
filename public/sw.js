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

// 3️⃣ Fallback réseau → cache (version robuste)
self.addEventListener('fetch', (event) => {
  // On n'intercepte que les requêtes GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // On tente toujours le réseau en premier
        const networkResponse = await fetch(event.request);
        return networkResponse;
      } catch (_err) {
        // En cas d'échec réseau, on tente le cache
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }

        // Si c'est une navigation (HTML) et qu'on n'a rien, on renvoie la page offline
        if (event.request.mode === 'navigate') {
          const offline = await caches.match('/offline.html');
          if (offline) {
            return offline;
          }
        }

        // En dernier recours, on renvoie une erreur HTTP générique
        return Response.error();
      }
    })()
  );
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
  const badge = payload.badge || payload.data?.badge || 'https://onekamer-media-cdn.b-cdn.net/android-chrome-72x72.png';
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
    tag: payload.data?.tag || payload.tag || 'ok-general',
    renotify: true,
    data: { url },
    actions: [
      { action: 'open', title: 'Ouvrir', icon: '/icons/open.png' },
      { action: 'close', title: 'Fermer', icon: '/icons/close.png' },
    ],
  };

  // 👉 Si une fenêtre cliente est visible, on envoie un message pour afficher un toast in-app
  // Sinon, on affiche la notification système comme d'habitude.
  event.waitUntil((async () => {
    try {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasVisibleClient = Array.isArray(clientList) && clientList.some((c) => {
        try { return c.visibilityState === 'visible' || c.focused === true; } catch (_) { return false; }
      });

      if (hasVisibleClient) {
        for (const client of clientList) {
          try {
            client.postMessage({
              type: 'ok_push_in_app',
              payload: { title, body, url, icon, image, tag: options.tag },
            });
          } catch (_) {}
        }
        return; // pas de notification système si l'app est visible
      }

      return self.registration.showNotification(title, options);
    } catch (e) {
      // En cas d'erreur, fallback sur la notif système
      return self.registration.showNotification(title, options);
    }
  })());
});

// Clic sur la notification (focus/navigate robuste vers l'origine cible)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification?.data?.url || 'https://onekamer.co';
  let target = 'https://onekamer.co';
  try {
    target = new URL(raw, self.location.origin).href;
  } catch (_) {}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetOrigin = new URL(target).origin;
      for (const client of clientList) {
        try {
          const clientOrigin = new URL(client.url).origin;
          if (clientOrigin === targetOrigin) {
            if ('focus' in client) client.focus();
            if ('navigate' in client) client.navigate(target);
            return true;
          }
        } catch (_) {}
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return false;
    })
  );
});

// Renouvellement d'abonnement push: notifie l'app de relancer subscribeForPush
self.addEventListener('pushsubscriptionchange', () => {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({ type: 'ok_push_subscription_changed' });
    }
  });
});

console.log('✅ OneKamer SW enrichi (image + vibration + son + actions) prêt 🎨');
