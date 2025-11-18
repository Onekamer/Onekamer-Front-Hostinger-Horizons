import React, { useEffect, useState } from 'react';

const IosPwaPrompt = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const ua = window.navigator.userAgent || '';
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isInStandaloneMode =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    const dismissed = window.localStorage.getItem('ok_ios_pwa_prompt_dismissed') === '1';

    if (isIos && !isInStandaloneMode && !dismissed) {
      setVisible(true);
    }
  }, []);

  const handleClose = () => {
    setVisible(false);
    try {
      window.localStorage.setItem('ok_ios_pwa_prompt_dismissed', '1');
    } catch (e) {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-40 px-4">
      <div className="max-w-lg mx-auto bg-white/95 backdrop-blur-md border border-[#2BA84A]/30 rounded-2xl shadow-lg p-3 flex items-start gap-3 text-sm">
        <div className="flex-1 text-gray-800">
          <p className="font-semibold text-[#2BA84A] mb-1">Installe OneKamer sur ton iPhone</p>
          <p className="text-xs leading-snug">
            1. Appuie sur le bouton <span className="font-semibold">Partager</span>,
            puis 2. choisis <span className="font-semibold">« Ajouter à l'écran d'accueil »</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
        >
          Fermer
        </button>
      </div>
    </div>
  );
};

export default IosPwaPrompt;
