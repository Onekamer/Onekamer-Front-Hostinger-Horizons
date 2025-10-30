import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import OneSignal from 'react-onesignal';

// ============================================================
// ✅ Initialisation OneSignal pour la PROD (onekamer.co)
// ============================================================
(async () => {
  try {
    console.log("🔄 Initialisation OneSignal (PROD)...");
    await OneSignal.init({
      appId: "a122b55d-7627-4bc9-aeaf-16d69a6a50b5", // ID OneSignal
      safari_web_id: "web.onesignal.auto.YOUR_SAFARI_ID", // optionnel
      notifyButton: {
        enable: true,
        position: 'bottom-right',
        theme: 'default',
        text: {
          'tip.state.unsubscribed': 'Recevoir les notifications OneKamer',
          'tip.state.subscribed': 'Vous êtes abonné 🔔',
          'tip.state.blocked': 'Notifications bloquées',
          'message.prenotify': 'S’abonner aux actualités',
          'message.action.subscribed': 'Abonnement réussi ✅',
          'message.action.resubscribed': 'Abonnement réactivé 🔔',
          'message.action.unsubscribed': 'Abonnement désactivé ❌',
          'dialog.main.title': 'Activer les notifications',
          'dialog.main.button.subscribe': 'S’abonner',
          'dialog.main.button.unsubscribe': 'Se désabonner',
        },
      },
    });

    window.OneSignal = OneSignal;
    console.log("✅ OneSignal initialisé sur la PROD !");
    console.log("🧠 Tape `OneSignal.showSlidedownPrompt()` dans la console pour forcer le popup !");
  } catch (err) {
    console.error("❌ Erreur OneSignal init:", err);
  }
})();

// ============================================================
// ✅ Service Worker (PWA + OneSignal Android fix)
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('✅ Service Worker PWA enregistré'))
      .catch((err) => console.warn('⚠️ Erreur SW PWA :', err));

    navigator.serviceWorker
      .register('/OneSignalSDKWorker.js', { scope: '/' })
      .then(() => console.log('✅ OneSignal Service Worker Android enregistré'))
      .catch((err) => console.error('❌ Erreur SW OneSignal:', err));
  });
}

// ============================================================
// ✅ Lancement React
// ============================================================
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
