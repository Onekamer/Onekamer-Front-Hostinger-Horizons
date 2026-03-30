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

const Reauthenticate = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [code, setCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState('');
  const [resendDone, setResendDone] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [remember, setRemember] = useState(false); // par défaut non coché
  const [rememberDays] = useState(30); // durée fixe 30 jours
  const navigate = useNavigate();
  const autoTriedTokenRef = useRef('');
  const [flow, setFlow] = useState('reauth');

  const sendEmailOtp = async (mail) => {
    const { error: e2 } = await supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false } });
    return e2 || null;
  };

  const verifyReauthToken = async (mail, tok, preferred = 'reauthenticate') => {
    try {
      const firstType = preferred === 'email' ? 'email' : 'reauthenticate';
      const secondType = preferred === 'email' ? 'reauthenticate' : 'email';
      console.info('verifyOtp try type:', firstType);
      const primary = await supabase.auth.verifyOtp({ email: mail, token: tok, type: firstType });
      if (primary?.data?.user || primary?.data?.session) return { ok: true, data: primary.data };
      const err = primary?.error;
      if (err && (err.status === 400 || /invalid|expired/i.test(err.message || ''))) {
        console.info('verifyOtp fallback type:', secondType);
        const alt = await supabase.auth.verifyOtp({ email: mail, token: tok, type: secondType });
        if (alt?.data?.user || alt?.data?.session) return { ok: true, data: alt.data };
        return { ok: false, error: alt?.error || err };
      }
      return { ok: false, error: err };
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      const { data: s } = await supabase.auth.getSession();
      const mail = s?.session?.user?.email || '';
      if (!mail) {
        navigate('/auth', { replace: true });
        return;
      }
      if (!mounted) return;
      setEmail(mail);
      setStatus('loading');
      const { error } = await supabase.auth.reauthenticate();
      if (error) {
        setFlow('email');
        const { error: e2 } = await supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false } });
        if (e2) {
          setStatus('error');
          setResendError(e2.message || "Impossible d'envoyer le code.");
        } else {
          setStatus('awaiting');
          try {
            let left = 45;
            setCooldownLeft(left);
            const id = setInterval(() => {
              left -= 1;
              setCooldownLeft((v) => (v > 0 ? v - 1 : 0));
              if (left <= 0) clearInterval(id);
            }, 1000);
          } catch (_) {}
        }
      } else {
        setStatus('awaiting');
        try {
          let left = 45;
          setCooldownLeft(left);
          const id = setInterval(() => {
            left -= 1;
            setCooldownLeft((v) => (v > 0 ? v - 1 : 0));
            if (left <= 0) clearInterval(id);
          }, 1000);
        } catch (_) {}
      }
    };
    bootstrap();
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    const token = String(code || '').trim();
    if (!verifyLoading && email && token.length === 6 && autoTriedTokenRef.current !== token && !verifyError) {
      autoTriedTokenRef.current = token;
      const t = setTimeout(() => {
        (async () => {
          setVerifyError('');
          setVerifyLoading(true);
          try {
            const { ok, data, error } = await verifyReauthToken(email, token, flow === 'email' ? 'email' : 'reauthenticate');
            if (!ok) {
              console.error('reauth verify error:', error);
              const msg = (error && (error.message || error.error_description)) || 'Code invalide ou expiré.';
              setVerifyError(msg);
              // Si le code reauth n'est pas reconnu, on bascule en flow 'email' et on renvoie automatiquement un nouveau code
              try {
                if (/invalid|expired/i.test(String(msg))) {
                  console.warn('Switching to email OTP flow after reauth failure, sending fresh code...');
                  setFlow('email');
                  autoTriedTokenRef.current = '';
                  setCode('');
                  setCooldownLeft(0);
                  const e2 = await sendEmailOtp(email);
                  if (e2) {
                    console.error('send email otp after reauth fail error:', e2);
                    setResendError(e2.message || "Impossible d'envoyer le code.");
                  } else {
                    console.warn('Email OTP sent after reauth failure fallback');
                    setResendDone(true);
                    let left = 45;
                    setCooldownLeft(left);
                    const id = setInterval(() => {
                      left -= 1;
                      setCooldownLeft((v) => (v > 0 ? v - 1 : 0));
                      if (left <= 0) clearInterval(id);
                    }, 1000);
                  }
                }
              } catch (_) {}
            } else if (data?.user || data?.session) {
              try {
                if (remember) {
                  const nextDue = Date.now() + rememberDays * 24 * 60 * 60 * 1000;
                  window.localStorage.setItem('ok_reauth_next_due_ts', String(nextDue));
                } else {
                  window.localStorage.removeItem('ok_reauth_next_due_ts');
                }
              } catch (_) {}
              setStatus('success');
              setTimeout(() => { try { navigate(-1); } catch (_) { navigate('/compte'); } }, 600);
            }
          } finally {
            setVerifyLoading(false);
          }
        })();
      }, 200);
      return () => clearTimeout(t);
    }
  }, [code, email, verifyLoading, verifyError, navigate, remember, rememberDays]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifyError('');
    const token = String(code || '').trim();
    if (!email || token.length < 4) {
      setVerifyError('Veuillez saisir le code reçu.');
      return;
    }
    setVerifyLoading(true);
    try {
      const { ok, data, error } = await verifyReauthToken(email, token, flow === 'email' ? 'email' : 'reauthenticate');
      if (!ok) {
        console.error('reauth verify error (manual):', error);
        const msg = (error && (error.message || error.error_description)) || 'Code invalide ou expiré.';
        setVerifyError(msg);
        if (/invalid|expired/i.test(String(msg))) {
          console.warn('Switching to email OTP flow after manual reauth failure, sending fresh code...');
          setFlow('email');
          autoTriedTokenRef.current = '';
          setCode('');
          setCooldownLeft(0);
          const e2 = await sendEmailOtp(email);
          if (e2) {
            console.error('send email otp after manual reauth fail error:', e2);
            setResendError(e2.message || "Impossible d'envoyer le code.");
          } else {
            console.warn('Email OTP sent after manual reauth failure fallback');
            setResendDone(true);
            let left = 45;
            setCooldownLeft(left);
            const id = setInterval(() => {
              left -= 1;
              setCooldownLeft((v) => (v > 0 ? v - 1 : 0));
              if (left <= 0) clearInterval(id);
            }, 1000);
          }
        }
      } else if (data?.user || data?.session) {
        try {
          if (remember) {
            const nextDue = Date.now() + rememberDays * 24 * 60 * 60 * 1000;
            window.localStorage.setItem('ok_reauth_next_due_ts', String(nextDue));
          } else {
            window.localStorage.removeItem('ok_reauth_next_due_ts');
          }
        } catch (_) {}
        setStatus('success');
        setTimeout(() => { try { navigate(-1); } catch (_) { navigate('/compte'); } }, 600);
      }
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setResendError('');
    setResendDone(false);
    if (cooldownLeft > 0) return;
    setResendLoading(true);
    try {
      const { error } = flow === 'reauth' ? await supabase.auth.reauthenticate() : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) {
        setResendError(error.message || "Impossible de renvoyer le code.");
      } else {
        setResendDone(true);
        autoTriedTokenRef.current = '';
        setCode('');
        try {
          let left = 45;
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

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="flex flex-col items-center gap-4 text-gray-700">
          <Loader2 className="h-12 w-12 animate-spin text-[#2BA84A]" />
          <h1 className="text-2xl font-bold">Envoi du code…</h1>
          <p>Veuillez patienter un instant.</p>
        </div>
      );
    }
    if (status === 'success') {
      return (
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-4 text-green-700">
          <CheckCircle className="h-16 w-16" />
          <h1 className="text-3xl font-bold">Identité vérifiée</h1>
          <p>Redirection…</p>
        </motion.div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 text-gray-800 w-full max-w-md">
        <XCircle className="h-16 w-16 text-[#2BA84A]" />
        <h1 className="text-3xl font-bold">Vérification d’identité</h1>
        <p className="text-center">Un code à 6 chiffres a été envoyé à {email || 'votre e‑mail'}.</p>

        <form onSubmit={handleVerify} className="w-full space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reauth-otp-0">Code à 6 chiffres</Label>
            <OtpInput idPrefix="reauth-otp" value={code} onChange={setCode} onComplete={(v) => setCode(v)} />
          </div>
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Ne plus me redemander pendant 30 jours</span>
            </label>
            <p className="text-xs text-gray-500">
              À n’activer que sur un appareil de confiance. Sinon, le code pourra être demandé à chaque nouvelle connexion et action sensible.
            </p>
          </div>
          {verifyError ? <p className="text-sm text-red-500">{verifyError}</p> : null}
          <Button type="submit" disabled={verifyLoading || code.length !== 6} className="w-full">
            {verifyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Vérifier le code
          </Button>
        </form>

        <form onSubmit={handleResend} className="w-full space-y-3">
          {resendError ? <p className="text-sm text-red-500">{resendError}</p> : null}
          {resendDone ? <p className="text-sm text-green-600">Code renvoyé. Vérifiez votre boîte mail.</p> : null}
          <Button type="submit" disabled={resendLoading || cooldownLeft > 0} className="w-full">
            {resendLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {cooldownLeft > 0 ? `Renvoyer dans ${cooldownLeft}s` : 'Renvoyer le code par e‑mail'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => { try { navigate(-1); } catch (_) { navigate('/compte'); } }}>
            Retour
          </Button>
        </form>
      </div>
    );
  };

  return (
    <>
      <Helmet><title>Vérification d’identité - OneKamer.co</title></Helmet>
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        {renderContent()}
      </div>
    </>
  );
};

export default Reauthenticate;
