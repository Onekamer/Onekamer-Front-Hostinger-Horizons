import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const EmailsAdmin = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [adminSubject, setAdminSubject] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminEmails, setAdminEmails] = useState('');
  const [adminSending, setAdminSending] = useState(false);
  const [segment, setSegment] = useState('all'); // all | free | standard | vip | custom
  const [recipientCount, setRecipientCount] = useState(null);
  const [countLoading, setCountLoading] = useState(false);

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile.role === 'admin';
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  const adminApiToken = import.meta.env.VITE_ADMIN_API_TOKEN;
  const serverUrlEnv = import.meta.env.VITE_SERVER_URL || '';
  const serverUrl = (serverUrlEnv || 'https://onekamer-server.onrender.com').replace(/\/$/, '');

  useEffect(() => {
    if (!adminApiToken) {
      setRecipientCount(null);
      return;
    }

    if (segment === 'custom') {
      const emails = adminEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      setRecipientCount(emails.length);
      setCountLoading(false);
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      try {
        setCountLoading(true);
        setRecipientCount(null);

        const res = await fetch(`${serverUrl}/admin/email/count-segment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminApiToken,
          },
          body: JSON.stringify({ segment }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Erreur lors du comptage des destinataires');
        }
        setRecipientCount(typeof data.count === 'number' ? data.count : 0);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error(err);
          setRecipientCount(null);
        }
      } finally {
        setCountLoading(false);
      }
    };

    run();

    return () => controller.abort();
  }, [segment, adminEmails, adminApiToken, serverUrl]);

  return (
    <>
      <Helmet>
        <title>Emails admin - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Envoyer des emails (admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!adminApiToken && (
              <p className="text-red-500 text-xs font-medium">
                Le token admin n'est pas configuré (VITE_ADMIN_API_TOKEN).
              </p>
            )}

            <div className="space-y-1">
              <label className="block font-medium">Sujet</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                value={adminSubject}
                onChange={(e) => setAdminSubject(e.target.value)}
                placeholder="Sujet de l'email"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium">Message</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[200px] focus:outline-none focus:ring focus:ring-green-500/40"
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                placeholder="Contenu de l'email"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium">Destinataires</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
              >
                <option value="all">Toute la base avec email</option>
                <option value="free">Plans Free</option>
                <option value="standard">Plans Standard</option>
                <option value="vip">Plans VIP</option>
                <option value="custom">Au choix (emails ci-dessous)</option>
              </select>
              <p className="text-xs text-gray-500">
                Choisissez qui recevra cet email. "Au choix" permet de saisir les emails manuellement.
              </p>
              {adminApiToken && (
                <p className="text-xs text-gray-500 mt-1">
                  {segment === 'custom'
                    ? `Destinataires saisis : ${recipientCount ?? 0}`
                    : countLoading
                    ? 'Calcul du nombre de destinataires…'
                    : `Destinataires potentiels : ${recipientCount ?? 0}`}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block font-medium">Emails (séparés par des virgules)</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring focus:ring-green-500/40"
                value={adminEmails}
                onChange={(e) => setAdminEmails(e.target.value)}
                placeholder="ex: contact@onekamer.co, william@ndamboa.com"
                disabled={segment !== 'custom'}
              />
              {segment !== 'custom' && (
                <p className="text-xs text-gray-500">
                  Zone désactivée : les emails seront choisis automatiquement selon le segment.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                disabled={adminSending}
                onClick={async () => {
                  if (!adminApiToken) {
                    toast({
                      title: 'Configuration manquante',
                      description: "VITE_ADMIN_API_TOKEN n'est pas défini.",
                      variant: 'destructive',
                    });
                    return;
                  }

                  const emails = adminEmails
                    .split(',')
                    .map((e) => e.trim())
                    .filter((e) => e.length > 0);

                  if (!adminSubject || !adminMessage || (segment === 'custom' && emails.length === 0)) {
                    toast({
                      title: 'Champs incomplets',
                      description:
                        segment === 'custom'
                          ? 'Sujet, message et au moins un email sont requis.'
                          : 'Sujet et message sont requis.',
                      variant: 'destructive',
                    });
                    return;
                  }

                  setAdminSending(true);
                  try {
                    const res = await fetch(`${serverUrl}/admin/email/enqueue-info-all-users`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-admin-token': adminApiToken,
                      },
                      body: JSON.stringify({
                        subject: adminSubject,
                        message: adminMessage,
                        emails: segment === 'custom' ? emails : [],
                        segment: segment === 'custom' ? 'custom' : segment,
                      }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data?.error || 'Erreur lors de la création des emails');
                    }

                    toast({
                      title: 'Emails créés',
                      description: `${data.inserted || 0} emails en file (cible: ${data.mode || 'all'})`,
                    });
                  } catch (error) {
                    console.error(error);
                    toast({
                      title: 'Erreur',
                      description: error.message || 'Impossible de créer les emails.',
                      variant: 'destructive',
                    });
                  } finally {
                    setAdminSending(false);
                  }
                }}
                className="flex-1"
              >
                {adminSending ? 'Envoi en cours...' : 'Créer les emails'}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={adminSending}
                onClick={async () => {
                  if (!adminApiToken) {
                    toast({
                      title: 'Configuration manquante',
                      description: "VITE_ADMIN_API_TOKEN n'est pas défini.",
                      variant: 'destructive',
                    });
                    return;
                  }

                  setAdminSending(true);
                  try {
                    const res = await fetch(`${serverUrl}/admin/email/process-jobs`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-admin-token': adminApiToken,
                      },
                      body: JSON.stringify({ limit: 50 }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data?.error || 'Erreur lors du traitement des emails');
                    }

                    toast({
                      title: 'Traitement des emails',
                      description: `Emails envoyés: ${data.sent || 0}, erreurs: ${data.errors?.length || 0}`,
                    });
                  } catch (error) {
                    console.error(error);
                    toast({
                      title: 'Erreur',
                      description: error.message || 'Impossible de traiter les emails.',
                      variant: 'destructive',
                    });
                  } finally {
                    setAdminSending(false);
                  }
                }}
                className="flex-1"
              >
                Traiter les emails
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default EmailsAdmin;
