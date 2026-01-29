import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { toast } from '@/components/ui/use-toast';
import { clearMarketplaceCart } from '@/lib/marketplaceCart';
import { ArrowLeft } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

function PayForm({ clientSecret, onSuccess, onPrePay }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const onPay = async () => {
    try {
      if (!stripe || !elements) return;
      setSubmitting(true);
      if (onPrePay) {
        await onPrePay();
      }
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
  const [deliveryMode, setDeliveryMode] = useState(null);
  const [shipFirstName, setShipFirstName] = useState('');
  const [shipLastName, setShipLastName] = useState('');
  const [shipEmail, setShipEmail] = useState('');
  const [shipPhone, setShipPhone] = useState('');
  const [shipAddress1, setShipAddress1] = useState('');
  const [shipAddress2, setShipAddress2] = useState('');
  const [shipPostalCode, setShipPostalCode] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipCountry, setShipCountry] = useState('');
  const [acceptBuyerTerms, setAcceptBuyerTerms] = useState(false);

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
        // Charger le détail commande pour connaître le mode de livraison
        try {
          const detailRes = await fetch(`${API_PREFIX}/market/orders/${encodeURIComponent(orderId)}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
          });
          const detail = await detailRes.json().catch(() => ({}));
          if (detailRes.ok && detail?.order) {
            setDeliveryMode(String(detail.order.delivery_mode || '').toLowerCase() || null);
          }
        } catch {}
      } catch (e) {
        setInitError(e?.message || 'Erreur initialisation');
      } finally {
        setLoading(false);
      }
    };
    if (orderId) run();
  }, [orderId, session?.access_token]);

  const stripePromise = useMemo(() => (pk ? loadStripe(pk) : null), [pk]);

  const prePay = useMemo(() => {
    return async () => {
      if (!acceptBuyerTerms) {
        throw new Error('Tu dois accepter la charte acheteurs pour continuer.');
      }
      const mode = String(deliveryMode || '').toLowerCase();
      if (mode && mode !== 'pickup') {
        const required = [shipFirstName, shipLastName, shipEmail, shipPhone, shipAddress1, shipPostalCode, shipCity, shipCountry];
        if (required.some((v) => !String(v || '').trim())) {
          throw new Error('Merci de remplir toutes les informations de livraison.');
        }
        const res = await fetch(`${API_PREFIX}/market/orders/${encodeURIComponent(orderId)}/shipping-info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            first_name: shipFirstName,
            last_name: shipLastName,
            email: shipEmail,
            phone: shipPhone,
            address_line1: shipAddress1,
            address_line2: shipAddress2 || undefined,
            postal_code: shipPostalCode,
            city: shipCity,
            country: shipCountry,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Erreur enregistrement adresse de livraison');
        }
      }

      // Enregistrer l'acceptation de la charte acheteur au niveau de la commande
      try {
        const res = await fetch(`${API_PREFIX}/market/orders/${encodeURIComponent(orderId)}/terms/buyer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'buyer_terms_required');
        }
      } catch (e) {
        throw new Error(e?.message || 'buyer_terms_required');
      }
    };
  }, [acceptBuyerTerms, deliveryMode, shipFirstName, shipLastName, shipEmail, shipPhone, shipAddress1, shipAddress2, shipPostalCode, shipCity, shipCountry, orderId, session?.access_token]);

  const doFallbackCheckout = async () => {
    try {
      if (!API_PREFIX) throw new Error('API non configurée');
      // Enregistrer l'adresse si nécessaire avant d'ouvrir le checkout
      try { await prePay(); } catch (e) { throw e; }
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

            {String(deliveryMode || '').toLowerCase() && String(deliveryMode || '').toLowerCase() !== 'pickup' ? (
              <div className="space-y-2 mb-4">
                <div className="text-sm text-gray-700 font-medium">Adresse de livraison</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input value={shipFirstName} onChange={(e) => setShipFirstName(e.target.value)} placeholder="Prénom" />
                  <Input value={shipLastName} onChange={(e) => setShipLastName(e.target.value)} placeholder="Nom" />
                </div>
                <Input type="email" value={shipEmail} onChange={(e) => setShipEmail(e.target.value)} placeholder="Email" />
                <Input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="Téléphone" />
                <Input value={shipAddress1} onChange={(e) => setShipAddress1(e.target.value)} placeholder="Adresse ligne 1" />
                <Input value={shipAddress2} onChange={(e) => setShipAddress2(e.target.value)} placeholder="Adresse ligne 2 (optionnel)" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input value={shipPostalCode} onChange={(e) => setShipPostalCode(e.target.value)} placeholder="Code postal" />
                  <Input value={shipCity} onChange={(e) => setShipCity(e.target.value)} placeholder="Ville" />
                  <Input value={shipCountry} onChange={(e) => setShipCountry(e.target.value)} placeholder="Pays (ex: FR)" />
                </div>
                <div className="text-xs text-gray-500">Ces informations sont requises pour la livraison et seront anonymisées côté vendeur une fois la commande terminée.</div>
              </div>
            ) : null}

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
                <div className="flex items-start gap-2 mb-3">
                  <input
                    id="buyer_terms"
                    type="checkbox"
                    checked={acceptBuyerTerms}
                    onChange={(e) => setAcceptBuyerTerms(e.target.checked)}
                  />
                  <label htmlFor="buyer_terms" className="text-xs text-gray-700">
                    J’accepte la charte acheteurs du Marketplace
                  </label>
                </div>
                <PayForm
                  clientSecret={clientSecret}
                  onPrePay={async () => {
                    try { await prePay(); }
                    catch (e) { toast({ title: 'Préparation paiement', description: e?.message || 'Action requise', variant: 'destructive' }); throw e; }
                  }}
                  onSuccess={() => {
                    try { clearMarketplaceCart(); } catch {}
                    navigate('/marketplace');
                  }}
                />
              </Elements>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
