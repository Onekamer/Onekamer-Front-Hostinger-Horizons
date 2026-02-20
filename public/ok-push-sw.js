/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'OneKamer';
    const body = data.body || data.message || 'Nouvelle notification';
    const icon = data.icon || 'https://onekamer-media-cdn.b-cdn.net/logo/IMG_0885%202.PNG';
    const badge = data.badge || 'https://onekamer-media-cdn.b-cdn.net/favicon-32x32.png';
    const url = data.url || (data.data && data.data.url) || '/';
    const notifType = (data && data.data && data.data.type) || 'systeme';

    const options = {
      body,
      icon,
      badge,
      data: { url, ...data.data },
      vibrate: data.vibrate || [100, 50, 100],
      actions: data.actions || [],
      requireInteraction: Boolean(data.requireInteraction),
    };

    event.waitUntil(
      Promise.all([
        (async () => {
          // Vérifie les préférences locales (CacheStorage: 'ok-prefs' → '/ok-prefs')
          let allowed = true;
          try {
            if (typeof caches !== 'undefined') {
              const cache = await caches.open('ok-prefs');
              const resp = await cache.match('/ok-prefs');
              if (resp) {
                const prefs = await resp.json();
                if (prefs && Object.prototype.hasOwnProperty.call(prefs, notifType) && prefs[notifType] === false) {
                  allowed = false;
                }
              }
            }
          } catch (_e) {
            // ignore erreurs de lecture des préférences
          }
          if (!allowed) return; // Catégorie désactivée → pas d'affichage
          await self.registration.showNotification(title, options);
        })(),
        (async () => {
          try {
            const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            clientList.forEach((client) => {
              client.postMessage({ type: 'NEW_PUSH', payload: { title, body, url, data } });
            });
          } catch (_e) {
            // ignore
          }
        })(),
      ])
    );
  } catch (e) {
    event.waitUntil(self.registration.showNotification('OneKamer', {
      body: 'Nouvelle notification',
      icon: 'https://onekamer-media-cdn.b-cdn.net/logo/IMG_0885%202.PNG',
    }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
