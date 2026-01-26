import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-2 rounded-md text-sm font-medium border ${active ? 'bg-[#2BA84A] text-white border-[#2BA84A]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
  >
    {children}
  </button>
);

const StatusPill = ({ status }) => {
  const color = status === 'new' ? 'bg-yellow-100 text-yellow-800'
    : status === 'in_review' ? 'bg-blue-100 text-blue-800'
    : status === 'resolved' ? 'bg-green-100 text-green-800'
    : status === 'open' ? 'bg-red-100 text-red-800'
    : status === 'closed' ? 'bg-green-100 text-green-800'
    : 'bg-gray-100 text-gray-800';
  return <span className={`inline-block px-2 py-0.5 rounded text-xs ${color}`}>{status}</span>;
};

const SupportAdmin = () => {
  const { session } = useAuth();
  const { toast } = useToast();

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const [tab, setTab] = useState('requests'); // requests | shop | deletions

  // Support requests
  const [reqType, setReqType] = useState('report'); // report | feedback | suggestion
  const [reqStatus, setReqStatus] = useState(''); // new | in_review | resolved | ''
  const [reqLoading, setReqLoading] = useState(false);
  const [requests, setRequests] = useState([]);

  // Shop reports
  const [shopStatus, setShopStatus] = useState('open'); // open | closed | ''
  const [shopLoading, setShopLoading] = useState(false);
  const [shopReports, setShopReports] = useState([]);

  // Account deletions
  const [delLoading, setDelLoading] = useState(false);
  const [deletions, setDeletions] = useState([]);

  const displayUser = (username, email, uid) => {
    const parts = [];
    if (username) parts.push(`@${username}`);
    if (email) parts.push(email);
    const text = parts.length ? parts.join(' • ') : (uid || '—');
    return text;
  };

  const authHeaders = useMemo(() => ({
    Authorization: session?.access_token ? `Bearer ${session.access_token}` : undefined,
    'Content-Type': 'application/json',
  }), [session?.access_token]);

  const loadRequests = async () => {
    if (!session?.access_token) return;
    setReqLoading(true);
    try {
      const qs = new URLSearchParams();
      if (reqType) qs.set('type', reqType);
      if (reqStatus) qs.set('status', reqStatus);
      const res = await fetch(`${apiBaseUrl}/api/admin/support/requests?${qs.toString()}`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur lecture support');
      setRequests(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Chargement support échoué' });
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  };

  const softDeleteUser = async (userId) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/users/${encodeURIComponent(userId)}/soft-delete`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Suppression échouée');
      toast({ title: 'Compte supprimé', description: data?.email_notice ? 'Un e-mail de confirmation a été envoyé.' : undefined });
      loadDeletions();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de supprimer le compte' });
    }
  };

  const loadShopReports = async () => {
    if (!session?.access_token) return;
    setShopLoading(true);
    try {
      const qs = new URLSearchParams();
      if (shopStatus) qs.set('status', shopStatus);
      const res = await fetch(`${apiBaseUrl}/api/admin/shop-reports?${qs.toString()}`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur lecture signalements boutiques');
      setShopReports(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Chargement signalements échoué' });
      setShopReports([]);
    } finally {
      setShopLoading(false);
    }
  };

  const loadDeletions = async () => {
    if (!session?.access_token) return;
    setDelLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/account-deletions`, { headers: authHeaders });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur lecture suppressions de compte');
      setDeletions(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Chargement suppressions échoué' });
      setDeletions([]);
    } finally {
      setDelLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'requests') loadRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reqType, reqStatus]);

  useEffect(() => {
    if (tab === 'shop') loadShopReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, shopStatus]);

  useEffect(() => {
    if (tab === 'deletions') loadDeletions();
  }, [tab]);

  const updateRequestStatus = async (id, status) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/support/requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Mise à jour échouée');
      toast({ title: 'Statut mis à jour' });
      loadRequests();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de mettre à jour' });
    }
  };

  const updateShopReportStatus = async (id, status) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/shop-reports/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Mise à jour échouée');
      toast({ title: 'Statut mis à jour' });
      loadShopReports();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de mettre à jour' });
    }
  };

  return (
    <>
      <Helmet>
        <title>Centre d'aide (Admin) - OneKamer</title>
      </Helmet>
      <div className="max-w-5xl mx-auto py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Centre d'aide (Admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <TabButton active={tab==='requests'} onClick={() => setTab('requests')}>Signalements & Feedback</TabButton>
              <TabButton active={tab==='shop'} onClick={() => setTab('shop')}>Signalements boutiques</TabButton>
              <TabButton active={tab==='deletions'} onClick={() => setTab('deletions')}>Suppressions de compte</TabButton>
            </div>

            {tab === 'requests' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">Type:</span>
                  <TabButton active={reqType==='report'} onClick={() => setReqType('report')}>Report</TabButton>
                  <TabButton active={reqType==='feedback'} onClick={() => setReqType('feedback')}>Feedback</TabButton>
                  <TabButton active={reqType==='suggestion'} onClick={() => setReqType('suggestion')}>Suggestion</TabButton>
                  <span className="ml-4 text-sm text-gray-600">Statut:</span>
                  <TabButton active={reqStatus===''} onClick={() => setReqStatus('')}>Tous</TabButton>
                  <TabButton active={reqStatus==='new'} onClick={() => setReqStatus('new')}>Nouveau</TabButton>
                  <TabButton active={reqStatus==='in_review'} onClick={() => setReqStatus('in_review')}>En cours</TabButton>
                  <TabButton active={reqStatus==='resolved'} onClick={() => setReqStatus('resolved')}>Résolu</TabButton>
                </div>

                <div className="border rounded divide-y">
                  {reqLoading ? (
                    <div className="p-3 text-sm text-gray-500">Chargement…</div>
                  ) : requests.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">Aucun élément</div>
                  ) : (
                    requests.map((r) => (
                      <div key={r.id} className="p-3 text-sm flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.type}</div>
                          <StatusPill status={r.status} />
                        </div>
                        {r.category && <div className="text-gray-600">Catégorie: {r.category}</div>}
                        <div className="text-gray-800 whitespace-pre-wrap">{r.message}</div>
                        <div className="text-xs text-gray-500">
                          Auteur: {displayUser(r.user_username, r.user_email, r.user_id)}
                          {r.target_user_id ? (
                            <>
                              {` → cible: `}
                              {displayUser(r.target_username, r.target_email, r.target_user_id)}
                            </>
                          ) : null}
                        </div>
                        <div className="pt-2 flex gap-2">
                          {r.status !== 'in_review' && <Button variant="outline" size="sm" onClick={() => updateRequestStatus(r.id, 'in_review')}>Marquer en cours</Button>}
                          {r.status !== 'resolved' && <Button size="sm" onClick={() => updateRequestStatus(r.id, 'resolved')}>Résoudre</Button>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'shop' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">Statut:</span>
                  <TabButton active={shopStatus==='open'} onClick={() => setShopStatus('open')}>Ouverts</TabButton>
                  <TabButton active={shopStatus==='closed'} onClick={() => setShopStatus('closed')}>Fermés</TabButton>
                </div>
                <div className="border rounded divide-y">
                  {shopLoading ? (
                    <div className="p-3 text-sm text-gray-500">Chargement…</div>
                  ) : shopReports.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">Aucun élément</div>
                  ) : (
                    shopReports.map((r) => (
                      <div key={r.id} className="p-3 text-sm flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Boutique: {r.shop_id}</div>
                          <StatusPill status={r.status} />
                        </div>
                        <div className="text-gray-600">Raison: {r.reason || '—'}</div>
                        {r.details && <div className="text-gray-800 whitespace-pre-wrap">{r.details}</div>}
                        <div className="text-xs text-gray-500">Reporter: {displayUser(r.reporter_username, r.reporter_email, r.reporter_id)}</div>
                        <div className="pt-2 flex gap-2">
                          {r.status !== 'closed' && <Button size="sm" onClick={() => updateShopReportStatus(r.id, 'closed')}>Clore</Button>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'deletions' && (
              <div className="space-y-4">
                <div className="border rounded divide-y">
                  {delLoading ? (
                    <div className="p-3 text-sm text-gray-500">Chargement…</div>
                  ) : deletions.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">Aucun élément</div>
                  ) : (
                    deletions.map((d) => (
                      <div key={d.id} className="p-3 text-sm flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">Utilisateur: {displayUser(d.username, d.email, d.deleted_user_id)}</div>
                          <div className="text-xs text-gray-500">{new Date(d.created_at).toLocaleString()}</div>
                        </div>
                        <div className="text-gray-800 whitespace-pre-wrap">{d.reason}</div>
                        <div className="flex items-center justify-between pt-2">
                          <div className="text-xs text-gray-500">
                            Statut: {d.is_deleted ? 'supprimé' : 'actif'}{d.deleted_at ? ` • ${new Date(d.deleted_at).toLocaleString()}` : ''}
                          </div>
                          {!d.is_deleted && (
                            <Button size="sm" onClick={() => softDeleteUser(d.deleted_user_id)}>Supprimer le compte</Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default SupportAdmin;
