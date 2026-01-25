import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ShoppingBag } from 'lucide-react';
import { readMarketplaceCart, getMarketplaceCartCount } from '@/lib/marketplaceCart';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { canUserAccess } from '@/lib/accessControl';

const Marketplace = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [search, setSearch] = useState('');
  const [cartCount, setCartCount] = useState(() => {
    const cart = readMarketplaceCart();
    return getMarketplaceCartCount(cart);
  });
  const [shopAccess, setShopAccess] = useState(false);
  const [myPartnerId, setMyPartnerId] = useState(null);
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;
  const [ratingSummaries, setRatingSummaries] = useState({});
  const [activeRatingsPartnerId, setActiveRatingsPartnerId] = useState(null);
  const [ratingsList, setRatingsList] = useState([]);
  const [ratingsOffset, setRatingsOffset] = useState(0);
  const [ratingsHasMore, setRatingsHasMore] = useState(true);
  const [ratingsLoading, setRatingsLoading] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const cart = readMarketplaceCart();
      setCartCount(getMarketplaceCartCount(cart));
    };

    refresh();
    window.addEventListener('ok_marketplace_cart_updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('ok_marketplace_cart_updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/market/partners`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement marketplace');
        setPartners(Array.isArray(data?.partners) ? data.partners : []);
      } catch (e) {
        toast({
          title: 'Erreur',
          description: e?.message || 'Impossible de charger la marketplace',
          variant: 'destructive',
        });
        setPartners([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [apiBaseUrl, toast]);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const allowed = await canUserAccess(profile, 'marketplace', 'create_shop');
        setShopAccess(Boolean(allowed));

        if (!allowed || !session?.access_token) {
          setMyPartnerId(null);
          return;
        }

        const res = await fetch(`${apiBaseUrl}/api/market/partners/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement boutique');
        setMyPartnerId(data?.partner?.id || null);
      } catch (_e) {
        setShopAccess(false);
        setMyPartnerId(null);
      }
    };

    loadMe();
  }, [profile, apiBaseUrl, session?.access_token]);

  const handleGoMyShop = async () => {
    if (!session?.access_token) {
      toast({
        title: 'Connexion requise',
        description: 'Connecte-toi pour créer ta boutique.',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    const allowed = await canUserAccess(profile, 'marketplace', 'create_shop');
    if (!allowed) {
      toast({
        title: 'Réservé VIP',
        description: 'La création de boutique est réservée aux VIP.',
        variant: 'destructive',
      });
      navigate('/forfaits');
      return;
    }

    navigate('/marketplace/ma-boutique');
  };

  const filtered = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    if (!term) return partners;
    return (partners || []).filter((p) => {
      const name = String(p?.display_name || '').toLowerCase();
      const cat = String(p?.category || '').toLowerCase();
      const desc = String(p?.description || '').toLowerCase();
      return name.includes(term) || cat.includes(term) || desc.includes(term);
    });
  }, [partners, search]);

  const buildMapsUrl = (address) => {
    const addr = String(address || '').trim();
    if (!addr) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  };

  const buildWhatsappUrl = (phoneOrWhatsapp) => {
    const raw = String(phoneOrWhatsapp || '').trim();
    if (!raw) return null;
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return null;
    return `https://wa.me/${digits}`;
  };

  const buildTelUrl = (phone) => {
    const raw = String(phone || '').trim();
    if (!raw) return null;
    const digits = raw.replace(/[^0-9+]/g, '');
    if (!digits) return null;
    return `tel:${digits}`;
  };

  const fetchRatingSummary = async (partnerId) => {
    const id = String(partnerId || '');
    if (!id) return;
    if (ratingSummaries[id] !== undefined) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/public/partners/${encodeURIComponent(id)}/ratings/summary`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const avg = typeof data?.avg === 'number' ? data.avg : null;
      const count = parseInt(data?.count, 10) || 0;
      setRatingSummaries((prev) => ({ ...prev, [id]: { avg, count } }));
    } catch {}
  };

  const RATINGS_LIMIT = 20;
  const openRatingsDialog = async (partnerId) => {
    setActiveRatingsPartnerId(String(partnerId));
    setRatingsList([]);
    setRatingsOffset(0);
    setRatingsHasMore(true);
    await fetchRatingsPage(partnerId, 0);
  };

  const fetchRatingsPage = async (partnerId, offset = 0) => {
    const id = String(partnerId || '');
    if (!id) return;
    if (ratingsLoading) return;
    setRatingsLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', String(RATINGS_LIMIT));
      qs.set('offset', String(Math.max(offset, 0)));
      const res = await fetch(`${apiBaseUrl}/api/market/public/partners/${encodeURIComponent(id)}/ratings?${qs.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement avis');
      const list = Array.isArray(data?.ratings) ? data.ratings : [];
      setRatingsList((prev) => (offset === 0 ? list : [...prev, ...list]));
      setRatingsOffset(offset + list.length);
      setRatingsHasMore(list.length === RATINGS_LIMIT);
    } catch {
      setRatingsHasMore(false);
    } finally {
      setRatingsLoading(false);
    }
  };

  useEffect(() => {
    const ids = (partners || []).map((p) => p?.id).filter(Boolean);
    ids.forEach((id) => fetchRatingSummary(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners]);

  return (
    <>
      <Helmet>
        <title>Marketplace - OneKamer.co</title>
        <meta name="description" content="Marketplace OneKamer : découvre les boutiques partenaires." />
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#2BA84A]">Marketplace</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {shopAccess && (
              <Button variant="outline" onClick={handleGoMyShop} className="shrink-0">
                {myPartnerId ? 'Ma boutique' : 'Créer ma boutique'}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/market/orders')} className="shrink-0">
              Mes commandes
            </Button>
            <Button variant="outline" onClick={() => navigate('/marketplace/cart')} className="shrink-0">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Panier{cartCount > 0 ? ` (${cartCount})` : ''}
            </Button>
          </div>
        </div>

        <Input placeholder="Rechercher une boutique..." value={search} onChange={(e) => setSearch(e.target.value)} />

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-600">Aucune boutique trouvée.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const commandable = p?.commandable === true;
              const mapUrl = buildMapsUrl(p?.address);
              const whatsappUrl = buildWhatsappUrl(p?.whatsapp || p?.phone);
              const telUrl = buildTelUrl(p?.phone);
              const contactUrl = whatsappUrl || telUrl;
              return (
                <Card key={p.id} className={`h-full flex flex-col ${commandable ? '' : 'opacity-60'}`}>
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {p?.logo_url ? (
                          <img
                            alt="Logo boutique"
                            src={p.logo_url}
                            className="h-12 w-12 rounded-md object-cover border shrink-0"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <CardTitle className="text-lg font-semibold">{p.display_name || 'Boutique partenaire'}</CardTitle>
                          <div className="text-xs text-gray-500">{p.category || ''}</div>
                        </div>
                      </div>
                      <div className={`text-xs font-medium whitespace-nowrap ${commandable ? 'text-green-600' : 'text-gray-500'}`}>
                        {commandable ? 'Disponible' : 'Indisponible'}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex-1 flex flex-col gap-3">
                    {p.description ? (
                      <p className="text-sm text-gray-600 line-clamp-3">{p.description}</p>
                    ) : (
                      <p className="text-sm text-gray-500">Description indisponible.</p>
                    )}

                    {(p?.hours || p?.address) && (
                      <div className="space-y-1">
                        {p?.hours ? <div className="text-xs text-gray-600 whitespace-pre-line">{p.hours}</div> : null}
                        {p?.address ? <div className="text-xs text-gray-600">{p.address}</div> : null}
                      </div>
                    )}

                    {(mapUrl || contactUrl) && (
                      <div className="flex flex-wrap gap-2">
                        {mapUrl ? (
                          <Button
                            type="button"
                            variant="default"
                            onClick={() => window.open(mapUrl, '_blank', 'noopener,noreferrer')}
                            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            S’y rendre
                          </Button>
                        ) : null}
                        {contactUrl ? (
                          <Button
                            type="button"
                            variant="default"
                            onClick={() => {
                              window.location.href = contactUrl;
                            }}
                            className="shrink-0 bg-[#2BA84A] hover:bg-[#2BA84A]/90 text-white"
                          >
                            Contacter
                          </Button>
                        ) : null}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => openRatingsDialog(p.id)}
                            className="shrink-0"
                          >
                            {ratingSummaries[p.id]?.avg != null
                              ? `${ratingSummaries[p.id].avg.toFixed(1)} ★ (${ratingSummaries[p.id].count})`
                              : 'Notes'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Avis de la boutique</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                            {ratingsList.length === 0 ? (
                              <div className="text-sm text-gray-600">Aucun avis pour le moment.</div>
                            ) : (
                              ratingsList.map((r) => {
                                const n = Math.max(Math.min(Number(r?.rating || 0), 5), 0);
                                const stars = '★'.repeat(n) + '☆'.repeat(5 - n);
                                const when = r?.created_at ? new Date(r.created_at).toLocaleString() : '';
                                return (
                                  <div key={r.id} className="border rounded-md p-3 bg-white">
                                    <div className="text-sm font-medium">{stars}</div>
                                    {r?.comment ? (
                                      <div className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{r.comment}</div>
                                    ) : null}
                                    <div className="text-xs text-gray-500 mt-1">{r?.buyer_alias ? `${r.buyer_alias} • ` : ''}{when}</div>
                                  </div>
                                );
                              })
                            )}
                            {ratingsHasMore ? (
                              <Button
                                type="button"
                                onClick={() => fetchRatingsPage(activeRatingsPartnerId, ratingsOffset)}
                                disabled={ratingsLoading}
                                className="w-full"
                              >
                                {ratingsLoading ? 'Chargement…' : 'Charger plus'}
                              </Button>
                            ) : null}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button asChild disabled={!commandable} className="shrink-0">
                        <Link to={`/marketplace/partner/${encodeURIComponent(p.id)}`}>Voir la boutique</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Marketplace;
