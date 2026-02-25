import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';

const API_PREFIX = import.meta.env.VITE_API_URL || '/api';

const MesPostsSponsorises = () => {
  const { session, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [paying, setPaying] = useState(false);

  const isIOSNativeApp = typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() === 'ios';

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_PREFIX}/sponsor/my-posts`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur lecture');
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Chargement échoué', variant: 'destructive' });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, load]);

  const handlePay = async (postId) => {
    if (!session?.access_token) {
      toast({ title: 'Session requise', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
      return;
    }
    try {
      setPaying(true);
      const provider = isIOSNativeApp ? 'iap' : 'stripe';
      const res = await fetch(`${API_PREFIX}/sponsor/orders/${encodeURIComponent(postId)}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Création commande échouée');
      toast({ title: 'Commande créée', description: 'Brouillon de paiement prêt. Le paiement sera bientôt disponible.' });
      load();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de créer la commande', variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Mes posts sponsorisés - OneKamer.co</title>
      </Helmet>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Mes posts sponsorisés</CardTitle>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>Rafraîchir</Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-500">Chargement…</div>
            ) : (items || []).length === 0 ? (
              <div className="text-sm text-gray-500">Aucun post sponsorisé</div>
            ) : (
              <div className="divide-y">
                {items.map((it) => (
                  <div key={it.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{it.title || 'Sans titre'}</div>
                      <div className="text-xs text-gray-500">Statut: {it.status}</div>
                    </div>
                    {String(it.status || '') === 'approved' ? (
                      <Button size="sm" onClick={() => handlePay(it.id)} disabled={paying}>Payer</Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MesPostsSponsorises;
