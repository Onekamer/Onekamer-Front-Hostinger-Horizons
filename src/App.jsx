import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/lib/customSupabaseClient';
import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';
import Home from '@/pages/Home';
import Annonces from '@/pages/Annonces';
import Partenaires from '@/pages/Partenaires';
import Echange from '@/pages/Echange';
import Evenements from '@/pages/Evenements';
import Rencontre from '@/pages/Rencontre';
import FaitsDivers from '@/pages/FaitsDivers';
import Groupes from '@/pages/Groupes';
import GroupeDetail from '@/pages/GroupeDetail';
import CreateGroupe from '@/pages/groupes/CreateGroupe';
import GroupInvitations from '@/pages/groupes/GroupInvitations';
import OKCoins from '@/pages/OKCoins';
import Forfaits from '@/pages/Forfaits';
import Compte from '@/pages/Compte';
import MesPostsSponsorises from '@/pages/compte/MesPostsSponsorises';
import EmailsAdmin from '@/pages/EmailsAdmin';
import InfluenceursAdmin from '@/pages/InfluenceursAdmin';
import InfluenceurStats from '@/pages/InfluenceurStats';
import ModerationAdmin from '@/pages/ModerationAdmin';
import OKCoinsAdminLab from '@/pages/OKCoinsAdminLab';
import AdminUsers from '@/pages/AdminUsers';
import AdminInvitations from '@/pages/AdminInvitations';
import MonQRCode from '@/pages/compte/MonQRCode';
import Scan from '@/pages/Scan';
import PayOKCoins from '@/pages/pay/PayOKCoins';
import PayEvent from '@/pages/pay/PayEvent';
import PayMarket from '@/pages/pay/PayMarket';
import OKCoinsTransactions from '@/pages/OKCoinsTransactions';
import Publier from '@/pages/Publier';
import Rechercher from '@/pages/Rechercher';
import Messages from '@/pages/Messages';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import ModifierProfil from '@/pages/compte/ModifierProfil';
import Notifications from '@/pages/compte/Notifications';
import Confidentialite from '@/pages/compte/Confidentialite';
import Favoris from '@/pages/compte/Favoris';
import BlockedAccounts from '@/pages/compte/BlockedAccounts';
import ReportsHistory from '@/pages/compte/ReportsHistory';
import Trophees from '@/pages/compte/Trophees';
import CreateAnnonce from '@/pages/publier/CreateAnnonce';
import CreateEvenement from '@/pages/publier/CreateEvenement';
import ProposerPartenaire from '@/pages/publier/ProposerPartenaire';
import UserProfile from '@/pages/UserProfile';
import RencontreMessages from '@/pages/rencontre/RencontreMessages';
import ConversationDetail from '@/pages/rencontre/ConversationDetail';
import RencontreProfil from '@/pages/rencontre/RencontreProfil';
import AuthPage from '@/pages/Auth';
import PaiementSuccess from '@/pages/PaiementSuccess';
import PaiementAnnule from '@/pages/PaiementAnnule';
import MerciVerification from '@/pages/MerciVerification';
import VerificationSMS from '@/pages/VerificationSMS';
import ChartePopup from '@/components/ChartePopup';
import { useCharteValidation } from '@/hooks/useCharteValidation';
import { applyAutoAccessProtection } from '@/lib/autoAccessWrapper';
import ResetPassword from '@/pages/ResetPassword';
import SupportCenter from '@/pages/SupportCenter';
import SupportAdmin from '@/pages/SupportAdmin';
import NotificationsAdmin from '@/pages/NotificationsAdmin';
import AdminHub from '@/pages/AdminHub';
import CguPage from '@/pages/Cgu';
import RgpdPage from '@/pages/Rgpd';
import MentionsLegalesPage from '@/pages/MentionLegales';
import Landing from '@/pages/Landing';
import Invite from '@/pages/Invite';
import PublicHeader from '@/pages/public/PublicHeader';
import OneSignalInitializer from '@/OneSignalInitializer';
import IosPwaPrompt from '@/components/IosPwaPrompt';
import Marketplace from '@/pages/Marketplace';
import MarketplacePartner from '@/pages/MarketplacePartner';
import MarketplaceCart from '@/pages/MarketplaceCart';
import MarketplaceMyShop from '@/pages/MarketplaceMyShop';
import MarketplaceMyProducts from '@/pages/MarketplaceMyProducts';
import MarketplaceAdmin from '@/pages/MarketplaceAdmin';
import MarketplaceOrders from '@/pages/MarketplaceOrders';
import MarketplaceOrderDetail from '@/pages/MarketplaceOrderDetail';
import MarketplaceInvoices from '@/pages/MarketplaceInvoices';
import { iosPush } from "@/lib/push/iosPush";

