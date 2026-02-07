import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

const API_URL = 'https://onekamer-server.onrender.com';

const Forfaits = () => {
  const { toast } = useToast();
  const { user, profile, session, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const isIOS = Capacitor.getPlatform() === 'ios';
  const [subInfo, setSubInfo] = useState(null);
  const [iapVipReady, setIapVipReady] = useState(false);
  const [iapVipChecked, setIapVipChecked] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        if (!user?.id || !session?.access_token) return;
        const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || API_URL;
        const API_PREFIX = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
        const res = await fetch(`${API_PREFIX}/iap/subscription?userId=${encodeURIComponent(user.id)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.status === 404) { setSubInfo(null); return; }
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.subscription) setSubInfo(data.subscription);
      } catch {}
    };
    run();
  }, [user?.id, session?.access_token, profile?.plan]);

  useEffect(() => {
    let mounted = true;
    const preload = async () => {
      try {
        if (!isIOS) { if (mounted) setIapVipChecked(true); return; }
        const hasFn = typeof NativePurchases?.getProducts === 'function';
        if (!hasFn) { if (mounted) setIapVipChecked(true); return; }
        const res = await NativePurchases.getProducts({
          productIdentifiers: ['onekamer_vip_monthly', 'co.onekamer.vip.monthly'],
          productType: PURCHASE_TYPE.SUBS,
        });
        const list = Array.isArray(res?.products) ? res.products : (Array.isArray(res) ? res : []);
        const getId = (p) => String(p?.productId || p?.productIdentifier || p?.identifier || p?.id || p?.sku || '').trim();
        const wanted = new Set(['onekamer_vip_monthly', 'co.onekamer.vip.monthly']);
        const hasAny = Array.isArray(list) && list.length > 0;
        const foundWanted = (list || []).some((p) => wanted.has(getId(p)));
        if (mounted) {
          setIapVipReady(hasAny || foundWanted);
          setIapVipChecked(true);
          if (!hasAny) {
            const returned = (list || []).map(getId).filter(Boolean).join(', ') || 'aucun';
            toast({ title: 'IAP iOS', description: `getProducts: aucun produit VIP trouvé. IDs demandés: onekamer_vip_monthly, co.onekamer.vip.monthly. Retournés: ${returned}` });
            // eslint-disable-next-line no-console
            console.log('[IAP] preload getProducts result:', list);
          }
        }
      } catch (e) {
        if (mounted) {
          setIapVipChecked(true);
          toast({ title: 'IAP iOS', description: `getProducts a échoué: ${e?.message || 'erreur inconnue'}`, variant: 'destructive' });
          // eslint-disable-next-line no-console
          console.log('[IAP] preload getProducts error:', e);
        }
      }
    };
    preload();
    return () => { mounted = false; };
  }, [isIOS]);

  const handleChoosePlan = async (plan) => {
    if (!user) {
      toast({ title: "Connexion requise", description: "Veuillez vous connecter pour choisir un forfait.", variant: "destructive" });
      navigate('/auth');
      return;
    }

    // iOS natif: désactivation temporaire du plan Standard (App Review)
    if (isIOS && plan.key === 'standard') {
      toast({ title: "Bientôt disponible", description: "Le forfait Standard sera disponible prochainement sur iOS.", variant: "default" });
      return;
    }

    setLoadingPlan(plan.key);

    try {
      if (isIOS && plan.key === 'vip') {
        try {
          const candidates = ['co.onekamer.vip.monthly', 'onekamer_vip_monthly'];
          let productToBuy = candidates[0];
          try {
            const res = await NativePurchases.getProducts({
              productIdentifiers: candidates,
              productType: PURCHASE_TYPE.SUBS,
            });
            const list = Array.isArray(res?.products) ? res.products : (Array.isArray(res) ? res : []);
            const getId = (p) => String(p?.productId || p?.productIdentifier || p?.identifier || p?.id || p?.sku || '').trim();
            for (const id of candidates) {
              const found = (list || []).find((p) => getId(p) === id);
              if (found) { productToBuy = id; break; }
            }
          } catch {}
          toast({ title: 'IAP iOS', description: `Achat VIP via produit: ${productToBuy}` });
          const result = await NativePurchases.purchaseProduct({
            productIdentifier: productToBuy,
            productType: PURCHASE_TYPE.SUBS,
            quantity: 1
          });
          // Récupération robuste du transactionId: résultat direct, fallback via getPurchases, puis prompt
          let txId = String(result?.transactionId || '').trim();
          if (!txId) {
            try {
              const got = await NativePurchases.getPurchases();
              const purchases = Array.isArray(got?.purchases) ? got.purchases : [];
              const wanted = new Set(candidates);
              const getId = (p) => String(p?.productId || p?.productIdentifier || p?.identifier || p?.id || p?.sku || '').trim();
              const match = purchases.find((it) => wanted.has(getId(it)) && it?.transactionId);
              if (match?.transactionId) txId = String(match.transactionId);
            } catch {}
          }
          if (!txId) {
            const manual = window.prompt("Entrez l'identifiant de transaction Apple (transactionId)");
            if (!manual) throw new Error("Achat confirmé mais identifiant de transaction introuvable");
            txId = String(manual).trim();
          }

          const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || API_URL;
          const API_PREFIX = API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`;
          const res = await fetch(`${API_PREFIX}/iap/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
            },
            body: JSON.stringify({
              platform: 'ios',
              provider: 'apple',
              userId: user.id,
              transactionId: txId
            })
          });
          const dataVerify = await res.json().catch(() => ({}));
          if (!res.ok || !dataVerify?.ok) {
            throw new Error(dataVerify?.error || 'Échec vérification IAP');
          }
          await refreshProfile();
          toast({ title: "Abonnement activé", description: "Votre plan a été mis à jour." });
        } catch (e) {
          toast({ title: "Erreur", description: e?.message || "Achat in-app échoué", variant: "destructive" });
        } finally {
          setLoadingPlan(null);
        }
        return;
      }

      let response;
      if (plan.key === 'free') {
        toast({ title: "Déjà sur le plan gratuit", description: "Vous utilisez déjà le plan gratuit.", variant: "info" });
        setLoadingPlan(null);
        return;
      }
      
      response = await fetch(`${API_URL}/create-subscription-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, planKey: plan.key, priceId: plan.priceId, promoCode: promoCode || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue.');
      }
      
      if (data.url) {
        window.location.href = data.url;
      }

    } catch (error) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de traiter votre demande. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      key: 'free',
      name: 'Gratuit',
      description: 'Découvrez les bases de la communauté OneKamer.',
      price: '0€',
      priceId: null,
      features: [
        '📰 Accès aux Annonces (lecture)',
        '🎟️ Accès aux Événements (lecture)',
        '💬 Accès aux Échanges (lecture + commentaires)',
        '🗞️ Accès aux Faits divers',
        '👥 Accès aux Groupes (lecture)',
        '📱 Accès au QR Code pour les événements',
        "🛒 Accès Marketplace : création d'une boutique + achat",
      ],
    },
    {
      key: 'standard',
      name: 'Standard',
      description: 'Moins cher qu’une portion de soya bien pimenté.',
      price: '2€',
      priceId: 'price_1S6UwbGDT7i4b3lHZCiI9jwh', // Remplacez par le vrai Price ID de Stripe pour 2€
      isPopular: true,
      features: [
        '✅ Tout du plan Gratuit',
        '🏢 Accès aux Partenaires & Recommandations',
        '🏷️ Badge Standard sur le profil',
        '📱 Accès au QR Code pour les événements',
      ],
    },
    {
      key: 'vip',
      name: 'VIP',
      description: 'À peine le prix de deux courses en moto-taxi.',
      price: '5€',
      priceId: 'price_1S6V5XGDT7i4b3lHcqu6yoZh', // Remplacez par le vrai Price ID de Stripe pour 5€
      features: [
        '✅ Tout du plan Standard',
        '❤️ Accès complet à la section Rencontre',
        '✍️ Création d’annonces',
        '🎉 Création d’événements',
        '👨‍👩‍👧‍👦 Création de groupes',
        '📱 Accès au QR Code pour les événements',
        '💎 Badge VIP sur le profil',
      ],
    }
  ];

  return (
    <>
      <Helmet>
        <title>Forfaits - OneKamer.co</title>
        <meta name="description" content="Choisissez un forfait pour profiter de toutes les fonctionnalités de OneKamer.co." />
      </Helmet>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#2BA84A]">Nos Forfaits</h1>
          <p className="text-lg text-gray-600 mt-2">Accédez à plus de fonctionnalités et soutenez la communauté.</p>
        </div>

        {!isIOS && (
          <div className="max-w-md mx-auto flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Code promo (optionnel)</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Ex: WILLYFREE"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2BA84A] focus:border-[#2BA84A]"
              />
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const vipActiveNow = subInfo && subInfo.plan_name === 'vip' && subInfo.end_date && (new Date(subInfo.end_date).getTime() > Date.now());
            const vipInactiveNow = subInfo && subInfo.plan_name === 'vip' && subInfo.end_date && (new Date(subInfo.end_date).getTime() <= Date.now());
            const isCurrentPlan = (
              plan.key === 'vip'
                ? vipActiveNow
                : plan.key === 'free'
                  ? (profile?.plan === 'free' || vipInactiveNow)
                  : (profile?.plan === plan.key)
            );
            return (
            <Card key={plan.key} className={`flex flex-col ${plan.isPopular ? 'border-2 border-[#2BA84A]' : ''} ${isCurrentPlan ? 'bg-green-50' : ''}`}>
              {plan.isPopular && <div className="absolute top-0 right-4 -mt-3 bg-[#2BA84A] text-white text-xs font-bold px-3 py-1 rounded-full">POPULAIRE</div>}
              <CardHeader>
                <CardTitle>
                  {plan.name}
                </CardTitle>
                <CardDescription className="italic">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between space-y-4">
                <div>
                  <p className="text-3xl font-bold">{isIOS && plan.key === 'vip' ? '6,49€' : plan.price} <span className="text-sm font-normal">/ mois</span></p>
                  <ul className="space-y-2 text-sm mt-4">
                    {plan.features?.map(feat => <li key={feat} className="flex items-center"><CheckCircle className="h-4 w-4 mr-2 text-green-500" /> {feat}</li>)}
                    {plan.nonFeatures?.map(feat => <li key={feat} className="flex items-center"><XCircle className="h-4 w-4 mr-2 text-red-500" /> {feat}</li>)}
                  </ul>
                  {subInfo && subInfo.plan_name === plan.key && subInfo.end_date && (
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(subInfo.end_date).getTime() > Date.now()
                        ? `Actif jusqu’au ${new Date(subInfo.end_date).toLocaleString()}`
                        : `Expiré le ${new Date(subInfo.end_date).toLocaleString()}`}
                    </div>
                  )}
                </div>
                {/* iOS natif: bouton Standard désactivé temporairement (App Review) */}
                <Button 
                  onClick={() => handleChoosePlan(plan)}
                  className={`w-full mt-4 ${isCurrentPlan ? 'bg-gray-400' : (plan.key === 'vip' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-[#2BA84A] hover:bg-[#24903f]')}`}
                  variant={'default'}
                  disabled={
                    loadingPlan === plan.key ||
                    isCurrentPlan ||
                    (isIOS && plan.key === 'standard') ||
                    (isIOS && plan.key === 'vip' && iapVipChecked && !iapVipReady)
                  }
                >
                  {loadingPlan === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   isCurrentPlan ? 'Votre plan actuel' :
                   (isIOS && plan.key === 'standard') ? 'Bientôt disponible' :
                   (isIOS && plan.key === 'vip' && iapVipChecked && !iapVipReady) ? 'Indisponible (Sandbox requis)' :
                   plan.key === 'free' ? 'Gratuit' :
                   plan.key === 'standard' ? 'Souscrire au forfait Standard' :
                   'Devenir membre VIP'}
                </Button>
                {isIOS && plan.key === 'vip' && (
                  <div className="mt-2 text-[11px] text-gray-500">
                    En appuyant sur "Devenir membre VIP", vous acceptez
                    <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer" className="underline"> l'EULA d'Apple</a>,
                    nos <a href="/cgu" className="underline">Conditions d'utilisation</a> et notre
                    <a href="/rgpd" className="underline"> Politique de confidentialité</a>.
                  </div>
                )}
              </CardContent>
            </Card>
          )})}
        </div>
      </div>
    </>
  );
};

export default Forfaits;