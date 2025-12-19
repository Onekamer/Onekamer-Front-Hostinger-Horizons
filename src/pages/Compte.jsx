import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, ChevronRight, Coins, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import MediaDisplay from '@/components/MediaDisplay';

const Compte = () => {
  const { user, profile, signOut, balance, loading, session } = useAuth();
  const [isQrAdmin, setIsQrAdmin] = React.useState(false);
  const [canAccessQrDashboard, setCanAccessQrDashboard] = React.useState(false);
  const [dashSearch, setDashSearch] = React.useState('');
  const [dashSuggestions, setDashSuggestions] = React.useState([]);
  const [dashSuggestLoading, setDashSuggestLoading] = React.useState(false);
  const [dashEventId, setDashEventId] = React.useState('');
  const [dashStats, setDashStats] = React.useState(null);
  const [dashStatsLoading, setDashStatsLoading] = React.useState(false);
  const [dashError, setDashError] = React.useState(null);
  const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';
  const navigate = useNavigate();

  React.useEffect(() => {
    let aborted = false;
    const run = async () => {
      try {
        if (!API_PREFIX || !session?.access_token) return;
        const res = await fetch(`${API_PREFIX}/qrcode/admin/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!aborted) setIsQrAdmin(!!data?.isAdmin);
      } catch {
        if (!aborted) setIsQrAdmin(false);
      }
    };
    run();
    return () => { aborted = true; };
  }, [API_PREFIX, session?.access_token]);

  React.useEffect(() => {
    let aborted = false;
    const run = async () => {
      try {
        if (!API_PREFIX || !session?.access_token) return;
        const res = await fetch(`${API_PREFIX}/admin/dashboard/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (!aborted) setCanAccessQrDashboard(!!data?.canAccess);
      } catch {
        if (!aborted) setCanAccessQrDashboard(false);
      }
    };
    run();
    return () => { aborted = true; };
  }, [API_PREFIX, session?.access_token]);

  React.useEffect(() => {
    const ctrl = new AbortController();
    if (!canAccessQrDashboard) return;
    if (!API_PREFIX) return;
    const q = dashSearch.trim();
    if (q.length < 1) { setDashSuggestions([]); return; }
    setDashSuggestLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_PREFIX}/events/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (Array.isArray(data)) setDashSuggestions(data);
      } catch {}
      finally { setDashSuggestLoading(false); }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [API_PREFIX, canAccessQrDashboard, dashSearch]);

  const fetchDashStats = async (eventId) => {
    try {
      if (!API_PREFIX || !session?.access_token) return;
      if (!eventId) return;
      setDashError(null);
      setDashStatsLoading(true);
      const res = await fetch(`${API_PREFIX}/admin/events/${encodeURIComponent(eventId)}/qrcode-stats`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
      setDashStats(data);
    } catch (e) {
      setDashStats(null);
      setDashError(e?.message || 'Erreur interne');
    } finally {
      setDashStatsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/');
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt sur OneKamer.co !",
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Mon Compte - OneKamer.co</title>
        <meta name="description" content="Gérez votre profil, vos forfaits et vos paramètres sur OneKamer.co." />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <Avatar className="w-24 h-24 border-4 border-[#2BA84A]">
            {profile.avatar_url ? (
              <MediaDisplay
                bucket="avatars"
                path={profile.avatar_url}
                alt={profile.username}
                className="rounded-full w-full h-full object-cover"
              />
            ) : (
              <AvatarFallback className="text-3xl bg-gray-200">{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <p className="text-center text-gray-600 max-w-md">{profile.bio || "Aucune biographie pour le moment."}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mes Badges</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3"/> Niveau 1 - Bronze
            </div>
            <div className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3"/> {profile.plan || 'Free'}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-lg">Forfait</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#2BA84A] capitalize">{profile.plan || 'Free'}</p>
            </CardContent>
          </Card>
          <Card className="text-center cursor-pointer" onClick={() => navigate('/ok-coins')}>
            <CardHeader>
              <CardTitle className="text-lg">OK Coins</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#F5C300] flex items-center justify-center gap-2">
                <Coins className="w-6 h-6"/> {balance ? balance.coins_balance.toLocaleString() : 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Paramètres</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <MenuItem onClick={() => navigate('/compte/modifier')} title="Modifier le profil" />
            <MenuItem onClick={() => navigate('/compte/notifications')} title="Notifications" />
            <MenuItem onClick={() => navigate('/compte/mon-qrcode')} title="Mon QR Code" />
            {isQrAdmin && (
              <MenuItem onClick={() => navigate('/scan')} title="Scanner QR (Admin)" />
            )}
            {profile.role === 'admin' && (
              <MenuItem onClick={() => navigate('/compte/emails-admin')} title="Envoyer des emails (admin)" />
            )}
            {(profile?.is_admin === true || profile?.is_admin === 1 || profile?.is_admin === 'true' || String(profile?.role || '').toLowerCase() === 'admin') && (
              <MenuItem onClick={() => navigate('/compte/moderation')} title="Modération" />
            )}
            {(profile?.is_admin === true || profile?.is_admin === 1 || profile?.is_admin === 'true' || String(profile?.role || '').toLowerCase() === 'admin') && (
              <MenuItem onClick={() => navigate('/compte/marketplace-admin')} title="Gestion Marketplace" />
            )}
            <MenuItem onClick={() => navigate('/compte/favoris')} title="Mes favoris" />
            <MenuItem onClick={() => navigate('/compte/confidentialite')} title="Confidentialité" />
            <MenuItem onClick={() => navigate('/forfaits')} title="Changer de forfait" />
          </CardContent>
        </Card>

        {canAccessQrDashboard && (
          <Card>
            <CardHeader>
              <CardTitle>Dashboard QR (événements)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rechercher un événement (par nom)</label>
                <Input value={dashSearch} onChange={(e) => setDashSearch(e.target.value)} placeholder="Ex: Soirée, Conférence, ..." />
                {dashSuggestLoading && <div className="text-xs text-gray-500">Recherche…</div>}
                {dashSuggestions.length > 0 && (
                  <div className="border rounded-md bg-white max-h-56 overflow-auto">
                    {dashSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setDashEventId(s.id);
                          setDashSearch(s.title || '');
                          setDashSuggestions([]);
                          fetchDashStats(s.id);
                        }}
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
                <Input value={dashEventId} onChange={(e) => setDashEventId(e.target.value)} placeholder="uuid" />
                <Button type="button" className="w-full sm:w-auto" disabled={!dashEventId || dashStatsLoading} onClick={() => fetchDashStats(dashEventId)}>
                  {dashStatsLoading ? 'Chargement…' : 'Voir les stats'}
                </Button>
              </div>

              {dashError && <div className="text-sm text-red-600">{dashError}</div>}

              {typeof dashStats?.capacity === 'number' && (
                <div className="text-sm text-gray-600">
                  Capacité : {dashStats.capacity} — Occupées : {dashStats.occupied ?? 0} — Restantes : {dashStats.remaining ?? 0}
                </div>
              )}

              {(dashStats?.attendus || dashStats?.deja_entres) && (
                <div className="space-y-4">
                  {dashStats?.attendus && (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Attendus (QR actifs)</div>
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Total</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold text-[#2BA84A]">{dashStats.attendus.total ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Payé</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{dashStats.attendus.paid ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Acompte</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{dashStats.attendus.deposit_paid ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Doit payer</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{dashStats.attendus.unpaid ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="text-center col-span-2">
                          <CardHeader>
                            <CardTitle className="text-sm">Gratuit</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{dashStats.attendus.free ?? 0}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {dashStats?.deja_entres && (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Déjà entrés (QR scannés)</div>
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Total</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold text-[#2BA84A]">{dashStats.deja_entres.total ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Payé</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{dashStats.deja_entres.paid ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Acompte</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{dashStats.deja_entres.deposit_paid ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="text-center">
                          <CardHeader>
                            <CardTitle className="text-sm">Doit payer</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{dashStats.deja_entres.unpaid ?? 0}</p>
                          </CardContent>
                        </Card>
                        <Card className="text-center col-span-2">
                          <CardHeader>
                            <CardTitle className="text-sm">Gratuit</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-2xl font-bold">{dashStats.deja_entres.free ?? 0}</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {profile.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle>Influenceurs & codes promo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-gray-600">
                Accédez à la vue globale des influenceurs et de leurs codes promo.
              </p>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => navigate('/compte/influenceurs-admin')}
              >
                Gérer les influenceurs
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Espace influenceur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-gray-600">
              Si vous disposez d'un code promo, consultez vos statistiques d'influenceur.
            </p>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => navigate('/compte/mes-stats-influenceur')}
            >
              Voir mes stats d'influenceur
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button variant="destructive" onClick={handleLogout} className="w-full max-w-sm">
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </Button>
        </div>
      </div>
    </>
  );
};

const MenuItem = ({ onClick, title }) => (
  <button onClick={onClick} className="w-full flex justify-between items-center py-4 text-left">
    <span className="font-medium">{title}</span>
    <ChevronRight className="h-5 w-5 text-gray-400" />
  </button>
);

export default Compte;