const SPONSORED_POSTS_ENABLED = false;

const AppLayout = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (profile) {
      applyAutoAccessProtection(profile, navigate, location.pathname);
    }
  }, [profile, navigate, location.pathname]);

  useEffect(() => {
    if (profile?.is_deleted) {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const fromReactivate = params.get('reactivate') === '1';
        const flag = typeof window !== 'undefined' ? window.localStorage.getItem('ok_reactivate_requested') === '1' : false;

        if (fromReactivate || flag) {
          // Tenter une réactivation douce du profil
          supabase
            .from('profiles')
            .update({ is_deleted: false, updated_at: new Date().toISOString() })
            .eq('id', profile.id)
            .then(({ error }) => {
              if (!error) {
                try { window.localStorage.removeItem('ok_reactivate_requested'); } catch (_) {}
                toast({ title: 'Compte réactivé', description: 'Bienvenue à nouveau sur OneKamer !' });
                // Reste sur place; les composants se mettront à jour via le listener sur profile
              } else {
                toast({ title: 'Réactivation impossible', description: 'Veuillez contacter le support.', variant: 'destructive' });
                try { supabase.auth.signOut(); } catch {}
                navigate('/auth', { replace: true });
              }
            });
          return;
        }
      } catch (_) {}

      toast({ title: 'Compte supprimé', description: 'Votre compte a été supprimé. Vous pouvez créer un nouveau compte si nécessaire.' });
      try { supabase.auth.signOut(); } catch {}
      navigate('/auth', { replace: true });
    }
  }, [profile?.is_deleted, profile?.id, navigate, toast]);

  return null;
};

