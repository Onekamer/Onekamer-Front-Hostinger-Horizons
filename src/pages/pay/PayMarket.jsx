import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

function PayForm({ clientSecret, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
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
        toast({ title: 'Paiement réussi', description: 'Commande payée avec succès.' });
        onSuccess?.();
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

export default function PayMarket() {
  const { orderId } = useParams();
  const { session } = useAuth();
  const [clientSecret, setClientSecret] = useState(null);
  const [pk, setPk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [initError, setInitError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      try {
        if (!API_PREFIX) throw new Error('API non configurée');
        const keyRes = await fetch(`${API_PREFIX}/stripe/config`);
        const keyData = await keyRes.json().catch(() => ({}));
        if (!keyRes.ok || !keyData?.publishableKey) throw new Error('Clé Stripe manquante');
        setPk(keyData.publishableKey);

        const res = await fetch(`${API_PREFIX}/market/orders/${encodeURIComponent(orderId)}/intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.clientSecret) {
          setInitError(data?.error || 'Erreur création paiement');
          return;
        }
        setClientSecret(data.clientSecret);
        setOrder(data.order || null);
      } catch (e) {
        setInitError(e?.message || 'Erreur initialisation');
      } finally {
        setLoading(false);
      }
    };
    if (orderId) run();
  }, [orderId, session?.access_token]);

  const stripePromise = useMemo(() => (pk ? loadStripe(pk) : null), [pk]);

  const doFallbackCheckout = async () => {
    try {
      if (!API_PREFIX) throw new Error('API non configurée');
      const res = await fetch(`${API_PREFIX}/market/orders/${encodeURIComponent(orderId)}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Erreur checkout');
      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d’ouvrir le checkout', variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet>
        <title>Payer ma commande - OneKamer</title>
      </Helmet>
      <div className="max-w-md mx-auto">
        <div className="mb-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Paiement Marketplace</CardTitle>
          </CardHeader>
          <CardContent>
            {order && (
              <div className="mb-3 text-sm text-gray-600 space-y-1">
                <div>
                  Total: {Intl.NumberFormat('fr-FR', { style: 'currency', currency: (order.currency || 'eur').toUpperCase() }).format((Number(order.amount || 0) / 100))}
                </div>
                <div>
                  Frais plateforme: {Intl.NumberFormat('fr-FR', { style: 'currency', currency: (order.currency || 'eur').toUpperCase() }).format((Number(order.platform_fee || 0) / 100))}
                </div>
                <div>
                  Part partenaire: {Intl.NumberFormat('fr-FR', { style: 'currency', currency: (order.currency || 'eur').toUpperCase() }).format((Number(order.partner_amount || 0) / 100))}
                </div>
              </div>
            )}

            {loading && <div>Chargement…</div>}
            {!loading && initError && (
              <div className="space-y-3">
                <div className="text-sm text-red-600">{initError}</div>
                <Button variant="outline" className="w-full" onClick={doFallbackCheckout}>Continuer avec Stripe Checkout</Button>
              </div>
            )}
            {!loading && !initError && (!stripePromise || !clientSecret) && (
              <div className="text-sm text-red-600">Impossible d’initialiser le paiement.</div>
            )}
            {stripePromise && clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PayForm clientSecret={clientSecret} onSuccess={() => navigate('/marketplace')} />
              </Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
