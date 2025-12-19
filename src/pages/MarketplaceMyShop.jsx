import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { canUserAccess } from '@/lib/accessControl';

const CATEGORIES = ['Restauration', 'Mode', 'Beauté', 'Services', 'High-tech', 'Autre'];

const MarketplaceMyShop = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session, user, profile } = useAuth();

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [partner, setPartner] = useState(null);

  const [form, setForm] = useState({
    display_name: '',
    description: '',
    category: '',
    logo_url: '',
    phone: '',
    whatsapp: '',
    address: '',
    hours: '',
  });

  const statusLabel = useMemo(() => {
    const s = String(partner?.status || '').toLowerCase();
    if (s === 'approved') return 'Validé';
    if (s === 'rejected') return 'Refusé';
    if (s === 'pending') return 'En attente de validation';
    return partner ? (partner.status || '—') : '—';
  }, [partner]);

  const payoutLabel = useMemo(() => {
    const s = String(partner?.payout_status || '').toLowerCase();
    if (!partner) return '—';
    if (!s) return '—';
    if (s === 'complete') return 'Activés';
    if (s === 'incomplete') return 'À activer';
    return partner.payout_status || '—';
  }, [partner]);

  useEffect(() => {
    const init = async () => {
      if (!session?.access_token) {
        toast({
          title: 'Connexion requise',
          description: 'Connecte-toi pour accéder à ta boutique.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      setLoading(true);
      try {
        const allowed = await canUserAccess(profile, 'marketplace', 'create_shop');
        if (!allowed) {
          toast({
            title: 'Accès refusé',
            description: 'La création de boutique est réservée aux VIP.',
            variant: 'destructive',
          });
          navigate('/forfaits');
          return;
        }

        const res = await fetch(`${apiBaseUrl}/api/market/partners/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement boutique');

        const me = data?.partner || null;
        setPartner(me);
        if (me) {
          setForm({
            display_name: me.display_name || '',
            description: me.description || '',
            category: me.category || '',
            logo_url: me.logo_url || '',
            phone: me.phone || '',
            whatsapp: me.whatsapp || '',
            address: me.address || '',
            hours: me.hours || '',
          });
        }
      } catch (e) {
        toast({
          title: 'Erreur',
          description: e?.message || 'Impossible de charger ta boutique',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate, profile, serverUrl, session?.access_token, toast]);

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleUploadLogo = async (file) => {
    if (!file) return;
    if (!session?.access_token) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'partenaires');
      fd.append('recordId', user?.id || profile?.id || '');

      const res = await fetch(`${apiBaseUrl}/api/upload`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || "Échec de l'upload");
      if (!data?.url) throw new Error('URL upload manquante');

      setForm((prev) => ({ ...prev, logo_url: data.url }));
      toast({ title: 'Logo mis à jour', description: 'Image uploadée avec succès.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'uploader l'image", variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const reloadPartner = async () => {
    if (!session?.access_token) return;
    const res = await fetch(`${apiBaseUrl}/api/market/partners/me`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Erreur chargement boutique');
    const me = data?.partner || null;
    setPartner(me);
  };

  const handleConnectOnboarding = async () => {
    if (!partner?.id) return;
    if (!session?.access_token) return;
    if (connecting) return;

    setConnecting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/partner/connect/onboarding-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ partnerId: partner.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur Stripe Connect');
      if (!data?.url) throw new Error('URL Stripe manquante');

      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de démarrer Stripe Connect', variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncPayoutStatus = async () => {
    if (!partner?.id) return;
    if (!session?.access_token) return;
    if (syncing) return;

    setSyncing(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/partner/connect/sync-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ partnerId: partner.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur sync Stripe');

      await reloadPartner();
      toast({ title: 'Statut mis à jour', description: 'Le statut de paiement a été rafraîchi.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de synchroniser le statut', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.access_token) return;
    if (saving) return;

    const payload = {
      display_name: String(form.display_name || '').trim(),
      description: String(form.description || '').trim(),
      category: String(form.category || '').trim(),
      logo_url: String(form.logo_url || '').trim(),
      phone: form.phone,
      whatsapp: form.whatsapp,
      address: form.address,
      hours: form.hours,
    };

    if (!payload.display_name || !payload.description || !payload.category || !payload.logo_url) {
      toast({
        title: 'Champs requis',
        description: 'Nom, description, catégorie et logo sont obligatoires.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (!partner?.id) {
        const res = await fetch(`${apiBaseUrl}/api/market/partners`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur création boutique');

        toast({ title: 'Boutique créée', description: 'Ta boutique est en attente de validation.' });
        navigate('/marketplace');
        return;
      }

      const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour boutique');

      toast({ title: 'Boutique mise à jour', description: 'Modifications enregistrées.' });
      navigate('/marketplace');
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-gray-600">Chargement…</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Ma boutique - Marketplace - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#2BA84A]">Ma boutique</h1>
          <Button variant="outline" onClick={() => navigate('/marketplace')} className="shrink-0">
            Retour marketplace
          </Button>
        </div>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold">Statut</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm text-gray-700 space-y-2">
              <div className="space-y-1">
                <div>
                  <span className="text-gray-600">Validation : </span>
                  <span>{statusLabel}</span>
                </div>
                <div>
                  <span className="text-gray-600">Paiements : </span>
                  <span>{payoutLabel}</span>
                </div>
              </div>

              {partner?.id ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleConnectOnboarding}
                    disabled={connecting}
                    className="w-full"
                  >
                    {connecting ? 'Redirection…' : 'Activer mes paiements'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSyncPayoutStatus}
                    disabled={syncing}
                    className="w-full"
                  >
                    {syncing ? 'Vérification…' : 'Vérifier le statut'}
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base font-semibold">Informations boutique</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {partner?.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/marketplace/ma-boutique/produits')}
                  className="w-full"
                >
                  Gérer mes produits
                </Button>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="display_name">Nom</Label>
                <Input id="display_name" value={form.display_name} onChange={onChange('display_name')} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={onChange('description')} rows={4} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Catégorie</Label>
                <select
                  id="category"
                  value={form.category}
                  onChange={onChange('category')}
                  className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                  required
                >
                  <option value="" disabled>
                    Sélectionner une catégorie
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                {form.logo_url ? (
                  <img alt="Logo boutique" src={form.logo_url} className="h-24 w-24 rounded-md object-cover border" />
                ) : (
                  <div className="text-sm text-gray-600">Aucun logo</div>
                )}

                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => handleUploadLogo(e.target.files?.[0] || null)}
                />
                <div className="text-xs text-gray-500">Le logo est obligatoire.</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" value={form.phone} onChange={onChange('phone')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" value={form.whatsapp} onChange={onChange('whatsapp')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" value={form.address} onChange={onChange('address')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">Horaires</Label>
                <Textarea
                  id="hours"
                  value={form.hours}
                  onChange={onChange('hours')}
                  rows={3}
                  placeholder="Ex:\nLundi: 10h-20h\nMardi: 10h-20h\nMercredi: fermé"
                />
              </div>

              <Button type="submit" disabled={saving || uploading} className="w-full">
                {partner?.id ? (saving ? 'Enregistrement…' : 'Enregistrer') : saving ? 'Création…' : 'Créer ma boutique'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </>
  );
};

export default MarketplaceMyShop;
