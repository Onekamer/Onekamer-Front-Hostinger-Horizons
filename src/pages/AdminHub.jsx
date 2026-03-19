import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AdminHub = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }
  const isAdmin = profile.role === 'admin' || profile.is_admin === true || profile.is_admin === 1 || profile.is_admin === 'true';
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  const items = [
    { path: '/compte/notifications-admin', label: 'Envoyer une notification (admin)' },
    { path: '/compte/emails-admin', label: 'Envoyer des emails (admin)' },
    { path: '/compte/admin-utilisateurs', label: 'Gestion utilisateurs (admin)' },
    { path: '/compte/moderation', label: 'Modération' },
    { path: '/compte/admin-invitations', label: 'Dashboard invitations (admin)' },
    { path: '/compte/marketplace-admin', label: 'Gestion Marketplace' },
    { path: '/compte/support-admin', label: 'Centre d\'aide (Admin)' },
    { path: '/scan', label: 'Scanner QR (Admin)' },
    { path: '/compte/okcoins-admin', label: 'Retraits OK COINS' },
    { path: '/compte/okcoins-transactions', label: 'Transactions OK COINS' },
    { path: '/compte/influenceurs-admin', label: 'Influenceurs (Admin)' },
  ];

  return (
    <>
      <Helmet>
        <title>Espace Admin - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Espace Admin</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((it) => (
              <Button key={it.path} type="button" onClick={() => navigate(it.path)}>
                {it.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AdminHub;
