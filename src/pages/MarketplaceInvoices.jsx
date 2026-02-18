import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const formatMoney = (cents, currency) => `${(Number(cents || 0) / 100).toFixed(2)} ${String(currency || 'EUR').toUpperCase()}`;

const MarketplaceInvoices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const headers = useMemo(() => {
    const h = { 'Content-Type': 'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);

  const [billingLoading, setBillingLoading] = useState(true);
  const [form, setForm] = useState({
    vat_number: '',
    vat_validation_status: '',
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_postcode: '',
    billing_region: '',
    billing_country_code: '',
    billing_email: '',
  });
  const [shopAddress, setShopAddress] = useState('');
  const [sameAsShop, setSameAsShop] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      if (!session?.access_token) { setInvoices([]); return; }
      const res = await fetch(`${apiBaseUrl}/api/market/me/invoices?limit=50`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement des factures');
      setInvoices(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de charger vos factures.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, headers, session?.access_token, toast]);

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      if (!session?.access_token) return;
      const res = await fetch(`${apiBaseUrl}/api/market/me/billing`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement infos facturation');
      const next = { ...form };
      next.vat_number = data?.vat?.number || '';
      next.vat_validation_status = data?.vat?.validation_status || '';
      next.billing_address_line1 = data?.billing?.address_line1 || '';
      next.billing_address_line2 = data?.billing?.address_line2 || '';
      next.billing_city = data?.billing?.city || '';
      next.billing_postcode = data?.billing?.postcode || '';
      next.billing_region = data?.billing?.region || '';
      next.billing_country_code = data?.billing?.country_code || '';
      next.billing_email = data?.billing?.email || '';
      setForm(next);
      setShopAddress(String(data?.shop_address || ''));
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de charger vos paramètres de facturation.', variant: 'destructive' });
    } finally {
      setBillingLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, headers, session?.access_token]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);
  useEffect(() => { loadBilling(); }, [loadBilling]);

  const downloadPdf = async (invoiceId) => {
    if (!invoiceId) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/market/me/invoices/${encodeURIComponent(invoiceId)}/pdf`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Lien PDF indisponible');
      window.open(data.url, '_blank');
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de télécharger la facture', variant: 'destructive' });
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const applyShopAddress = () => {
    setSameAsShop(true);
    if (shopAddress) setForm((prev) => ({ ...prev, billing_address_line1: shopAddress }));
  };

  const saveBilling = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      const res = await fetch(`${apiBaseUrl}/api/market/me/billing`, { method: 'PUT', headers, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Enregistrement impossible');
      toast({ title: 'Enregistré', description: 'Paramètres de facturation mis à jour.' });
      await loadBilling();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Mise à jour impossible.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet><title>Mes factures - OneKamer.co</title></Helmet>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#2BA84A]">Mes factures</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/marketplace/ma-boutique')}>Ma boutique</Button>
            <Button variant="outline" onClick={() => navigate('/marketplace')}>Retour marketplace</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Historique des factures</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-gray-600">Chargement…</div>
            ) : (Array.isArray(invoices) ? invoices : []).length === 0 ? (
              <div className="text-gray-600">Aucune facture pour le moment.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {invoices.map((inv) => (
                  <Card key={inv.id} className="border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="space-y-1">
                          <div className="font-semibold">{inv.number || '—'}</div>
                          <div className="text-gray-600">Période: {inv.period_start} → {inv.period_end}</div>
                          <div className="text-gray-600">Émise le: {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString('fr-FR') : '—'}</div>
                        </div>
                        <div className="text-right space-y-1">
                          <div>Total HT: {formatMoney(inv.total_ht, inv.currency)}</div>
                          <div>TVA: {formatMoney(inv.total_tva, inv.currency)}</div>
                          <div className="font-semibold">TTC: {formatMoney(inv.total_ttc, inv.currency)}</div>
                          <Button className="w-full mt-2" onClick={() => downloadPdf(inv.id)}>Télécharger le PDF</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paramètres de facturation</CardTitle>
          </CardHeader>
          <CardContent>
            {billingLoading ? (
              <div className="text-gray-600">Chargement…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="vat_number">Numéro de TVA</Label>
                    <Input id="vat_number" name="vat_number" value={form.vat_number} onChange={onChange} placeholder="FR12345678901" />
                  </div>
                  <div>
                    <Label htmlFor="vat_validation_status">Statut TVA</Label>
                    <select id="vat_validation_status" name="vat_validation_status" value={form.vat_validation_status || ''} onChange={onChange} className="w-full border rounded px-3 py-2 text-sm">
                      <option value="">—</option>
                      <option value="valid">Valide</option>
                      <option value="invalid">Invalide</option>
                      <option value="unchecked">Non vérifié</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="billing_country_code">Pays (code ISO à 2 lettres)</Label>
                    <Input id="billing_country_code" name="billing_country_code" value={form.billing_country_code} onChange={onChange} placeholder="FR" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox id="sameAsShop" checked={sameAsShop} onCheckedChange={(v) => { setSameAsShop(Boolean(v)); if (v) applyShopAddress(); }} />
                    <Label htmlFor="sameAsShop">Utiliser l'adresse de la boutique</Label>
                  </div>
                  <div>
                    <Label htmlFor="billing_address_line1">Adresse (ligne 1)</Label>
                    <Input id="billing_address_line1" name="billing_address_line1" value={form.billing_address_line1} onChange={onChange} />
                  </div>
                  <div>
                    <Label htmlFor="billing_address_line2">Adresse (ligne 2)</Label>
                    <Input id="billing_address_line2" name="billing_address_line2" value={form.billing_address_line2} onChange={onChange} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="billing_postcode">Code postal</Label>
                      <Input id="billing_postcode" name="billing_postcode" value={form.billing_postcode} onChange={onChange} />
                    </div>
                    <div>
                      <Label htmlFor="billing_city">Ville</Label>
                      <Input id="billing_city" name="billing_city" value={form.billing_city} onChange={onChange} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="billing_region">Région</Label>
                    <Input id="billing_region" name="billing_region" value={form.billing_region} onChange={onChange} />
                  </div>
                  <div>
                    <Label htmlFor="billing_email">Email de facturation</Label>
                    <Input id="billing_email" name="billing_email" type="email" value={form.billing_email} onChange={onChange} placeholder="facturation@exemple.com" />
                  </div>
                </div>
                <div className="md:col-span-2 pt-2">
                  <Button onClick={saveBilling} disabled={saving} className="w-full md:w-auto">Enregistrer</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MarketplaceInvoices;
