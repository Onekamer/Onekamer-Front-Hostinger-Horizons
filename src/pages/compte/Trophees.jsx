import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Lock, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';

export default function Trophees() {
  const { session } = useAuth();
  const token = session?.access_token;

  const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;
  const API_PREFIX = useMemo(() => `${apiBaseUrl}/api`, [apiBaseUrl]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [awardTried, setAwardTried] = useState(false);

  const getStepsForKey = (key) => {
    const k = String(key || '').toLowerCase();
    switch (k) {
      case 'profile_complete':
        return [
          'Ajouter une photo de profil',
          'Renseigner une bio',
          'Avoir un pseudo (username)',
        ];
      case 'first_post':
        return [
          'Publier au moins un post',
        ];
      case 'first_referral':
        return [
          "Récupérer votre lien d'invitation depuis Mon Compte",
          "Un contact s'inscrit via ce lien",
        ];
      case 'first_comment':
        return [
          'Publier votre premier commentaire',
        ];
      case 'first_mention':
        return [
          'Écrire un commentaire avec une mention',
          'Utiliser @pseudo dans votre message',
        ];
      case 'first_group':
        return [
          'Créer un premier groupe',
          'Ajouter au moins 2 autres membres',
        ];
      case 'first_annonce':
        return [
          'Publier votre première annonce',
        ];
      case 'first_event':
        return [
          'Créer/organiser votre premier événement',
        ];
      default:
        return ["Gagner ce trophée en réalisant l'action associée."]; 
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!token) { setLoading(false); return; }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_PREFIX}/trophies/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!mounted) return;
        if (!res.ok) throw new Error(data?.error || 'Erreur lecture trophées');
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Erreur interne');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [API_PREFIX, token]);

  // Tentative d'auto-award: on essaie d'attribuer les trophées non débloqués dès l'ouverture
  useEffect(() => {
    if (!token) return;
    if (loading) return;
    if (awardTried) return;
    const locked = (items || []).filter((it) => !it.unlocked);
    if (locked.length === 0) { setAwardTried(true); return; }
    let aborted = false;
    const run = async () => {
      try {
        await Promise.all(locked.map(async (it) => {
          try {
            const res = await fetch(`${API_PREFIX}/trophies/award`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ trophy_key: it.key }),
            });
            const data = await res.json().catch(() => ({}));
            if (!aborted) {
              if (res.ok || data?.already_awarded) {
                setItems((prev) => prev.map((x) => x.key === it.key ? { ...x, unlocked: true, unlocked_at: x.unlocked_at || new Date().toISOString() } : x));
              }
            }
          } catch {}
        }));
      } finally {
        if (!aborted) setAwardTried(true);
      }
    };
    run();
    return () => { aborted = true; };
  }, [API_PREFIX, token, items, loading, awardTried]);

  const unlockedCount = (items || []).filter((it) => it.unlocked).length;

  return (
    <>
      <Helmet>
        <title>Mes Trophées - OneKamer.co</title>
        <meta name="description" content="Consultez vos trophées OneKamer." />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">Mes Trophées</h1>
          <div className="text-sm text-gray-600">{unlockedCount}/{items.length || 3}</div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[0,1,2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <CardTitle className="h-6 bg-gray-200 rounded w-2/3" />
                </CardHeader>
                <CardContent>
                  <div className="h-24 bg-gray-100 rounded mb-3" />
                  <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="text-red-600 text-sm">{error}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(items || []).map((t) => (
              <Card key={t.key}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    {t.name}
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" aria-label="Infos" className="text-gray-500 hover:text-gray-700">
                          <Info className="w-4 h-4" />
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t.name}</DialogTitle>
                          <DialogDescription>
                            <div className="mt-2 text-gray-700 text-sm">{t.description}</div>
                            <div className="mt-4">
                              <div className="font-semibold text-sm mb-2">Comment l'obtenir</div>
                              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                {getStepsForKey(t.key).map((s, idx) => (
                                  <li key={idx}>{s}</li>
                                ))}
                              </ul>
                            </div>
                          </DialogDescription>
                        </DialogHeader>
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                  {t.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 text-xs px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Débloqué
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-600 bg-gray-100 text-xs px-2 py-0.5 rounded-full">
                      <Lock className="w-3 h-3" /> Verrouillé
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  {t.icon_url ? (
                    <img
                      src={t.icon_url}
                      alt={t.name}
                      className={`w-full h-24 object-contain mb-3 ${t.unlocked ? '' : 'grayscale opacity-70'}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-full h-24 bg-gray-100 mb-3 rounded ${t.unlocked ? '' : 'grayscale opacity-70'}`} />
                  )}
                  <p className="text-sm text-gray-700">{t.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
