import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ArrowLeft } from 'lucide-react';
import { isEventFree } from '@/utils/isEventFree';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

const MonQRCode = () => {
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [eventId, setEventId] = useState('');
  const [qrImage, setQrImage] = useState(null);
  const [status, setStatus] = useState(null);
  const [value, setValue] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [myQrs, setMyQrs] = useState([]);
  const myQrsGrouped = useMemo(() => {
    const groups = {};
    (Array.isArray(myQrs) ? myQrs : []).forEach((row) => {
      const eid = row?.event_id || 'unknown';
      if (!groups[eid]) groups[eid] = { event: row?.evenements || null, items: [] };
      groups[eid].items.push(row);
    });
    return groups;
  }, [myQrs]);
  const hasMyQrForCurrent = useMemo(() => {
    if (!eventId) return false;
    return Array.isArray(myQrs) && myQrs.some((r) => String(r?.event_id) === String(eventId));
  }, [myQrs, eventId]);
  const currentPayment = useMemo(() => {
    if (selectedPayment) return selectedPayment;
    if (!eventId || !Array.isArray(myQrs)) return null;
    const row = myQrs.find((r) => String(r?.event_id) === String(eventId));
    return row?.payment || null;
  }, [selectedPayment, myQrs, eventId]);
  const [didPrefillFromEventId, setDidPrefillFromEventId] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [thanks, setThanks] = useState(false);
  const [isFreeEvent, setIsFreeEvent] = useState(null);
  const [eventInfoLoading, setEventInfoLoading] = useState(false);

  const goToMyQrs = () => {
    try {
      const el = document.getElementById('ok-my-qrs');
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    } catch {}
    navigate('/compte/mon-qrcode');
  };

  const formatMinorAmount = (minor, currency) => {
    const cur = (currency || '').toLowerCase();
    const amount = Number(minor) || 0;
    const major = amount;
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: (cur || 'eur').toUpperCase(),
      }).format(major);
    } catch {
      return `${major} ${cur || ''}`.trim();
    }
  };

  const handleBack = () => {
    try {
      if (window.history && window.history.length > 1) {
        navigate(-1);
        return;
      }
    } catch {}
    if (eventId) {
      navigate(`/evenements?eventId=${encodeURIComponent(eventId)}`);
    } else {
      navigate('/evenements');
    }
  };

  const getPaymentLabel = (p) => {
    const s = p?.status || p?.payment_status;
    if (s === 'paid') return 'PAYÉ';
    if (s === 'deposit_paid') return 'ACOMPTE PAYÉ';
    if (s === 'refunded') return 'REMBOURSÉ';
    if (s === 'unpaid') return 'DOIT PAYER';
    if (s === 'free') return 'GRATUIT';
    return null;
  };

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
    try {
      const query = new URLSearchParams(location.search);
      const qEventId = query.get('eventId');
      if (qEventId) setEventId(qEventId);
      const qThanks = query.get('thanks');
      setThanks(String(qThanks || '') === '1');
    } catch {}
  }, [location.search]);

  // Charger les infos de l'événement courant pour déterminer s'il est gratuit
  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (!API_PREFIX || !eventId) { setIsFreeEvent(null); return; }
      setEventInfoLoading(true);
      try {
        const ts = Date.now();
        const res = await fetch(`${API_PREFIX}/events/${encodeURIComponent(eventId)}?ts=${ts}`, { signal: ctrl.signal, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setIsFreeEvent(null); return; }
        const free = isEventFree(data);
        setIsFreeEvent(free);
      } catch {
        setIsFreeEvent(null);
      } finally {
        setEventInfoLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, [API_PREFIX, eventId]);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      if (!API_PREFIX) return;
      if (!eventId) return;
      if (didPrefillFromEventId) return;

      try {
        const ts = Date.now();
        const res = await fetch(`${API_PREFIX}/events/${encodeURIComponent(eventId)}?ts=${ts}`, { signal: ctrl.signal, cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) return;
        if (data?.title) {
          setSearch(String(data.title));
          setEventTitle(String(data.title));
          setSuggestions([
            {
              id: data.id,
              title: data.title,
              date: data.date,
              location: data.location,
            },
          ]);
        }
        setDidPrefillFromEventId(true);
      } catch {
        // ignore
      }
    };
    run();
    return () => ctrl.abort();
  }, [eventId, didPrefillFromEventId]);

  // Après redirection Stripe (thanks=1), auto-sélectionner le QR correspondant si présent
  useEffect(() => {
    if (!thanks || !eventId) return;
    if (!Array.isArray(myQrs) || myQrs.length === 0) return;
    const row = myQrs.find((r) => r?.event_id === eventId);
    if (row) {
      setQrImage(row.qrImage || null);
      setStatus(row.status || null);
      setValue(row.qrcode_value || null);
      setSelectedPayment(row.payment || null);
    }
  }, [thanks, eventId, myQrs]);

  useEffect(() => {
    if (!eventId) return;
    if (!Array.isArray(myQrs) || myQrs.length === 0) return;
    const row = myQrs.find((r) => r?.event_id === eventId);
    if (!row) return;
    setSelectedPayment(row.payment || null);
  }, [eventId, myQrs]);

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

  const onPay = async (mode) => {
    if (!eventId) {
      setError("Veuillez saisir un identifiant d'événement");
      return;
    }
    const m = mode === 'deposit' ? 'deposit' : 'full';
    setPaying(true);
    try {
      navigate(`/pay/events/${encodeURIComponent(eventId)}?mode=${encodeURIComponent(m)}`);
    } finally {
      setPaying(false);
    }
  };

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
        <title>QR Code - OneKamer</title>
      </Helmet>

      <div className="max-w-xl mx-auto space-y-6">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>QR Code</CardTitle>
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
            {/* Champ identifiant masqué pour éviter l’exposition d’un ID interne */}
            {eventId && isFreeEvent === true && (
              <Button disabled={submitting || eventInfoLoading} onClick={onGenerate} className="bg-[#2BA84A] text-white w-full">
                {submitting ? 'Génération…' : (hasMyQrForCurrent ? '🎟 Obtenir un autre QR Code' : '🎟 Obtenir un QR Code')}
              </Button>
            )}

            {eventId && isFreeEvent === false && (
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={() => onPay('full')} disabled={paying || eventInfoLoading} className="bg-[#2BA84A] text-white w-full">
                  {paying ? 'Redirection…' : (hasMyQrForCurrent ? 'Payer un autre billet' : 'Payer maintenant')}
                </Button>
                <div className="text-xs text-gray-500">Billets non échangeables, non remboursables.</div>
              </div>
            )}
            {error && <div className="text-sm text-red-600">{error}</div>}
          </CardContent>
        </Card>

        {(qrImage || thanks) && (
          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {thanks && (
                <div className="rounded-md border border-[#CDE1D5] bg-[#CDE1D5] text-[#2BA84A] p-3 text-sm">
                  Merci {user?.email || 'membre'}, votre réservation pour "{eventTitle || 'votre événement'}" a bien été prise en compte. Voici votre QR Code.
                  <div className="text-gray-700 mt-1">
                    Vous pourrez le retrouver à tout moment dans <span className="font-semibold">Compte › Mes QR Codes</span> ou depuis la page de l’événement via le bouton <span className="font-semibold">Mon QRcode</span>.
                  </div>
                  <div className="mt-2">
                    <Button size="sm" variant="outline" onClick={goToMyQrs}>Voir mes QR Codes</Button>
                  </div>
                </div>
              )}
              <div className="w-full flex justify-center">
                <img
                  src={qrImage}
                  alt="QR Code"
                  className={`w-64 h-64 bg-white p-2 rounded ${((String((selectedPayment?.status || selectedPayment?.payment_status) || '').toLowerCase() === 'refunded') || status === 'expired') ? 'grayscale opacity-60' : ''}`}
                />
              </div>
              <div className="text-sm text-center">
                {(() => {
                  const expired = status === 'expired';
                  return (
                    <>
                      Statut: <span className={`font-medium ${expired ? 'text-red-600' : ''} capitalize`}>{expired ? 'expiré' : status}</span>
                    </>
                  );
                })()}
              </div>
              {selectedPayment && (
                <div className="text-sm text-center">
                  {(() => {
                    const base = getPaymentLabel(selectedPayment);
                    const isPaidFallback = base === 'GRATUIT' && ((typeof selectedPayment?.amount_total === 'number' && selectedPayment.amount_total > 0) || isFreeEvent === false);
                    const label = isPaidFallback ? 'PAYÉ' : (base || '—');
                    const total = (typeof selectedPayment?.amount_total === 'number' && selectedPayment.amount_total > 0) ? ` • total: ${formatMinorAmount(selectedPayment.amount_total, selectedPayment.currency || selectedPayment?.currency)}` : '';
                    return (
                      <>
                        Statut paiement: <span className="font-medium">{label}</span>
                        {total && <span className="ml-1 text-xs text-gray-600">{total}</span>}
                        {typeof selectedPayment?.remaining === 'number' && selectedPayment.remaining > 0 && (
                          <span className="ml-2 text-xs text-gray-600">(reste: {formatMinorAmount(selectedPayment.remaining, selectedPayment.currency || selectedPayment?.currency)})</span>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              {value && (
                <div className="text-xs text-center text-gray-500 break-all">{value}</div>
              )}
            </CardContent>
          </Card>
        )}

        <Card id="ok-my-qrs">
          <CardHeader>
            <CardTitle>
              {`Mes QR Codes${Array.isArray(myQrs) && myQrs.length ? ` (${myQrs.length})` : ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myQrs.length === 0 && (
              <div className="text-sm text-gray-600">Aucun QR Code enregistré pour l'instant.</div>
            )}
            {Object.entries(myQrsGrouped).map(([eid, group]) => (
              <div key={eid} className="space-y-2">
                <div className="text-sm font-semibold">
                  {(group?.event?.title || 'Événement')} {Array.isArray(group?.items) ? `(${group.items.length})` : ''}
                </div>
                <div className="text-xs text-gray-500">{group?.event?.date} • {group?.event?.location}</div>
                {group.items.map((row) => (
                  <div key={row.id} className="flex flex-col md:flex-row md:items-center gap-3 border rounded-lg p-3">
                    {row.qrImage ? (
                      <img
                        src={row.qrImage}
                        alt="QR"
                        className={`w-20 h-20 bg-white p-1 rounded ${(((row.status === 'expired') || isExpiredDate(group?.event?.end_date || group?.event?.date) || String((row?.payment?.status || row?.payment?.payment_status) || '').toLowerCase() === 'refunded') ? 'grayscale opacity-60' : '')}`}
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {(() => {
                          const expired = (row.status === 'expired') || isExpiredDate(group?.event?.end_date || group?.event?.date);
                          return (
                            <>
                              Statut: <span className={`font-medium ${expired ? 'text-red-700' : ''} capitalize`}>{expired ? 'expiré' : row.status}</span>
                            </>
                          );
                        })()}
                      </div>
                      {row.payment && (
                        <div className="text-xs">
                          {(() => {
                            const base = getPaymentLabel(row.payment);
                            const eventLooksFree = isEventFree(group?.event || {});
                            const eventLooksPaid = !eventLooksFree;
                            const isPaidFallback = base === 'GRATUIT' && ( (typeof row.payment?.amount_total === 'number' && row.payment.amount_total > 0) || eventLooksPaid );
                            const label = isPaidFallback ? 'PAYÉ' : (base || '—');
                            const total = (typeof row.payment?.amount_total === 'number' && row.payment.amount_total > 0) ? ` • total ${formatMinorAmount(row.payment.amount_total, row.payment.currency)}` : '';
                            return (
                              <>
                                Paiement: <span className="font-medium">{label}</span>
                                {total && <span className="ml-1 text-gray-600">{total}</span>}
                                {typeof row.payment?.remaining === 'number' && row.payment.remaining > 0 && (
                                  <span className="ml-2 text-gray-600">• reste {formatMinorAmount(row.payment.remaining, row.payment.currency)}</span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex w-full md:w-auto flex-row md:flex-col gap-2 md:ml-auto md:items-end shrink-0">
                      <Button size="sm" className="whitespace-nowrap" variant="outline" onClick={() => { setEventId(row.event_id); setQrImage(row.qrImage || null); setStatus(row.status); setValue(row.qrcode_value); setSelectedPayment(row.payment || null); }}>
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
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default MonQRCode;
