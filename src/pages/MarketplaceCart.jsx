import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
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

  const cartCount = useMemo(() => getMarketplaceCartCount(cart), [cart]);

  const subtotal = useMemo(() => {
    const items = Array.isArray(cart?.items) ? cart.items : [];
    return items.reduce((sum, it) => sum + Number(it.base_price_amount || 0) * Number(it.quantity || 1), 0);
  }, [cart]);

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
          delivery_mode: 'pickup',
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
    </>
  );
};

export default MarketplaceCart;
