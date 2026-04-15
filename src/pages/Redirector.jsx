import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Redirector = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search || '');
      const rawTo = (params.get('to') || '/').trim();
      const to = rawTo.startsWith('/') ? rawTo : '/';
      params.delete('to');
      const qs = params.toString();
      const targetPath = qs ? `${to}?${qs}` : to;

      const ua = String(navigator.userAgent || '').toLowerCase();
      const isMobile = /iphone|ipad|ipod|android/.test(ua);
      const deep = `onekamer://${targetPath.replace(/^\//, '')}`;

      if (isMobile) {
        const timer = setTimeout(() => {
          try { navigate(targetPath, { replace: true }); } catch { window.location.replace(targetPath); }
        }, 1200);
        try { window.location.href = deep; } catch (_) { /* ignore */ }
        return () => clearTimeout(timer);
      } else {
        try { navigate(targetPath, { replace: true }); } catch { window.location.replace(targetPath); }
      }
    } catch (_) {
      try { navigate('/', { replace: true }); } catch { window.location.replace('/'); }
    }
  }, [location.search, navigate]);

  return (
    <div className="flex items-center justify-center h-64 text-sm text-gray-700">
      Redirection en cours… Si rien ne se passe, veuillez revenir en arrière ou vous connecter.
    </div>
  );
};

export default Redirector;
