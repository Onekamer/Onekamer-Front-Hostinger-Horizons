import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';

const STATUS_OPTIONS = [
  { value: 'requested', label: 'Demandés' },
  { value: 'processing', label: 'En cours' },
  { value: 'processed', label: 'Traités' },
  { value: 'refused', label: 'Refusés' },
  { value: 'all', label: 'Tous' },
];

export default function OKCoinsAdminLab() {
  const { session } = useAuth();
  const token = session?.access_token;
  const serverLabUrl = (import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com').replace(/\/$/, '');

  const [status, setStatus] = useState('requested');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [refusing, setRefusing] = useState({ id: null, reason: '' });

  const headers = useMemo(() => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status && status !== 'all') qs.set('status', status);
      if (search) qs.set('search', search);
      qs.set('limit', '20');
      qs.set('offset', '0');

      const res = await fetch(`${serverLabUrl}/api/admin/okcoins/withdrawals?${qs.toString()}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement retraits');
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === 'number' ? data.total : null);
    } catch (e) {
      toast({ title: 'Erreur', description: e.message || 'Chargement impossible', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [token, status, search, headers, serverLabUrl]);

  useEffect(() => { load(); }, [load]);

  const accept = async (id) => {
    if (!token || !id) return;
    setAcceptingId(id);
    try {
      const res = await fetch(`${serverLabUrl}/api/admin/okcoins/withdrawals/${encodeURIComponent(id)}/accept`, {
        method: 'POST', headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Échec acceptation');
      toast({ title: 'Accepté', description: 'Demande passée en cours de traitement.' });
      await load();
    } catch (e) {
      toast({ title: 'Erreur', description: e.message || 'Échec acceptation', variant: 'destructive' });
    } finally { setAcceptingId(null); }
  };

  const markProcessed = async (id) => {
    if (!token || !id) return;
    if (!window.confirm('Confirmer le marquage comme traité ? Le solde sera débité et une ligne de ledger sera créée.')) return;
    setProcessingId(id);
    try {
      const res = await fetch(`${serverLabUrl}/api/admin/okcoins/withdrawals/${encodeURIComponent(id)}/processed`, {
        method: 'POST', headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Échec marquage traité');
      toast({ title: 'Traité', description: 'Retrait marqué comme traité et solde débité.' });
      await load();
    } catch (e) {
      toast({ title: 'Erreur', description: e.message || 'Échec marquage', variant: 'destructive' });
    } finally { setProcessingId(null); }
  };

  const submitRefuse = async () => {
    const id = refusing.id;
    const reason = refusing.reason || '';
    if (!id) return;
    try {
      const res = await fetch(`${serverLabUrl}/api/admin/okcoins/withdrawals/${encodeURIComponent(id)}/refuse`, {
        method: 'POST', headers, body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Échec refus');
      toast({ title: 'Refusé', description: 'La demande a été refusée.' });
      setRefusing({ id: null, reason: '' });
      await load();
    } catch (e) {
      toast({ title: 'Erreur', description: e.message || 'Échec refus', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Retraits OK COINS — Admin</CardTitle>
          <CardDescription>Accepter, refuser ou marquer comme traitées les demandes de retrait.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Statut</label>
              <select className="border rounded px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <Input placeholder="Recherche username/email" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Button onClick={load} disabled={loading}>Rechercher</Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-gray-500">Chargement…</div>
          ) : (
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="text-center text-gray-500">Aucune demande.</div>
              ) : (
                items.map((w) => (
                  <div key={w.id} className="p-3 bg-white rounded border flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-sm">{new Date(w.created_at).toLocaleString('fr-FR')} • <span className="uppercase text-xs text-gray-500">{w.status}</span></div>
                      <div className="text-sm">Utilisateur: <span className="font-medium">{w.username || 'n/a'}</span> <span className="text-gray-500">({w.email || 'sans email'})</span></div>
                      <div className="text-sm">Montant: <span className="font-semibold">{(w.amount || 0).toLocaleString('fr-FR')} 🪙</span> • Solde à la demande: {(w.balance_at_request || 0).toLocaleString('fr-FR')} 🪙</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {w.status === 'requested' && (
                        <>
                          <Button size="sm" variant="default" onClick={() => accept(w.id)} disabled={acceptingId === w.id}>Accepter</Button>
                          <Button size="sm" variant="destructive" onClick={() => setRefusing({ id: w.id, reason: '' })}>Refuser</Button>
                        </>
                      )}
                      {w.status === 'processing' && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setRefusing({ id: w.id, reason: '' })}>Refuser</Button>
                          <Button size="sm" variant="default" onClick={() => markProcessed(w.id)} disabled={processingId === w.id}>Marquer traité</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(refusing.id)} onOpenChange={(isOpen) => { if (!isOpen) setRefusing({ id: null, reason: '' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la demande</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input placeholder="Motif (optionnel)" value={refusing.reason} onChange={(e) => setRefusing((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRefusing({ id: null, reason: '' })}>Annuler</Button>
            <Button variant="destructive" onClick={submitRefuse}>Refuser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
