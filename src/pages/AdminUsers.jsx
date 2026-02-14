import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const { user, profile, session, onlineUserIds } = useAuth();
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
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(null);

  const canPrev = offset > 0;
  const canNext = total == null ? items.length === limit : offset + limit < total;

  // Badges communauté (admin)
  const [badges, setBadges] = useState([]);
  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [badgeTarget, setBadgeTarget] = useState(null);
  const [badgeSelected, setBadgeSelected] = useState(new Set());
  const [badgeLoading, setBadgeLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('badges')
          .select('id, name, code, icon, icon_url, description, is_special, created_at')
          .order('created_at', { ascending: true });
        if (!error && Array.isArray(data)) {
          // Exclure le badge automatique "Nouveau membre"
          setBadges(data.filter((b) => String(b.code || '').toLowerCase() !== 'new_member'));
        } else {
          setBadges([]);
        }
      } catch {
        setBadges([]);
      }
    })();
  }, []);

  const openBadgeDialog = async (row) => {
    setBadgeTarget(row);
    setBadgeDialogOpen(true);
    setBadgeLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', row.id);
      if (!error && Array.isArray(data)) {
        const ids = new Set(data.map((r) => r.badge_id).filter(Boolean));
        setBadgeSelected(ids);
      } else {
        setBadgeSelected(new Set());
      }
    } catch {
      setBadgeSelected(new Set());
    } finally {
      setBadgeLoading(false);
    }
  };

  const toggleBadge = (badgeId) => {
    setBadgeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(badgeId)) next.delete(badgeId);
      else next.add(badgeId);
      return next;
    });
  };

  const saveBadges = async () => {
    if (!badgeTarget?.id) { setBadgeDialogOpen(false); return; }
    setBadgeLoading(true);
    try {
      const { data: currentRows } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', badgeTarget.id);
      const current = new Set((currentRows || []).map((r) => r.badge_id).filter(Boolean));
      const want = new Set(badgeSelected);

      const toAdd = Array.from(want).filter((id) => !current.has(id));
      const toRemove = Array.from(current).filter((id) => !want.has(id));

      if (toAdd.length) {
        const rows = toAdd.map((id) => ({ user_id: badgeTarget.id, badge_id: id, awarded_by: user?.id || null }));
        const { error: e1 } = await supabase.from('user_badges').insert(rows);
        if (e1) throw e1;
      }
      if (toRemove.length) {
        const { error: e2 } = await supabase
          .from('user_badges')
          .delete()
          .eq('user_id', badgeTarget.id)
          .in('badge_id', toRemove);
        if (e2) throw e2;
      }

      toast({ title: 'Badges mis à jour' });
      setBadgeDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de mettre à jour les badges.' });
    } finally {
      setBadgeLoading(false);
    }
  };

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
    fetchUsers({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

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

  const isRowOnline = (row) => {
    const visible = row?.show_online_status !== false;
    if (!visible) return false;
    const uid = row?.id ? String(row.id) : null;
    return Boolean(uid && onlineUserIds instanceof Set && onlineUserIds.has(uid));
  };

  const getStatusLabel = (row) => {
    const visible = row?.show_online_status !== false;
    if (!visible) return 'Hors ligne';
    if (isRowOnline(row)) return 'En ligne';
    if (row?.last_seen_at) {
      try {
        return `Vu ${formatDistanceToNow(new Date(row.last_seen_at), { addSuffix: true, locale: fr })}`;
      } catch {
        return 'Hors ligne';
      }
    }
    return 'Hors ligne';
  };

  const filteredItems = useMemo(() => {
    const plan = String(planFilter || 'all');
    const status = String(statusFilter || 'all');
    return (items || []).filter((row) => {
      if (plan !== 'all') {
        const p = normalizePlan(row?.plan);
        if (p !== plan) return false;
      }
      if (status !== 'all') {
        const online = isRowOnline(row);
        if (status === 'online' && !online) return false;
        if (status === 'offline' && online) return false;
      }
      return true;
    });
  }, [items, planFilter, statusFilter, onlineUserIds]);

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
              <div className="text-xs text-gray-500">{filteredItems.length} affiché(s) — {totalLabel}</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-gray-600">Plan</div>
                <Select value={planFilter} onValueChange={(v) => setPlanFilter(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {PLAN_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-gray-600">Statut</div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="online">En ligne</SelectItem>
                    <SelectItem value="offline">Hors ligne</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-gray-600">Afficher</div>
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v) || 20)}>
                  <SelectTrigger>
                    <SelectValue placeholder="20" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-sm text-gray-600">Aucun utilisateur trouvé.</div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((row) => (
                  <div key={row.id} className="border rounded p-3 space-y-3">
                    <div className="space-y-1">
                      <div className="font-semibold">{row.username || row.full_name || row.id}</div>
                      <div className="text-xs text-gray-600 break-all">{row.email || '—'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${isRowOnline(row) ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span>{getStatusLabel(row)}</span>
                      </div>
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

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => openBadgeDialog(row)}
                      >
                        Badges
                      </Button>
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
        <Dialog open={badgeDialogOpen} onOpenChange={setBadgeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Badges — {badgeTarget?.username || badgeTarget?.email || badgeTarget?.id || ''}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-72 overflow-auto">
              {badgeLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-[#2BA84A]" /></div>
              ) : badges.length === 0 ? (
                <div className="text-sm text-gray-500">Aucun badge configuré.</div>
              ) : (
                badges.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={badgeSelected.has(b.id)} onCheckedChange={() => toggleBadge(b.id)} />
                    {b.icon ? <span className="text-base">{b.icon}</span> : (b.icon_url ? <img src={b.icon_url} alt={b.name} className="h-4 w-4" /> : null)}
                    <span className="font-medium">{b.name || b.code}</span>
                    {b.description && <span className="text-gray-500">— {b.description}</span>}
                  </label>
                ))
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setBadgeDialogOpen(false)}>Annuler</Button>
              <Button type="button" onClick={saveBadges} disabled={badgeLoading}>{badgeLoading ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default AdminUsers;
