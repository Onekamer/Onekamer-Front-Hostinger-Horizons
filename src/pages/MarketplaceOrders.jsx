import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const MarketplaceOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('all');

  const headers = useMemo(() => {
    const h = { 'Content-Type': 'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  const load = async () => {
    setLoading(true);
    try {
      if (!session?.access_token) {
        setOrders([]);
        return;
      }
      const res = await fetch(`${apiBaseUrl}/api/market/orders?status=${encodeURIComponent(status)}`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement commandes');
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de charger vos commandes.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.access_token]);

  const renderAmount = (amt, cur) => {
    const n = Number(amt || 0);
    const c = String(cur || '').toUpperCase();
    return `${(n / 100).toFixed(2)} ${c}`;
  };

  return (
    <>
      <Helmet>
        <title>Mes commandes - Marketplace - OneKamer.co</title>
      </Helmet>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#2BA84A]">Mes commandes</h1>
          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
            >
              <option value="all">Toutes</option>
              <option value="pending">En attente</option>
              <option value="paid">Payées</option>
              <option value="canceled">Annulées</option>
            </select>
            <Button variant="outline" onClick={load} disabled={loading}>Rafraîchir</Button>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : (Array.isArray(orders) ? orders : []).length === 0 ? (
          <div className="text-gray-600">Aucune commande trouvée.</div>
        ) : (
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base">Liste</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="divide-y">
                {orders.map((o) => {
                  const createdAt = o?.created_at ? new Date(o.created_at) : null;
                  const when = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : '—';
                  const amount = renderAmount(o?.charge_amount_total, o?.charge_currency);
                  const statusNorm = String(o?.status || '').toLowerCase();
                  const statusLabel = statusNorm === 'paid' ? 'Payée' : statusNorm === 'pending' ? 'En attente' : statusNorm;
                  return (
                    <div key={o.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">Commande #{String(o.id).slice(0, 8)}</div>
                        <div className="text-xs text-gray-500">{when}</div>
                        <div className="text-xs text-gray-600">{o?.partner_display_name || 'Boutique'}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-gray-900">{amount}</div>
                        <div className="text-xs text-gray-600">{statusLabel}</div>
                        <div className="mt-2">
                          <Button variant="outline" onClick={() => navigate(`/market/orders/${encodeURIComponent(o.id)}`)}>Voir</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default MarketplaceOrders;
