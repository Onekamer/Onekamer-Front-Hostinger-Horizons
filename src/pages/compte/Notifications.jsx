import React, { useMemo, useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNotifPrefs } from '@/hooks/useNotifPrefs';
import { useWebPush } from '@/hooks/useWebPush';
import { iosPush } from "@/lib/push/iosPush";
import { androidPush } from "@/lib/push/androidPush";


const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://onekamer-server.onrender.com";

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bellHidden, setBellHidden, prefs, setPrefs, reset } = useNotifPrefs();
  const { active, permission, subscribed, endpoint, subscribe, unsubscribe, disableOnThisDevice, sendTest } = useWebPush(user?.id);
  const [loading, setLoading] = useState(false);

  const featureBell = useMemo(() => `${import.meta.env.VITE_FEATURE_NOTIF_BELL}` === 'true', []);

    const platform = (typeof window !== 'undefined' && window.Capacitor && typeof window.Capacitor.getPlatform === 'function') ? window.Capacitor.getPlatform() : null;
    const isNativeApp = typeof window !== "undefined" && window.Capacitor && typeof window.Capacitor.getPlatform === "function" && (platform === 'ios' || platform === 'android');
    const isIOSNativeApp = isNativeApp && platform === 'ios';
    const isAndroidNativeApp = isNativeApp && platform === 'android';

  // Sur iOS natif, ton "subscribed" webpush n'a pas de sens (pas de SW).
  // On se contente d'afficher "Actif" si on a déjà enregistré un token dans ce device (simple).
 const [iosEnabled, setIosEnabled] = useState(() => {
  try { return localStorage.getItem("ios_push_enabled") === "1"; } catch { return false; }
});
 const [androidEnabled, setAndroidEnabled] = useState(() => {
  try { return localStorage.getItem("android_push_enabled") === "1"; } catch { return false; }
});

