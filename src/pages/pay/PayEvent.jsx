import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft } from 'lucide-react';
import MediaDisplay from '@/components/MediaDisplay';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function PayForm({ clientSecret, eventId, session }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onPay = async () => {
    try {
      if (!stripe || !elements) return;
      setSubmitting(true);
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        toast({ title: 'Paiement', description: error.message || 'Erreur de confirmation', variant: 'destructive' });
        return;
      }
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        try {
          if (session?.access_token) {
            await fetch(`${API_PREFIX}/qrcode/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ event_id: eventId }),
            }).catch(() => {});
          }
        } finally {
          toast({ title: 'Paiement réussi', description: 'Votre billet a été activé.' });
          navigate(`/compte/mon-qrcode?eventId=${encodeURIComponent(eventId)}&thanks=1`);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <Button className="w-full" disabled={!stripe || submitting} onClick={onPay}>
        {submitting ? 'Paiement…' : 'Payer'}
      </Button>
    </div>
  );
}

export default function PayEvent() {
  const { eventId } = useParams();
  const { session } = useAuth();
  const q = useQuery();
  const navigate = useNavigate();
  const paymentMode = 'full';
  const [clientSecret, setClientSecret] = useState(null);
  const [pk, setPk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventInfo, setEventInfo] = useState(null);
  const amountText = useMemo(() => {
    try {
      if (!eventInfo) return '';
      const currency = String(eventInfo.currency || 'eur').toUpperCase();
      const isZeroDecimal = currency === 'XAF';
      let amountMajor = 0;
      if (typeof eventInfo.price_amount === 'number' && eventInfo.price_amount > 0) {
        amountMajor = eventInfo.price_amount;
      } else if (typeof eventInfo.price === 'string') {
        const s = eventInfo.price.replace(',', '.');
        const m = s.match(/([0-9]+(?:\.[0-9]+)?)/);
        amountMajor = m ? parseFloat(m[1]) : 0;
      }
      if (!Number.isFinite(amountMajor) || amountMajor <= 0) return '';
      const formatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: isZeroDecimal ? 0 : 2, maximumFractionDigits: isZeroDecimal ? 0 : 2 }).format(amountMajor);
      return `Prix total: ${formatted}`;
    } catch {
      return '';
    }
  }, [eventInfo, paymentMode]);

  useEffect(() => {
    const run = async () => {
      try {
        if (!API_PREFIX) throw new Error('API non configurée');
        const keyRes = await fetch(`${API_PREFIX}/stripe/config`);
        const keyData = await keyRes.json().catch(() => ({}));
        if (!keyRes.ok || !keyData?.publishableKey) throw new Error('Clé Stripe manquante');
        setPk(keyData.publishableKey);

        // Event details (optional, for display)
        try {
          const evRes = await fetch(`${API_PREFIX}/events/${encodeURIComponent(eventId)}`);
          const ev = await evRes.json().catch(() => ({}));
          if (evRes.ok) setEventInfo(ev);
        } catch {}

        const res = await fetch(`${API_PREFIX}/events/${encodeURIComponent(eventId)}/intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ payment_mode: paymentMode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur création paiement');
        if (data?.alreadyPaid) {
          navigate(`/compte/mon-qrcode?eventId=${encodeURIComponent(eventId)}`);
          return;
        }
        if (!data?.clientSecret) throw new Error('Client secret manquant');
        setClientSecret(data.clientSecret);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [eventId, paymentMode, session?.access_token]);

  const stripePromise = useMemo(() => (pk ? loadStripe(pk) : null), [pk]);

  const handleBack = () => {
    try {
      if (window.history && window.history.length > 1) {
        navigate(-1);
      } else {
        if (eventId) {
          navigate(`/evenements?eventId=${encodeURIComponent(eventId)}`);
        } else {
          navigate('/evenements');
        }
      }
    } catch (e) {
      if (eventId) {
        navigate(`/evenements?eventId=${encodeURIComponent(eventId)}`);
      } else {
        navigate('/evenements');
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Payer mon billet - OneKamer</title>
      </Helmet>
      <div className="max-w-md mx-auto">
        <div className="mb-3">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Paiement Évènement</CardTitle>
          </CardHeader>
          <CardContent>
            {eventInfo && (
              <div className="text-sm text-gray-600 mb-2 flex items-start gap-3">
                <div className="w-12 h-12 rounded overflow-hidden shrink-0 bg-gray-100">
                  {Array.isArray(eventInfo.image_urls) && eventInfo.image_urls.length > 0 ? (
                    <img src={eventInfo.image_urls[0]} alt={eventInfo.title} className="w-12 h-12 object-cover" />
                  ) : (
                    <MediaDisplay bucket="evenements" path={eventInfo.media_url} alt={eventInfo.title} className="w-12 h-12 object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate">{eventInfo.title}</div>
                  <div className="text-xs text-gray-500 truncate">{eventInfo.date} • {eventInfo.location}</div>
                </div>
              </div>
            )}
            {amountText && (
              <div className="text-sm font-medium mb-2">{amountText}</div>
            )}
            <div className="text-xs text-gray-500 mb-3">Billets non échangeables, non remboursables.</div>
            {loading && <div>Chargement…</div>}
            {!loading && (!stripePromise || !clientSecret) && (
              <div className="text-sm text-red-600">Impossible d’initialiser le paiement.</div>
            )}
            {stripePromise && clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PayForm clientSecret={clientSecret} eventId={eventId} session={session} />
              </Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
