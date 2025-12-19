import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { canUserAccess } from '@/lib/accessControl';

const MarketplaceMyProducts = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { session, profile, user } = useAuth();

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [togglingPublishId, setTogglingPublishId] = useState(null);

  const [partner, setPartner] = useState(null);
  const [items, setItems] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price_eur: '',
    is_available: true,
    is_published: false,
    image_url: '',
  });

  const isEditing = useMemo(() => Boolean(editingId), [editingId]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      title: '',
      description: '',
      price_eur: '',
      is_available: true,
      is_published: false,
      image_url: '',
    });
  };

  const loadAll = async ({ keepForm = true } = {}) => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const allowed = await canUserAccess(profile, 'marketplace', 'create_shop');
      if (!allowed) {
        toast({
          title: 'Accès refusé',
          description: 'La gestion de boutique est réservée aux VIP.',
          variant: 'destructive',
        });
        navigate('/forfaits');
        return;
      }

      const meRes = await fetch(`${apiBaseUrl}/api/market/partners/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const meData = await meRes.json().catch(() => ({}));
      if (!meRes.ok) throw new Error(meData?.error || 'Erreur chargement boutique');
      const me = meData?.partner || null;
      if (!me?.id) {
        toast({
          title: 'Boutique manquante',
          description: 'Crée d’abord ta boutique avant d’ajouter des produits.',
          variant: 'destructive',
        });
        navigate('/marketplace/ma-boutique');
        return;
      }
      setPartner(me);

      const itemsRes = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(me.id)}/items/manage`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const itemsData = await itemsRes.json().catch(() => ({}));
      if (!itemsRes.ok) throw new Error(itemsData?.error || 'Erreur chargement produits');
      setItems(Array.isArray(itemsData?.items) ? itemsData.items : []);

      if (!keepForm) resetForm();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de charger', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (item) => {
    if (!session?.access_token || !partner?.id) return;
    const itemId = item?.id ? String(item.id) : null;
    if (!itemId) return;
    if (togglingPublishId) return;

    const nextPublished = item?.is_published !== true;
    setTogglingPublishId(itemId);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/items/${encodeURIComponent(itemId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ is_published: nextPublished }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur publication produit');
      toast({
        title: nextPublished ? 'Publié' : 'Brouillon',
        description: nextPublished ? 'Le produit est visible dans ta boutique.' : 'Le produit est caché de ta boutique.',
      });
      await loadAll({ keepForm: true });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de mettre à jour', variant: 'destructive' });
    } finally {
      setTogglingPublishId(null);
    }
  };

  useEffect(() => {
    if (!session?.access_token) {
      navigate('/auth');
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const onChange = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const onToggle = (key) => (next) => setForm((p) => ({ ...p, [key]: Boolean(next) }));

  const startEdit = (item) => {
    const eur = Number(item?.base_price_amount || 0) / 100;
    const media = item?.media && typeof item.media === 'object' ? item.media : {};
    const imageUrl = media?.image_url || '';

    setEditingId(String(item.id));
    setForm({
      title: item?.title || '',
      description: item?.description || '',
      price_eur: String(Number.isFinite(eur) ? eur : ''),
      is_available: item?.is_available !== false,
      is_published: item?.is_published === true,
      image_url: imageUrl,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadImage = async (file) => {
    if (!file) return;
    if (!session?.access_token) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'marketplace_items');
      fd.append('recordId', partner?.id || user?.id || profile?.id || '');

      const res = await fetch(`${apiBaseUrl}/api/upload`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || "Échec de l'upload");
      if (!data?.url) throw new Error('URL upload manquante');

      setForm((p) => ({ ...p, image_url: data.url }));
      toast({ title: 'Image ajoutée', description: 'Image uploadée avec succès.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'uploader l'image", variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!session?.access_token || !partner?.id) return;
    if (saving) return;

    const title = String(form.title || '').trim();
    const description = String(form.description || '').trim();
    const priceNum = Number(String(form.price_eur || '').replace(',', '.'));

    if (!title) {
      toast({ title: 'Titre requis', description: 'Indique le nom du produit.', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast({ title: 'Prix invalide', description: 'Indique un prix valide.', variant: 'destructive' });
      return;
    }

    const payload = {
      type: 'product',
      title,
      description: description || null,
      base_price_amount: Math.round(priceNum * 100),
      is_available: form.is_available === true,
      is_published: form.is_published === true,
      media: form.image_url ? { image_url: form.image_url } : null,
    };

    setSaving(true);
    try {
      if (!isEditing) {
        const res = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur création produit');
        toast({ title: 'Produit créé', description: 'Produit enregistré.' });
      } else {
        const res = await fetch(
          `${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/items/${encodeURIComponent(editingId)}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour produit');
        toast({ title: 'Produit mis à jour', description: 'Modifications enregistrées.' });
      }

      await loadAll({ keepForm: false });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de sauvegarder', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!session?.access_token || !partner?.id) return;
    const ok = window.confirm('Supprimer ce produit ?');
    if (!ok) return;

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/market/partners/${encodeURIComponent(partner.id)}/items/${encodeURIComponent(itemId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur suppression produit');
      toast({ title: 'Supprimé', description: 'Produit supprimé.' });
      await loadAll({ keepForm: true });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de supprimer', variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet>
        <title>Mes produits - Marketplace - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#2BA84A]">Mes produits</h1>
          <Button variant="outline" onClick={() => navigate('/marketplace/ma-boutique')} className="shrink-0">
            Retour
          </Button>
        </div>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold">{isEditing ? 'Modifier un produit' : 'Ajouter un produit'}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Nom du produit</Label>
                <Input id="title" value={form.title} onChange={onChange('title')} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={onChange('description')} rows={3} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Prix (€)</Label>
                <Input
                  id="price"
                  value={form.price_eur}
                  onChange={onChange('price_eur')}
                  placeholder="Ex: 12.5"
                  inputMode="decimal"
                />
              </div>

              <div className="space-y-2">
                <Label>Image produit</Label>
                {form.image_url ? (
                  <img alt="Image produit" src={form.image_url} className="h-24 w-24 rounded-md object-cover border" />
                ) : (
                  <div className="text-sm text-gray-600">Aucune image</div>
                )}
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => handleUploadImage(e.target.files?.[0] || null)}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_available} onCheckedChange={onToggle('is_available')} />
                  <span className="text-sm text-gray-700">Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={form.is_published ? 'outline' : 'default'}
                    onClick={() => setForm((p) => ({ ...p, is_published: false }))}
                  >
                    Brouillon
                  </Button>
                  <Button
                    type="button"
                    variant={form.is_published ? 'default' : 'outline'}
                    onClick={() => setForm((p) => ({ ...p, is_published: true }))}
                  >
                    Publier
                  </Button>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Un produit doit être <span className="font-semibold">Publié</span> pour apparaître dans ta boutique.
              </div>

              <div className="flex flex-col gap-2">
                <Button type="submit" disabled={saving || uploading} className="w-full">
                  {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer' : 'Créer'}
                </Button>
                {isEditing ? (
                  <Button type="button" variant="outline" onClick={resetForm} className="w-full">
                    Annuler l’édition
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-base font-semibold">Liste</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="text-gray-600">Chargement…</div>
            ) : items.length === 0 ? (
              <div className="text-gray-600">Aucun produit.</div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => {
                  const eur = Number(it?.base_price_amount || 0) / 100;
                  const media = it?.media && typeof it.media === 'object' ? it.media : {};
                  const imageUrl = media?.image_url || '';
                  return (
                    <div key={it.id} className="border rounded-md p-3 flex items-start gap-3">
                      {imageUrl ? (
                        <img alt="Produit" src={imageUrl} className="h-12 w-12 rounded-md object-cover border shrink-0" />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-sm truncate">{it.title || 'Produit'}</div>
                          <div className="text-sm font-semibold text-gray-800">
                            {Number.isFinite(eur) ? eur.toFixed(2) : '0.00'} €
                          </div>
                        </div>
                        {it.description ? <div className="text-xs text-gray-600 line-clamp-2">{it.description}</div> : null}
                        <div className="text-xs text-gray-500 mt-1">
                          {it.is_published ? 'Publié' : 'Brouillon'} • {it.is_available ? 'Disponible' : 'Indisponible'}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button type="button" variant="outline" onClick={() => startEdit(it)}>
                            Modifier
                          </Button>
                          <Button
                            type="button"
                            variant={it.is_published ? 'secondary' : 'default'}
                            disabled={String(togglingPublishId || '') === String(it.id || '')}
                            onClick={() => handleTogglePublish(it)}
                          >
                            {String(togglingPublishId || '') === String(it.id || '')
                              ? '…'
                              : it.is_published
                                ? 'Mettre en brouillon'
                                : 'Publier'}
                          </Button>
                          <Button type="button" variant="destructive" onClick={() => handleDelete(it.id)}>
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MarketplaceMyProducts;
