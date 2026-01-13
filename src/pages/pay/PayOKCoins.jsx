import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { ArrowLeft } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

function PayForm({ clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { refreshBalance } = useAuth();
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
        toast({ title: 'Paiement réussi', description: 'Vos OK Coins seront crédités.' });
        try { await refreshBalance(); } catch {}
        navigate('/ok-coins');
      } else {
        // Peut nécessiter une action supplémentaire, Stripe gère l’auth 3DS dans l’Element
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

export default function PayOKCoins() {
  const { packId } = useParams();
  const { session } = useAuth();
  const [clientSecret, setClientSecret] = useState(null);
  const [pk, setPk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pack, setPack] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      try {
        if (!API_PREFIX) throw new Error('API non configurée');
        const keyRes = await fetch(`${API_PREFIX}/stripe/config`);
        const keyData = await keyRes.json().catch(() => ({}));
        if (!keyRes.ok || !keyData?.publishableKey) throw new Error('Clé Stripe manquante');
        setPk(keyData.publishableKey);

        const res = await fetch(`${API_PREFIX}/okcoins/intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ packId }),
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
  }, [packId, session?.access_token]);

  const stripePromise = useMemo(() => (pk ? loadStripe(pk) : null), [pk]);

  return (
    <>
      <Helmet>
        <title>Payer OK Coins - OneKamer</title>
      </Helmet>
      <div className="max-w-md mx-auto">
        <div className="mb-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Paiement OK Coins</CardTitle>
          </CardHeader>
          <CardContent>
            {packId && (
              <PackInfo packId={packId} pack={pack} setPack={setPack} />
            )}
            {loading && <div>Chargement…</div>}
            {!loading && (!stripePromise || !clientSecret) && (
              <div className="text-sm text-red-600">Impossible d’initialiser le paiement.</div>
            )}
            {stripePromise && clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PayForm clientSecret={clientSecret} />
              </Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function PackInfo({ packId, pack, setPack }) {
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('okcoins_packs')
          .select('id, pack_name, coins, price_eur')
          .eq('id', packId)
          .maybeSingle();
        if (!active) return;
        if (!error) setPack(data || null);
      } catch {}
    };
    run();
    return () => { active = false; };
  }, [packId, setPack]);

  if (!pack) return null;
  return (
    <div className="mb-3 text-sm text-gray-600">
      <div className="font-medium">{pack.pack_name || 'Pack OK Coins'}</div>
      <div>
        {Number(pack.coins) || 0} pièces • {Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format((Number(pack.price_eur) || 0))}
      </div>
    </div>
  );
}
