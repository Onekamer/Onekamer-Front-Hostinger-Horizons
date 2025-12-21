import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const AdminInvitations = () => {
  const { user, profile } = useAuth();
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

  const [period, setPeriod] = useState('30d');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const suggestReqIdRef = useRef(0);
  const searchWrapRef = useRef(null);
  const lastPickedRef = useRef('');

  const canPrev = offset > 0;
  const canNext = count == null ? rows.length === limit : offset + limit < count;

  const getFreshAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error('Session expirée');
    const token = data?.session?.access_token;
    if (!token) throw new Error('Session expirée');
    return token;
  };

  const fetchStats = async (opts = {}) => {
    try {
      setLoading(true);
      const token = await getFreshAccessToken();
      if (!API_PREFIX) throw new Error('API non configurée');

      const qs = new URLSearchParams();
      const q = String(opts.search ?? search).trim();
      const nextOffset = typeof opts.offset === 'number' ? opts.offset : offset;
      const p = String(opts.period ?? period).trim();

      qs.set('period', p);
      qs.set('limit', String(limit));
      qs.set('offset', String(nextOffset));
      if (q) qs.set('search', q);

      const res = await fetch(`${API_PREFIX}/admin/invites/users-stats?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        toast({ title: 'Session expirée', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
        navigate('/auth');
        return;
      }

      if (res.status === 403) {
        navigate('/compte');
        return;
      }

      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setCount(typeof data?.count === 'number' ? data.count : null);
      if (typeof opts.offset === 'number') setOffset(opts.offset);
      if (opts.period) setPeriod(p);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
      setRows([]);
      setCount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchStats({ offset: 0, period });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchStats({ offset: 0, search });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const q = String(search || '').trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      setHighlightIndex(-1);
      return;
    }

    if (q === lastPickedRef.current) {
      setSuggestOpen(false);
      return;
    }

    const myReqId = ++suggestReqIdRef.current;
    const t = setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const token = await getFreshAccessToken();
        const qs = new URLSearchParams();
        qs.set('suggest', '1');
        qs.set('suggest_limit', '10');
        qs.set('search', q);
        const res = await fetch(`${API_PREFIX}/admin/invites/users-stats?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (myReqId !== suggestReqIdRef.current) return;
        if (!res.ok) {
          setSuggestions([]);
          setSuggestOpen(false);
          return;
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        setSuggestions(items);
        setSuggestOpen(items.length > 0);
        setHighlightIndex(-1);
      } catch {
        if (myReqId !== suggestReqIdRef.current) return;
        setSuggestions([]);
        setSuggestOpen(false);
        setHighlightIndex(-1);
      } finally {
        if (myReqId === suggestReqIdRef.current) setSuggestLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const onDocDown = (e) => {
      const el = searchWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target)) {
        setSuggestOpen(false);
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const countLabel = useMemo(() => {
    if (typeof count === 'number') return `${count} utilisateur(s)`;
    return `${rows.length} utilisateur(s)`;
  }, [count, rows.length]);

  const getDisplayName = (r) => {
    const u = String(r?.username || '').trim();
    const e = String(r?.email || '').trim();
    if (u && e) return `${u} — ${e}`;
    if (u) return u;
    if (e) return e;
    return r?.inviter_user_id ? String(r.inviter_user_id) : 'Utilisateur';
  };

  const formatSuggestionLabel = (s) => {
    const u = String(s?.username || '').trim();
    const e = String(s?.email || '').trim();
    if (u && e) return `${u} — ${e}`;
    if (u) return u;
    if (e) return e;
    return s?.id ? String(s.id) : '';
  };

  const applySuggestion = (s) => {
    const value = String(s?.username || s?.email || '').trim();
    if (!value) return;
    lastPickedRef.current = value;
    setSearch(value);
    setSuggestOpen(false);
    setHighlightIndex(-1);
  };

  const onSearchKeyDown = (e) => {
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => {
        const next = prev + 1;
        return next >= suggestions.length ? 0 : next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? suggestions.length - 1 : next;
      });
    } else if (e.key === 'Enter') {
      if (highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        applySuggestion(suggestions[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
      setHighlightIndex(-1);
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin — Invitations - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Admin — Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Période</div>
              <div className="flex gap-2">
                <Button type="button" variant={period === '7d' ? 'default' : 'outline'} onClick={() => setPeriod('7d')}>
                  7 jours
                </Button>
                <Button type="button" variant={period === '30d' ? 'default' : 'outline'} onClick={() => setPeriod('30d')}>
                  30 jours
                </Button>
                <Button type="button" variant={period === 'all' ? 'default' : 'outline'} onClick={() => setPeriod('all')}>
                  Total
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Recherche</div>
              <div className="relative" ref={searchWrapRef}>
                <Input
                  placeholder="Rechercher par username ou email"
                  value={search}
                  onChange={(e) => {
                    lastPickedRef.current = '';
                    setSearch(e.target.value);
                    setSuggestOpen(true);
                  }}
                  onKeyDown={onSearchKeyDown}
                  onFocus={() => {
                    if (suggestions.length > 0) setSuggestOpen(true);
                  }}
                />
                {suggestOpen ? (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-sm">
                    {suggestLoading ? (
                      <div className="px-3 py-2 text-xs text-gray-500">Chargement...</div>
                    ) : suggestions.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500">Aucune suggestion</div>
                    ) : (
                      <div className="max-h-56 overflow-auto py-1">
                        {suggestions.map((s, idx) => (
                          <button
                            key={s.id || idx}
                            type="button"
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                              idx === highlightIndex ? 'bg-gray-100' : ''
                            }`}
                            onMouseEnter={() => setHighlightIndex(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              applySuggestion(s);
                            }}
                          >
                            {formatSuggestionLabel(s)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-gray-500">{countLabel}</div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={!canPrev || loading} onClick={() => fetchStats({ offset: Math.max(offset - limit, 0) })}>
                  Précédent
                </Button>
                <Button type="button" variant="outline" disabled={!canNext || loading} onClick={() => fetchStats({ offset: offset + limit })}>
                  Suivant
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-green-500" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-sm text-gray-500">Aucune donnée.</div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <Card key={r.inviter_user_id}>
                    <CardHeader>
                      <CardTitle className="text-sm">{getDisplayName(r)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="text-xs text-gray-500 break-all">Code : {r.code || ''}</div>

                      <div className="grid grid-cols-2 gap-3">
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Ouvertures</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{r?.stats?.click ?? 0}</div>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Inscriptions</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{r?.stats?.signup ?? 0}</div>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Premières connexions</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{r?.stats?.first_login ?? 0}</div>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Installations</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{r?.stats?.install ?? 0}</div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="space-y-2">
                        <div className="font-medium">Dernières activités</div>
                        {Array.isArray(r?.recent) && r.recent.length > 0 ? (
                          <div className="space-y-2">
                            {r.recent.map((ev) => (
                              <div key={ev.id} className="flex items-center justify-between gap-4">
                                <div className="text-gray-700">
                                  <div className="font-medium">{ev.event}</div>
                                  <div className="text-xs text-gray-500">{ev.user_username || ev.user_email || ''}</div>
                                </div>
                                <div className="text-xs text-gray-500">{new Date(ev.created_at).toLocaleString()}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500">Aucune activité.</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AdminInvitations;
