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
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        try {
            const search = window.location.search?.startsWith('?') ? window.location.search.slice(1) : '';
            const params = new URLSearchParams(search);
            const em = params.get('email');
            if (em) setEmail(em);
        } catch {}
    }, []);

    const handleVerifyAndReset = async (e) => {
        e.preventDefault();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Veuillez saisir un e-mail valide.');
            return;
        }
        if (!code || code.length < 4) {
            setError('Veuillez saisir le code reçu par e-mail.');
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
            const { data, error: vErr } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
            if (vErr || !(data?.session || data?.user)) {
                toast({ title: 'Échec de vérification', description: vErr?.message || 'Code invalide ou expiré.', variant: 'destructive' });
                setLoading(false);
                return;
            }
            const { error: uErr } = await supabase.auth.updateUser({ password });
            if (uErr) {
                toast({ title: 'Erreur', description: uErr.message, variant: 'destructive' });
            } else {
                toast({ title: 'Succès', description: 'Votre mot de passe a été mis à jour avec succès ✅' });
                navigate('/compte');
            }
        } catch (err) {
            toast({ title: 'Erreur', description: err?.message || 'Impossible de mettre à jour le mot de passe.', variant: 'destructive' });
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
            const { error: err } = await supabase.auth.resetPasswordForEmail(email);
            if (err) {
                toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
            } else {
                toast({ title: 'Code envoyé', description: "Un code de réinitialisation a été envoyé à votre e-mail." });
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
                        <CardDescription>Entrez l’e-mail, le code reçu et votre nouveau mot de passe.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleVerifyAndReset} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Votre e-mail</Label>
                                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">Code</Label>
                                <Input id="code" type="text" required value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="123456" />
                            </div>
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
                                Valider
                            </Button>
                        </form>
                        <div className="mt-4 space-y-2">
                            <Button type="button" className="w-full" onClick={handleResend} disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Renvoyer le code
                            </Button>
                            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
                                Revenir à la connexion
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default ResetPassword;