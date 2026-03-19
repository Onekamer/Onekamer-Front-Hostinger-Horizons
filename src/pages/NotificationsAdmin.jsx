import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const NotificationsAdmin = () => {
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('broadcast');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [searching, setSearching] = useState(false);

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile.role === 'admin' || profile.is_admin === true || profile.is_admin === 1 || profile.is_admin === 'true';
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  const sendBroadcast = async () => {
    if (!API_BASE_URL) {
      toast({ title: 'Configuration manquante', description: "VITE_API_URL n'est pas défini.", variant: 'destructive' });
      return;
    }
    if (!title || !message) {
      toast({ title: 'Champs incomplets', description: 'Titre et message sont requis.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const body = {
        title: title.trim(),
        message: message.trim(),
        data: { type: 'system' },
        url: url && url.trim() ? url.trim() : '/',
        segment: 'subscribed_users',
      };

      let res = await fetch(`${API_BASE_URL}/notifications/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // Fallback alias /api/...
        res = await fetch(`${API_BASE_URL}/api/notifications/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de l\'envoi de la notification');
      }

      toast({ title: 'Notification envoyée', description: 'Le broadcast a été déclenché.' });
      setTitle('');
      setMessage('');
      setUrl('');
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d\'envoyer la notification.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const sendTargeted = async () => {
    if (!API_BASE_URL) {
      toast({ title: 'Configuration manquante', description: "VITE_API_URL n'est pas défini.", variant: 'destructive' });
      return;
    }
    if (!title || !message) {
      toast({ title: 'Champs incomplets', description: 'Titre et message sont requis.', variant: 'destructive' });
      return;
    }
    const ids = Array.from(new Set((selected || []).map((u) => String(u.id)).filter(Boolean)));
    if (ids.length === 0) {
      toast({ title: 'Destinataires manquants', description: 'Sélectionnez au moins un utilisateur.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const body = {
        title: title.trim(),
        message: message.trim(),
        data: { type: 'system' },
        url: url && url.trim() ? url.trim() : '/',
        targetUserIds: ids,
      };

      let res = await fetch(`${API_BASE_URL}/notifications/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const alt = `${API_BASE_URL}/api/notifications/dispatch`;
        res = await fetch(alt, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de l\'envoi de la notification');
      }

      toast({ title: 'Notification envoyée', description: `Envoi ciblé à ${ids.length} utilisateur(s).` });
      setTitle('');
      setMessage('');
      setUrl('');
      setSelected([]);
      setQuery('');
      setResults([]);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d\'envoyer la notification.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (mode !== 'targeted') { setResults([]); return; }
    const q = String(query || '').trim();
    if (!q) { setResults([]); return; }
    let canceled = false;
    const t = setTimeout(async () => {
      try {
        setSearching(true);
        const token = session?.access_token;
        if (!token) { setResults([]); setSearching(false); return; }
        const API_PREFIX = import.meta.env.VITE_API_URL || '/api';
        const qs = new URLSearchParams();
        qs.set('search', q);
        qs.set('limit', '10');
        const res = await fetch(`${API_PREFIX}/admin/users?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (!canceled) {
          const items = Array.isArray(data?.items) ? data.items : [];
          setResults(items);
        }
      } catch {
        if (!canceled) setResults([]);
      } finally {
        if (!canceled) setSearching(false);
      }
    }, 300);
    return () => { canceled = true; clearTimeout(t); };
  }, [mode, query, session?.access_token]);

  const addSelected = (row) => {
    if (!row || !row.id) return;
    setSelected((prev) => {
      const map = new Map(prev.map((u) => [String(u.id), u]));
      map.set(String(row.id), row);
      return Array.from(map.values());
    });
  };
  const removeSelected = (id) => {
    setSelected((prev) => prev.filter((u) => String(u.id) !== String(id)));
  };
  const goBack = () => {
    try {
      if (window.history && window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        navigate('/compte');
      }
    } catch {
      navigate('/compte');
    }
  };

  return (
    <>
      <Helmet>
        <title>Notifications système (Admin) - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={goBack}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Envoyer une notification système (admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="block font-medium">Mode d'envoi</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="broadcast">Tous les utilisateurs</option>
                <option value="targeted">Utilisateurs spécifiques</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block font-medium">Titre</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de la notification"
              />
            </div>

            {mode === 'targeted' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="block font-medium">Rechercher un utilisateur (username ou email)</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ex: williams, contact@exemple.com"
                  />
                  {searching && <div className="text-xs text-gray-500">Recherche…</div>}
                  {!searching && results.length > 0 && (
                    <div className="border rounded bg-white max-h-56 overflow-auto">
                      {results.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => addSelected(r)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          <div className="text-sm font-medium">{r.username || r.full_name || r.email || r.id}</div>
                          <div className="text-xs text-gray-500 break-all">{r.email || r.id}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selected.map((u) => (
                      <span key={u.id} className="inline-flex items-center gap-2 border rounded px-2 py-1 text-xs">
                        <span>{u.username || u.email || u.id}</span>
                        <button type="button" onClick={() => removeSelected(u.id)} className="text-red-600">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="block font-medium">Message</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[160px] focus:outline-none focus:ring focus:ring-green-500/40"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contenu à afficher dans le toast / push"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium">URL (optionnelle)</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/echange, /evenements, https://onekamer.co/..."
              />
              <p className="text-xs text-gray-500">Par défaut, la notification redirige vers l\'accueil.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" disabled={sending} onClick={mode === 'targeted' ? sendTargeted : sendBroadcast} className="flex-1">
                {sending ? 'Envoi en cours...' : (mode === 'targeted' ? 'Envoyer aux utilisateurs spécifiés' : 'Envoyer à tous les utilisateurs')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default NotificationsAdmin;
