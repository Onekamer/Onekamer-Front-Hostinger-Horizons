import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const SERVER_URL_ENV = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
const SERVER_URL = (SERVER_URL_ENV || '').replace(/\/$/, '');

const InfluenceurStats = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const [error, setError] = useState(null);

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${SERVER_URL}/influenceur/mes-stats`);
        url.searchParams.set('userId', user.id);
        const res = await fetch(url.toString(), {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Erreur lors du chargement de vos stats');
        }
        setItem(data.item || null);
      } catch (e) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  return (
    <>
      <Helmet>
        <title>Mes stats d'influenceur - OneKamer.co</title>
      </Helmet>
      <div className="space-y-4">
        <button className="px-0 text-sm" onClick={() => window.history.back()}>
          ← Retour à mon compte
        </button>

        <h1 className="text-2xl font-bold">Mes stats d'influenceur</h1>
        <p className="text-sm text-gray-600">
          Si vous êtes configuré comme influenceur, vous verrez ici les performances de votre code promo.
        </p>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && !item && (
          <p className="text-sm text-gray-500">
            Vous n'êtes pas encore configuré comme influenceur dans OneKamer. Contactez l'équipe si vous pensez que c'est une erreur.
          </p>
        )}

        {!loading && !error && item && (
          <Card>
            <CardHeader>
              <CardTitle>{item.nom_public || profile.username}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="font-semibold">Code promo :</span>{' '}
                  <span className="font-mono">{item.code || '—'}</span>
                </div>
                <div>
                  <span className="font-semibold">Actif :</span>{' '}
                  <span className={item.actif ? 'text-green-600' : 'text-red-600'}>
                    {item.actif ? 'Oui' : 'Non'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Nombre d'utilisations :</span>{' '}
                  {item.total_usages}
                </div>
                <div>
                  <span className="font-semibold">Utilisateurs distincts :</span>{' '}
                  {item.total_users_distincts}
                </div>
                <div>
                  <span className="font-semibold">Montant total payé :</span>{' '}
                  {(item.total_amount_paid || 0) / 100} €
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default InfluenceurStats;
