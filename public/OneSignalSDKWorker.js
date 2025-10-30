/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// ============================================================
// ✅ OneKamer - OneSignal Service Worker (PWA Android Fix)
// ============================================================

// Charge le SDK officiel OneSignal
importScripts('https://cdn.onesignal.com/sdks/OneSignalSDK.js');

// Log installation et activation
self.addEventListener('install', () => {
  console.log('✅ OneSignal Worker installé');
});

self.addEventListener('activate', () => {
  console.log('✅ OneSignal Worker activé et prêt');
});

// ============================================================
// 🧩 FIX Android Chrome : affichage manuel des notifications
// ============================================================
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();

      const title = data.notification?.title || data.title || '📢 OneKamer';
      const message = data.notification?.body || data.message || 'Nouvelle notification reçue !';
      const icon = data.notification?.icon || '/icon-192x192.png';

      console.log('📩 Notification reçue dans le Worker:', data);

      event.waitUntil(
        self.registration.showNotification(title, {
          body: message,
          icon: icon,
          vibrate: [200, 100, 200],
          tag: 'onekamer-push',
          data: data
        })
      );
    } catch (err) {
      console.error('❌ Erreur lors du parsing du push event:', err);
    }
  }
});

// ============================================================
// 📲 Optionnel : gérer le clic sur la notification
// ============================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('https://onekamer.co');
      }
    })
  );
});
