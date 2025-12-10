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
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nom_public: '',
    identifiant_reseau: '',
    email: '',
    code: '',
    stripe_promotion_code_id: '',
    date_debut: '',
    date_fin: '',
    actif: true,
    ok_coins_bonus: 0,
  });

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile.role === 'admin';
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload = {
        ...form,
        ok_coins_bonus:
          form.ok_coins_bonus === '' || isNaN(Number(form.ok_coins_bonus))
            ? 0
            : Number(form.ok_coins_bonus),
      };

      const res = await fetch(`${SERVER_URL}/admin/influenceurs-promo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': ADMIN_TOKEN || '',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création de l'influenceur");
      }

      setForm({
        nom_public: '',
        identifiant_reseau: '',
        email: '',
        code: '',
        stripe_promotion_code_id: '',
        date_debut: '',
        date_fin: '',
        actif: true,
        ok_coins_bonus: 0,
      });

      await fetchData();
      setShowForm(false);
    } catch (e) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setCreating(false);
    }
  };

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

        {!showForm && (
          <div className="pt-2">
            <Button type="button" variant="outline" onClick={() => setShowForm(true)}>
              Ajouter un influenceur
            </Button>
          </div>
        )}

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Créer un influenceur + code promo</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom public *</label>
                    <input
                      type="text"
                      name="nom_public"
                      value={form.nom_public}
                      onChange={handleChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Identifiant réseau social</label>
                    <input
                      type="text"
                      name="identifiant_reseau"
                      value={form.identifiant_reseau}
                      onChange={handleChange}
                      placeholder="ex: @willy_insta"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email OneKamer (pour lier au profil)</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="influenceur@example.com"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Code promo *</label>
                    <input
                      type="text"
                      name="code"
                      value={form.code}
                      onChange={handleChange}
                      placeholder="DEMOFREE1"
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ID Promotion Code Stripe *</label>
                    <input
                      type="text"
                      name="stripe_promotion_code_id"
                      value={form.stripe_promotion_code_id}
                      onChange={handleChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
                      <input
                        type="date"
                        name="date_debut"
                        value={form.date_debut}
                        onChange={handleChange}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
                      <input
                        type="date"
                        name="date_fin"
                        value={form.date_fin}
                        onChange={handleChange}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Bonus OK Coins</label>
                    <input
                      type="number"
                      name="ok_coins_bonus"
                      value={form.ok_coins_bonus}
                      onChange={handleChange}
                      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      min="0"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <input
                      id="actif"
                      type="checkbox"
                      name="actif"
                      checked={form.actif}
                      onChange={handleChange}
                      className="h-4 w-4 text-green-600 border-gray-300 rounded"
                    />
                    <label htmlFor="actif" className="text-xs font-medium text-gray-700">
                      Code actif
                    </label>
                  </div>
                </div>

                <Button type="submit" className="mt-2" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Créer linfluenceur'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default InfluenceursAdmin;
