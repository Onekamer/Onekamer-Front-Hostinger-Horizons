import React, { useState } from 'react';
    import { Helmet } from 'react-helmet';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
    import { useToast } from '@/components/ui/use-toast';
    import { useNavigate } from 'react-router-dom';
    import { Loader2 } from 'lucide-react';
    import { supabase } from '@/lib/customSupabaseClient';

    const INVITE_CODE_STORAGE_KEY = 'onekamer_invite_code';

    const ForgotPasswordForm = ({ onBack }) => {
        const [email, setEmail] = useState('');
        const [loading, setLoading] = useState(false);
        const { toast } = useToast();

        const handlePasswordReset = async (e) => {
            e.preventDefault();
            setLoading(true);
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            setLoading(false);
            if (error) {
                toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
            } else {
                toast({ title: 'Succès', description: '✅ Un lien de réinitialisation a été envoyé à votre adresse email.' });
                onBack();
            }
        };

        return (
            <Card>
                <CardHeader>
                    <CardTitle>Mot de passe oublié</CardTitle>
                    <CardDescription>Entrez votre email pour recevoir un lien de réinitialisation.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="reset-email">Email</Label>
                            <Input id="reset-email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Envoyer le lien
                        </Button>
                        <Button variant="link" className="w-full" onClick={onBack}>Retour à la connexion</Button>
                    </form>
                </CardContent>
            </Card>
        );
    };

const AuthPage = () => {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');

  const handleResendConfirmation = async (e) => {
    e.preventDefault();
    if (!registerEmail) {
      toast({ title: "Email requis", description: "Saisissez votre email dans le formulaire d'inscription pour renvoyer le lien.", variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: registerEmail,
      options: { emailRedirectTo: `${window.location.origin}/merci-verification` }
    });
    setLoading(false);
    if (error) {
      toast({ title: "Échec de l'envoi", description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Code renvoyé', description: '📬 Un nouveau code a été envoyé à votre e-mail.' });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn({ email: loginEmail, password: loginPassword });
    if (!error) {
      toast({ title: 'Connexion réussie !', description: 'Bienvenue à nouveau !' });
      navigate('/compte');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(
      { email: registerEmail, password: registerPassword },
      { 
        data: { username: registerUsername },
        emailRedirectTo: `${window.location.origin}/merci-verification` 
      }
    );
    if (!error) {
      toast({ title: 'Inscription réussie !', description: 'Un code de vérification vous a été envoyé par e-mail.' });
      try {
        window.sessionStorage.setItem('ok_signup_email', registerEmail);
        window.sessionStorage.setItem('ok_signup_pw', registerPassword);
      } catch (_) {}
      try { navigate(`/merci-verification?email=${encodeURIComponent(registerEmail)}`); } catch (_) {}

      try {
        if (!API_PREFIX) return;
        const code = String(localStorage.getItem(INVITE_CODE_STORAGE_KEY) || '').trim();
        if (code) {
          await fetch(`${API_PREFIX}/invites/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              event: 'signup',
              user_email: registerEmail,
              user_username: registerUsername,
            }),
          });
        }
      } catch {}
    } else {
      // Cas email déjà existant: tenter de distinguer profil supprimé vs compte actif
      const msg = String(error?.message || '').toLowerCase();
      const looksExisting = msg.includes('already') || msg.includes('exist');
      try {
        if (looksExisting) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id,is_deleted')
            .eq('email', registerEmail)
            .maybeSingle();

          if (prof?.is_deleted === true) {
            try { window.localStorage.setItem('ok_reactivate_requested', '1'); } catch (_) {}
            // Tenter une connexion directe avec le mot de passe saisi pour réactiver automatiquement
            const { error: loginErr } = await signIn({ email: registerEmail, password: registerPassword });
            if (!loginErr) {
              toast({ title: 'Réactivation en cours', description: 'Connexion réussie. Votre compte va être réactivé.' });
              setLoading(false);
              navigate('/compte');
              return;
            }
            // Mot de passe inconnu → orienter vers reset
            toast({ title: 'Compte supprimé détecté', description: 'Votre compte existe (supprimé). Utilisez "Mot de passe oublié" pour le réactiver.', variant: 'destructive' });
            setShowForgotPassword(true);
            setLoading(false);
            return;
          }

          // Compte actif: guider vers reset mot de passe
          toast({ title: 'Compte existant', description: 'Cet e-mail est déjà utilisé. Utilisez "Mot de passe oublié" pour accéder à votre compte.' , variant: 'destructive' });
          setShowForgotPassword(true);
          setLoading(false);
          return;
        }
      } catch (_) {
        // ignore et laisser tomber sur gestion générique
      }

      // Gestion générique des autres erreurs d’inscription
      toast({ title: 'Inscription impossible', description: error.message || 'Veuillez réessayer plus tard.', variant: 'destructive' });
    }
    setLoading(false);
  };

  if (showForgotPassword) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Connexion / Inscription - OneKamer.co</title>
        <meta name="description" content="Rejoignez la communauté OneKamer.co ou connectez-vous à votre compte." />
      </Helmet>
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Tabs defaultValue="login" className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="register">Inscription</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Connexion</CardTitle>
                <CardDescription>Accédez à votre compte pour continuer.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="m@example.com" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Mot de passe</Label>
                    <Input id="login-password" type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                  </div>
                  <div className="text-right">
                    <Button variant="link" type="button" className="text-sm text-gray-600 p-0 h-auto" onClick={() => setShowForgotPassword(true)}>
                      Mot de passe oublié ?
                    </Button>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Se connecter
                  </Button>
                  
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Inscription</CardTitle>
                <CardDescription>Créez un compte pour rejoindre la communauté.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Nom d'utilisateur</Label>
                    <Input id="register-username" required value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input id="register-email" type="email" placeholder="m@example.com" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Mot de passe</Label>
                    <Input id="register-password" type="password" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    S'inscrire
                  </Button>
                  <div className="text-center">
                    <Button type="button" variant="link" onClick={handleResendConfirmation} disabled={loading}>
                      Renvoyer le code par e-mail
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default AuthPage;