const AppContent = () => {
  const { showCharte, acceptCharte } = useCharteValidation();
  const { session, loading } = useAuth();
  const userId = session?.user?.id;
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const publicPaths = useMemo(() => ['/', '/invite', '/cgu', '/rgpd', '/mentions-legales'], []);
  const isPublic = !session && publicPaths.includes(location.pathname);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // 🔍 On détecte si on est dans l’app native iOS (Capacitor + WKWebView)
  const isIOSNativeApp =
    typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.getPlatform === 'function' &&
    window.Capacitor.getPlatform() === 'ios';

  useEffect(() => {
  if (!userId) return;
  if (!isIOSNativeApp) return;

  const t = setTimeout(() => {
    iosPush(userId);
  }, 800);

  return () => clearTimeout(t);
}, [userId, isIOSNativeApp, iosPush]);
  
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (event) => {
      const data = event?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'ok_push_in_app') {
        const p = data.payload || {};
        const rawUrl = p.url || '/';
        let path = '/';
        try {
          const u = new URL(rawUrl, window.location.origin);
          path = u.pathname + (u.search || '');
        } catch (_) {
          path = rawUrl;
        }
        toast({
          title: p.title || 'Notification',
          description: p.body || '',
          action: (
            <ToastAction altText="Ouvrir" onClick={() => navigate(path)}>
              Ouvrir
            </ToastAction>
          ),
        });
      } else if (data.type === 'ok_push_subscription_changed') {
        // no-op
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate, toast]);

  useEffect(() => {
    if (!session?.access_token) return;
    let mounted = true;
    const loadAndToast = async () => {
      try {
        const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
        const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;
        const PREFIX = `${apiBaseUrl}/api`;
        const res = await fetch(`${PREFIX}/trophies/my`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const data = await res.json().catch(() => ({}));
        if (!mounted || !res.ok) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        const unlocked = items.filter((it) => it && it.unlocked && it.key).map((it) => String(it.key));
        let prev = [];
        try { prev = JSON.parse(localStorage.getItem('ok_trophies_unlocked') || '[]'); } catch (_) {}
        const hadPrev = Array.isArray(prev) && prev.length > 0;
        const prevSet = new Set(Array.isArray(prev) ? prev : []);
        const nowSet = new Set(unlocked);
        const newly = unlocked.filter((k) => !prevSet.has(k));
        if (hadPrev && newly.length) {
          try { localStorage.setItem('ok_trophies_unlocked', JSON.stringify(Array.from(nowSet))); } catch (_) {}
          newly.forEach((k) => {
            const t = items.find((it) => String(it.key) === k);
            const name = t?.name || 'Un trophée';
            toast({
              title: 'Trophée débloqué',
              description: `Vous avez gagné: ${name}`,
              action: (
                <ToastAction altText="Voir" onClick={() => navigate('/compte/trophees')}>
                  Voir
                </ToastAction>
              ),
            });
          });
        } else {
          try { localStorage.setItem('ok_trophies_unlocked', JSON.stringify(Array.from(nowSet))); } catch (_) {}
        }
      } catch (_) {}
    };
    loadAndToast();
    const iv = setInterval(loadAndToast, 60000);
    const onFocus = () => loadAndToast();
    const onVisible = () => { try { if (document.visibilityState === 'visible') loadAndToast(); } catch (_) {} };
    const onCheck = () => loadAndToast();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('ok_trophy_check', onCheck);
    return () => {
      mounted = false;
      clearInterval(iv);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('ok_trophy_check', onCheck);
    };
  }, [session?.access_token, navigate, toast]);

  useEffect(() => {
    if (loading) return;
    if (session) return;

    const allowNoSessionExact = new Set([
      ...publicPaths,
      '/auth',
      '/reset-password',
      '/merci-verification',
      '/verification-sms',
      '/paiement-success',
      '/paiement-annule',
    ]);

    if (allowNoSessionExact.has(location.pathname)) return;
    if (location.pathname.startsWith('/marketplace')) return;
    if (location.pathname.startsWith('/forfaits')) return;
    if (location.pathname.startsWith('/aide')) return;

    navigate('/auth', { replace: true });
  }, [loading, session, location.pathname, navigate, publicPaths]);

  return (
    <>
      {!isPublic ? <Header deferredPrompt={deferredPrompt} /> : <PublicHeader />}
      <AppLayout />
      {isPublic ? (
       <div
    className="container mx-auto px-4 min-h-screen"
    style={
      isIOSNativeApp
        ? {
            paddingTop: 'var(--safe-top)',
            paddingBottom: 'var(--safe-bottom)',
          }
        : undefined
    }
  >
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/cgu" element={<CguPage />} />
          <Route path="/rgpd" element={<RgpdPage />} />
          <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
       </div>
      ) : (
      <main
  className="container mx-auto px-4 pb-24 pt-20"
  style={
    isIOSNativeApp
      ? {
          paddingTop: 'calc(4rem + var(--safe-top))', // 4rem = 64px (header)
          paddingBottom: 'calc(4rem + var(--safe-bottom))', // 4rem = bottom nav
        }
      : undefined // équivalent pt-20 (80px) pour le web/PWA
  }
>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/annonces" element={<Annonces />} />
          <Route path="/partenaires" element={<Partenaires />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/marketplace/partner/:partnerId" element={<MarketplacePartner />} />
          <Route path="/marketplace/cart" element={<MarketplaceCart />} />
          <Route path="/marketplace/ma-boutique" element={<MarketplaceMyShop />} />
          <Route path="/marketplace/ma-boutique/produits" element={<MarketplaceMyProducts />} />
          <Route path="/compte/marketplace-admin" element={<MarketplaceAdmin />} />
          <Route path="/market/orders" element={<MarketplaceOrders />} />
          <Route path="/market/orders/:orderId" element={<MarketplaceOrderDetail />} />
          <Route path="/market/invoices" element={<MarketplaceInvoices />} />
          <Route path="/echange" element={<Echange />} />
          <Route path="/evenements" element={<Evenements />} />
          <Route path="/rencontre" element={<Rencontre />} />
          <Route path="/rencontre/messages" element={<RencontreMessages />} />
          <Route path="/rencontre/messages/:conversationId" element={<ConversationDetail />} />
          <Route path="/rencontre/profil" element={<RencontreProfil />} />
          {/* <Route path="/rencontre/profil/:id" element={<RencontreProfilDetail />} /> */}
          <Route path="/faits-divers" element={<FaitsDivers />} />
          <Route path="/groupes" element={<Groupes />} />
          <Route path="/groupes/creer" element={<CreateGroupe />} />
          <Route path="/groupes/invitations" element={<GroupInvitations />} />
          <Route path="/groupes/:groupId" element={<GroupeDetail />} />
          <Route path="/ok-coins" element={<OKCoins />} />
          <Route path="/pay/okcoins/:packId" element={<PayOKCoins />} />
          <Route path="/pay/events/:eventId" element={<PayEvent />} />
          <Route path="/pay/market/:orderId" element={<PayMarket />} />
          <Route path="/forfaits" element={<Forfaits />} />
          <Route path="/compte" element={<Compte />} />
          <Route path="/compte/mes-posts-sponsorises" element={SPONSORED_POSTS_ENABLED ? <MesPostsSponsorises /> : <Navigate to="/compte" replace />} />
          <Route path="/compte/emails-admin" element={<EmailsAdmin />} />
          <Route path="/compte/admin-utilisateurs" element={<AdminUsers />} />
          <Route path="/compte/admin-invitations" element={<AdminInvitations />} />
          <Route path="/compte/influenceurs-admin" element={<InfluenceursAdmin />} />
          <Route path="/compte/moderation" element={<ModerationAdmin />} />
          <Route path="/compte/okcoins-admin" element={<OKCoinsAdminLab />} />
          <Route path="/compte/support-admin" element={<SupportAdmin />} />
          <Route path="/compte/notifications-admin" element={<NotificationsAdmin />} />
          <Route path="/compte/admin" element={<AdminHub />} />
          <Route path="/compte/okcoins-transactions" element={<OKCoinsTransactions />} />
          <Route path="/compte/mes-stats-influenceur" element={<InfluenceurStats />} />
          <Route path="/compte/mon-qrcode" element={<MonQRCode />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/compte/modifier" element={<ModifierProfil />} />
          <Route path="/compte/notifications" element={<Notifications />} />
          <Route path="/compte/confidentialite" element={<Confidentialite />} />
          <Route path="/compte/favoris" element={<Favoris />} />
          <Route path="/compte/trophees" element={<Trophees />} />
          <Route path="/compte/comptes-bloques" element={<BlockedAccounts />} />
          <Route path="/compte/mes-signalements" element={<ReportsHistory />} />
          <Route path="/publier" element={<Publier />} />
          <Route path="/publier/annonce" element={<CreateAnnonce />} />
          <Route path="/publier/evenement" element={<CreateEvenement />} />
          <Route path="/publier/partenaire" element={<ProposerPartenaire />} />
          <Route path="/rechercher" element={<Rechercher />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/profil/:userId" element={<UserProfile />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/merci-verification" element={<MerciVerification />} />
          <Route path="/verification-sms" element={<VerificationSMS />} />
          <Route path="/paiement-success" element={<PaiementSuccess />} />
          <Route path="/paiement-annule" element={<PaiementAnnule />} />
          <Route path="/aide" element={<SupportCenter />} />
          <Route path="/cgu" element={<CguPage />} />
          <Route path="/rgpd" element={<RgpdPage />} />
          <Route path="/mentions-legales" element={<MentionsLegalesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      )}

      <ChartePopup show={showCharte} onAccept={acceptCharte} />
      {!isPublic && <BottomNav />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Helmet>
          <title>OneKamer.co - Communauté Camerounaise</title>
          <meta name="description" content="Application communautaire de la diaspora camerounaise - Annonces, Événements, Rencontres et plus" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#2BA84A" />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-[#FDF9F9] to-[#CDE1D5]">
          <AppContent />
          <OneSignalInitializer />
          <IosPwaPrompt />
        </div>

        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;
