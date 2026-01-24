import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [cartCount, setCartCount] = useState(() => {
    const cart = readMarketplaceCart();
    return getMarketplaceCartCount(cart);
  });
  const [shopAccess, setShopAccess] = useState(false);
  const [myPartnerId, setMyPartnerId] = useState(null);
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

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
                <Card key={p.id} className="h-full flex flex-col">
                  <CardHeader className="p-4">
                    <div className="flex items-start gap-3">
                      {p?.logo_url ? (
                        <button
                          type="button"
                          className="h-12 w-12 rounded-md overflow-hidden border shrink-0"
                          onClick={() => {
                            setLightboxSrc(p.logo_url);
                            setLightboxOpen(true);
                          }}
                        >
                          <img alt="Logo boutique" src={p.logo_url} className="h-12 w-12 object-cover" />
                        </button>
                      ) : null}
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-semibold">{p.display_name || 'Boutique partenaire'}</CardTitle>
                        <div className="text-xs text-gray-500">{p.category || ''}</div>
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
                            variant="outline"
                            onClick={() => {
                              window.location.href = contactUrl;
                            }}
                            className="shrink-0"
                          >
                            Contacter
                          </Button>
                        ) : null}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="text-xs text-gray-500">{commandable ? 'Disponible' : 'Indisponible'}</div>
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

export default Marketplace;
