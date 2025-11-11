/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// Neutralisé: aucun chargement du SDK OneSignal
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});
