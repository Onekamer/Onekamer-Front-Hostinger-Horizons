import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  addToMarketplaceCart,
  clearMarketplaceCart,
  readMarketplaceCart,
  getMarketplaceCartCount,
} from '@/lib/marketplaceCart';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MarketplacePartner = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [cart, setCart] = useState(() => readMarketplaceCart());
  const [addingItemId, setAddingItemId] = useState(null);
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [partnerInfo, setPartnerInfo] = useState(null);

  const cartCount = useMemo(() => getMarketplaceCartCount(cart), [cart]);

  useEffect(() => {
    setCart(readMarketplaceCart());
  }, []);

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

  const submitReport = async () => {
    if (!partnerId) return;
    if (!session?.access_token) {
      toast({ title: 'Veuillez vous connecter', variant: 'destructive' });
      return;
    }
    const reason = String(reportReason || '').trim();
    const details = String(reportDetails || '').trim();
    if (!reason) {
      toast({ title: 'Motif requis', description: 'Merci de choisir un motif.', variant: 'destructive' });
      return;
    }
    setReportSending(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partnerId)}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reason, details }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Erreur lors de l'envoi du signalement");
      toast({ title: 'Signalement envoyé', description: 'Merci, nous allons examiner votre signalement.' });
      setReportOpen(false);
      setReportReason('');
      setReportDetails('');
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de signaler la boutique.', variant: 'destructive' });
    } finally {
      setReportSending(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!partnerId) return;
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partnerId)}/items`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement items');
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        toast({
          title: 'Erreur',
          description: e?.message || 'Impossible de charger la boutique',
          variant: 'destructive',
        });
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [partnerId, apiBaseUrl, toast]);

  useEffect(() => {
    const loadPartnerInfo = async () => {
      if (!partnerId) return;
      try {
        const res = await fetch(`${apiBaseUrl}/api/market/partners`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const list = Array.isArray(data?.partners) ? data.partners : [];
        const info = list.find((p) => String(p?.id || '') === String(partnerId || '')) || null;
        setPartnerInfo(info);
      } catch {
        setPartnerInfo(null);
      }
    };
    loadPartnerInfo();
  }, [partnerId, apiBaseUrl]);

  const handleAdd = async (item) => {
    const itemId = item?.id ? String(item.id) : null;
    if (!itemId) return;
    if (addingItemId) return;

    setAddingItemId(itemId);
    const result = addToMarketplaceCart({ cart, partnerId, item });

    if (result?.conflict) {
      const ok = window.confirm("Ton panier contient déjà des articles d'un autre partenaire. Vider le panier et continuer ?");
      if (!ok) return;

      clearMarketplaceCart();
      const next = addToMarketplaceCart({ cart: { partnerId: null, items: [] }, partnerId, item });
      setCart(next.cart);
      await syncCartToServer(next.cart);
      toast({ title: 'Ajouté au panier', description: 'Produit ajouté au panier.' });
      setTimeout(() => setAddingItemId(null), 250);
      return;
    }

    setCart(result.cart);
    await syncCartToServer(result.cart);
    toast({ title: 'Ajouté au panier', description: 'Produit ajouté au panier.' });
    setTimeout(() => setAddingItemId(null), 250);
  };

  return (
    <>
      <Helmet>
        <title>Boutique - Marketplace - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => navigate('/marketplace')} className="px-2">
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>

          <div className="flex items-center gap-2">
            <Dialog open={reportOpen} onOpenChange={setReportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="shrink-0">Signaler la boutique</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Signaler la boutique</DialogTitle>
                  <DialogDescription>Choisissez un motif et décrivez le problème si besoin.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Motif</Label>
                    <Select value={reportReason} onValueChange={setReportReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir un motif" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arnaque">Arnaque</SelectItem>
                        <SelectItem value="Contenu inapproprié">Contenu inapproprié</SelectItem>
                        <SelectItem value="Produit non conforme">Produit non conforme</SelectItem>
                        <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Détails (optionnel)</Label>
                    <textarea
                      className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                      rows={4}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Expliquez le problème…"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submitReport} disabled={reportSending} className="w-full">
                    {reportSending ? 'Envoi…' : 'Envoyer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" onClick={() => navigate('/marketplace/cart')} className="shrink-0">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Panier{cartCount > 0 ? ` (${cartCount})` : ''}
            </Button>
          </div>
        </div>

        <h1 className="text-xl font-bold text-[#2BA84A]">Boutique</h1>

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="text-gray-600">Aucun article disponible.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => {
              const media = it?.media && typeof it.media === 'object' ? it.media : {};
              const imageUrl = media?.image_url || '';
              return (
                <Card key={it.id} className="h-full flex flex-col">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base font-semibold">{it.title || 'Article'}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex-1 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      {imageUrl ? (
                        <button
                          type="button"
                          className="h-12 w-12 rounded-md overflow-hidden border shrink-0"
                          onClick={() => {
                            setLightboxSrc(imageUrl);
                            setLightboxOpen(true);
                          }}
                        >
                          <img alt="Produit" src={imageUrl} className="h-12 w-12 object-cover" />
                        </button>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        {it.description ? (
                          <p className="text-sm text-gray-600 line-clamp-3">{it.description}</p>
                        ) : (
                          <p className="text-sm text-gray-500">Description indisponible.</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-gray-800">{Number(it.base_price_amount || 0) / 100} €</div>
                      <Button
                        onClick={() => handleAdd(it)}
                        disabled={String(addingItemId || '') === String(it.id || '') || partnerInfo?.commandable === false}
                        className="shrink-0"
                      >
                        {String(addingItemId || '') === String(it.id || '') ? 'Ajout…' : 'Ajouter'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {lightboxOpen && lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => {
            setLightboxOpen(false);
            setLightboxSrc(null);
          }}
        >
          <div
            className="max-w-[95vw] max-h-[95vh] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxSrc}
              alt="media"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default MarketplacePartner;
