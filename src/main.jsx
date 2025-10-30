// ============================================================
// ✅ OneKamer — main.jsx (version finale fusionnée PWA + OneSignal)
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// Service Worker unique : PWA + OneSignal
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('✅ Service Worker fusionné (PWA + OneSignal) enregistré'))
      .catch((err) => console.error('❌ Erreur enregistrement SW fusionné :', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
