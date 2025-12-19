import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';

const MarketplaceAdmin = () => {
  const { user, profile, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = useMemo(() => {
    return (
      profile?.is_admin === true ||
      profile?.is_admin === 1 ||
      profile?.is_admin === 'true' ||
      String(profile?.role || '').toLowerCase() === 'admin'
    );
  }, [profile]);

  const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;
  const API_PREFIX = `${apiBaseUrl}/api`;

  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [partners, setPartners] = useState([]);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');
      if (!API_PREFIX) throw new Error('API non configurée');

      const qs = new URLSearchParams();
      if (status && status !== 'all') qs.set('status', status);
      if (search.trim()) qs.set('search', search.trim());
      qs.set('limit', '100');
      qs.set('offset', '0');

      const res = await fetch(`${API_PREFIX}/admin/market/partners?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

      setPartners(Array.isArray(data?.partners) ? data.partners : []);
    } catch (e) {
      const msg = e?.message || 'Erreur interne';
      setError(msg);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && profile && isAdmin) {
      fetchPartners();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, isAdmin]);

  const updatePartner = async (partnerId, patch) => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');
      if (!API_PREFIX) throw new Error('API non configurée');

      const res = await fetch(`${API_PREFIX}/admin/market/partners/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour');

      await fetchPartners();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const deletePartner = async (partnerId, displayName) => {
    if (submitting) return;
    const ok = window.confirm(`Supprimer définitivement la boutique "${displayName || partnerId}" ?`);
    if (!ok) return;

    try {
      setSubmitting(true);
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');
      if (!API_PREFIX) throw new Error('API non configurée');

      const res = await fetch(`${API_PREFIX}/admin/market/partners/${encodeURIComponent(partnerId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur suppression');

      toast({ title: 'Boutique supprimée', description: 'Suppression effectuée.' });
      await fetchPartners();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="space-y-4">
        <div>Chargement…</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Gestion Marketplace - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Gestion Marketplace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Statut</div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Tous</option>
                  <option value="pending">En attente</option>
                  <option value="approved">Validés</option>
                  <option value="rejected">Refusés</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="text-sm font-medium">Recherche (nom boutique)</div>
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex: OK Boutique" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={loading || submitting} onClick={fetchPartners}>
                {loading ? 'Chargement…' : 'Recharger'}
              </Button>
            </div>

            {!loading && error && <div className="text-sm text-red-600">{error}</div>}

            {!loading && !error && partners.length === 0 && (
              <div className="text-sm text-gray-600">Aucune boutique trouvée.</div>
            )}

            {!loading && partners.length > 0 && (
              <div className="space-y-3">
                {partners.map((p) => (
                  <div key={p.id} className="border rounded-md p-3 bg-white space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{p.display_name || p.id}</div>
                        <div className="text-xs text-gray-500">
                          {p.category || '—'} • {p.base_currency || '—'}
                          {' • '}
                          Statut: {p.status || '—'}
                          {' • '}
                          Paiements: {p.payout_status || '—'}
                          {' • '}
                          Ouvert: {p.is_open ? 'oui' : 'non'}
                        </div>
                        {(p.owner_username || p.owner_email) && (
                          <div className="text-xs text-gray-500">
                            Propriétaire: {p.owner_username || p.owner_user_id}
                            {p.owner_email ? ` (${p.owner_email})` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => updatePartner(p.id, { status: 'approved' })}
                      >
                        Approuver
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => updatePartner(p.id, { status: 'rejected' })}
                      >
                        Refuser
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => updatePartner(p.id, { is_open: !p.is_open })}
                      >
                        {p.is_open ? 'Fermer' : 'Ouvrir'}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={submitting}
                        onClick={() => deletePartner(p.id, p.display_name)}
                      >
                        Supprimer
                      </Button>
                    </div>
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

export default MarketplaceAdmin;
