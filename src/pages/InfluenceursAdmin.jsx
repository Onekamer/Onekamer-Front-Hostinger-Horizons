import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const SERVER_URL_ENV = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
const SERVER_URL = (SERVER_URL_ENV || '').replace(/\/$/, '');
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_API_TOKEN;

const InfluenceursAdmin = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile.role === 'admin';
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${SERVER_URL}/admin/influenceurs-promo`, {
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': ADMIN_TOKEN || '',
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Erreur lors du chargement des stats influenceurs');
        }
        setItems(data.items || []);
      } catch (e) {
        setError(e.message || 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <Helmet>
        <title>Influenceurs & Codes promo - OneKamer.co</title>
      </Helmet>
      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => window.history.back()}>
          ← Retour à mon compte
        </Button>

        <h1 className="text-2xl font-bold">Influenceurs & Codes promo</h1>
        <p className="text-sm text-gray-600">
          Vue PROD. Permet de suivre les stats globales des codes promo par influenceur.
        </p>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-green-500" />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-gray-500">Aucun influenceur configuré pour le moment.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.promo_code_id || item.influenceur_id}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>{item.nom_public || 'Influenceur sans nom'}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {item.handle || item.canal_principal || 'N/A'}
                    </span>
                  </CardTitle>
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
                      <span className="font-semibold">Usages :</span>{' '}
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
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default InfluenceursAdmin;
