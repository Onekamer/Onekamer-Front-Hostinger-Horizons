import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const ModerationAdmin = () => {
  const { user, profile, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actions, setActions] = useState([]);

  const isAdmin = useMemo(() => {
    return (
      profile?.is_admin === true ||
      profile?.is_admin === 1 ||
      profile?.is_admin === 'true' ||
      String(profile?.role || '').toLowerCase() === 'admin'
    );
  }, [profile]);

  const API_PREFIX = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = session?.access_token;
        if (!token) throw new Error('Session expirée');

        const res = await fetch(`${API_PREFIX}/admin/moderation/actions?limit=100`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

        setActions(Array.isArray(data?.actions) ? data.actions : []);
      } catch (e) {
        const msg = e?.message || 'Erreur interne';
        setError(msg);
        toast({ title: 'Erreur', description: msg, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    if (user && profile && isAdmin) {
      run();
    }
  }, [user, profile, isAdmin, session, API_PREFIX]);

  if (authLoading) {
    return (
      <div className="space-y-4">
        <div>Chargement…</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Modération - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Modération</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading && <div>Chargement…</div>}
            {!loading && error && <div className="text-red-600">{error}</div>}

            {!loading && !error && actions.length === 0 && (
              <div className="text-gray-600">Aucune action pour le moment.</div>
            )}

            {!loading && !error && actions.length > 0 && (
              <div className="space-y-3">
                {actions.map((a) => (
                  <div key={a.id} className="border rounded-md p-3 bg-white">
                    <div className="font-semibold">
                      {a.target_username || a.target_user_id} — {a.reason || a.action_type}
                    </div>
                    <div className="text-xs text-gray-500">
                      Admin : {a.admin_username || a.admin_user_id}
                      {' • '}
                      {a.created_at ? new Date(a.created_at).toLocaleString('fr-FR') : ''}
                    </div>
                    {a.message && <div className="mt-2 whitespace-pre-wrap">{a.message}</div>}
                    <div className="mt-2 text-xs text-gray-600">
                      Notif : {a.notification_sent ? 'OK' : 'KO'}
                      {' • '}
                      Email : {a.email_sent ? 'OK' : 'KO'}
                      {a.delivery_error ? ` • Erreur : ${a.delivery_error}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ModerationAdmin;
