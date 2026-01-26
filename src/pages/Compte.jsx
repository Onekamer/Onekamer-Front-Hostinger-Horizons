import React, { useState, useEffect, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Capacitor } from '@capacitor/core';
import { NativePurchases } from '@capgo/native-purchases';

const Compte = () => {
  const { user, profile, signOut, balance, loading, session, refreshProfile } = useAuth();
  const [isQrAdmin, setIsQrAdmin] = React.useState(false);
  const [canAccessQrDashboard, setCanAccessQrDashboard] = React.useState(false);
  const [onlineVisible, setOnlineVisible] = useState(true);
  const [onlineSaving, setOnlineSaving] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [subInfo, setSubInfo] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

  const fetchSubscription = React.useCallback(async () => {
    try {
      if (!API_PREFIX || !session?.access_token || !user?.id) return;
      const res = await fetch(`${API_PREFIX}/iap/subscription?userId=${encodeURIComponent(user.id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 404) { setSubInfo(null); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.subscription) setSubInfo(data.subscription);
    } catch {}
  }, [API_PREFIX, session?.access_token, user?.id]);

  const effectivePlan = useMemo(() => {
    try {
      if (subInfo?.end_date) {
        const active = new Date(subInfo.end_date).getTime() > Date.now();
        return active ? (subInfo.plan_name || profile.plan || 'free') : 'free';
      }
      return profile.plan || 'free';
    } catch {
      return profile.plan || 'free';
    }
  }, [subInfo?.plan_name, subInfo?.end_date, profile.plan]);

  const displayPlan = useMemo(() => {
    const p = String(effectivePlan || '').toLowerCase();
    if (p === 'vip') return 'VIP';
    if (p === 'standard') return 'Standard';
    if (p === 'free') return 'Free';
    return effectivePlan || 'Free';
  }, [effectivePlan]);

  const isAdmin = (
    profile?.is_admin === true ||
    profile?.is_admin === 1 ||
    profile?.is_admin === 'true' ||
    String(profile?.role || '').toLowerCase() === 'admin'
  );

  const [inviteCode, setInviteCode] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStatsLoading, setInviteStatsLoading] = useState(false);
  const [inviteStats, setInviteStats] = useState(null);
  const [inviteRecent, setInviteRecent] = useState([]);
  const [invitePeriod, setInvitePeriod] = useState('30d');

  const [dashSearch, setDashSearch] = React.useState('');
  const [dashSuggestions, setDashSuggestions] = React.useState([]);
  const [dashSuggestLoading, setDashSuggestLoading] = React.useState(false);
  const [dashEventId, setDashEventId] = React.useState('');
  const [dashStats, setDashStats] = React.useState(null);
  const [dashStatsLoading, setDashStatsLoading] = React.useState(false);
  const [dashError, setDashError] = React.useState(null);
  const navigate = useNavigate();

  const isNativeApp = useMemo(() => {
    try {
      const p = typeof Capacitor?.getPlatform === 'function' ? Capacitor.getPlatform() : 'web';
      return p === 'ios' || p === 'android';
    } catch {
      return false;
    }
  }, []);

  const inviteLink = useMemo(() => {
    if (!inviteCode) return null;
    return `${window.location.origin}/invite?code=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  useEffect(() => {
    const run = async () => {
      if (!API_PREFIX || !session?.access_token) return;

      try {
        setInviteLoading(true);
        const res = await fetch(`${API_PREFIX}/invites/my-code`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Erreur récupération code');
        }
        const data = await res.json();
        setInviteCode(data?.code || null);
      } catch (e) {
        toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
      } finally {
        setInviteLoading(false);
      }
    };

    run();
  }, [API_PREFIX, session?.access_token]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    const run = async () => {
      if (!API_PREFIX || !session?.access_token) return;

      try {
        setInviteStatsLoading(true);
        const res = await fetch(`${API_PREFIX}/invites/my-stats?period=${encodeURIComponent(invitePeriod)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || 'Erreur récupération stats');
        }
        const data = await res.json();
        setInviteCode((prev) => prev || data?.code || null);
        setInviteStats(data?.stats || null);
        setInviteRecent(Array.isArray(data?.recent) ? data.recent : []);
      } catch (e) {
        toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
      } finally {
        setInviteStatsLoading(false);
      }
    };

    run();
  }, [API_PREFIX, session?.access_token, invitePeriod]);

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

  useEffect(() => {
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

  useEffect(() => {
    setOnlineVisible(profile?.show_online_status !== false);
  }, [profile?.show_online_status]);

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
      navigate('/auth');
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt sur OneKamer.co !",
      });
    }
  };

  const handleRestorePurchases = async () => {
    try {
      if (!API_PREFIX || !session?.access_token) return;
      const p = typeof Capacitor?.getPlatform === 'function' ? Capacitor.getPlatform() : 'web';
      if (p === 'android') {
        toast({ title: 'Bientôt disponible', description: 'La restauration Android sera ajoutée prochainement.' });
        return;
      }
      if (p !== 'ios') return;
      setRestoreLoading(true);
      let txIds = [];
      try { await NativePurchases.restorePurchases(); } catch {}
      try {
        const got = await NativePurchases.getPurchases();
        const purchases = Array.isArray(got?.purchases) ? got.purchases : [];
        // Ne filtre plus par état: laissons le backend décider de ce qui est restorable
        txIds = purchases
          .filter((it) => it?.transactionId)
          .map((it) => String(it.transactionId));
      } catch {}
      if (txIds.length === 0) {
        const tx = window.prompt("Entrez l'identifiant de transaction Apple à restaurer");
        if (!tx) {
          toast({ title: 'Aucun achat à restaurer', description: "Aucun identifiant de transaction fourni." });
          return;
        }
        txIds = [String(tx).trim()].filter(Boolean);
      }
      const res = await fetch(`${API_PREFIX}/iap/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ platform: 'ios', provider: 'apple', userId: user.id, transactionIds: txIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Échec restauration');
      const items = Array.isArray(data?.results) ? data.results : [];
      const ok = items.some((it) => it?.effect?.kind === 'subscription');
      if (ok) {
        toast({ title: 'Restauration réussie', description: "Votre abonnement a été resynchronisé." });
        await refreshProfile();
        await fetchSubscription();
      } else {
        const firstErr = items.find((it) => it?.error);
        if (firstErr?.error) {
          console.warn('[IAP][restore] errors=', items);
          toast({ title: 'Restauration impossible', description: firstErr.error, variant: 'destructive' });
        } else {
          toast({ title: 'Aucun achat à restaurer', description: "Aucun abonnement restorable n'a été trouvé." });
        }
      }
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur restauration', variant: 'destructive' });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleManageSubscriptions = async () => {
    try {
      const p = typeof Capacitor?.getPlatform === 'function' ? Capacitor.getPlatform() : 'web';
      if (p === 'web') return;
      await NativePurchases.manageSubscriptions();
      try {
        if (API_PREFIX && session?.access_token && user?.id) {
          await fetch(`${API_PREFIX}/iap/sync-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId: user.id }),
          });
          await refreshProfile();
          await fetchSubscription();
        }
      } catch {}
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d’ouvrir la gestion des abonnements.', variant: 'destructive' });
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
              <ShieldCheck className="w-3 h-3"/> {displayPlan}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-lg">Forfait</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#2BA84A]">{displayPlan}</p>
              {subInfo && subInfo.plan_name && subInfo.end_date && effectivePlan !== 'free' && (new Date(subInfo.end_date).getTime() > Date.now()) && (
                <div className="text-xs text-gray-500 mt-1">
                  {subInfo.auto_renew === false
                    ? `L’abonnement sera résilié le ${new Date(subInfo.end_date).toLocaleString()}`
                    : `Se renouvelle le ${new Date(subInfo.end_date).toLocaleString()}`}
                </div>
              )}
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

            <div className="w-full flex justify-between items-center py-4 text-left">
              <div>
                <div className="font-medium">Apparaître en ligne</div>
                <div className="text-xs text-gray-500">Activez pour que les autres membres voient votre statut.</div>
              </div>
              <Switch
                className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 border border-gray-300"
                checked={onlineVisible}
                disabled={onlineSaving}
                onCheckedChange={async (checked) => {
                  try {
                    setOnlineSaving(true);
                    setOnlineVisible(Boolean(checked));
                    const { error } = await supabase
                      .from('profiles')
                      .update({ show_online_status: Boolean(checked), updated_at: new Date().toISOString() })
                      .eq('id', user.id);
                    if (error) throw error;
                    await refreshProfile();
                  } catch (e) {
                    toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
                    setOnlineVisible(profile?.show_online_status !== false);
                  } finally {
                    setOnlineSaving(false);
                  }
                }}
              />
            </div>
            <MenuItem onClick={() => navigate('/compte/modifier')} title="Mon profil" />
            <MenuItem onClick={() => navigate('/compte/notifications')} title="Notifications" />
            <MenuItem onClick={() => navigate('/compte/mon-qrcode')} title="Mon QR Code" />

            {isQrAdmin && (
              <MenuItem onClick={() => navigate('/scan')} title="Scanner QR (Admin)" />
            )}
            {profile.role === 'admin' && (
              <MenuItem onClick={() => navigate('/compte/emails-admin')} title="Envoyer des emails (admin)" />
            )}
            {(profile?.is_admin === true || profile?.is_admin === 1 || profile?.is_admin === 'true' || String(profile?.role || '').toLowerCase() === 'admin') && (
              <MenuItem onClick={() => navigate('/compte/admin-utilisateurs')} title="Gestion utilisateurs (admin)" />
            )}
            {(profile?.is_admin === true || profile?.is_admin === 1 || profile?.is_admin === 'true' || String(profile?.role || '').toLowerCase() === 'admin') && (
              <MenuItem onClick={() => navigate('/compte/moderation')} title="Modération" />
            )}
            {(profile?.is_admin === true || profile?.is_admin === 1 || profile?.is_admin === 'true' || String(profile?.role || '').toLowerCase() === 'admin') && (
              <MenuItem onClick={() => navigate('/compte/admin-invitations')} title="Dashboard invitations (admin)" />
            )}
            {(profile?.is_admin === true || profile?.is_admin === 1 || profile?.is_admin === 'true' || String(profile?.role || '').toLowerCase() === 'admin') && (
              <MenuItem onClick={() => navigate('/compte/marketplace-admin')} title="Gestion Marketplace" />
            )}
            <MenuItem onClick={() => navigate('/compte/favoris')} title="Mes favoris" />
            <MenuItem onClick={() => navigate('/compte/confidentialite')} title="Confidentialité" />

            {isNativeApp && (
              <div className="py-4">
                <div className="flex flex-col gap-1">
                  <div className="font-medium">Restaurer les achats</div>
                  <div className="text-xs text-gray-500">Restaure l’abonnement lié à votre compte.</div>
                </div>
                <div className="mt-2">
                  <Button type="button" className="w-full sm:w-auto" disabled={restoreLoading} onClick={handleRestorePurchases}>
                    {restoreLoading ? 'Restauration…' : 'Restaurer mes achats'}
                  </Button>
                </div>
              </div>
            )}

            {isNativeApp && (
              <div className="py-4">
                <div className="flex flex-col gap-1">
                  <div className="font-medium">Gérer mon abonnement</div>
                  <div className="text-xs text-gray-500">Ouvre la gestion d’abonnement du store (Apple/Google).</div>
                </div>
                <div className="mt-2">
                  <Button type="button" className="w-full sm:w-auto" onClick={handleManageSubscriptions}>
                    Gérer mon abonnement
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Partager à mes contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-gray-600">
              Invitez vos contacts à installer et utiliser OneKamer. Vous pourrez suivre les ouvertures et inscriptions.
            </p>

            <div className="space-y-2">
              <div className="text-xs text-gray-500">Votre lien d’invitation</div>
              <div className="text-sm break-all">{inviteLink || (inviteLoading ? 'Chargement...' : 'Indisponible')}</div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="w-full sm:w-auto"
                disabled={!inviteLink}
                onClick={async () => {
                  const text = `Rejoins-moi sur OneKamer : ${inviteLink}`;
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: 'OneKamer', text, url: inviteLink });
                      return;
                    }
                    await navigator.clipboard.writeText(text);
                    toast({ title: 'Copié', description: 'Message d’invitation copié.' });
                  } catch (e) {
                    toast({ title: 'Erreur', description: e?.message || 'Impossible de partager.', variant: 'destructive' });
                  }
                }}
              >
                Partager
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={!inviteLink}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink);
                    toast({ title: 'Lien copié', description: 'Vous pouvez le coller dans un message.' });
                  } catch (e) {
                    toast({ title: 'Erreur', description: e?.message || 'Impossible de copier.', variant: 'destructive' });
                  }
                }}
              >
                Copier le lien
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={!inviteLink || !navigator?.contacts?.select}
                onClick={async () => {
                  try {
                    const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: true });
                    const count = Array.isArray(contacts) ? contacts.length : 0;
                    toast({ title: 'Contacts sélectionnés', description: `${count} contact(s) sélectionné(s).` });
                    const text = `Rejoins-moi sur OneKamer : ${inviteLink}`;

                    const tels = (Array.isArray(contacts) ? contacts : [])
                      .flatMap((c) => (Array.isArray(c?.tel) ? c.tel : []))
                      .map((t) => String(t || '').trim())
                      .filter(Boolean);

                    if (tels.length === 0) {
                      await navigator.clipboard.writeText(text);
                      toast({ title: 'Copié', description: 'Aucun numéro trouvé sur les contacts sélectionnés. Message copié.' });
                      return;
                    }

                    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent || '');
                    const recipients = tels.join(',');
                    const sep = isIOS ? '&' : '?';
                    const smsUrl = `sms:${recipients}${sep}body=${encodeURIComponent(text)}`;
                    window.location.href = smsUrl;
                  } catch (e) {
                    toast({ title: 'Erreur', description: e?.message || 'Action annulée.', variant: 'destructive' });
                  }
                }}
              >
                Choisir des contacts
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-gray-600">Période</div>
              <div className="flex gap-2">
                <Button type="button" variant={invitePeriod === '7d' ? 'default' : 'outline'} onClick={() => setInvitePeriod('7d')}>
                  7 jours
                </Button>
                <Button type="button" variant={invitePeriod === '30d' ? 'default' : 'outline'} onClick={() => setInvitePeriod('30d')}>
                  30 jours
                </Button>
                <Button type="button" variant={invitePeriod === 'all' ? 'default' : 'outline'} onClick={() => setInvitePeriod('all')}>
                  Total
                </Button>
              </div>
            </div>

            {inviteStatsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-green-500" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="text-sm">Ouvertures</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{inviteStats?.click ?? 0}</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="text-sm">Inscriptions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{inviteStats?.signup ?? 0}</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="text-sm">Premières connexions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{inviteStats?.first_login ?? 0}</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardHeader>
                    <CardTitle className="text-sm">Installations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{inviteStats?.install ?? 0}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="space-y-2">
              <div className="font-medium">Dernières activités</div>
              {inviteRecent.length === 0 ? (
                <div className="text-gray-500">Aucune activité.</div>
              ) : (
                <div className="space-y-2">
                  {inviteRecent.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between gap-4">
                      <div className="text-gray-700">
                        <div className="font-medium">{ev.event}</div>
                        <div className="text-xs text-gray-500">{ev.user_username || ev.user_email || ''}</div>
                      </div>
                      <div className="text-xs text-gray-500">{new Date(ev.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              <CardTitle>Invitations (Admin)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-gray-600">
                Consultez les statistiques d'invitations de chaque utilisateur.
              </p>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => navigate('/compte/admin-invitations')}
              >
                Ouvrir le dashboard invitations
              </Button>
            </CardContent>
          </Card>
        )}

        

        

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Retraits OK COINS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-gray-600">
                Validez/refusez les demandes de retrait et marquez comme traitées.
              </p>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => navigate('/compte/okcoins-admin')}
              >
                Ouvrir la gestion retraits
              </Button>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>QR Codes événements (Admin)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-gray-600">
                Scanner et vérifier les QR Codes à l'entrée (PAYÉ / ACOMPTE PAYÉ / DOIT PAYER).
              </p>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => navigate('/scan')}
              >
                Ouvrir le scanner
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