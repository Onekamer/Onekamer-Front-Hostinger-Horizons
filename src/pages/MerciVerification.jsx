import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MerciVerification = () => {
    const [status, setStatus] = useState('loading');
    const [resendEmail, setResendEmail] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendError, setResendError] = useState('');
    const [resendDone, setResendDone] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const sub = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setStatus('success');
                setTimeout(() => { navigate('/compte'); }, 800);
            }
        });

        const handleVerification = async () => {
            try {
                // 1) Session déjà présente
                const { data: s1 } = await supabase.auth.getSession();
                if (s1?.session) {
                    setStatus('success');
                    setTimeout(() => { navigate('/compte'); }, 800);
                    return;
                }

                // 2) Extraire paramètres (# prioritaire)
                const hash = window.location.hash?.startsWith('#') ? window.location.hash.slice(1) : '';
                const search = window.location.search?.startsWith('?') ? window.location.search.slice(1) : '';
                const params = new URLSearchParams(hash || search);
                const type = params.get('type') || 'signup';
                const token_hash = params.get('token_hash');
                const token = params.get('token');
                const email = params.get('email') || params.get('email_address') || '';
                const access_token = params.get('access_token');
                const refresh_token = params.get('refresh_token');
                const errorCode = params.get('error_code');

                if (email) setResendEmail(email);

                // 3) Si des tokens de session sont présents (format hash), établir la session directement
                if (access_token && refresh_token) {
                    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
                    if (!error && data?.session) {
                        setStatus('success');
                        try { window.history.replaceState({}, document.title, window.location.pathname); } catch (_) {}
                        setTimeout(() => { navigate('/compte'); }, 300);
                        return;
                    }
                }

                // 4) Sinon tenter verifyOtp (format token_hash/token)
                if (token_hash || token) {
                    const payload = token_hash ? { type, token_hash } : { type, token, email };
                    const { data, error } = await supabase.auth.verifyOtp(payload);
                    if (!error && data?.session) {
                        setStatus('success');
                        setTimeout(() => { navigate('/compte'); }, 800);
                        return;
                    }
                }

                // 5) Fallback: utilisateur déjà confirmé mais pas de session
                const { data: userData } = await supabase.auth.getUser();
                if (userData?.user) {
                    setStatus('success');
                    setTimeout(() => { navigate('/compte'); }, 800);
                    return;
                }

                // 6) Si le lien indique explicitement une expiration
                if (errorCode === 'otp_expired') {
                    setStatus('error');
                    return;
                }

                setStatus('error');
            } catch (error) {
                console.error('Verification error:', error);
                setStatus('error');
            }
        };

        handleVerification();

        const fallbackTimer = setTimeout(() => {
            setStatus((prev) => (prev === 'loading' ? 'error' : prev));
        }, 12000);

        return () => {
            try { sub.data.subscription.unsubscribe(); } catch (_) {}
            clearTimeout(fallbackTimer);
        };
    }, [navigate]);

    const handleResend = async (e) => {
        e.preventDefault();
        setResendError('');
        setResendDone(false);
        const email = String(resendEmail || '').trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setResendError('Veuillez entrer un e-mail valide.');
            return;
        }
        setResendLoading(true);
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
                options: { emailRedirectTo: `${window.location.origin}/merci-verification` },
            });
            if (error) {
                setResendError(error.message || "Impossible de renvoyer l'e-mail.");
            } else {
                setResendDone(true);
            }
        } finally {
            setResendLoading(false);
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="flex flex-col items-center gap-4 text-gray-700">
                        <Loader2 className="h-12 w-12 animate-spin text-[#2BA84A]" />
                        <h1 className="text-2xl font-bold">Vérification de votre compte...</h1>
                        <p>Veuillez patienter un instant.</p>
                    </div>
                );
            case 'success':
                return (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 text-green-700">
                        <CheckCircle className="h-16 w-16" />
                        <h1 className="text-3xl font-bold">Merci d'avoir vérifié votre compte !</h1>
                        <p>Vous allez être redirigé vers votre profil.</p>
                    </motion.div>
                );
            case 'error':
                return (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 text-red-700 w-full max-w-md">
                        <XCircle className="h-16 w-16" />
                        <h1 className="text-3xl font-bold">Lien invalide ou expiré</h1>
                        <p className="text-center">La vérification a échoué. Vous pouvez demander un nouvel e-mail de confirmation ci-dessous.</p>
                        <form onSubmit={handleResend} className="w-full space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="resend-email">Votre e-mail</Label>
                                <Input id="resend-email" type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} placeholder="vous@exemple.com" required />
                            </div>
                            {resendError ? <p className="text-sm text-red-500">{resendError}</p> : null}
                            {resendDone ? <p className="text-sm text-green-600">E-mail envoyé. Vérifiez votre boîte mail.</p> : null}
                            <Button type="submit" disabled={resendLoading} className="w-full">
                                {resendLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Renvoyer l’e-mail de vérification
                            </Button>
                            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/auth')}>
                                Revenir à la connexion
                            </Button>
                        </form>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <Helmet>
                <title>Vérification du compte - OneKamer.co</title>
            </Helmet>
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                {renderContent()}
            </div>
        </>
    );
};

export default MerciVerification;