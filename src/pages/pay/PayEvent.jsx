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

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function PayForm({ clientSecret, eventId }) {
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
        toast({ title: 'Paiement réussi', description: 'Votre billet a été activé.' });
        navigate(`/compte/mon-qrcode?eventId=${encodeURIComponent(eventId)}`);
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
  const paymentMode = (q.get('mode') === 'deposit') ? 'deposit' : 'full';
  const [clientSecret, setClientSecret] = useState(null);
  const [pk, setPk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventInfo, setEventInfo] = useState(null);

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
        if (!res.ok || !data?.clientSecret) throw new Error(data?.error || 'Erreur création paiement');
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
            <CardTitle>Paiement Évènement {paymentMode === 'deposit' ? '(Acompte)' : '(Total)'}</CardTitle>
          </CardHeader>
          <CardContent>
            {eventInfo && (
              <div className="text-sm text-gray-600 mb-2">
                {eventInfo.title} — {eventInfo.date} • {eventInfo.location}
              </div>
            )}
            {loading && <div>Chargement…</div>}
            {!loading && (!stripePromise || !clientSecret) && (
              <div className="text-sm text-red-600">Impossible d’initialiser le paiement.</div>
            )}
            {stripePromise && clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PayForm clientSecret={clientSecret} eventId={eventId} />
              </Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