// si tu veux être safe quand la page revient au premier plan
useEffect(() => {
  const onFocus = () => {
    try { setIosEnabled(localStorage.getItem("ios_push_enabled") === "1"); } catch {}
    try { setAndroidEnabled(localStorage.getItem("android_push_enabled") === "1"); } catch {}
  };
  window.addEventListener("focus", onFocus);
  return () => window.removeEventListener("focus", onFocus);
}, []);

    const handleSubscribe = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isIOSNativeApp) {
        await iosPush(user.id); // récupère token APNs + POST /push/register-device
        try { localStorage.setItem("ios_push_enabled", "1"); } catch {}
        setIosEnabled(true);
      } else if (isAndroidNativeApp) {
        await androidPush(user.id); // récupère token FCM + POST /push/register-device
        try { localStorage.setItem("android_push_enabled", "1"); } catch {}
        setAndroidEnabled(true);
      } else {
        await subscribe(); // web / android inchangé
      }
    } finally {
      setLoading(false);
    }
  };

    const handleDisableThisDevice = async () => {
    setLoading(true);
    try {
      if (isIOSNativeApp) {
        try { localStorage.removeItem("ios_push_enabled"); } catch {}
        setIosEnabled(false);
      } else if (isAndroidNativeApp) {
        try { localStorage.removeItem("android_push_enabled"); } catch {}
        setAndroidEnabled(false);
      } else {
        await disableOnThisDevice();
      }
    } finally {
      setLoading(false);
    }
  };

    const handleEnableThisDevice = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isIOSNativeApp) {
        await iosPush(user.id);
        try { localStorage.setItem("ios_push_enabled", "1"); } catch {}
        setIosEnabled(true);
      } else if (isAndroidNativeApp) {
        await androidPush(user.id);
        try { localStorage.setItem("android_push_enabled", "1"); } catch {}
        setAndroidEnabled(true);
      } else {
        await subscribe();
      }
    } finally {
      setLoading(false);
    }
  };
  
    const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      if (isIOSNativeApp) {
        // Sur iOS, désabonner = l'utilisateur coupe dans Réglages.
        // Ici on fait juste "désactiver côté UI locale".
        try { localStorage.removeItem("ios_push_enabled"); } catch {}
        setIosEnabled(false);
      } else if (isAndroidNativeApp) {
        try { localStorage.removeItem("android_push_enabled"); } catch {}
        setAndroidEnabled(false);
      } else {
        await unsubscribe();
      }
    } finally {
      setLoading(false);
    }
  };

    const handleTest = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isIOSNativeApp) {
        // S'assure qu'un token est bien enregistré
        await iosPush(user.id);
        try { localStorage.setItem("ios_push_enabled", "1"); } catch {}
        setIosEnabled(true);

        const res = await fetch(`${API_BASE}/api/push/send-ios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "🔔 Test OneKamer",
            message: "Si tu vois ça, tes notifications iOS sont OK ✅",
            targetUserIds: [user.id],
            url: "/compte/notifications",
            data: { type: "systeme" },
          }),
        });

        const txt = await res.text();
        if (!res.ok) {
          console.error("[iOS Push] test send failed:", res.status, txt);
        } else {
          console.log("[iOS Push] test send ok:", txt);
        }
      } else if (isAndroidNativeApp) {
        // S'assure qu'un token est bien enregistré
        await androidPush(user.id);
        try { localStorage.setItem("android_push_enabled", "1"); } catch {}
        setAndroidEnabled(true);

        const res = await fetch(`${API_BASE}/api/notifications/dispatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "🔔 Test OneKamer",
            message: "Si tu vois ça, tes notifications Android sont OK ✅",
            targetUserIds: [user.id],
            url: "/compte/notifications",
            data: { type: "systeme" },
          }),
        });
        const txt = await res.text();
        if (!res.ok) {
          console.error("[Android Push] test send failed:", res.status, txt);
        } else {
          console.log("[Android Push] test send ok:", txt);
        }
      } else {
        if (!subscribed) await subscribe();
        await sendTest();
      }
    } finally {
      setLoading(false);
    }
  };
  
    const effectiveSubscribed = isIOSNativeApp ? iosEnabled : (isAndroidNativeApp ? androidEnabled : subscribed);
  
  return (
    <>
      <Helmet>
        <title>Notifications - OneKamer</title>
      </Helmet>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => navigate('/compte')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au compte
          </Button>
          <h1 className="text-3xl font-bold text-[#2BA84A] mb-6">Paramètres de notifications</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notifications Push</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!user && (<div className="text-gray-600">Connectez-vous pour gérer vos notifications.</div>)}
              {user && (
                <>
                  <div className="flex items-center justify-between">
  <div className="text-sm text-gray-700">Statut</div>
  <div className="text-sm font-medium">
    {isIOSNativeApp
      ? (effectiveSubscribed ? "Activé (iOS)" : "Non activé (iOS)")
      : (active ? (effectiveSubscribed ? "Abonné" : "Non abonné") : "Non disponible")}
  </div>
</div>
                  <div className="flex items-center justify-between">
  <div className="text-sm text-gray-700">
    {isIOSNativeApp ? "Permission système" : isAndroidNativeApp ? "Permission système" : "Permission navigateur"}
  </div>
  <div className="text-sm font-medium">
    {isIOSNativeApp ? "Gérée par iOS" : isAndroidNativeApp ? "Gérée par Android" : permission}
  </div>
</div>
                  {!isNativeApp && endpoint && (
  <div className="text-xs text-gray-500 break-all">{endpoint}</div>
)}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {isNativeApp ? (
                      <>
                        {!effectiveSubscribed && (
                          <Button disabled={loading} onClick={handleSubscribe} className="bg-[#2BA84A] text-white">Activer</Button>
                        )}
                        <Button disabled={loading} onClick={handleTest} className="bg-[#2BA84A] text-white">Envoyer un test</Button>
                      </>
                    ) : (
                      <>
                        {!effectiveSubscribed ? (
                          <Button disabled={loading} onClick={handleSubscribe} className="bg-[#2BA84A] text-white">S'abonner</Button>
                        ) : (
                          <Button disabled={loading} onClick={handleUnsubscribe} className="bg-[#2BA84A] text-white">Se désabonner</Button>
                        )}
                        <Button disabled={loading} onClick={handleTest} className="bg-[#2BA84A] text-white">Envoyer un test</Button>
                      </>
                    )}
                  </div>
                  {isIOSNativeApp && (
                    <div className="text-xs text-gray-500 pt-2">Pour désactiver complètement : Réglages iPhone → Notifications → OneKamer.</div>
                  )}
                  {isAndroidNativeApp && (
                    <div className="text-xs text-gray-500 pt-2">Pour désactiver complètement : Paramètres Android → Notifications → OneKamer.</div>
                  )}
                  {!isNativeApp && (
                    <div className="pt-2">
                      {effectiveSubscribed ? (
                        <Button disabled={loading} onClick={handleDisableThisDevice} variant="outline" className="w-full">Désactiver sur cet appareil</Button>
                      ) : (
                        <Button disabled={loading} onClick={handleEnableThisDevice} variant="outline" className="w-full">Activer sur cet appareil</Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Affichage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Afficher la cloche de notifications</div>
                </div>
                <div className="origin-right scale-90 sm:scale-75">
                  <Switch
                    checked={!bellHidden}
                    onCheckedChange={(v) => setBellHidden(!v)}
                    className="data-[state=checked]:bg-[#2BA84A] data-[state=unchecked]:bg-gray-300"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catégories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'mentions', label: 'Mentions' },
                { key: 'annonces', label: 'Annonces' },
                { key: 'evenements', label: 'Événements' },
                { key: 'systeme', label: 'Système' },
                { key: 'partenaires', label: 'Partenaires' },
                { key: 'faits_divers', label: 'Faits divers' },
                { key: 'groupes', label: 'Groupes' },
                { key: 'rencontre', label: 'Rencontre' },
                { key: 'marketplace', label: 'Marketplace' },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between">
                  <div className="text-sm">{row.label}</div>
                  <div className="origin-right scale-90 sm:scale-75">
                    <Switch
                      checked={!!prefs[row.key]}
                      onCheckedChange={(v) => setPrefs({ ...prefs, [row.key]: !!v })}
                      className="data-[state=checked]:bg-[#2BA84A] data-[state=unchecked]:bg-gray-300"
                    />
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <Button variant="outline" onClick={reset} className="w-full">Réinitialiser les préférences</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default Notifications;
