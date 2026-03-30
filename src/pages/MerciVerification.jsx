import React, { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OtpInput from '@/components/OtpInput';
import { useToast } from '@/components/ui/use-toast';

const MerciVerification = () => {
    const [status, setStatus] = useState('loading');
    const [resendEmail, setResendEmail] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendError, setResendError] = useState('');
    const [resendDone, setResendDone] = useState(false);
    const [code, setCode] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [verifyError, setVerifyError] = useState('');
    const [cooldownLeft, setCooldownLeft] = useState(0);
    const navigate = useNavigate();
    const { toast } = useToast();
    const autoTriedTokenRef = useRef('');

    // OTP inputs refs et helpers
    const otpRefs = useRef([]);
    const setDigitAt = (idx, val) => {
        const arr = Array.from({ length: 6 }, (_, k) => (code[k] || ''));
        arr[idx] = val;
        setCode(arr.join(''));
    };
    const focusAt = (idx) => {
        const el = otpRefs.current[idx];
        if (el && typeof el.focus === 'function') {
            try { el.focus(); el.select?.(); } catch (_) {}
        }
    };
    const handleOtpChange = (idx, raw) => {
        const v = String(raw || '').replace(/\D/g, '').slice(0, 1);
        setDigitAt(idx, v);
        if (v && idx < 5) focusAt(idx + 1);
    };
    const handleOtpKeyDown = (idx, e) => {
        const key = e.key;
        const cur = code[idx] || '';
        if (key === 'Backspace') {
            if (cur) {
                // effacer ce digit
                e.preventDefault();
                setDigitAt(idx, '');
            } else if (idx > 0) {
                e.preventDefault();
                focusAt(idx - 1);
                setTimeout(() => setDigitAt(idx - 1, ''), 0);
            }
        } else if (key === 'ArrowLeft' && idx > 0) {
            e.preventDefault();
            focusAt(idx - 1);
        } else if (key === 'ArrowRight' && idx < 5) {
            e.preventDefault();
            focusAt(idx + 1);
        }
    };
    const handleOtpPaste = (e) => {
        try {
            const txt = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
            if (!txt) return;
            e.preventDefault();
            const arr = Array.from({ length: 6 }, (_, i) => txt[i] || '');
            setCode(arr.join(''));
            const last = Math.min(txt.length, 6) - 1;
            focusAt(last >= 0 ? last : 0);
        } catch (_) {}
    };

    const ensureSignedInAfterVerify = async () => {
        try {
            const { data: s0 } = await supabase.auth.getSession();
            if (s0?.session) return true;
            const em = String(window.sessionStorage.getItem('ok_signup_email') || '');
            const pw = String(window.sessionStorage.getItem('ok_signup_pw') || '');
            if (em && pw) {
                const { error: e1 } = await supabase.auth.signInWithPassword({ email: em, password: pw });
                if (!e1) {
                    try { window.sessionStorage.removeItem('ok_signup_email'); window.sessionStorage.removeItem('ok_signup_pw'); } catch (_) {}
                    return true;
                }
            }
        } catch (_) {}
        return false;
    };

    useEffect(() => {
        const sub = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setStatus('success');
                try { window.localStorage.setItem('ok_reauth_next_due_ts', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch (_) {}
                try { toast({ title: 'Connexion réussie !', description: 'Bienvenue à nouveau !' }); } catch (_) {}
                setTimeout(() => { navigate('/compte'); }, 800);
            }
        });

        const handleVerification = async () => {
            try {
                // 1) Session déjà présente
                const { data: s1 } = await supabase.auth.getSession();
                if (s1?.session) {
                    setStatus('success');
                    try { window.localStorage.setItem('ok_reauth_next_due_ts', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch (_) {}
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
                        try { window.localStorage.setItem('ok_reauth_next_due_ts', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch (_) {}
                        try { window.history.replaceState({}, document.title, window.location.pathname); } catch (_) {}
                        try { toast({ title: 'Connexion réussie !', description: 'Bienvenue à nouveau !' }); } catch (_) {}
                        setTimeout(() => { navigate('/compte'); }, 300);
                        return;
                    }
                }

                // 4) Sinon tenter verifyOtp (format token_hash/token)
                if (token_hash || token) {
                    const payload = token_hash ? { type, token_hash } : { type, token, email };
                    const { data, error } = await supabase.auth.verifyOtp(payload);
                    if (!error && (data?.session || data?.user)) {
                        if (!data?.session) {
                            await ensureSignedInAfterVerify();
                        }
                        setStatus('success');
                        try { window.localStorage.setItem('ok_reauth_next_due_ts', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch (_) {}
                        try { toast({ title: 'Connexion réussie !', description: 'Bienvenue à nouveau !' }); } catch (_) {}
                        setTimeout(() => { navigate('/compte'); }, 800);
                        return;
                    }
                }

                // 5) Fallback: utilisateur déjà confirmé mais pas de session
                const { data: userData } = await supabase.auth.getUser();
                if (userData?.user) {
                    setStatus('success');
                    try { window.localStorage.setItem('ok_reauth_next_due_ts', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch (_) {}
                    try { toast({ title: 'Connexion réussie !', description: 'Bienvenue à nouveau !' }); } catch (_) {}
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
        if (cooldownLeft > 0) return;
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
                autoTriedTokenRef.current = '';
                setCode('');
                try {
                  let left = 45; // 45s de cooldown
                  setCooldownLeft(left);
                  const id = setInterval(() => {
                    left -= 1;
                    setCooldownLeft((v) => (v > 0 ? v - 1 : 0));
                    if (left <= 0) clearInterval(id);
                  }, 1000);
                } catch (_) {}
            }
        } finally {
            setResendLoading(false);
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setVerifyError('');
        const email = String(resendEmail || '').trim();
        const token = String(code || '').trim();
        if (!email || token.length < 4) {
            setVerifyError('Veuillez saisir le code reçu.');
            return;
        }
        setVerifyLoading(true);
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'signup',
            });
            if (error) {
                setVerifyError('Code invalide ou expiré.');
            } else if (data?.session || data?.user) {
                if (!data?.session) {
                    await ensureSignedInAfterVerify();
                }
                setStatus('success');
                try { window.localStorage.setItem('ok_reauth_next_due_ts', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch (_) {}
                try { toast({ title: 'Connexion réussie !', description: 'Bienvenue à nouveau !' }); } catch (_) {}
                setTimeout(() => { navigate('/compte'); }, 600);
            }
        } finally {
            setVerifyLoading(false);
        }
    };

    useEffect(() => {
        const email = String(resendEmail || '').trim();
        const token = String(code || '').trim();
        if (email && token.length === 6 && autoTriedTokenRef.current !== token && !verifyLoading && !verifyError) {
            autoTriedTokenRef.current = token;
            const t = setTimeout(() => {
                (async () => {
                    setVerifyError('');
                    setVerifyLoading(true);
                    try {
                        const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
                        if (error) {
                            setVerifyError('Code invalide ou expiré.');
                        } else if (data?.session || data?.user) {
                            if (!data?.session) {
                                await ensureSignedInAfterVerify();
                            }
                            setStatus('success');
                            try { window.localStorage.setItem('ok_reauth_next_due_ts', String(Date.now() + 30 * 24 * 60 * 60 * 1000)); } catch (_) {}
                            try { toast({ title: 'Connexion réussie !', description: 'Bienvenue à nouveau !' }); } catch (_) {}
                            setTimeout(() => { navigate('/compte'); }, 600);
                        }
                    } finally {
                        setVerifyLoading(false);
                    }
                })();
            }, 200);
            return () => clearTimeout(t);
        }
    }, [code, resendEmail, verifyLoading, verifyError, navigate]);

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
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 text-gray-800 w-full max-w-md">
                        <XCircle className="h-16 w-16 text-red-700" />
                        <h1 className="text-3xl font-bold">Entrez votre code de vérification</h1>
                        <p className="text-center">Un code à 6 chiffres a été envoyé à {resendEmail || 'votre e-mail'}.</p>

                        <form onSubmit={handleVerifyCode} className="w-full space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="otp-code-0">Code à 6 chiffres</Label>
                                <OtpInput idPrefix="otp-code" value={code} onChange={setCode} onComplete={(v) => setCode(v)} />
                            </div>
                            {verifyError ? <p className="text-sm text-red-500">{verifyError}</p> : null}
                            <Button type="submit" disabled={verifyLoading || code.length !== 6} className="w-full">
                                {verifyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Vérifier le code
                            </Button>
                        </form>

                        <form onSubmit={handleResend} className="w-full space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="resend-email">Votre e-mail</Label>
                                <Input id="resend-email" type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} placeholder="vous@exemple.com" required />
                            </div>
                            {resendError ? <p className="text-sm text-red-500">{resendError}</p> : null}
                            {resendDone ? <p className="text-sm text-green-600">Code renvoyé. Vérifiez votre boîte mail.</p> : null}
                            <Button type="submit" disabled={resendLoading || cooldownLeft > 0} className="w-full">
                                {resendLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {cooldownLeft > 0 ? `Renvoyer dans ${cooldownLeft}s` : 'Renvoyer le code par e-mail'}
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