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

  const [perfPeriod, setPerfPeriod] = useState('30d');
  const [perfCurrency, setPerfCurrency] = useState('ALL');
  const [perfSearch, setPerfSearch] = useState('');
  const [perfIncludeEmpty, setPerfIncludeEmpty] = useState(false);
  const [perfLimit, setPerfLimit] = useState(5);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState(null);
  const [perfRows, setPerfRows] = useState([]);
  const [perfCount, setPerfCount] = useState(null);

  const currencyOptions = useMemo(() => {
    const set = new Set(['ALL', 'EUR', 'USD', 'GBP', 'XAF']);
    (Array.isArray(perfRows) ? perfRows : []).forEach((r) => {
      const cur = String(r?.currency || '').toUpperCase().trim();
      if (cur) set.add(cur);
    });
    return Array.from(set);
  }, [perfRows]);

  const formatMoney = (minor, currency) => {
    const v = Number(minor);
    if (!Number.isFinite(v)) return '—';
    const cur = String(currency || '').toUpperCase().trim();
    const amount = (v / 100).toFixed(2);
    return cur ? `${amount} ${cur}` : `${amount}`;
  };

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

  const fetchPerformance = async (opts = {}) => {
    try {
      setPerfLoading(true);
      setPerfError(null);

      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');
      if (!API_PREFIX) throw new Error('API non configurée');

      const period = opts?.period ?? perfPeriod;
      const currency = opts?.currency ?? perfCurrency;
      const searchText = opts?.search ?? perfSearch;
      const includeEmpty = opts?.includeEmpty ?? perfIncludeEmpty;
      const limitValue = opts?.limit ?? perfLimit;

      const qs = new URLSearchParams();
      qs.set('period', period);
      qs.set('currency', currency);
      if (String(searchText || '').trim()) qs.set('search', String(searchText || '').trim());
      if (includeEmpty) qs.set('includeEmpty', 'true');
      qs.set('limit', String(limitValue));
      qs.set('offset', '0');

      const res = await fetch(`${API_PREFIX}/admin/market/partners/performance?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

      setPerfRows(Array.isArray(data?.rows) ? data.rows : []);
      setPerfCount(typeof data?.count === 'number' ? data.count : null);
    } catch (e) {
      const msg = e?.message || 'Erreur interne';
      setPerfError(msg);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setPerfLoading(false);
    }
  };

  useEffect(() => {
    if (user && profile && isAdmin) {
      fetchPerformance();
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
            <CardTitle>Performance boutiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Période</div>
                <select
                  value={perfPeriod}
                  onChange={(e) => setPerfPeriod(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                >
                  <option value="7d">7 jours</option>
                  <option value="30d">30 jours</option>
                  <option value="90d">90 jours</option>
                  <option value="365d">365 jours</option>
                  <option value="all">Tout</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Devise</div>
                <select
                  value={perfCurrency}
                  onChange={(e) => setPerfCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                >
                  {currencyOptions.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'Toutes' : c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Recherche boutique</div>
                <Input value={perfSearch} onChange={(e) => setPerfSearch(e.target.value)} placeholder="Ex: African Food" />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" disabled={perfLoading} onClick={fetchPerformance} className="w-full">
                  {perfLoading ? 'Chargement…' : 'Recharger'}
                </Button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={perfLoading}
                onClick={() => {
                  setPerfIncludeEmpty(false);
                  setPerfLimit(5);
                  fetchPerformance({ includeEmpty: false, limit: 5 });
                }}
                className="w-full md:w-auto"
              >
                Top 5
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={perfLoading}
                onClick={() => {
                  setPerfIncludeEmpty(true);
                  setPerfLimit(50);
                  fetchPerformance({ includeEmpty: true, limit: 50 });
                }}
                className="w-full md:w-auto"
              >
                Voir toutes les boutiques
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={perfLoading}
                onClick={() => {
                  const next = perfLimit + 5;
                  setPerfLimit(next);
                  fetchPerformance({ limit: next });
                }}
                className="w-full md:w-auto"
              >
                Voir plus
              </Button>
            </div>

            {!perfLoading && perfError ? <div className="text-sm text-red-600">{perfError}</div> : null}

            {!perfLoading && !perfError && perfRows.length === 0 ? (
              <div className="text-sm text-gray-600">Aucune vente payée sur la période.</div>
            ) : null}

            {!perfLoading && !perfError && perfRows.length > 0 && typeof perfCount === 'number' ? (
              <div className="text-xs text-gray-500">Affichage: {perfRows.length} / {perfCount}</div>
            ) : null}

            {!perfLoading && perfRows.length > 0 ? (
              <div className="border rounded-md bg-white overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium">
                  <div className="col-span-4">Boutique</div>
                  <div className="col-span-2">Devise</div>
                  <div className="col-span-2">CA</div>
                  <div className="col-span-2">Commandes payées</div>
                  <div className="col-span-2">Panier moyen</div>
                </div>

                <div className="divide-y">
                  {perfRows.map((r) => (
                    <div key={`${r.partner_id}-${r.currency}`} className="p-3">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-start">
                        <div className="md:col-span-4">
                          <div className="text-sm font-semibold">{r.partner_display_name || r.partner_id}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-sm text-gray-800">{String(r.currency || '—').toUpperCase()}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-sm text-gray-800">{formatMoney(r.revenue_charge_total_minor, r.currency)}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-sm text-gray-800">{Number(r.orders_paid_count || 0)}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-sm text-gray-800">{formatMoney(r.avg_basket_minor, r.currency)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

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
