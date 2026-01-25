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

  // Admin - Commandes
  const [ordPartnerId, setOrdPartnerId] = useState('');
  const [ordStatus, setOrdStatus] = useState('all');
  const [ordFulfillment, setOrdFulfillment] = useState('');
  const [ordOrderNumber, setOrdOrderNumber] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [adminOrders, setAdminOrders] = useState([]);
  const [ordersCount, setOrdersCount] = useState(null);
  const [ordersExpanded, setOrdersExpanded] = useState({});
  const [orderDetails, setOrderDetails] = useState(new Map());

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

  const formatOrderCode = (shopName, createdAt, orderNumber) => {
    const raw = String(shopName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const prefix = (raw.slice(0, 3) || 'OK');
    const d = createdAt ? new Date(createdAt) : new Date();
    const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    const num = String(Number(orderNumber || 0)).padStart(6, '0');
    return `${prefix}-${year}-${num}`;
  };

  const fetchAdminOrders = async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');
      if (!API_PREFIX) throw new Error('API non configurée');

      const qs = new URLSearchParams();
      if (ordPartnerId) qs.set('partnerId', ordPartnerId);
      if (ordStatus && ordStatus !== 'all') qs.set('status', ordStatus);
      if (ordFulfillment) qs.set('fulfillment', ordFulfillment);
      if (String(ordOrderNumber || '').trim()) qs.set('orderNumber', String(ordOrderNumber).trim());
      qs.set('limit', '5');
      qs.set('offset', '0');

      const res = await fetch(`${API_PREFIX}/admin/market/orders?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur lecture commandes');
      setAdminOrders(Array.isArray(data?.orders) ? data.orders : []);
      setOrdersCount(typeof data?.count === 'number' ? data.count : null);
    } catch (e) {
      const msg = e?.message || 'Erreur interne';
      setOrdersError(msg);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadOrderDetail = async (orderId) => {
    try {
      const token = session?.access_token;
      if (!token) throw new Error('Session expirée');
      const res = await fetch(`${API_PREFIX}/admin/market/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur détail commande');
      setOrderDetails((prev) => {
        const next = new Map(prev);
        next.set(String(orderId), data || {});
        return next;
      });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de charger le détail.', variant: 'destructive' });
    }
  };

  const patchOrderStatus = async (orderId, status, askReason = false) => {
    if (!orderId || !status) return;
    const token = session?.access_token;
    if (!token) return toast({ title: 'Erreur', description: 'Session expirée', variant: 'destructive' });
    const reason = askReason ? window.prompt('Motif (optionnel) :', '') : '';
    try {
      const res = await fetch(`${API_PREFIX}/admin/market/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reason: String(reason || '').trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour statut');
      toast({ title: 'Statut mis à jour' });
      await fetchAdminOrders();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de mettre à jour.', variant: 'destructive' });
    }
  };

  const completeOrderAdmin = async (o) => {
    if (!o?.id) return;
    const token = session?.access_token;
    if (!token) return toast({ title: 'Erreur', description: 'Session expirée', variant: 'destructive' });
    const reason = window.prompt('Motif (optionnel) :', '') || '';
    try {
      const res = await fetch(`${API_PREFIX}/admin/market/orders/${encodeURIComponent(o.id)}/fulfillment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fulfillment_status: 'completed', reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour commande');
      toast({ title: 'Commande terminée' });
      await fetchAdminOrders();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de terminer la commande.', variant: 'destructive' });
    }
  };

  const refundOrder = async (o) => {
    if (!o?.id) return;
    const token = session?.access_token;
    if (!token) return toast({ title: 'Erreur', description: 'Session expirée', variant: 'destructive' });
    const cur = String(o.charge_currency || '').toUpperCase();
    const totalMinor = Number(o.charge_amount_total || 0);
    const defaultAmount = (totalMinor / 100).toFixed(2);
    const input = window.prompt(`Montant à rembourser en ${cur} (laisser vide pour ${defaultAmount} ${cur})`, '');
    let amountMinor = totalMinor;
    if (input && String(input).trim()) {
      const parsed = parseFloat(String(input).replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return toast({ title: 'Montant invalide', description: 'Veuillez saisir un nombre positif.', variant: 'destructive' });
      }
      amountMinor = Math.round(parsed * 100);
      if (amountMinor > totalMinor) {
        return toast({ title: 'Montant trop élevé', description: 'Le montant dépasse le total de la commande.', variant: 'destructive' });
      }
    }
    try {
      const res = await fetch(`${API_PREFIX}/admin/market/orders/${encodeURIComponent(o.id)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount_minor: amountMinor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur remboursement');
      toast({ title: 'Remboursement effectué', description: `${(amountMinor / 100).toFixed(2)} ${cur}` });
      await fetchAdminOrders();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Échec du remboursement', variant: 'destructive' });
    }
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
      fetchAdminOrders();
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
            <CardTitle>Commandes Marketplace (Admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="space-y-2">
                <div className="text-sm font-medium">Boutique</div>
                <select
                  value={ordPartnerId}
                  onChange={(e) => setOrdPartnerId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Toutes</option>
                  {(Array.isArray(partners) ? partners : []).map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name || p.id}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Statut paiement</div>
                <select
                  value={ordStatus}
                  onChange={(e) => setOrdStatus(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">Tous</option>
                  <option value="pending">pending</option>
                  <option value="paid">paid</option>
                  <option value="refunded">refunded</option>
                  <option value="disputed">disputed</option>
                  <option value="failed">failed</option>
                  <option value="canceled">canceled</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Statut commande</div>
                <select
                  value={ordFulfillment}
                  onChange={(e) => setOrdFulfillment(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Tous</option>
                  <option value="sent_to_seller">sent_to_seller</option>
                  <option value="preparing">preparing</option>
                  <option value="shipping">shipping</option>
                  <option value="delivered">delivered</option>
                  <option value="completed">completed</option>
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">N° commande</div>
                <Input value={ordOrderNumber} onChange={(e) => setOrdOrderNumber(e.target.value)} placeholder="Ex: 123" />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" disabled={ordersLoading} onClick={fetchAdminOrders} className="w-full">{ordersLoading ? 'Chargement…' : 'Rechercher'}</Button>
              </div>
            </div>

            {ordersError ? <div className="text-sm text-red-600">{ordersError}</div> : null}

            {!ordersLoading && Array.isArray(adminOrders) && adminOrders.length === 0 ? (
              <div className="text-sm text-gray-600">Aucune commande.</div>
            ) : null}

            {ordersCount != null && adminOrders.length > 0 ? (
              <div className="text-xs text-gray-500">Affichage: {adminOrders.length}{typeof ordersCount === 'number' ? ` / ${ordersCount}` : ''}</div>
            ) : null}

            {adminOrders.length > 0 ? (
              <div className="border rounded-md bg-white overflow-hidden">
                <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium">
                  <div className="col-span-3">Commande</div>
                  <div className="col-span-2">Boutique</div>
                  <div className="col-span-2">Montant</div>
                  <div className="col-span-2">Statuts</div>
                  <div className="col-span-3">Actions</div>
                </div>
                <div className="divide-y">
                  {adminOrders.map((o) => {
                    const code = formatOrderCode(o.partner_display_name, o.created_at, o.order_number);
                    const money = formatMoney(o.charge_amount_total, o.charge_currency);
                    const sPay = String(o.status || '').toLowerCase();
                    const sFul = String(o.fulfillment_status || '').toLowerCase();
                    const resolved = (sFul === 'completed') && (sPay === 'refunded' || sPay === 'disputed');
                    const expanded = ordersExpanded[String(o.id)] === true;
                    return (
                      <div key={o.id} className="p-3">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-start">
                          <div className="md:col-span-3">
                            <div className="text-sm font-semibold">{code}</div>
                            <div className="text-xs text-gray-500">{o?.created_at ? new Date(o.created_at).toLocaleString() : '—'}</div>
                          </div>
                          <div className="md:col-span-2">
                            <div className="text-sm text-gray-800">{o.partner_display_name || o.partner_id}</div>
                          </div>
                          <div className="md:col-span-2">
                            <div className="text-sm text-gray-800">{money}</div>
                          </div>
                          <div className="md:col-span-2">
                            <div className="text-sm text-gray-800">{sPay}</div>
                            <div className="text-xs text-gray-500">{sFul || '—'}</div>
                            {resolved ? (
                              <div className="mt-1 inline-flex items-center rounded px-2 py-0.5 text-[10px] bg-green-100 text-green-700 border border-green-200">Résolu</div>
                            ) : null}
                          </div>
                          <div className="md:col-span-3 flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={async () => {
                              setOrdersExpanded((prev) => ({ ...prev, [String(o.id)]: !expanded }));
                              if (!expanded && !orderDetails.get(String(o.id))) await loadOrderDetail(o.id);
                            }}>
                              {expanded ? 'Masquer' : 'Détail'}
                            </Button>
                            {sPay === 'paid' ? (
                              <Button type="button" variant="outline" onClick={() => refundOrder(o)}>Refund</Button>
                            ) : null}
                            {sPay !== 'refunded' ? (
                              <Button type="button" variant="outline" onClick={() => patchOrderStatus(o.id, 'disputed', true)}>Disputed</Button>
                            ) : null}
                            {sFul !== 'completed' ? (
                              <Button type="button" variant="outline" onClick={() => completeOrderAdmin(o)}>Terminer</Button>
                            ) : null}
                          </div>
                        </div>

                        {expanded ? (
                          <div className="mt-3 text-sm">
                            {(() => {
                              const det = orderDetails.get(String(o.id)) || {};
                              const ord = det.order || {};
                              const items = Array.isArray(det.items) ? det.items : [];
                              return (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div>
                                      <div className="text-gray-600">Dest. account</div>
                                      <div className="text-gray-800">{ord?.destination_account || '—'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-600">Checkout</div>
                                      <div className="text-gray-800">{ord?.checkout_session_id || '—'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-600">Payment Intent</div>
                                      <div className="text-gray-800">{ord?.payment_intent_id || '—'}</div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <div>
                                      <div className="text-gray-600">Transfer ID</div>
                                      <div className="text-gray-800">{ord?.transfer_id || '—'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-600">Transfer status</div>
                                      <div className="text-gray-800">{ord?.transfer_status || '—'}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-600">Transféré le</div>
                                      <div className="text-gray-800">{ord?.transferred_at ? new Date(ord.transferred_at).toLocaleString() : '—'}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-gray-600">Erreur transfert</div>
                                    <div className="text-gray-800">{ord?.transfer_error || '—'}</div>
                                  </div>
                                  <div>
                                    <div className="text-gray-600">Articles</div>
                                    <div className="space-y-1">
                                      {items.length === 0 ? (
                                        <div className="text-gray-600">—</div>
                                      ) : items.map((it) => (
                                        <div key={it.id} className="flex items-center justify-between">
                                          <div className="text-gray-800">{it.title_snapshot || 'Article'}</div>
                                          <div className="text-gray-600">x{it.quantity || 1}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
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
