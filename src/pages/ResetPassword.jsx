import React, { useEffect, useState } from 'react';

import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasSession, setHasSession] = useState(true);
    const [email, setEmail] = useState('');

    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        const init = async () => {
            try {
                const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : '';
                const search = window.location.search?.startsWith('?') ? window.location.search.slice(1) : '';
                const params = new URLSearchParams(hash || search);
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');
                if (access_token && refresh_token) {
                    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
                    if (!error && data?.session) {
                        setHasSession(true);
                        try { window.history.replaceState({}, document.title, window.location.pathname); } catch (_) {}
                        return;
                    }
                }
                const { data } = await supabase.auth.getSession();
                setHasSession(!!data?.session);
            } catch (_) {
                setHasSession(false);
            }
        };
        init();
    }, []);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!hasSession) {
            setError("Lien expiré. Veuillez renvoyer l'e-mail de réinitialisation ci-dessous.");
            return;
        }
        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }
        if (password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) {
                toast({ title: 'Erreur', description: updateError.message, variant: 'destructive' });
            } else {
                toast({ title: 'Succès', description: 'Votre mot de passe a été mis à jour avec succès ✅' });
                navigate('/auth');
            }
        } catch (err) {
            toast({ title: 'Erreur', description: err?.message || "Impossible de mettre à jour le mot de passe.", variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async (e) => {
        e.preventDefault();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Veuillez saisir un e-mail valide.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const redirectTo = `${window.location.origin}/reset-password`;
            const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
            if (err) {
                toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
            } else {
                toast({ title: 'E-mail envoyé', description: 'Vérifiez votre boîte mail pour continuer.' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Helmet>
                <title>Réinitialiser le mot de passe - OneKamer.co</title>
            </Helmet>
            <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Réinitialiser le mot de passe</CardTitle>
                        <CardDescription>
                            {hasSession ? 'Entrez votre nouveau mot de passe.' : 'Votre lien est invalide ou expiré. Renvoyez un e-mail pour continuer.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {hasSession ? (
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">Nouveau mot de passe</Label>
                                    <Input id="new-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                                    <Input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                </div>
                                {error && <p className="text-sm text-red-500">{error}</p>}
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Mettre à jour le mot de passe
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleResend} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Votre e-mail</Label>
                                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
                                </div>
                                {error && <p className="text-sm text-red-500">{error}</p>}
                                <Button type="submit" className="w-full" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Renvoyer l’e-mail de réinitialisation
                                </Button>
                                <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
                                    Revenir à la connexion
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default ResetPassword;