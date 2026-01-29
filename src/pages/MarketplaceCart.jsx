import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ChartePopup from '@/components/ChartePopup';
import {
  clearMarketplaceCart,
  readMarketplaceCart,
  removeMarketplaceCartItem,
  updateMarketplaceCartQuantity,
  getMarketplaceCartCount,
} from '@/lib/marketplaceCart';

const MarketplaceCart = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [cart, setCart] = useState(() => readMarketplaceCart());
  const [payLoading, setPayLoading] = useState(false);
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const [shipLoading, setShipLoading] = useState(false);
  const [shipError, setShipError] = useState(null);
  const [shipOptions, setShipOptions] = useState({
    pickup: { label: 'Retrait sur place', price_cents: 0, is_active: true },
    standard: null,
    express: null,
    international: null,
  });
  const [deliveryMode, setDeliveryMode] = useState('pickup');
  const [customerNote, setCustomerNote] = useState('');
  const [acceptBuyerTerms, setAcceptBuyerTerms] = useState(false);
  const [showBuyerCharte, setShowBuyerCharte] = useState(false);

  const cartCount = useMemo(() => getMarketplaceCartCount(cart), [cart]);

  const subtotal = useMemo(() => {
    const items = Array.isArray(cart?.items) ? cart.items : [];
    return items.reduce((sum, it) => sum + Number(it.base_price_amount || 0) * Number(it.quantity || 1), 0);
  }, [cart]);

  const shippingFee = useMemo(() => {
    const m = String(deliveryMode || 'pickup').toLowerCase();
    if (m === 'pickup') return 0;
    const opt = shipOptions[m];
    if (!opt || opt.is_active !== true) return 0;
    return Math.max(parseInt(opt.price_cents, 10) || 0, 0);
  }, [deliveryMode, shipOptions]);

  const totalWithShipping = useMemo(() => subtotal + shippingFee, [subtotal, shippingFee]);

  useEffect(() => {
    const fetchShipping = async () => {
      try {
        if (!cart?.partnerId) return;
        setShipLoading(true);
        setShipError(null);
        const res = await fetch(
          `${apiBaseUrl}/api/market/partners/${encodeURIComponent(cart.partnerId)}/shipping-options?t=${Date.now()}`,
          { cache: 'no-store' }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement options de livraison');
        const list = Array.isArray(data?.options) ? data.options : [];
        const base = {
          pickup: { label: 'Retrait sur place', price_cents: 0, is_active: true },
          standard: { label: 'Livraison standard', price_cents: 0, is_active: false },
          express: { label: 'Livraison express', price_cents: 0, is_active: false },
          international: { label: 'Livraison internationale', price_cents: 0, is_active: false },
        };
        let defaultMode = 'pickup';
        list.forEach((o) => {
          const t = String(o?.shipping_type || '').toLowerCase().trim();
          if (!['pickup','standard','express','international'].includes(t)) return;
          base[t] = {
            label: o?.label || base[t].label,
            price_cents: t === 'pickup' ? 0 : Math.max(parseInt(o?.price_cents, 10) || 0, 0),
            is_active: t === 'pickup' ? true : o?.is_active === true,
          };
          if (t !== 'pickup' && base[t].is_active && defaultMode === 'pickup') {
            // garder pickup par défaut, l'utilisateur choisira s'il veut livraison
          }
        });
        setShipOptions(base);
        setDeliveryMode(defaultMode);
      } catch (e) {
        setShipError(e?.message || 'Erreur chargement options de livraison');
      } finally {
        setShipLoading(false);
      }
    };
    fetchShipping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.partnerId, apiBaseUrl]);

  const syncCartToServer = async (nextCart) => {
    try {
      if (!session?.access_token) return;
      const pid = nextCart?.partnerId ? String(nextCart.partnerId) : null;
      const its = Array.isArray(nextCart?.items) ? nextCart.items : [];
      if (!pid) return;

      await fetch(`${apiBaseUrl}/api/market/cart`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          partnerId: pid,
          items: its.map((it) => ({ itemId: it.itemId, quantity: it.quantity })),
        }),
      });
    } catch {
      // ignore
    }
  };

  const handlePay = async () => {
    if (!cart?.partnerId || !Array.isArray(cart?.items) || cart.items.length === 0) {
      toast({
        title: 'Panier vide',
        description: 'Ajoute au moins un article avant de payer.',
        variant: 'destructive',
      });
      return;
    }

    if (!session?.access_token) {
      toast({
        title: 'Connexion requise',
        description: 'Connecte-toi pour payer.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    if (payLoading) return;

    if (!acceptBuyerTerms) {
      toast({ title: 'Charte acheteur', description: 'Vous devez accepter la charte acheteur pour continuer.', variant: 'destructive' });
      return;
    }

    setPayLoading(true);
    try {
      const createRes = await fetch(`${apiBaseUrl}/api/market/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          partnerId: cart.partnerId,
          items: cart.items.map((it) => ({ itemId: it.itemId, quantity: it.quantity })),
          delivery_mode: deliveryMode || 'pickup',
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(createData?.error || 'Erreur création commande');

      const orderId = createData?.orderId;
      if (!orderId) throw new Error('orderId manquant');

      navigate(`/pay/market/${encodeURIComponent(orderId)}`);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Impossible de démarrer le paiement',
        variant: 'destructive',
      });
    } finally {
      setPayLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Panier - Marketplace - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => navigate('/marketplace')} className="px-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
          <div className="text-sm text-gray-600">Articles: {cartCount}</div>
        </div>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base">Panier</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {!cart?.items?.length ? (
              <div className="text-gray-600 text-sm">Ton panier est vide.</div>
            ) : (
              <div className="space-y-3">
                {cart.items.map((it) => (
                  <div key={it.itemId} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{it.title || 'Article'}</div>
                      <div className="text-xs text-gray-500">{Number(it.base_price_amount || 0) / 100} €</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => {
                          const next = updateMarketplaceCartQuantity({
                            cart,
                            itemId: it.itemId,
                            quantity: e.target.value,
                          });
                          setCart(next);
                          syncCartToServer(next);
                        }}
                        className="w-20"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = removeMarketplaceCartItem({ cart, itemId: it.itemId });
                          setCart(next);
                          syncCartToServer(next);
                        }}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">Sous-total</div>
              <div className="font-semibold text-gray-800">{subtotal / 100} €</div>
            </div>

            <div className="flex items-start gap-2 py-2">
              <input id="buyer_terms" type="checkbox" checked={acceptBuyerTerms} onChange={(e) => setAcceptBuyerTerms(e.target.checked)} />
              <label htmlFor="buyer_terms" className="text-xs text-gray-700">
                J’accepte la charte acheteur du Marketplace
              </label>
            </div>
            <div className="pb-1">
              <button type="button" className="text-xs text-[#2BA84A] underline" onClick={() => setShowBuyerCharte(true)}>
                Voir la charte acheteur
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-700 font-medium">Mode de livraison</div>
              {shipError ? <div className="text-xs text-red-600">{shipError}</div> : null}
              <div className="grid grid-cols-1 gap-2">
                {(['pickup','standard','express','international']).map((t) => {
                  const opt = shipOptions[t];
                  const active = t === 'pickup' ? true : opt && opt.is_active;
                  if (!active) return null;
                  const label = opt?.label || (t === 'pickup' ? 'Retrait sur place' : t);
                  const price = t === 'pickup' ? 0 : Math.max(parseInt(opt?.price_cents, 10) || 0, 0);
                  return (
                    <label key={t} className="flex items-center justify-between rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="delivery_mode"
                          value={t}
                          checked={deliveryMode === t}
                          onChange={() => setDeliveryMode(t)}
                        />
                        <span className="text-gray-800">{label}</span>
                      </div>
                      <div className="text-gray-700">{price / 100} €</div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Livraison</div>
              <div className="font-semibold text-gray-800">{shippingFee / 100} €</div>
            </div>

            <div className="text-xs text-gray-500">Frais de service OneKamer (10%)</div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-900 font-semibold">Total</div>
              <div className="text-base font-bold text-gray-900">{totalWithShipping / 100} €</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-700 font-medium">Note pour le vendeur</div>
              <textarea
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Ex: précisions de taille, remise en main propre, etc. (optionnel)"
                className="w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm min-h-[80px]"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" disabled={!cart?.items?.length || payLoading} onClick={handlePay} className="w-full">
                {payLoading ? 'Redirection…' : 'Payer'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!cart?.items?.length}
                onClick={() => {
                  clearMarketplaceCart();
                  const next = readMarketplaceCart();
                  setCart(next);
                  syncCartToServer(next);
                }}
                className="w-full"
              >
                Vider le panier
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <ChartePopup show={showBuyerCharte} onClose={() => setShowBuyerCharte(false)} readOnly={true} title="Charte Marketplace — Acheteur" />
    </>
  );
};

export default MarketplaceCart;
