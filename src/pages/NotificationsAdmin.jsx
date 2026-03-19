import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const NotificationsAdmin = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile.role === 'admin' || profile.is_admin === true || profile.is_admin === 1 || profile.is_admin === 'true';
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  const sendBroadcast = async () => {
    if (!API_BASE_URL) {
      toast({ title: 'Configuration manquante', description: "VITE_API_URL n'est pas défini.", variant: 'destructive' });
      return;
    }
    if (!title || !message) {
      toast({ title: 'Champs incomplets', description: 'Titre et message sont requis.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const body = {
        title: title.trim(),
        message: message.trim(),
        data: { type: 'system' },
        url: url && url.trim() ? url.trim() : '/',
        segment: 'subscribed_users',
      };

      let res = await fetch(`${API_BASE_URL}/notifications/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // Fallback alias /api/...
        res = await fetch(`${API_BASE_URL}/api/notifications/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de l\'envoi de la notification');
      }

      toast({ title: 'Notification envoyée', description: 'Le broadcast a été déclenché.' });
      setTitle('');
      setMessage('');
      setUrl('');
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d\'envoyer la notification.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Notifications système (Admin) - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Envoyer une notification système (admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <label className="block font-medium">Titre</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre de la notification"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium">Message</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[160px] focus:outline-none focus:ring focus:ring-green-500/40"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contenu à afficher dans le toast / push"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium">URL (optionnelle)</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="/echange, /evenements, https://onekamer.co/..."
              />
              <p className="text-xs text-gray-500">Par défaut, la notification redirige vers l\'accueil.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" disabled={sending} onClick={sendBroadcast} className="flex-1">
                {sending ? 'Envoi en cours...' : 'Envoyer à tous les utilisateurs'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default NotificationsAdmin;
