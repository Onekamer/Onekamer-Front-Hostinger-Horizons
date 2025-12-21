import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const INVITE_CODE_STORAGE_KEY = 'onekamer_invite_code';

const Invite = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tracking, setTracking] = useState(false);

  const code = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get('code') || '').trim() || null;
  }, [location.search]);

  const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

  useEffect(() => {
    if (!code) return;

    try {
      localStorage.setItem(INVITE_CODE_STORAGE_KEY, code);
    } catch {
    }

    (async () => {
      try {
        if (!API_PREFIX) return;
        setTracking(true);
        const res = await fetch(`${API_PREFIX}/invites/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, event: 'click' }),
        });
        if (!res.ok) {
          const txt = await res.text();
          console.warn('[Invite] track click failed:', txt);
        }
      } catch (e) {
        console.warn('[Invite] track click error:', e?.message || e);
      } finally {
        setTracking(false);
      }
    })();
  }, [code, API_PREFIX]);

  if (!code) {
    return (
      <>
        <Helmet>
          <title>Invitation - OneKamer.co</title>
        </Helmet>
        <div className="max-w-xl mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invitation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">Lien d’invitation invalide.</p>
              <Button type="button" className="w-full" onClick={() => navigate('/auth')}>
                Se connecter / S’inscrire
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Invitation - OneKamer.co</title>
      </Helmet>
      <div className="max-w-xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Invitation OneKamer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Une personne vous invite à rejoindre OneKamer. Créez un compte ou connectez-vous pour continuer.
            </p>

            <Button type="button" className="w-full" onClick={() => navigate('/auth')}>
              Se connecter / S’inscrire
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={tracking}
              onClick={() => {
                try {
                  navigator.clipboard.writeText(`${window.location.origin}/invite?code=${encodeURIComponent(code)}`);
                  toast({ title: 'Lien copié', description: 'Vous pouvez le coller dans un message.' });
                } catch {
                  toast({ title: 'Erreur', description: 'Impossible de copier le lien.', variant: 'destructive' });
                }
              }}
            >
              Copier le lien
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Invite;
