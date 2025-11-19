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

const SUPABASE_URL = 'https://neswuuicqesslduqwzck.supabase.co';
const ENABLE_FALLBACK = (typeof window !== 'undefined') ? !/[?&#]nofallback=1/.test(window.location.href) : true;
const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasSession, setHasSession] = useState(false);

    const navigate = useNavigate();
    const { toast } = useToast();

    // Parse URL error for UX (safe for build-time without window)
    const hrefSafe = (typeof window !== 'undefined') ? window.location.href : '';
    const urlErrorMatch = /[?&#]error=([^&]+)/.exec(hrefSafe);
    const urlErrorDescMatch = /[?&#]error_description=([^&]+)/.exec(hrefSafe);
    const urlError = urlErrorMatch ? decodeURIComponent(urlErrorMatch[1].replace(/\+/g, ' ')) : '';
    const urlErrorDesc = urlErrorDescMatch ? decodeURIComponent(urlErrorDescMatch[1].replace(/\+/g, ' ')) : '';

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

        // 4) If URL contains recovery params, poll session for up to ~10s (Safari workaround)
        const href = window.location.href;
        if (/type=recovery|access_token=/.test(href)) {
            let attempts = 0;
            const maxAttempts = 40; // 40 * 250ms = 10s
            const interval = setInterval(async () => {
                attempts += 1;
                const { data } = await supabase.auth.getSession();
                console.debug('[ResetPassword][PROD] polling getSession', { attempts, hasSession: !!data?.session });
                if (!mounted) { clearInterval(interval); return; }
                if (data?.session || attempts >= maxAttempts) {
                    if (data?.session) setHasSession(true);
                    clearInterval(interval);
                }
            }, 250);

            // 4.b Fallback: delayed to 8s with guards to avoid consuming valid links too early
            if (ENABLE_FALLBACK) {
                console.debug('[ResetPassword][PROD] fallback scheduled: true (8s)');
                const fallback = setTimeout(() => {
                    if (hasSession) {
                        console.debug('[ResetPassword][PROD] fallback SKIPPED reason=session-already-present');
                        return;
                    }
                    const hash = window.location.hash || '';
                    const search = window.location.search || '';
                    // if Supabase already indicates an error (expired/invalid), do not fallback
                    if (/([?&#])error=/.test(window.location.href)) {
                        console.debug('[ResetPassword][PROD] fallback SKIPPED reason=url-error-present');
                        return;
                    }
                    const tokenMatchHash = hash.match(/access_token=([^&]+)/);
                    const tokenMatchQuery = search.match(/access_token=([^&]+)/);
                    const token = (tokenMatchHash && tokenMatchHash[1]) || (tokenMatchQuery && tokenMatchQuery[1]);
                    if (!token) {
                        console.debug('[ResetPassword][PROD] fallback SKIPPED reason=no-token');
                        return;
                    }
                    const redirectTo = encodeURIComponent(`${window.location.origin}/reset-password`);
                    const verifyUrl = `${SUPABASE_URL}/auth/v1/verify?token=${token}&type=recovery&redirect_to=${redirectTo}`;
                    console.debug('[ResetPassword][PROD] fallback redirect to verify endpoint (8s)');
                    window.location.replace(verifyUrl);
                }, 8000);

                // clear fallback on unmount
                window.addEventListener('beforeunload', () => clearTimeout(fallback));
            } else {
                console.debug('[ResetPassword][PROD] fallback scheduled: false (nofallback=1)');
            }
        }

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
                            <div className="text-center text-gray-500 space-y-3">
                                {urlError ? (
                                  <>
                                    <p className="text-red-600 font-medium">Lien de réinitialisation invalide ou expiré.</p>
                                    {urlErrorDesc && <p className="text-sm">{urlErrorDesc}</p>}
                                    <Button onClick={() => navigate('/auth')} className="mt-2">Renvoyer un nouveau lien</Button>
                                  </>
                                ) : (
                                  <p>Si vous n'êtes pas redirigé, veuillez vérifier le lien dans votre email.</p>
                                )}
                                <p className="text-xs text-gray-400">Fallback actif: {String(ENABLE_FALLBACK)}</p>
                            </div>
                        )
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default ResetPassword;