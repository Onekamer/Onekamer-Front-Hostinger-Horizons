import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import MediaDisplay from '@/components/MediaDisplay';
import { Image as ImageIcon, Mic, Square, X } from 'lucide-react';
import { uploadAudioFile } from '@/utils/audioStorage';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import DotsLoader from '@/components/ui/DotsLoader';

const MarketplaceOrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const listRef = useRef(null);
  const LIMIT = 30;
  const [visibleCount, setVisibleCount] = useState(LIMIT);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasMoreOld, setHasMoreOld] = useState(false);
  const stickToBottomRef = useRef(true);
  const mediaInputRef = useRef(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const mimeRef = useRef(null);
  const recorderPromiseRef = useRef(null);

  const [rating, setRating] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const [accepting, setAccepting] = useState(false);
  const [updatingFulfill, setUpdatingFulfill] = useState(false);
  const [actioning, setActioning] = useState(null);

  const [trackingUrl, setTrackingUrl] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [shippingSubmitting, setShippingSubmitting] = useState(false);

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
    setTrackingUrl(order?.tracking_url || '');
    setCarrierName(order?.carrier_name || '');
  }, [order?.tracking_url, order?.carrier_name]);

  useEffect(() => {
    let id;
    const start = async () => {
      await loadMessages();
      id = setInterval(loadMessages, 4000);
    };
    start();
    return () => { if (id) clearInterval(id); };
  }, [loadMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    setHasMoreOld(messages.length > visibleCount);
  }, [messages.length, visibleCount]);

  useEffect(() => {
    setVisibleCount(LIMIT);
  }, [orderId]);

  const visibleMessages = useMemo(() => {
    const total = messages.length || 0;
    const count = Math.min(visibleCount, total);
    return messages.slice(Math.max(0, total - count));
  }, [messages, visibleCount]);

  const pickSupportedMime = useCallback(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('safari')) {
      return { type: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' };
    }
    if (ua.includes('android')) {
      return { type: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' };
    }
    if (window.MediaRecorder?.isTypeSupported?.('audio/webm;codecs=opus')) {
      return { type: 'audio/webm;codecs=opus', ext: 'webm' };
    }
    if (window.MediaRecorder?.isTypeSupported?.('audio/ogg;codecs=opus')) {
      return { type: 'audio/ogg;codecs=opus', ext: 'ogg' };
    }
    return { type: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      setAudioBlob(null);
      setRecordingTime(0);
      recorderPromiseRef.current = null;
      mimeRef.current = null;
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const uploadToBunny = async (file, folder) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const controller = new AbortController();
    const timeoutMs = 60000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, { method: 'POST', body: formData, signal: controller.signal });
    } catch (e) {
      throw e;
    } finally {
      clearTimeout(timer);
    }
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { throw new Error("Réponse inattendue du serveur d'upload"); }
    }
    if (!response.ok || !data?.success) {
      const message = data?.message || data?.error || `Erreur d’upload (${response.status})`;
      throw new Error(message);
    }
    return data.url;
  };

  const startRecording = async () => {
    try {
      setAudioBlob(null);
      setRecordingTime(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosenMime = pickSupportedMime();
      mimeRef.current = chosenMime;
      let resolveRecording;
      const recordingDone = new Promise((resolve) => (resolveRecording = resolve));
      recorderPromiseRef.current = recordingDone;
      const supportedMimeType = window.MediaRecorder?.isTypeSupported?.(chosenMime.type) ? chosenMime.type : undefined;
      const recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onerror = () => { resolveRecording(null); };
      recorder.onstop = async () => {
        clearInterval(recordingIntervalRef.current);
        stream.getTracks().forEach((t) => t.stop());
        await new Promise((r) => setTimeout(r, 300));
        const candidateType = (
          recorder?.mimeType ||
          (chunks[0]?.type) ||
          mimeRef.current?.type ||
          'audio/mp4'
        );
        const finalType = (candidateType || 'audio/mp4').split(';')[0];
        const blob = new Blob(chunks, { type: finalType });
        setAudioBlob(blob);
        setIsRecording(false);
        mediaRecorderRef.current = null;
        resolveRecording(blob);
      };
      await new Promise((r) => setTimeout(r, 200));
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 60000);
    } catch (err) {
      toast({ title: 'Erreur microphone', description: 'Veuillez autoriser le micro.', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.requestData?.();
      setTimeout(() => { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); }, 300);
      clearInterval(recordingIntervalRef.current);
    }
  };

  const handleRemoveAudio = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    recorderPromiseRef.current = null;
    mimeRef.current = null;
  };

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

  const markShipped = async () => {
    if (!order?.id) return;
    const url = String(trackingUrl || '').trim();
    if (!url) {
      toast({ title: 'Lien de suivi requis', description: "Veuillez renseigner l'URL de suivi.", variant: 'destructive' });
      return;
    }
    if (shippingSubmitting) return;
    setShippingSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(order.id)}/fulfillment`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'shipping', tracking_url: url, carrier_name: String(carrierName || '').trim() || undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour');
      toast({ title: 'Commande expédiée', description: 'Lien de suivi enregistré.' });
      await loadOrder();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de marquer expédié', variant: 'destructive' });
    } finally {
      setShippingSubmitting(false);
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
    if (sending) return;
    setSending(true);
    try {
      if (audioBlob) {
        const { ext, type } = mimeRef.current || { ext: 'webm', type: audioBlob.type || 'audio/webm' };
        const file = new File([audioBlob], `order-audio-${orderId}-${Date.now()}.${ext}`, { type });
        const { publicUrl } = await uploadAudioFile(file, 'comments_audio');
        const payload = { content: publicUrl };
        const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/messages`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur envoi message');
        handleRemoveAudio();
        await loadMessages();
        toast({ title: 'Message envoyé' });
        setSending(false);
        return;
      }
      if (mediaFile) {
        const url = await uploadToBunny(mediaFile, 'comments');
        const payload = { content: url };
        const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/messages`, { method: 'POST', headers, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur envoi message');
        handleRemoveMedia();
        await loadMessages();
        toast({ title: 'Message envoyé' });
        setSending(false);
        return;
      }
      if (!messageText.trim()) { setSending(false); return; }
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/messages`, { method: 'POST', headers, body: JSON.stringify({ content: messageText.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur envoi message');
      setMessageText('');
      await loadMessages();
      toast({ title: 'Message envoyé' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'envoyer le message", variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const canConfirmReceived = useMemo(() => {
    const f = String(order?.fulfillment_status || '').toLowerCase();
    return role === 'buyer' && f === 'delivered';
  }, [order, role]);

  const effectiveRole = useMemo(() => {
    const fromChat = location?.state && location.state.from === 'myshop-chat';
    if (fromChat) return 'seller';
    return role;
  }, [location?.state, role]);

  const chatLocked = useMemo(() => {
    const fs = String(order?.fulfillment_status || '').toLowerCase();
    return fs === 'completed';
  }, [order?.fulfillment_status]);

  const canAcceptOrder = useMemo(() => {
    const f = String(order?.fulfillment_status || '').toLowerCase();
    return role === 'seller' && f === 'sent_to_seller';
  }, [order, role]);

  const canManageFulfillment = useMemo(() => {
    const f = String(order?.fulfillment_status || '').toLowerCase();
    return role === 'seller' && ['preparing','shipping','delivered'].includes(f);
  }, [order, role]);

  const canShipNow = useMemo(() => {
    const f = String(order?.fulfillment_status || '').toLowerCase();
    return role === 'seller' && (f === 'preparing' || f === 'shipping');
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

  const autoCompleteDate = useMemo(() => {
    const s = String(order?.status || '').toLowerCase();
    const f = String(order?.fulfillment_status || '').toLowerCase();
    if (s !== 'paid' || f !== 'delivered') return null;
    const base = order?.payout_release_at ? new Date(order.payout_release_at) : (order?.fulfillment_updated_at ? new Date(order.fulfillment_updated_at) : null);
    if (!base || Number.isNaN(base.getTime())) return null;
    if (!order?.payout_release_at) {
      base.setDate(base.getDate() + 14);
    }
    return base;
  }, [order?.status, order?.fulfillment_status, order?.payout_release_at, order?.fulfillment_updated_at]);

  const formatLongDate = (d) => {
    try {
      return d?.toLocaleString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

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

  const formatOrderCode = (shopName, createdAt, orderNumber) => {
    const raw = String(shopName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const prefix = (raw.slice(0, 3) || 'OK');
    const d = createdAt ? new Date(createdAt) : new Date();
    const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    const num = String(Number(orderNumber || 0)).padStart(6, '0');
    return `${prefix}-${year}-${num}`;
  };

  const handleResumePayment = async () => {
    if (!orderId || !session?.access_token) return;
    setActioning('pay');
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

  const handleCancelOrder = async () => {
    if (!orderId || !session?.access_token) return;
    setActioning('cancel');
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Annulation impossible');
      await loadOrder();
      toast({ title: 'Commande annulée' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'annuler la commande", variant: 'destructive' });
    } finally {
      setActioning(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>{order ? `Commande n°${formatOrderCode(order.partner_display_name, order.created_at, order.order_number)} - OneKamer.co` : 'Commande - OneKamer.co'}</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (effectiveRole === 'seller') {
                navigate('/marketplace/ma-boutique?tab=chat');
              } else {
                navigate('/market/orders');
              }
            }}
            className="px-2"
          >
            Retour
          </Button>
          <div className="text-sm text-gray-600">{effectiveRole ? (effectiveRole === 'buyer' ? 'Acheteur' : 'Vendeur') : ''}</div>
        </div>

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : !order ? (
          <div className="text-gray-600">Commande introuvable.</div>
        ) : (
          <>
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base font-semibold">
                  {order ? `Commande n°${formatOrderCode(order.partner_display_name, order.created_at, order.order_number)}` : 'Commande'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-700 font-medium">Statut de paiement</div>
                  <div>{String(order.status || '').toLowerCase().replace('_', ' ')}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-700 font-medium">Montant</div>
                  <div>{(Number(order.charge_amount_total||0)/100).toFixed(2)} {String(order.charge_currency||'').toUpperCase()}</div>
                </div>
                {effectiveRole === 'seller' ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Montant net à recevoir</div>
                    <div>{(Number(order.partner_amount||0)/100).toFixed(2)} {String(order.charge_currency||'').toUpperCase()}</div>
                  </div>
                ) : null}
                {effectiveRole === 'seller' ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Client</div>
                    <div className="truncate max-w-[60%]">{order?.customer_alias || '—'}</div>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Livraison</div>
                    <div className="capitalize">{String(order.delivery_mode || '—')}</div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Statut</div>
                    <div>{String(order.status || '').toLowerCase() === 'pending' ? 'Waiting for payment' : String(order.fulfillment_status || '—')}</div>
                  </div>
                </div>
                {effectiveRole === 'seller' ? (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-700 font-medium">Nom</div>
                      <div className="truncate max-w-[60%]">
                        {(() => {
                          const fn = String(order?.customer_first_name || '').trim();
                          const ln = String(order?.customer_last_name || '').trim();
                          const full = [fn, ln].filter(Boolean).join(' ').trim();
                          return full || '—';
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-700 font-medium">Téléphone</div>
                      <div className="truncate max-w-[60%]">{order?.customer_phone || '—'}</div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-700 font-medium">Email</div>
                      <div className="truncate max-w-[60%]">{order?.customer_email || '—'}</div>
                    </div>
                    <div className="flex items-start justify-between text-sm">
                      <div className="text-gray-700 font-medium">Adresse</div>
                      <div className="text-right text-gray-700 whitespace-pre-wrap max-w-[60%]">
                        {(() => {
                          const a1 = String(order?.customer_address_line1 || '').trim();
                          const a2 = String(order?.customer_address_line2 || '').trim();
                          const pc = String(order?.customer_address_postal_code || '').trim();
                          const city = String(order?.customer_address_city || '').trim();
                          const cc = String(order?.customer_address_country || order?.customer_country_code || '').trim();
                          const row3 = [pc, city].filter(Boolean).join(' ');
                          const parts = [a1, a2, row3, cc].filter(Boolean);
                          return parts.length ? parts.join('\n') : '—';
                        })()}
                      </div>
                    </div>
                  </div>
                ) : null}
                {effectiveRole === 'buyer' ? (
                  <div className="pt-2">
                    <div className="text-gray-700 font-medium text-sm mb-1">Suivi colis</div>
                    {order?.tracking_url ? (
                      <a href={order.tracking_url} target="_blank" rel="noopener noreferrer">
                        <Button type="button" className="w-full">Suivre le colis</Button>
                      </a>
                    ) : (
                      <div className="text-sm text-gray-600">En attente du lien de suivi</div>
                    )}
                  </div>
                ) : null}
                {order?.customer_note ? (
                  <div className="pt-2">
                    <div className="text-gray-700 font-medium text-sm mb-1">Note client</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{order.customer_note}</div>
                  </div>
                ) : null}
                <div className="pt-2">
                  <div className="text-gray-700 font-medium text-sm mb-1">Articles</div>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-sm">
                        <div className="truncate">{it.title_snapshot || 'Article'}</div>
                        <div className="text-gray-600">x{it.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {(() => {
                  const s = String(order?.status || '').toLowerCase();
                  if (effectiveRole !== 'buyer') return null;
                  if (s === 'paid' || s === 'cancelled' || s === 'canceled') return null;
                  return (
                    <div className="pt-2 space-y-2">
                      <Button onClick={handleResumePayment} disabled={actioning === 'pay'} className="w-full">Reprendre le paiement</Button>
                      <Button onClick={handleCancelOrder} disabled={actioning === 'cancel'} variant="outline" className="w-full">Annuler la commande</Button>
                    </div>
                  );
                })()}
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
                    String(order?.delivery_mode || '').toLowerCase() === 'pickup' ? (
                      <div className="space-y-2">
                        <div className="text-sm">Étape</div>
                        <select
                          value={String(order?.fulfillment_status || 'preparing')}
                          onChange={(e) => updateFulfillment(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                          disabled={updatingFulfill}
                        >
                          <option value="preparing">En préparation</option>
                          <option value="delivered">Livrée</option>
                        </select>
                      </div>
                    ) : (
                      (() => {
                        const f = String(order?.fulfillment_status || '').toLowerCase();
                        return (
                          <div className="space-y-2">
                            <div className="text-sm">Expédition</div>
                            {f === 'preparing' ? (
                              <>
                                <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="Lien de suivi (URL)" />
                                <Input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder="Transporteur (optionnel)" />
                                <Button onClick={markShipped} disabled={shippingSubmitting} className="w-full">{shippingSubmitting ? 'Envoi…' : 'Marquer comme expédié'}</Button>
                              </>
                            ) : f === 'shipping' ? (
                              <>
                                {order?.tracking_url ? (
                                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="block">
                                    <Button type="button" variant="outline" className="w-full">Ouvrir le suivi</Button>
                                  </a>
                                ) : null}
                                <Button onClick={() => updateFulfillment('delivered')} disabled={updatingFulfill} className="w-full">Marquer comme livré</Button>
                              </>
                            ) : null}
                          </div>
                        );
                      })()
                    )
                  )}
                </CardContent>
              </Card>
            ) : null}

            {chatLocked ? (
              messages.length > 0 ? (
                <Card className="h-[60vh] flex flex-col overflow-hidden">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base font-semibold">Chat commande</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div
                      ref={listRef}
                      className="flex-1 overflow-y-auto p-4 space-y-3"
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const nearTop = el.scrollTop <= 80;
                        const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) <= 80;
                        stickToBottomRef.current = nearBottom;
                        if (nearTop && hasMoreOld && !olderLoading) {
                          const prevHeight = el.scrollHeight;
                          const prevTop = el.scrollTop;
                          setOlderLoading(true);
                          setVisibleCount((c) => Math.min(messages.length, c + LIMIT));
                          setTimeout(() => {
                            try {
                              const newH = el.scrollHeight;
                              const diff = newH - prevHeight;
                              el.scrollTop = prevTop + diff;
                            } catch {}
                            setOlderLoading(false);
                          }, 0);
                        }
                      }}
                    >
                      {olderLoading ? (<div className="flex justify-center py-2"><DotsLoader centered size={10} /></div>) : null}
                      {visibleMessages.map((m) => {
                        const text = m.content || m.body || '';
                        const mediaUrl = (/(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|avif|mp4|mov|webm))(\?|$)/i.test(text) ? text : null);
                        const isVideo = mediaUrl ? /(\.mp4|\.mov|\.webm)(\?|$)/i.test(mediaUrl) : false;
                        const audioUrl = (/^https?:\/\/\S+\.(?:m4a|mp3|ogg|webm)(\?|$)/i.test(text) ? text : null);
                        return (
                          <div key={m.id} className={`max-w-[80%] rounded px-3 py-2 text-sm ${String(m.sender_id||'')===String(session?.user?.id||'') ? 'bg-[#DCFCE7] ml-auto' : 'bg-white border'}`}>
                            {audioUrl ? (
                              <audio src={audioUrl} controls className="w-full" preload="metadata" />
                            ) : mediaUrl ? (
                              isVideo ? (
                                <video src={mediaUrl} controls className="w-56 rounded" />
                              ) : (
                                <img src={mediaUrl} alt="media" className="w-40 rounded" />
                              )
                            ) : (
                              <div className="whitespace-pre-wrap break-words">{text}</div>
                            )}
                            <div className="text-[11px] text-gray-500 mt-1">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t p-3">
                      <div className="text-sm font-medium text-red-600">La commande est terminée. Le chat n'est plus disponible.</div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-base font-semibold">Chat commande</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-sm text-gray-600">La commande est terminée. Le chat n'est plus disponible.</div>
                  </CardContent>
                </Card>
              )
            ) : String(order?.status||'').toLowerCase() === 'paid' ? (
              <Card className="h-[60vh] flex flex-col overflow-hidden">
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Chat commande</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col">
                  <div
                    ref={listRef}
                    className="flex-1 overflow-y-auto p-4 space-y-3"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const nearTop = el.scrollTop <= 80;
                      const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) <= 80;
                      stickToBottomRef.current = nearBottom;
                      if (nearTop && hasMoreOld && !olderLoading) {
                        const prevHeight = el.scrollHeight;
                        const prevTop = el.scrollTop;
                        setOlderLoading(true);
                        setVisibleCount((c) => Math.min(messages.length, c + LIMIT));
                        setTimeout(() => {
                          try {
                            const newH = el.scrollHeight;
                            const diff = newH - prevHeight;
                            el.scrollTop = prevTop + diff;
                          } catch {}
                          setOlderLoading(false);
                        }, 0);
                      }
                    }}
                  >
                    {olderLoading ? (<div className="flex justify-center py-2"><DotsLoader centered size={10} /></div>) : null}
                    {visibleMessages.length === 0 ? (
                      <div className="text-gray-500 text-sm">Aucun message pour le moment.</div>
                    ) : visibleMessages.map((m) => {
                      const text = m.content || m.body || '';
                      const mediaUrl = (/(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|avif|mp4|mov|webm))(\?|$)/i.test(text) ? text : null);
                      const isVideo = mediaUrl ? /(\.mp4|\.mov|\.webm)(\?|$)/i.test(mediaUrl) : false;
                      const audioUrl = (/^https?:\/\/\S+\.(?:m4a|mp3|ogg|webm)(\?|$)/i.test(text) ? text : null);
                      return (
                        <div key={m.id} className={`max-w-[80%] rounded px-3 py-2 text-sm ${String(m.sender_id||'')===String(session?.user?.id||'') ? 'bg-[#DCFCE7] ml-auto' : 'bg-white border'}`}>
                          {audioUrl ? (
                            <audio src={audioUrl} controls className="w-full" preload="metadata" />
                          ) : mediaUrl ? (
                            isVideo ? (
                              <video src={mediaUrl} controls className="w-56 rounded" />
                            ) : (
                              <img src={mediaUrl} alt="media" className="w-40 rounded" />
                            )
                          ) : (
                            <div className="whitespace-pre-wrap break-words">{text}</div>
                          )}
                          <div className="text-[11px] text-gray-500 mt-1">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t p-3">
                    {mediaPreviewUrl ? (
                      <div className="mb-2">
                        {String(mediaFile?.type||'').startsWith('video/') ? (
                          <video src={mediaPreviewUrl} controls className="w-56 rounded" />
                        ) : (
                          <img src={mediaPreviewUrl} alt="preview" className="w-40 rounded" />
                        )}
                        <Button variant="ghost" size="sm" onClick={handleRemoveMedia} className="mt-1"><X className="h-4 w-4 mr-1" /> Retirer</Button>
                      </div>
                    ) : null}
                    {audioBlob ? (
                      <div className="mb-2 flex items-center gap-2">
                        <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
                        <Button variant="ghost" size="sm" onClick={handleRemoveAudio}><X className="h-4 w-4 mr-1" /> Retirer</Button>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                      {!isRecording && !audioBlob && (
                        <Button size="sm" type="button" variant="ghost" onClick={() => mediaInputRef.current?.click()} disabled={sending} aria-label="Ajouter média">
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={isRecording || !!audioBlob} />
                      {!isRecording && !audioBlob && (
                        <Button size="sm" type="button" variant="ghost" onClick={startRecording} disabled={sending} aria-label="Enregistrer audio">
                          <Mic className="h-4 w-4" />
                        </Button>
                      )}
                      {isRecording && (
                        <Button size="sm" type="button" variant="destructive" onClick={stopRecording} aria-label="Arrêter l'enregistrement">
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                      <div className="text-xs text-gray-600 min-w-[48px]">{isRecording ? `${recordingTime}s` : ''}</div>
                      <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Votre message…" onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); } }} />
                      <Button onClick={sendMessage} disabled={sending || (!messageText.trim() && !mediaFile && !audioBlob)} className="shrink-0">Envoyer</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Chat commande</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-sm text-gray-600">Le chat sera disponible une fois le paiement validé.</div>
                </CardContent>
              </Card>
            )}

            {canShowRatingCard ? (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Noter la commande</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  {ratingLoading ? (
                    <div className="text-sm text-gray-600">Chargement…</div>
                  ) : rating ? (
                    <div className="space-y-2 text-sm text-gray-700">
                      <div>
                        {(() => {
                          const n = Number(rating?.rating || 0);
                          const clamped = Math.max(Math.min(n, 5), 0);
                          return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
                        })()}
                      </div>
                      {rating?.comment ? (
                        <div className="whitespace-pre-wrap">{rating.comment}</div>
                      ) : null}
                    </div>
                  ) : canRate ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {[1,2,3,4,5].map((n) => (
                          <Button key={n} type="button" variant={ratingValue >= n ? 'default' : 'outline'} size="sm" onClick={() => setRatingValue(n)}>
                            {n}
                          </Button>
                        ))}
                      </div>
                      <Textarea value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Votre avis (optionnel)" />
                      <Button type="button" onClick={submitRating} disabled={ratingSubmitting || !ratingValue} className="w-full">
                        {ratingSubmitting ? 'Envoi…' : 'Envoyer mon avis'}
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {effectiveRole === 'buyer' && String(order?.fulfillment_status || '').toLowerCase() === 'delivered' && !order?.buyer_received_at ? (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Réception</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  <Button onClick={confirmReceived} className="w-full">J'ai bien reçu la commande</Button>
                  {String(order?.status||'').toLowerCase() === 'paid' && autoCompleteDate ? (
                    <div className="text-xs text-gray-500 text-center">La commande sera considérée automatiquement terminée au bout de 14 jours — soit le {formatLongDate(autoCompleteDate)}.</div>
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
