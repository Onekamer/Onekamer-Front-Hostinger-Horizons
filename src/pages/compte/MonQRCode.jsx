import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

const MonQRCode = () => {
  const { user, session, loading } = useAuth();
  const [eventId, setEventId] = useState('');
  const [qrImage, setQrImage] = useState(null);
  const [status, setStatus] = useState(null);
  const [value, setValue] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [myQrs, setMyQrs] = useState([]);

  const isExpiredDate = (iso) => {
    if (!iso) return false;
    try {
      const d = new Date(iso);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d < today;
    } catch {
      return false;
    }
  };

  const cacheKey = useMemo(() => (user && eventId ? `qr_${user.id}_${eventId}` : null), [user, eventId]);

  useEffect(() => {
    if (!cacheKey) return;
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setQrImage(parsed.qrImage || null);
        setStatus(parsed.status || null);
        setValue(parsed.value || null);
      } catch {}
    } else {
      setQrImage(null);
      setStatus(null);
      setValue(null);
    }
  }, [cacheKey]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (!API_PREFIX) return;
    const q = search.trim();
    if (q.length < 1) { setSuggestions([]); return; }
    setSuggestLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_PREFIX}/events/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (Array.isArray(data)) setSuggestions(data);
      } catch {}
      finally { setSuggestLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [search]);

  useEffect(() => {
    const run = async () => {
      if (!API_PREFIX || !session?.access_token) return;
      try {
        const res = await fetch(`${API_PREFIX}/qrcode/my?withImage=1`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data?.items)) setMyQrs(data.items);
      } catch {}
    };
    run();
  }, [session]);

  const onGenerate = async () => {
    if (!API_PREFIX) {
      setError("API non configurée (VITE_API_URL)");
      return;
    }
    if (!eventId) {
      setError('Veuillez saisir un identifiant d\'événement');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_PREFIX}/qrcode/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ event_id: eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
      setQrImage(data.qrImage);
      setStatus(data.status || 'active');
      setValue(data.qrcode_value || null);
      if (cacheKey) {
        localStorage.setItem(cacheKey, JSON.stringify({ qrImage: data.qrImage, status: data.status || 'active', value: data.qrcode_value || null }));
      }
    } catch (e) {
      setError(e?.message || 'Erreur interne');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">Chargement…</div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">Vous devez être connecté.</div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Mon QR Code - OneKamer</title>
      </Helmet>

      <div className="max-w-xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Mon QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rechercher un événement (par nom)</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex: Soirée, Conférence, ..." />
              {suggestLoading && <div className="text-xs text-gray-500">Recherche…</div>}
              {suggestions.length > 0 && (
                <div className="border rounded-md bg-white max-h-56 overflow-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setEventId(s.id); setSearch(s.title || ''); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="text-sm font-medium">{s.title}</div>
                      <div className="text-xs text-gray-500">{s.date} • {s.location}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Identifiant de l'événement</label>
              <Input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="Ex: 0f8c...-uuid" />
            </div>
            <Button disabled={submitting || !eventId} onClick={onGenerate} className="bg-[#2BA84A] text-white w-full">
              {submitting ? 'Génération…' : '🎟 Obtenir mon QR Code'}
            </Button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </CardContent>
        </Card>

        {qrImage && (
          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="w-full flex justify-center">
                <img src={qrImage} alt="QR Code" className="w-64 h-64 bg-white p-2 rounded" />
              </div>
              <div className="text-sm text-center">
                Statut: <span className="font-medium capitalize">{status}</span>
                {status === 'expired' && (
                  <span className="ml-2 text-xs font-semibold text-red-600">Expiré</span>
                )}
              </div>
              {value && (
                <div className="text-xs text-center text-gray-500 break-all">{value}</div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Mes QR Codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myQrs.length === 0 && (
              <div className="text-sm text-gray-600">Aucun QR Code enregistré pour l'instant.</div>
            )}
            {myQrs.map((row) => (
              <div key={row.id} className="flex flex-col md:flex-row md:items-center gap-3 border rounded-lg p-3">
                {row.qrImage ? (
                  <img src={row.qrImage} alt="QR" className="w-20 h-20 bg-white p-1 rounded" />
                ) : (
                  <div className="w-20 h-20 bg-gray-100 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {row.evenements?.title || 'Événement'}
                    {(row.status === 'expired' || isExpiredDate(row.evenements?.date)) && (
                      <span className="ml-2 text-[10px] font-semibold text-red-700">Expiré</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{row.evenements?.date} • {row.evenements?.location}</div>
                  <div className="text-xs">Statut: <span className="font-medium capitalize">{row.status}</span></div>
                </div>
                <div className="flex w-full md:w-auto flex-row md:flex-col gap-2 md:ml-auto md:items-end shrink-0">
                  <Button size="sm" className="whitespace-nowrap" variant="outline" onClick={() => { setEventId(row.event_id); setQrImage(row.qrImage || null); setStatus(row.status); setValue(row.qrcode_value); }}>
                    Ouvrir
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="whitespace-nowrap"
                    onClick={async () => {
                      if (!API_PREFIX || !session?.access_token) return;
                      const ok = window.confirm('Supprimer ce QR Code ?');
                      if (!ok) return;
                      try {
                        const res = await fetch(`${API_PREFIX}/qrcode/${row.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${session.access_token}` },
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || data?.deleted !== true) throw new Error(data?.error || 'Suppression échouée');
                        setMyQrs((prev) => prev.filter((x) => x.id !== row.id));
                        if (value === row.qrcode_value) { setQrImage(null); setStatus(null); setValue(null); }
                        if (user?.id && row.event_id) { const key = `qr_${user.id}_${row.event_id}`; try { localStorage.removeItem(key); } catch {} }
                      } catch (e) {
                        alert(e?.message || 'Erreur lors de la suppression');
                      }
                    }}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MonQRCode;
