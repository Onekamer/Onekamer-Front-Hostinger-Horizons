// ============================================================
// ✅ OneKamer — main.jsx (version finale fusionnée PWA + OneSignal)
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// 🔍 Détection de l'app native iOS (Capacitor + WKWebView)
const isIOSNativeApp =
  typeof window !== 'undefined' &&
  window.Capacitor &&
  typeof window.Capacitor.getPlatform === 'function' &&
  window.Capacitor.getPlatform() === 'ios';

// ✅ Ajoute une classe uniquement dans l’app iOS native
if (isIOSNativeApp) {
  document.documentElement.classList.add('cap-ios'); // <html>
  document.body.classList.add('cap-ios');            // <body>
}

 //Service Worker PWA + désenregistrement OneSignal (si natif)
// 👉 On NE fait ça que si on n'est PAS dans l'app iOS native
if ('serviceWorker' in navigator && !isIOSNativeApp) {
  window.addEventListener('load', () => {
    // PWA
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('✅ Service Worker PWA enregistré'))
      .catch((err) => console.error('❌ Erreur enregistrement SW PWA :', err));

    const provider = 'supabase_light';
    if (provider === 'onesignal') {
      navigator.serviceWorker
        .register('/OneSignalSDKWorker.js', { scope: '/' })
        .then(() => console.log('✅ OneSignal Service Worker enregistré'))
        .catch((err) => console.error('❌ Erreur SW OneSignal :', err));
    } else if (provider === 'supabase_light') {
      // Désenregistrer d’anciens workers OneSignal (nettoyage cache/canaux)
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((r) => {
            if (r.scriptURL.includes('OneSignal')) {
              console.log('♻️ Unregister OneSignal SW:', r.scriptURL);
              r.unregister();
            }
          });
        })
        .catch(() => {});
    }
  });
}

// Auto-reload après longue inactivité pour éviter les écrans blancs au retour
// S'applique au navigateur, PWA et potentiellement au wrapper iOS (si WebView charge onekamer.co)
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

if (typeof window !== 'undefined') {
  let lastActive = Date.now();

  const updateActivity = () => {
    lastActive = Date.now();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if (now - lastActive > INACTIVITY_LIMIT_MS) {
        // no-op
      }
      updateActivity();
    }
  };

  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pageshow', handleVisibilityChange);
  window.addEventListener('focus', updateActivity);
  window.addEventListener('touchstart', updateActivity, { passive: true });
  window.addEventListener('click', updateActivity);
  window.addEventListener('keydown', updateActivity);
}
// ============================================================
// ✅ Lancement React
// ============================================================
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
