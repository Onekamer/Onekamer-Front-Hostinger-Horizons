import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const MarketplaceOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const headers = useMemo(() => {
    const h = { 'Content-Type': 'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [role, setRole] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const [rating, setRating] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const [accepting, setAccepting] = useState(false);
  const [updatingFulfill, setUpdatingFulfill] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      if (!session?.access_token) {
        toast({ title: 'Veuillez vous connecter', variant: 'destructive' });
        return;
      }
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement commande');
      setOrder(data?.order || null);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setRole(data?.role || null);
      setConversationId(data?.conversationId || null);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de charger la commande.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orderId, session?.access_token, apiBaseUrl, headers, toast]);

  const loadMessages = useCallback(async () => {
    if (!orderId || !session?.access_token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/messages`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement messages');
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      if (data?.conversationId) setConversationId(data.conversationId);
    } catch {}
  }, [orderId, session?.access_token, apiBaseUrl, headers]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    let id;
    const start = async () => {
      await loadMessages();
      id = setInterval(loadMessages, 4000);
    };
    start();
    return () => { if (id) clearInterval(id); };
  }, [loadMessages]);

  const acceptOrder = async () => {
    if (!order?.id || !order?.partner_id) return;
    if (accepting) return;
    setAccepting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(order.partner_id)}/orders/${encodeURIComponent(order.id)}/mark-received`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Action impossible');
      toast({ title: 'Commande acceptée', description: 'Statut: en préparation' });
      await loadOrder();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d’accepter la commande', variant: 'destructive' });
    } finally {
      setAccepting(false);
    }
  };

  const updateFulfillment = async (next) => {
    if (!order?.id) return;
    if (updatingFulfill) return;
    setUpdatingFulfill(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(order.id)}/fulfillment`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: next })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour');
      toast({ title: 'Préparation mise à jour' });
      await loadOrder();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de mettre à jour', variant: 'destructive' });
    } finally {
      setUpdatingFulfill(false);
    }
  };

  const loadRating = useCallback(async () => {
    if (!orderId || !session?.access_token) return;
    try {
      setRatingLoading(true);
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/rating`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement avis');
      setRating(data?.rating || null);
    } catch {
      setRating(null);
    } finally {
      setRatingLoading(false);
    }
  }, [orderId, session?.access_token, apiBaseUrl, headers]);

  useEffect(() => { loadRating(); }, [loadRating]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: messageText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur envoi message');
      setMessageText('');
      await loadMessages();
      toast({ title: 'Message envoyé' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d\'envoyer le message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const canConfirmReceived = useMemo(() => {
    const f = String(order?.fulfillment_status || '').toLowerCase();
    return role === 'buyer' && f === 'delivered';
  }, [order, role]);

  const canAcceptOrder = useMemo(() => {
    const f = String(order?.fulfillment_status || '').toLowerCase();
    return role === 'seller' && f === 'sent_to_seller';
  }, [order, role]);

  const canManageFulfillment = useMemo(() => {
    const f = String(order?.fulfillment_status || '').toLowerCase();
    return role === 'seller' && ['preparing','shipping','delivered'].includes(f);
  }, [order, role]);

  const confirmReceived = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/confirm-received`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Échec confirmation');
      toast({ title: 'Réception confirmée' });
      await loadOrder();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de confirmer', variant: 'destructive' });
    }
  };

  const canRate = useMemo(() => {
    const s = String(order?.status || '').toLowerCase();
    const f = String(order?.fulfillment_status || '').toLowerCase();
    return role === 'buyer' && s === 'paid' && f === 'completed' && !rating;
  }, [order, role, rating]);

  const canShowRatingCard = useMemo(() => {
    return ratingLoading || Boolean(rating) || canRate;
  }, [ratingLoading, rating, canRate]);

  const submitRating = async () => {
    if (ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/rating`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating: ratingValue, comment: ratingComment || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Échec enregistrement avis');
      toast({ title: 'Avis enregistré' });
      await loadRating();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d\'enregistrer l\'avis', variant: 'destructive' });
    } finally {
      setRatingSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Commande - Marketplace - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => navigate('/market/orders')} className="px-2">Retour</Button>
          <div />
        </div>

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : !order ? (
          <div className="text-gray-600">Commande introuvable.</div>
        ) : (
          <>
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">Commande #{String(order.id).slice(0,8)}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="text-sm text-gray-700">Statut: <span className="font-semibold">{order.status}</span></div>
                <div className="text-sm text-gray-700">Exécution: <span className="font-semibold">{order.fulfillment_status || '—'}</span></div>
                <div className="text-sm text-gray-700">Total: <span className="font-semibold">{(Number(order.charge_amount_total||0)/100).toFixed(2)} {String(order.charge_currency||'').toUpperCase()}</span></div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Articles</div>
                  <div className="space-y-1">
                    {(items||[]).map((it) => (
                      <div key={it.id} className="text-sm text-gray-700 flex items-center justify-between">
                        <div className="truncate">{it.title_snapshot || 'Article'}</div>
                        <div className="shrink-0">x{it.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {canConfirmReceived ? (
                  <Button onClick={confirmReceived} className="w-full">Confirmer réception</Button>
                ) : null}
              </CardContent>
            </Card>

            {role === 'seller' ? (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base">Gérer la préparation</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {canAcceptOrder ? (
                    <Button onClick={acceptOrder} disabled={accepting} className="w-full">{accepting ? 'En cours…' : 'Accepter la commande'}</Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-sm">Étape</div>
                      <select
                        value={String(order?.fulfillment_status || '')}
                        onChange={(e) => updateFulfillment(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                        disabled={updatingFulfill}
                      >
                        <option value="preparing">En préparation</option>
                        <option value="shipping">En cours d'envoi</option>
                        <option value="delivered">Livrée</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">Messages</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-sm text-gray-600">Aucun message.</div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => (
                      <div key={m.id} className="text-sm text-gray-800">
                        <span className="text-gray-500">{String(m.sender_id||m.senderId||m.author_id||m.authorId||'').slice(0,6)}:</span> {m.content || m.body}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Votre message…" />
                  <Button onClick={sendMessage} disabled={sending || !messageText.trim()} className="shrink-0">Envoyer</Button>
                </div>
              </CardContent>
            </Card>

            {canShowRatingCard ? (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base">Avis</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {ratingLoading ? (
                    <div className="text-gray-600 text-sm">Chargement…</div>
                  ) : rating ? (
                    <div className="text-sm text-gray-800">Note: {rating.rating}★{rating.comment ? ` — ${rating.comment}` : ''}</div>
                  ) : canRate ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm">Note</label>
                        <select value={ratingValue} onChange={(e) => setRatingValue(parseInt(e.target.value, 10) || 5)} className="flex h-10 rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm">
                          {[5,4,3,2,1].map((n)=> (<option key={n} value={n}>{n}</option>))}
                        </select>
                      </div>
                      <textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} className="w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm min-h-[80px]" placeholder="Votre avis (optionnel)" />
                      <Button onClick={submitRating} disabled={ratingSubmitting} className="w-full">{ratingSubmitting ? 'Envoi…' : 'Enregistrer l\'avis'}</Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </>
  );
};

export default MarketplaceOrderDetail;
