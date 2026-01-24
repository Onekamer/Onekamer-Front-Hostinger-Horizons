import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
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
  const [actioning, setActioning] = useState(null);

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
      const res = await fetch(`${apiBaseUrl}/api/market/orders?status=all`, {
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
  }, [session?.access_token]);

  const resumePayment = async (orderId) => {
    if (!orderId || !session?.access_token) return;
    setActioning(orderId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/pay`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Impossible de relancer le paiement');
      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Échec du paiement', variant: 'destructive' });
    } finally {
      setActioning(null);
    }
  };

  const cancelOrder = async (orderId) => {
    if (!orderId || !session?.access_token) return;
    setActioning(orderId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Annulation impossible");
      await load();
      toast({ title: 'Commande annulée' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'annuler la commande", variant: 'destructive' });
    } finally {
      setActioning(null);
    }
  };

  const renderAmount = (amt, cur) => {
    const n = Number(amt || 0);
    const c = String(cur || '').toUpperCase();
    return `${(n / 100).toFixed(2)} ${c}`;
  };

  const formatOrderCode = (shopName, createdAt, orderNumber) => {
    const raw = String(shopName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const prefix = (raw.slice(0, 3) || 'OK');
    const d = createdAt ? new Date(createdAt) : new Date();
    const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    const num = String(Number(orderNumber || 0)).padStart(6, '0');
    return `${prefix}-${year}-${num}`;
  };

  const groups = React.useMemo(() => {
    const arr = Array.isArray(orders) ? orders : [];
    const out = [];
    const idx = new Map();
    for (const o of arr) {
      const name = String(o?.partner_display_name || '—').trim() || '—';
      if (!idx.has(name)) { idx.set(name, out.length); out.push({ name, items: [] }); }
      out[idx.get(name)].items.push(o);
    }
    return out;
  }, [orders]);

  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const g of groups) if (typeof next[g.name] === 'undefined') next[g.name] = false;
      return next;
    });
  }, [groups]);

  return (
    <>
      <Helmet>
        <title>Mes commandes - Marketplace - OneKamer.co</title>
      </Helmet>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/marketplace')} className="px-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Marketplace
            </Button>
            <h1 className="text-xl font-bold text-[#2BA84A]">Mes commandes</h1>
          </div>
          <div />
        </div>

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : (Array.isArray(orders) ? orders : []).length === 0 ? (
          <div className="text-gray-600">Aucune commande trouvée.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {groups.map((g) => (
              <Card key={g.name} className="hover:shadow-sm transition">
                <CardHeader className="p-4 cursor-pointer" onClick={() => setExpanded((prev) => ({ ...prev, [g.name]: !prev[g.name] }))}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{g.name} ({Array.isArray(g.items) ? g.items.length : 0})</CardTitle>
                    <span className="text-gray-400">{expanded[g.name] !== false ? '▾' : '▸'}</span>
                  </div>
                </CardHeader>
                {expanded[g.name] !== false ? (
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-1 gap-3">
                      {g.items.map((o) => (
                        <Card key={o.id} className="hover:shadow-sm transition">
                          <CardHeader className="p-4">
                            <CardTitle className="text-base font-semibold">Commande n°{formatOrderCode(o.partner_display_name, o.created_at, o.order_number)}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Statut paiement</div>
                              <div>{String(o.status || '').toLowerCase().replace('_', ' ')}</div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Date de la commande</div>
                              <div>{o?.created_at ? new Date(o.created_at).toLocaleString() : '—'}</div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Statut commande</div>
                              <div>{String(o.status || '').toLowerCase() === 'pending' ? 'waiting for payment' : String(o.fulfillment_status || '—').replace('_', ' ')}</div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Montant</div>
                              <div>{renderAmount(o.charge_amount_total, o.charge_currency)}</div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Articles</div>
                              <div>{Array.isArray(o.items) ? o.items.length : 0}</div>
                            </div>
                            <div className="pt-2 flex flex-col gap-2">
                              <Button className="w-full" onClick={() => navigate(`/market/orders/${o.id}`)}>Voir le détail</Button>
                              {(() => {
                                const s = String(o.status || '').toLowerCase();
                                if (s === 'paid' || s === 'cancelled' || s === 'canceled') return null;
                                return (
                                  <>
                                    <Button className="w-full" variant="outline" onClick={() => resumePayment(o.id)} disabled={actioning === o.id}>
                                      Reprendre le paiement
                                    </Button>
                                    {!['cancelled', 'canceled'].includes(s) ? (
                                      <Button className="w-full" variant="outline" onClick={() => cancelOrder(o.id)} disabled={actioning === o.id}>
                                        Annuler la commande
                                      </Button>
                                    ) : null}
                                  </>
                                );
                              })()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default MarketplaceOrders;
