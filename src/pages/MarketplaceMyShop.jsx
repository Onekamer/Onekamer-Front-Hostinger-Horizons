import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { canUserAccess } from '@/lib/accessControl';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Info } from 'lucide-react';
import ChartePopup from '@/components/ChartePopup';
import { MARKET_VENDOR_CHARTER } from '@/content/marketplaceCharters.jsx';

const CATEGORIES = ['Restauration', 'Mode', 'Beauté', 'Services', 'High-tech', 'Autre'];

const MarketplaceMyShop = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session, user, profile } = useAuth();

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const [activeTab, setActiveTab] = useState('shop');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [togglingOpen, setTogglingOpen] = useState(false);

  const [partner, setPartner] = useState(null);
  const [acceptingVendorTerms, setAcceptingVendorTerms] = useState(false);
  const [showVendorCharte, setShowVendorCharte] = useState(false);

  const [ordersStatus, setOrdersStatus] = useState('sent_to_seller');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [markingOrderId, setMarkingOrderId] = useState(null);
  const [cancelingOrderId, setCancelingOrderId] = useState(null);
  const [refusingOrderId, setRefusingOrderId] = useState(null);

  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [chatOrders, setChatOrders] = useState([]);
  const [chatSelectedOrderId, setChatSelectedOrderId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessageText, setChatMessageText] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const [ratingsSummary, setRatingsSummary] = useState({ avg: null, count: 0 });
  const [ratingsSummaryLoading, setRatingsSummaryLoading] = useState(false);
  const RATINGS_LIMIT = 20;
  const [ratings, setRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsOffset, setRatingsOffset] = useState(0);
  const [ratingsHasMore, setRatingsHasMore] = useState(true);
  const [ratingsPreview, setRatingsPreview] = useState([]);
  const [ratingsPreviewLoading, setRatingsPreviewLoading] = useState(false);

  // Livraison (options d'expédition)
  const [shipLoading, setShipLoading] = useState(false);
  const [shipSaving, setShipSaving] = useState(false);
  const [shipError, setShipError] = useState(null);
  const [shipOptions, setShipOptions] = useState({
    pickup: { label: 'Retrait sur place', price_cents: 0, is_active: true },
    standard: { label: 'Livraison standard', price_cents: 0, is_active: false },
    express: { label: 'Livraison express', price_cents: 0, is_active: false },
    international: { label: 'Livraison internationale', price_cents: 0, is_active: false },
  });
  const [shipCurrency, setShipCurrency] = useState('EUR');
  const [shipPriceUI, setShipPriceUI] = useState({ pickup: '0', standard: '0', express: '0', international: '0' });

  const formatEur = (amountMinor) => {
    const v = Number(amountMinor);
    if (!Number.isFinite(v)) return '—';
    return `${(v / 100).toFixed(2)}€`;
  };

  const handleRefuseOrder = async (orderId) => {
    if (!orderId || !session?.access_token || !partner?.id) return;
    if (refusingOrderId) return;
    if (partner?.vendor_terms_compliant !== true) {
      toast({ title: 'Charte vendeur requise', description: 'Vous devez accepter la charte vendeur pour gérer les commandes.', variant: 'destructive' });
      return;
    }
    const reason = window.prompt('Motif du refus (optionnel)') || '';
    setRefusingOrderId(orderId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/orders/${encodeURIComponent(orderId)}/refuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Refus impossible');
      toast({ title: 'Commande refusée', description: 'Le remboursement sera traité manuellement.' });
      await fetchOrders();
      if (activeTab === 'chat') await fetchChatOrders();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Échec du refus', variant: 'destructive' });
    } finally {
      setRefusingOrderId(null);
    }
  };

  const handleCancelOrderBySeller = async (orderId) => {
    if (!orderId || !session?.access_token || !partner?.id) return;
    if (cancelingOrderId) return;
    if (partner?.vendor_terms_compliant !== true) {
      toast({ title: 'Charte vendeur requise', description: 'Vous devez accepter la charte vendeur pour gérer les commandes.', variant: 'destructive' });
      return;
    }
    const reason = window.prompt('Motif de l\'annulation (optionnel)') || '';
    setCancelingOrderId(orderId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Annulation impossible');
      toast({ title: 'Commande annulée', description: 'Le remboursement sera traité manuellement.' });
      await fetchOrders();
      if (activeTab === 'chat') await fetchChatOrders();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Échec de l\'annulation', variant: 'destructive' });
    } finally {
      setCancelingOrderId(null);
    }
  };

  const formatOrderCode = (shopName, createdAt, orderNumber) => {
    const raw = String(shopName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const prefix = (raw.slice(0, 3) || 'OK');
    const d = createdAt ? new Date(createdAt) : new Date();
    const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    const num = String(Number(orderNumber || 0)).padStart(6, '0');
    return `${prefix}-${year}-${num}`;
  };

  const fetchRatingsSummary = async () => {
    try {
      if (!session?.access_token || !partner?.id) return;
      if (ratingsSummaryLoading) return;
      setRatingsSummaryLoading(true);
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/ratings/summary`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const avg = typeof data?.avg === 'number' ? data.avg : null;
        const count = parseInt(data?.count, 10) || 0;
        setRatingsSummary({ avg, count });
      }
    } catch {}
    finally {
      setRatingsSummaryLoading(false);
    }
  };

  const fetchRatingsPage = async (offset = 0) => {
    if (!session?.access_token || !partner?.id) return;
    if (ratingsLoading) return;
    setRatingsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', String(RATINGS_LIMIT));
      qs.set('offset', String(Math.max(offset, 0)));
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/ratings?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement avis');
      const list = Array.isArray(data?.ratings) ? data.ratings : [];
      setRatings((prev) => (offset === 0 ? list : [...prev, ...list]));
      setRatingsOffset(offset + list.length);
      setRatingsHasMore(list.length === RATINGS_LIMIT);
    } catch {
      setRatingsHasMore(false);
    } finally {
      setRatingsLoading(false);
    }
  };

  const openRatingsDialog = async () => {
    setRatings([]);
    setRatingsOffset(0);
    setRatingsHasMore(true);
    await fetchRatingsPage(0);
  };

  const fetchRatingsPreview = async () => {
    if (!session?.access_token || !partner?.id) return;
    if (ratingsPreviewLoading) return;
    setRatingsPreviewLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', '3');
      qs.set('offset', '0');
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/ratings?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.ratings) ? data.ratings : [];
      setRatingsPreview(list);
    } catch {}
    finally {
      setRatingsPreviewLoading(false);
    }
  };

  const totalSalesEur = useMemo(() => {
    const totalMinor = (Array.isArray(orders) ? orders : [])
      .filter((o) => String(o?.status || '').toLowerCase() === 'paid')
      .filter((o) => String(o?.charge_currency || '').toUpperCase() === 'EUR')
      .reduce((sum, o) => sum + Number(o?.charge_amount_total || 0), 0);
    return totalMinor / 100;
  }, [orders]);

  const [form, setForm] = useState({
    display_name: '',
    description: '',
    category: '',
    logo_url: '',
    phone: '',
    whatsapp: '',
    address: '',
    hours: '',
  });

  const statusLabel = useMemo(() => {
    const s = String(partner?.status || '').toLowerCase();
    if (s === 'approved') return 'Validé';
    if (s === 'rejected') return 'Refusé';
    if (s === 'pending') return 'En attente de validation';
    return partner ? (partner.status || '—') : '—';
  }, [partner]);

  const payoutLabel = useMemo(() => {
    const s = String(partner?.payout_status || '').toLowerCase();
    if (!partner) return '—';
    if (!s) return '—';
    if (s === 'complete') return 'Activés';
    if (s === 'incomplete') return 'À activer';
    return partner.payout_status || '—';
  }, [partner]);

  useEffect(() => {
    const init = async () => {
      if (!session?.access_token) {
        toast({
          title: 'Connexion requise',
          description: 'Connecte-toi pour accéder à ta boutique.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      setLoading(true);
      try {
        const allowed = await canUserAccess(profile, 'marketplace', 'create_shop');
        if (!allowed) {
          toast({
            title: 'Accès refusé',
            description: 'La création de boutique est réservée aux VIP.',
            variant: 'destructive',
          });
          navigate('/forfaits');
          return;
        }

        const res = await fetch(`${apiBaseUrl}/api/market/partners/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement boutique');

        const me = data?.partner || null;
        setPartner(me);
        if (me) {
          setForm({
            display_name: me.display_name || '',
            description: me.description || '',
            category: me.category || '',
            logo_url: me.logo_url || '',
            phone: me.phone || '',
            whatsapp: me.whatsapp || '',
            address: me.address || '',
            hours: me.hours || '',
          });
        }
      } catch (e) {
        toast({
          title: 'Erreur',
          description: e?.message || 'Impossible de charger ta boutique',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate, profile, serverUrl, session?.access_token, toast]);

  const fetchOrders = async () => {
    if (!session?.access_token) return;
    if (!partner?.id) return;
    if (ordersLoading) return;

    setOrdersLoading(true);
    setOrdersError(null);

    try {
      const qs = new URLSearchParams();
      qs.set('fulfillment', ordersStatus);
      qs.set('limit', '100');
      qs.set('offset', '0');

      const res = await fetch(
        `${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/orders?${qs.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement commandes');

      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (e) {
      const msg = e?.message || 'Erreur chargement commandes';
      setOrdersError(msg);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleMarkReceived = async (orderId) => {
    if (!orderId) return;
    if (!session?.access_token) return;
    if (!partner?.id) return;
    if (partner?.vendor_terms_compliant !== true) {
      toast({ title: 'Charte vendeur requise', description: 'Vous devez accepter la charte vendeur pour gérer les commandes.', variant: 'destructive' });
      return;
    }
    if (markingOrderId) return;

    setMarkingOrderId(orderId);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/orders/${encodeURIComponent(orderId)}/mark-received`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Action impossible");
      toast({ title: 'Commande acceptée', description: 'Statut: en préparation' });
      await fetchOrders();
      if (activeTab === 'chat') await fetchChatOrders();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d’accepter la commande", variant: 'destructive' });
    } finally {
      setMarkingOrderId(null);
    }
  };

  useEffect(() => {
    if (activeTab !== 'orders') return;
    if (!partner?.id) return;
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, partner?.id, ordersStatus]);

  const fetchChatOrders = async () => {
    if (!session?.access_token) return;
    if (!partner?.id) return;
    if (chatLoading) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('status', 'paid');
      qs.set('limit', '100');
      qs.set('offset', '0');
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/orders?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement commandes');
      setChatOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (e) {
      const msg = e?.message || 'Erreur chargement commandes';
      setChatError(msg);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setChatLoading(false);
    }
  };

  const loadChatMessages = async (orderId) => {
    if (!orderId || !session?.access_token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/messages`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement messages');
      setChatMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (e) {
      setChatMessages([]);
    }
  };

  const sendChatMessage = async () => {
    if (!chatSelectedOrderId) return;
    const txt = String(chatMessageText || '').trim();
    if (!txt || chatSending) return;
    setChatSending(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(chatSelectedOrderId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content: txt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur envoi message');
      setChatMessageText('');
      await loadChatMessages(chatSelectedOrderId);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'envoyer le message", variant: 'destructive' });
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'chat') return;
    if (!partner?.id) return;
    fetchChatOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, partner?.id]);

  useEffect(() => {
    if (activeTab !== 'chat') return;
    if (!chatSelectedOrderId) return;
    let id;
    const start = async () => {
      await loadChatMessages(chatSelectedOrderId);
      id = setInterval(() => loadChatMessages(chatSelectedOrderId), 4000);
    };
    start();
    return () => { if (id) clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, chatSelectedOrderId]);

  const parsePriceToCents = (val) => {
    if (val === null || val === undefined) return 0;
    const str = String(val).trim().replace(/\s/g, '').replace(',', '.');
    if (!str) return 0;
    const num = Number(str);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.round(num * 100);
  };

  const fetchShippingOptions = async () => {
    if (!session?.access_token) return;
    if (!partner?.id) return;
    if (shipLoading) return;
    setShipLoading(true);
    setShipError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/shipping-options?t=${Date.now()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement des options de livraison');

      const opts = Array.isArray(data?.options) ? data.options : [];
      const base = {
        pickup: { label: 'Retrait sur place', price_cents: 0, is_active: true },
        standard: { label: 'Livraison standard', price_cents: 0, is_active: false },
        express: { label: 'Livraison express', price_cents: 0, is_active: false },
        international: { label: 'Livraison internationale', price_cents: 0, is_active: false },
      };
      opts.forEach((o) => {
        const t = String(o?.shipping_type || '').toLowerCase().trim();
        if (!['pickup', 'standard', 'express', 'international'].includes(t)) return;
        base[t] = {
          label: o?.label || base[t].label,
          price_cents: Math.max(parseInt(o?.price_cents, 10) || 0, 0),
          is_active: o?.is_active === true,
        };
      });
      setShipOptions(base);
      setShipPriceUI({
        pickup: ((base.pickup?.price_cents || 0) / 100).toFixed(2),
        standard: ((base.standard?.price_cents || 0) / 100).toFixed(2),
        express: ((base.express?.price_cents || 0) / 100).toFixed(2),
        international: ((base.international?.price_cents || 0) / 100).toFixed(2),
      });
      if (data?.base_currency) setShipCurrency(String(data.base_currency).toUpperCase());
    } catch (e) {
      const msg = e?.message || 'Erreur chargement des options de livraison';
      setShipError(msg);
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setShipLoading(false);
    }
  };

  const saveShippingOptions = async () => {
    if (!session?.access_token) return;
    if (!partner?.id) return;
    if (shipSaving) return;
    setShipSaving(true);
    setShipError(null);
    try {
      const payload = ['pickup', 'standard', 'express', 'international'].map((t) => ({
        shipping_type: t,
        price_cents: Math.max(parsePriceToCents(shipPriceUI[t]), 0),
        is_active: shipOptions[t]?.is_active === true,
      }));
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/shipping-options`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur enregistrement options');
      toast({ title: 'Options de livraison enregistrées' });
      await fetchShippingOptions();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d’enregistrer', variant: 'destructive' });
    } finally {
      setShipSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'shop') return;
    if (!partner?.id) return;
    fetchShippingOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, partner?.id]);
  useEffect(() => {
    if (activeTab !== 'shop') return;
    if (!partner?.id) return;
    fetchRatingsSummary();
    fetchRatingsPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, partner?.id]);

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleUploadLogo = async (file) => {
    if (!file) return;
    if (!session?.access_token) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'partenaires');
      fd.append('recordId', user?.id || profile?.id || '');

      const res = await fetch(`${apiBaseUrl}/api/upload`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || "Échec de l'upload");
      if (!data?.url) throw new Error('URL upload manquante');

      setForm((prev) => ({ ...prev, logo_url: data.url }));
      toast({ title: 'Logo mis à jour', description: 'Image uploadée avec succès.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'uploader l'image", variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const reloadPartner = async () => {
    if (!session?.access_token) return;
    const res = await fetch(`${apiBaseUrl}/api/market/partners/me`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Erreur chargement boutique');
    const me = data?.partner || null;
    setPartner(me);
  };

  const handleConnectLoginLink = async () => {
    if (!partner?.id) return;
    if (!session?.access_token) return;
    if (managing) return;

    setManaging(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/partner/connect/login-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ partnerId: partner.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur Stripe Connect');
      if (!data?.url) throw new Error('URL Stripe manquante');
      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d’ouvrir le tableau de bord Stripe', variant: 'destructive' });
    } finally {
      setManaging(false);
    }
  };

  const handleToggleOpen = async () => {
    if (!partner?.id) return;
    if (!session?.access_token) return;
    if (togglingOpen) return;

    setTogglingOpen(true);
    try {
      const next = partner?.is_open === true ? false : true;
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ is_open: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour disponibilité');
      await reloadPartner();
      toast({ title: 'Disponibilité mise à jour', description: next ? 'Boutique ouverte' : 'Boutique fermée' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible de mettre à jour la disponibilité", variant: 'destructive' });
    } finally {
      setTogglingOpen(false);
    }
  };

  const handleConnectOnboarding = async () => {
    if (!partner?.id) return;
    if (!session?.access_token) return;
    if (connecting) return;

    setConnecting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/partner/connect/onboarding-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ partnerId: partner.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur Stripe Connect');
      if (!data?.url) throw new Error('URL Stripe manquante');

      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de démarrer Stripe Connect', variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncPayoutStatus = async () => {
    if (!partner?.id) return;
    if (!session?.access_token) return;
    if (syncing) return;

    setSyncing(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/partner/connect/sync-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ partnerId: partner.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur sync Stripe');

      await reloadPartner();
      toast({ title: 'Statut mis à jour', description: 'Le statut de paiement a été rafraîchi.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de synchroniser le statut', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.access_token) return;
    if (saving) return;

    const payload = {
      display_name: String(form.display_name || '').trim(),
      description: String(form.description || '').trim(),
      category: String(form.category || '').trim(),
      logo_url: String(form.logo_url || '').trim(),
      phone: form.phone,
      whatsapp: form.whatsapp,
      address: form.address,
      hours: form.hours,
    };

    if (!payload.display_name || !payload.description || !payload.category || !payload.logo_url) {
      toast({
        title: 'Champs requis',
        description: 'Nom, description, catégorie et logo sont obligatoires.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (!partner?.id) {
        const res = await fetch(`${apiBaseUrl}/api/market/partners`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur création boutique');

        toast({ title: 'Boutique créée', description: 'Ta boutique est en attente de validation.' });
        navigate('/marketplace');
        return;
      }

      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour boutique');

      toast({ title: 'Boutique mise à jour', description: 'Modifications enregistrées.' });
      navigate('/marketplace');
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-gray-600">Chargement…</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Ma boutique - Marketplace - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#2BA84A]">Ma boutique</h1>
          <Button variant="outline" onClick={() => navigate('/marketplace')} className="shrink-0">
            Retour marketplace
          </Button>
        </div>

        {partner?.id ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={activeTab === 'shop' ? 'default' : 'outline'}
              onClick={() => setActiveTab('shop')}
              className="flex-1"
            >
              Ma boutique
            </Button>
            <Button
              type="button"
              variant={activeTab === 'orders' ? 'default' : 'outline'}
              onClick={() => setActiveTab('orders')}
              className="flex-1"
              disabled={partner?.vendor_terms_compliant !== true}
              title={partner?.vendor_terms_compliant !== true ? 'Acceptez la charte vendeur pour accéder à Mes ventes' : undefined}
            >
              Mes ventes
            </Button>
            <Button
              type="button"
              variant={activeTab === 'chat' ? 'default' : 'outline'}
              onClick={() => setActiveTab('chat')}
              className="flex-1"
              disabled={partner?.vendor_terms_compliant !== true}
              title={partner?.vendor_terms_compliant !== true ? 'Acceptez la charte vendeur pour accéder au Chat' : undefined}
            >
              Chat
            </Button>
          </div>
        ) : null}

        {partner?.id && partner?.vendor_terms_compliant !== true ? (
          <Card className="border-red-200">
            <CardHeader className="p-4">
              <CardTitle className="text-base">Charte vendeur à accepter</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="text-sm text-gray-700">
                Pour continuer à utiliser l’espace vendeur, vous devez accepter la{' '}
                <button
                  type="button"
                  onClick={() => setShowVendorCharte(true)}
                  className="underline text-[#2BA84A]"
                >
                  charte vendeur du Marketplace
                </button>
                .
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={acceptingVendorTerms}
                  onClick={async () => {
                    if (!session?.access_token || !partner?.id) return;
                    setAcceptingVendorTerms(true);
                    try {
                      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/terms/accept`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${session.access_token}` },
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data?.error || 'Action impossible');
                      await reloadPartner();
                      toast({ title: 'Charte acceptée', description: 'Vous pouvez maintenant gérer vos commandes.' });
                    } catch (e) {
                      toast({ title: 'Erreur', description: e?.message || 'Impossible de valider la charte', variant: 'destructive' });
                    } finally {
                      setAcceptingVendorTerms(false);
                    }
                  }}
                >
                  {acceptingVendorTerms ? 'Validation…' : "J’accepte la charte vendeur"}
                </Button>
              </div>
              <ChartePopup
                show={showVendorCharte}
                onClose={() => setShowVendorCharte(false)}
                readOnly={true}
                title="Charte Marketplace — Vendeur"
                content={MARKET_VENDOR_CHARTER}
              />
            </CardContent>
          </Card>
        ) : null}


        {activeTab === 'chat' ? (
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base font-semibold">Chat</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <Button type="button" variant="outline" onClick={fetchChatOrders} disabled={chatLoading} className="w-full">
                {chatLoading ? 'Chargement…' : 'Recharger'}
              </Button>
              {!chatLoading && chatError ? <div className="text-sm text-red-600">{chatError}</div> : null}

              {!chatLoading && !chatError && chatOrders.length === 0 ? (
                <div className="text-sm text-gray-600">Aucune commande payée.</div>
              ) : null}

              {!chatLoading && chatOrders.length > 0 ? (
                <div className="border rounded-md bg-white overflow-hidden">
                  <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium">
                    <div className="col-span-3">Commande</div>
                    <div className="col-span-4">Client</div>
                    <div className="col-span-3">Total</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  <div className="divide-y">
                    {chatOrders.map((o) => {
                      const createdAt = o?.created_at ? new Date(o.created_at) : null;
                      const createdLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : '—';
                      const currency = String(o?.charge_currency || '').toUpperCase();
                      const totalLabel = currency === 'EUR' ? formatEur(o?.charge_amount_total) : currency ? `${o?.charge_amount_total} ${currency}` : '—';
                      const isCompleted = String(o?.fulfillment_status || '').toLowerCase() === 'completed';

                      return (
                        <div key={o.id} className={`p-3 ${isCompleted ? 'opacity-70' : ''}`}>
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-start">
                            <div className="md:col-span-3">
                              <div className="text-sm font-semibold">Commande n°{formatOrderCode(partner?.display_name, o.created_at, o.order_number)}</div>
                              <div className="text-xs text-gray-500">{createdLabel}</div>
                            </div>
                            <div className="md:col-span-4">
                              <div className="text-sm text-gray-800 break-all">{o?.customer_alias || '—'}</div>
                            </div>
                            <div className="md:col-span-3">
                              <div className="text-sm text-gray-800">{totalLabel}</div>
                            </div>
                            <div className="md:col-span-2 md:text-right">
                              <div className="flex gap-2 justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full md:w-auto"
                                  onClick={() => navigate(`/market/orders/${encodeURIComponent(o.id)}`, { state: { from: 'myshop-chat' } })}
                                >
                                  Détail
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
        

        

        {activeTab === 'orders' ? (
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base font-semibold">Mes ventes</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border rounded-md p-3 bg-white">
                  <div className="text-xs text-gray-500">Ventes</div>
                  <div className="text-lg font-semibold text-gray-900">{totalSalesEur.toFixed(2)}€</div>
                </div>
                <div className="border rounded-md p-3 bg-white">
                  <div className="text-xs text-gray-500">Commandes</div>
                  <div className="text-lg font-semibold text-gray-900">{Array.isArray(orders) ? orders.filter((o) => String(o?.status||'').toLowerCase()==='paid').length : 0}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Étape de préparation</div>
                <select
                  value={ordersStatus}
                  onChange={(e) => setOrdersStatus(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                >
                  <option value="sent_to_seller">En attente de préparation</option>
                  <option value="preparing">En préparation</option>
                  <option value="shipping">En cours d'envoi</option>
                  <option value="delivered">Livrée</option>
                  <option value="completed">Terminée</option>
                  <option value="all">Toutes</option>
                </select>
              </div>

              <Button type="button" variant="outline" onClick={fetchOrders} disabled={ordersLoading} className="w-full">
                {ordersLoading ? 'Chargement…' : 'Recharger'}
              </Button>

              {!ordersLoading && ordersError ? <div className="text-sm text-red-600">{ordersError}</div> : null}

              {!ordersLoading && !ordersError && orders.length === 0 ? (
                <div className="text-sm text-gray-600">Aucune commande.</div>
              ) : null}

              {!ordersLoading && orders.length > 0 ? (
                <div className="border rounded-md bg-white overflow-hidden">
                  <div className="hidden md:grid grid-cols-12 gap-3 px-3 py-2 bg-gray-50 text-xs text-gray-600 font-medium">
                    <div className="col-span-3">Commande</div>
                    <div className="col-span-3">Client</div>
                    <div className="col-span-2">Total</div>
                    <div className="col-span-2">Statut</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  <div className="divide-y">
                    {orders.map((o) => {
                      const fRaw = String(o?.fulfillment_status || '').toLowerCase();
                      const statusLabel =
                        fRaw === 'sent_to_seller' ? 'En attente de préparation' :
                        fRaw === 'preparing' ? 'En préparation' :
                        fRaw === 'shipping' ? "En cours d'envoi" :
                        fRaw === 'delivered' ? 'Livrée' :
                        fRaw === 'completed' ? 'Terminée' : (fRaw || '—');

                      const isExpanded = expandedOrderId && String(expandedOrderId) === String(o.id);
                      const createdAt = o?.created_at ? new Date(o.created_at) : null;
                      const createdLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : '—';
                      const currency = String(o?.charge_currency || '').toUpperCase();
                      const totalLabel = currency === 'EUR' ? formatEur(o?.charge_amount_total) : (currency ? `${o?.charge_amount_total} ${currency}` : '—');
                      const netLabel = currency === 'EUR' ? formatEur(o?.partner_amount) : (currency ? `${o?.partner_amount} ${currency}` : '—');
                      const isCompleted = fRaw === 'completed';

                      return (
                        <div key={o.id} className={`p-3 ${isCompleted ? 'opacity-70' : ''}`}>
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-start">
                            <div className="md:col-span-3">
                              <div className="text-sm font-semibold">Commande n°{formatOrderCode(partner?.display_name, o.created_at, o.order_number)}</div>
                              <div className="text-xs text-gray-500">{createdLabel}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {(() => {
                                  const m = String(o?.delivery_mode || '').toLowerCase();
                                  const label = m === 'pickup' ? 'Retrait sur place' : (m === 'standard' ? 'Livraison standard' : (m === 'express' ? 'Livraison express' : (m === 'international' ? 'Livraison internationale' : '')));
                                  const cc = String(o?.customer_country_code || '').toUpperCase();
                                  return [label || null, cc ? `Pays: ${cc}` : null].filter(Boolean).join(' • ');
                                })() || '—'}
                              </div>
                            </div>

                            <div className="md:col-span-3">
                              <div className="text-sm text-gray-800 break-all">{o?.customer_email || '—'}</div>
                            </div>

                            <div className="md:col-span-2">
                              <div className="text-sm text-gray-800">{totalLabel}</div>
                              <div className="text-xs text-gray-500">Montant net à recevoir: {netLabel}</div>
                            </div>

                            <div className="md:col-span-2">
                              <div className="text-sm text-gray-800">{statusLabel}</div>
                            </div>

                            <div className="md:col-span-2 md:text-right">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full md:w-auto"
                                onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                              >
                                {isExpanded ? 'Masquer' : 'Détail'}
                              </Button>
                              {(() => {
                                const f = String(o?.fulfillment_status || '').toLowerCase();
                                if (f === 'sent_to_seller') {
                                  return (
                                    <>
                                      <Button
                                        type="button"
                                        variant="default"
                                        className="w-full md:w-auto mt-2"
                                        onClick={() => handleMarkReceived(o.id)}
                                        disabled={markingOrderId === o.id}
                                      >
                                        {markingOrderId === o.id ? 'En cours…' : 'Accepter la commande'}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full md:w-auto mt-2"
                                        onClick={() => handleRefuseOrder(o.id)}
                                        disabled={refusingOrderId === o.id}
                                      >
                                        {refusingOrderId === o.id ? 'Refus…' : 'Je refuse la commande'}
                                      </Button>
                                    </>
                                  );
                                }
                                if (!['shipping','delivered','completed'].includes(f)) {
                                  return (
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      className="w-full md:w-auto mt-2"
                                      onClick={() => handleCancelOrderBySeller(o.id)}
                                      disabled={cancelingOrderId === o.id}
                                    >
                                      {cancelingOrderId === o.id ? 'Annulation…' : 'Annuler la commande'}
                                    </Button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="mt-3 rounded-md border bg-gray-50 p-3 space-y-2">
                              <div className="text-xs text-gray-600 font-medium">Produits</div>
                              {(Array.isArray(o?.items) ? o.items : []).length === 0 ? (
                                <div className="text-sm text-gray-600">Aucun article.</div>
                              ) : (
                                <div className="space-y-2">
                                  {(o.items || []).map((it) => (
                                    <div key={it.id} className="flex items-start justify-between gap-2 text-sm">
                                      <div className="text-gray-800">{it.title_snapshot || 'Produit'}</div>
                                      <div className="text-gray-600">x{it.quantity || 1}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
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
        ) : null}

        {activeTab === 'shop' ? (
          <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold">Statut</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm text-gray-700 space-y-2">
              <div className="space-y-1">
                <div>
                  <span className="text-gray-600">Validation : </span>
                  <span>{statusLabel}</span>
                </div>
                <div>
                  <span className="text-gray-600">Paiements : </span>
                  <span>{payoutLabel}</span>
                </div>
                <div>
                  <span className="text-gray-600">Disponibilité : </span>
                  <span>{partner?.is_open ? 'Ouverte' : 'Indisponible'}</span>
                </div>
              </div>

              {partner?.id ? (
                <div className="mt-3 space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleToggleOpen}
                    disabled={togglingOpen}
                    className="w-full"
                  >
                    {togglingOpen ? 'Mise à jour…' : (partner?.is_open ? 'Fermer la boutique' : 'Ouvrir la boutique')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={String(partner?.payout_status || '').toLowerCase() === 'complete' ? handleConnectLoginLink : handleConnectOnboarding}
                    disabled={String(partner?.payout_status || '').toLowerCase() === 'complete' ? managing : connecting}
                    className="w-full"
                  >
                    {String(partner?.payout_status || '').toLowerCase() === 'complete' ? (managing ? 'Redirection…' : 'Gérer mes paiements') : (connecting ? 'Redirection…' : 'Activer mes paiements')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSyncPayoutStatus}
                    disabled={syncing}
                    className="w-full"
                  >
                    {syncing ? 'Vérification…' : 'Vérifier le statut'}
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
          </Card>
        ) : null}

        {activeTab === 'shop' ? (
        <>
        <Card>
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Gérer les modes de livraison</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <button type="button" aria-label="Informations frais" className="text-gray-500 hover:text-gray-700">
                    <Info className="h-4 w-4" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Information</DialogTitle>
                    <DialogDescription>
                      Frais de service OneKamer : 10 %. Ils s’appliquent sur le total du panier (article + livraison).
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="text-xs text-gray-600">Devise de base: {String(shipCurrency || '—')}</div>
            {shipError ? <div className="text-sm text-red-600">{shipError}</div> : null}

            <div className="space-y-3">
              {(['pickup','standard','express','international']).map((t) => (
                <div key={t} className="border rounded-md p-3 bg-white">
                  <div className="text-sm font-medium text-gray-800">{t === 'pickup' ? 'Pickup' : (t === 'standard' ? 'Standard' : (t === 'express' ? 'Express' : 'International'))}</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div className="space-y-1">
                      <Label>Prix ({shipCurrency})</Label>
                      <Input
                        type="text"
                        value={shipPriceUI[t] ?? ''}
                        onChange={(e) => setShipPriceUI((prev) => ({ ...prev, [t]: e.target.value }))}
                        disabled={shipLoading || shipSaving}
                        placeholder="ex: 5,00"
                      />
                      <div className="text-xs text-gray-500">Montant en devise (ex: 5,00)</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Activer</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={shipOptions[t]?.is_active === true}
                          onChange={(e) => setShipOptions((prev) => ({ ...prev, [t]: { ...(prev[t]||{}), is_active: e.target.checked } }))}
                          disabled={shipLoading || shipSaving}
                        />
                        <span className="text-sm text-gray-700">{shipOptions[t]?.is_active ? 'Activé' : 'Désactivé'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" onClick={saveShippingOptions} disabled={shipSaving} className="w-full">{shipSaving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base font-semibold">Informations boutique</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {partner?.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/marketplace/ma-boutique/produits')}
                  className="w-full"
                >
                  Gérer mes produits
                </Button>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="display_name">Nom</Label>
                <Input id="display_name" value={form.display_name} onChange={onChange('display_name')} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={onChange('description')} rows={4} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <select
                  id="category"
                  value={form.category}
                  onChange={onChange('category')}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                  required
                >
                  <option value="" disabled>
                    Sélectionner une catégorie
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                {form.logo_url ? (
                  <img alt="Logo boutique" src={form.logo_url} className="h-24 w-24 rounded-md object-cover border" />
                ) : (
                  <div className="text-sm text-gray-600">Aucun logo</div>
                )}

                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => handleUploadLogo(e.target.files?.[0] || null)}
                />
                <div className="text-xs text-gray-500">Le logo est obligatoire.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={form.phone} onChange={onChange('phone')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" value={form.whatsapp} onChange={onChange('whatsapp')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" value={form.address} onChange={onChange('address')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">Horaires</Label>
                <Textarea
                  id="hours"
                  value={form.hours}
                  onChange={onChange('hours')}
                  rows={3}
                  placeholder="Ex:\nLundi: 10h-20h\nMardi: 10h-20h\nMercredi: fermé"
                />
              </div>

              <Button type="submit" disabled={saving || uploading} className="w-full">
                {partner?.id ? (saving ? 'Enregistrement…' : 'Enregistrer') : saving ? 'Création…' : 'Créer ma boutique'}
              </Button>
            </CardContent>
          </Card>
        </form>
        </>
        ) : null}

        {activeTab === 'shop' ? (
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold">Mes avis (aperçu)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {ratingsPreviewLoading ? (
              <div className="text-sm text-gray-600">Chargement…</div>
            ) : ratingsPreview.length === 0 ? (
              <div className="text-sm text-gray-600">Aucun avis pour le moment.</div>
            ) : (
              <div className="space-y-3">
                {ratingsPreview.map((r) => {
                  const n = Math.max(Math.min(Number(r?.rating || 0), 5), 0);
                  const stars = '★'.repeat(n) + '☆'.repeat(5 - n);
                  const when = r?.created_at ? new Date(r.created_at).toLocaleString() : '';
                  return (
                    <div key={r.id} className="border rounded-md p-3 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{stars}</div>
                        {r?.order_number ? <div className="text-xs text-gray-600">Commande n°{r.order_number}</div> : null}
                      </div>
                      {r?.comment ? <div className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{r.comment}</div> : null}
                      <div className="text-xs text-gray-500 mt-1">{r?.buyer_alias ? `${r.buyer_alias} • ` : ''}{when}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="w-full" onClick={openRatingsDialog}>
                  {ratingsSummaryLoading ? 'Chargement…' : (ratingsSummary?.avg != null ? `${ratingsSummary.avg.toFixed(1)} ★ (${ratingsSummary.count})` : 'Aucune note')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tous les avis</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                  {ratings.length === 0 ? (
                    <div className="text-sm text-gray-600">Aucun avis pour le moment.</div>
                  ) : ratings.map((r) => {
                    const n = Math.max(Math.min(Number(r?.rating||0), 5), 0);
                    const stars = '★'.repeat(n) + '☆'.repeat(5 - n);
                    const when = r?.created_at ? new Date(r.created_at).toLocaleString() : '';
                    return (
                      <div key={r.id} className="border rounded-md p-3 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">{stars}</div>
                          {r?.order_number ? <div className="text-xs text-gray-600">Commande n°{r.order_number}</div> : null}
                        </div>
                        {r?.comment ? <div className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{r.comment}</div> : null}
                        <div className="text-xs text-gray-500 mt-1">{r?.buyer_alias ? `${r.buyer_alias} • ` : ''}{when}</div>
                      </div>
                    );
                  })}
                  {ratingsHasMore ? (
                    <Button type="button" onClick={() => fetchRatingsPage(ratingsOffset)} disabled={ratingsLoading} className="w-full">
                      {ratingsLoading ? 'Chargement…' : 'Charger plus'}
                    </Button>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        ) : null}
      </div>
    </>
  );
};

export default MarketplaceMyShop;
