import React, { useState, useEffect } from 'react';

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
    const [hasSession, setHasSession] = useState(false);

    const navigate = useNavigate();
    const { toast } = useToast();

    // Robust session detection + detailed logs to debug iOS/Safari
    useEffect(() => {
        console.debug('[ResetPassword][PROD] mount', {
            href: window.location.href,
            hash: window.location.hash,
            search: window.location.search,
            ua: navigator.userAgent,
        });

        let mounted = true;

        async function checkSession(origin) {
            const { data, error } = await supabase.auth.getSession();
            console.debug('[ResetPassword][PROD] getSession', { origin, data, error });
            if (!mounted) return;
            if (data?.session) {
                setHasSession(true);
            }
        }

        // 1) initial check (detectSessionInUrl may have already run)
        checkSession('initial');

        // 2) delayed re-check to cover timing on iOS Safari
        const t = setTimeout(() => checkSession('delayed-200ms'), 200);

        // 3) subscribe to all relevant events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.debug('[ResetPassword][PROD] onAuthStateChange', { event, session });
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
                setHasSession(!!session);
            }
        });

        return () => {
            mounted = false;
            clearTimeout(t);
            subscription.unsubscribe();
        };
    }, []);

    const handleResetPassword = async (e) => {
        e.preventDefault();
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

        // Safety timeout to avoid infinite spinner if the promise hangs on Safari
        const safety = setTimeout(() => {
            console.warn('[ResetPassword][PROD] updateUser taking too long (>15s)');
        }, 15000);

        try {
            console.debug('[ResetPassword][PROD] calling supabase.auth.updateUser');
            const { error: updateError, data } = await supabase.auth.updateUser({ password });
            console.debug('[ResetPassword][PROD] updateUser response', { data, updateError });

            if (updateError) {
                toast({ title: 'Erreur', description: updateError.message, variant: 'destructive' });
            } else {
                toast({ title: 'Succès', description: 'Votre mot de passe a été mis à jour avec succès ✅' });
                navigate('/auth');
            }
        } catch (err) {
            console.error('[ResetPassword][PROD] updateUser threw', err);
            toast({ title: 'Erreur', description: 'Une erreur est survenue lors de la mise à jour du mot de passe.', variant: 'destructive' });
        } finally {
            clearTimeout(safety);
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
                            {hasSession ? 'Entrez votre nouveau mot de passe.' : 'Veuillez utiliser le lien envoyé par email. Redirection en cours...'}
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
                            <div className="text-center text-gray-500">
                                <p>Si vous n'êtes pas redirigé, veuillez vérifier le lien dans votre email.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default ResetPassword;