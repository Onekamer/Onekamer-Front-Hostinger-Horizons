import React, { useMemo, useState } from 'react';
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

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bellHidden, setBellHidden, prefs, setPrefs, reset } = useNotifPrefs();
  const { active, permission, subscribed, endpoint, subscribe, unsubscribe, disableOnThisDevice, sendTest } = useWebPush(user?.id);
  const [loading, setLoading] = useState(false);

  const featureBell = useMemo(() => `${import.meta.env.VITE_FEATURE_NOTIF_BELL}` === 'true', []);

  const handleSubscribe = async () => {
    if (!user) return;
    setLoading(true);
    try { await subscribe(); } finally { setLoading(false); }
  };

  const handleDisableThisDevice = async () => {
    setLoading(true);
    try { await disableOnThisDevice(); } finally { setLoading(false); }
  };

  const handleEnableThisDevice = async () => {
    if (!user) return;
    setLoading(true);
    try { await subscribe(); } finally { setLoading(false); }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    await unsubscribe();
    setLoading(false);
  };

  const handleTest = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (!subscribed) { await subscribe(); }
      await sendTest();
    } finally { setLoading(false); }
  };

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
                    <div className="text-sm font-medium">{active ? (subscribed ? 'Abonné' : 'Non abonné') : 'Non disponible'}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">Permission navigateur</div>
                    <div className="text-sm font-medium">{permission}</div>
                  </div>
                  {endpoint && (<div className="text-xs text-gray-500 break-all">{endpoint}</div>)}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {!subscribed ? (
                      <Button disabled={loading} onClick={handleSubscribe} className="bg-[#2BA84A] text-white">S'abonner</Button>
                    ) : (
                      <Button disabled={loading} onClick={handleUnsubscribe} className="bg-[#2BA84A] text-white">Se désabonner</Button>
                    )}
                    <Button disabled={loading} onClick={handleTest} className="bg-[#2BA84A] text-white">Envoyer un test</Button>
                  </div>
                  <div className="pt-2">
                    {subscribed ? (
                      <Button disabled={loading} onClick={handleDisableThisDevice} variant="outline" className="w-full">Désactiver sur cet appareil</Button>
                    ) : (
                      <Button disabled={loading} onClick={handleEnableThisDevice} variant="outline" className="w-full">Activer sur cet appareil</Button>
                    )}
                  </div>
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
                  <div className="text-xs text-gray-500">Contrôle local sur cet appareil</div>
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