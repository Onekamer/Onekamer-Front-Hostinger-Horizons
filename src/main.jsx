// ============================================================
// ✅ OneKamer — main.jsx (version finale fusionnée PWA + OneSignal)
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// Service Worker PWA + désenregistrement OneSignal (si natif)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // PWA
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('✅ Service Worker PWA enregistré'))
      .catch((err) => console.error('❌ Erreur enregistrement SW PWA :', err));

    const provider = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal';
    if (provider === 'onesignal') {
      navigator.serviceWorker
        .register('/OneSignalSDKWorker.js', { scope: '/' })
        .then(() => console.log('✅ OneSignal Service Worker enregistré'))
        .catch((err) => console.error('❌ Erreur SW OneSignal :', err));
    } else if (provider === 'supabase_light') {
      // Désenregistrer d’anciens workers OneSignal (nettoyage cache/canaux)
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => {
          if (r.scriptURL.includes('OneSignal')) {
            console.log('♻️ Unregister OneSignal SW:', r.scriptURL);
            r.unregister();
          }
        });
      }).catch(() => {});
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
