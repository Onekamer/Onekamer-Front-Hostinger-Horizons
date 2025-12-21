import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'standard', label: 'Standard' },
  { value: 'vip', label: 'VIP' },
];

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'qrcode_verif', label: 'QRCode_Verif' },
];

const normalizeRole = (role) => {
  const v = String(role || '').trim().toLowerCase();
  if (v === 'admin') return 'admin';
  if (v === 'user') return 'user';
  if (v === 'qrcode_verif') return 'qrcode_verif';
  return 'user';
};

const normalizePlan = (plan) => {
  const v = String(plan || '').trim().toLowerCase();
  if (['free', 'standard', 'vip'].includes(v)) return v;
  return 'free';
};

const AdminUsers = () => {
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = useMemo(() => {
    return (
      profile?.is_admin === true ||
      profile?.is_admin === 1 ||
      profile?.is_admin === 'true' ||
      String(profile?.role || '').toLowerCase() === 'admin'
    );
  }, [profile]);

  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  const API_PREFIX = import.meta.env.VITE_API_URL || '/api';

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [items, setItems] = useState([]);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(null);

  const canPrev = offset > 0;
  const canNext = total == null ? items.length === limit : offset + limit < total;

  const getFreshAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error('Session expirée');
    const token = data?.session?.access_token;
    if (!token) throw new Error('Session expirée');
    return token;
  };

  const fetchUsers = async (opts = {}) => {
    try {
      setLoading(true);
      const token = await getFreshAccessToken();
      if (!API_PREFIX) throw new Error('API non configurée');

      const qs = new URLSearchParams();
      const q = String(opts.search ?? search).trim();
      const nextOffset = typeof opts.offset === 'number' ? opts.offset : offset;
      qs.set('limit', String(limit));
      qs.set('offset', String(nextOffset));
      if (q) qs.set('search', q);

      const res = await fetch(`${API_PREFIX}/admin/users?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        toast({ title: 'Session expirée', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
        navigate('/auth');
        return;
      }

      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

      const rows = Array.isArray(data?.items) ? data.items : [];
      setItems(
        rows.map((r) => ({
          ...r,
          planDraft: normalizePlan(r.plan),
          roleDraft: normalizeRole(r.role),
        }))
      );
      setTotal(typeof data?.total === 'number' ? data.total : null);
      if (typeof opts.offset === 'number') setOffset(opts.offset);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
      setItems([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchUsers({ offset: 0 });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onSave = async (row) => {
    try {
      const token = await getFreshAccessToken();
      if (!API_PREFIX) throw new Error('API non configurée');

      setSubmittingId(row.id);

      const payload = {
        plan: row.planDraft,
        role: row.roleDraft,
      };

      const res = await fetch(`${API_PREFIX}/admin/users/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        toast({ title: 'Session expirée', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
        navigate('/auth');
        return;
      }

      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

      const updated = data?.item;
      if (!updated?.id) throw new Error('Réponse serveur invalide');

      toast({ title: 'Succès', description: 'Utilisateur mis à jour.' });

      setItems((prev) =>
        prev.map((it) => {
          if (String(it.id) !== String(updated.id)) return it;
          return {
            ...it,
            ...updated,
            planDraft: normalizePlan(updated.plan),
            roleDraft: normalizeRole(updated.role),
          };
        })
      );
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
    } finally {
      setSubmittingId(null);
    }
  };

  const totalLabel = useMemo(() => {
    if (typeof total === 'number') return `${total} utilisateur(s)`;
    return `${items.length} utilisateur(s)`;
  }, [total, items.length]);

  return (
    <>
      <Helmet>
        <title>Admin — Utilisateurs - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Admin — Utilisateurs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Recherche</div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par username, nom complet ou email"
              />
              <div className="text-xs text-gray-500">{totalLabel}</div>
            </div>

            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-600">Aucun utilisateur trouvé.</div>
            ) : (
              <div className="space-y-3">
                {items.map((row) => (
                  <div key={row.id} className="border rounded p-3 space-y-3">
                    <div className="space-y-1">
                      <div className="font-semibold">{row.username || row.full_name || row.id}</div>
                      <div className="text-xs text-gray-600 break-all">{row.email || '—'}</div>
                      <div className="text-xs text-gray-500">ID: {row.id}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-600">Plan</div>
                        <Select
                          value={row.planDraft}
                          onValueChange={(v) => {
                            setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, planDraft: v } : it)));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-gray-600">Rôle</div>
                        <Select
                          value={row.roleDraft}
                          onValueChange={(v) => {
                            setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, roleDraft: v } : it)));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Rôle" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        className="w-full sm:w-auto"
                        disabled={submittingId === row.id}
                        onClick={() => onSave(row)}
                      >
                        {submittingId === row.id ? 'Enregistrement…' : 'Enregistrer'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && items.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canPrev}
                  onClick={() => fetchUsers({ offset: Math.max(offset - limit, 0) })}
                >
                  Précédent
                </Button>

                <div className="text-xs text-gray-500">Page {Math.floor(offset / limit) + 1}</div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!canNext}
                  onClick={() => fetchUsers({ offset: offset + limit })}
                >
                  Suivant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AdminUsers;
