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
  const [linkProcessing, setLinkProcessing] = useState(false);

  const sendEmailOtp = async (mail) => {
    const redirectTo = `${window.location.origin}/reauth`;
    const { error: e2 } = await supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
    try { window.localStorage.setItem('ok_reauth_last_send_ts', String(Date.now())); } catch (_) {}
    return e2 || null;
  };

  const sanitizeCode = (v) => String(v || '').replace(/[^0-9]/g, '').slice(0, 6);
  const maskEmail = (m) => String(m || '').replace(/(^.).*(@.*$)/, '$1***$2');

  const verifyWithTokenHash = async (tokenHash, typeHint = '') => {
    const hint = String(typeHint || '').toLowerCase();
    const base = ['reauthenticate', 'magiclink', 'signup', 'recovery', 'email_change'];
    const order = hint && base.includes(hint) ? [hint, ...base.filter((t) => t !== hint)] : base;
    let lastErr = null;
    for (const t of order) {
      try {
        console.info('verifyOtp (token_hash) try type:', t);
        const { data, error } = await supabase.auth.verifyOtp({ type: t, token_hash: tokenHash });
        if (data?.user || data?.session) return { ok: true, data };
        lastErr = error || lastErr;
        if (error) console.warn('verifyOtp (token_hash) failed for type', t, error);
      } catch (e) {
        lastErr = e;
        console.warn('verifyOtp (token_hash) exception for type', t, e);
      }
    }
    return { ok: false, error: lastErr };
  };

  useEffect(() => {
    // Gestion du retour par Magic Link (token_hash ou tokens directs)
    const q = new URLSearchParams(window.location.search || '');
    const th = q.get('token_hash') || '';
    const typ = q.get('type') || '';
    const at = q.get('access_token') || '';
    const rt = q.get('refresh_token') || '';
    if (!th && !at) return;
    (async () => {
      setLinkProcessing(true);
      setStatus('loading');
      try {
        if (at && rt) {
          console.info('setSession via access_token from URL');
          const { data, error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          if (error) throw error;
          if (data?.user || data?.session) {
            try {
              const nextDue = Date.now() + rememberDays * 24 * 60 * 60 * 1000;
              window.localStorage.setItem('ok_reauth_next_due_ts', String(nextDue));
            } catch (_) {}
            setStatus('success');
            setTimeout(() => { try { navigate('/compte', { replace: true }); } catch (_) { navigate('/compte'); } }, 400);
            return;
          }
        }
        if (th) {
          const { ok, data, error } = await verifyWithTokenHash(th, typ);
          if (!ok) throw error || new Error('Invalid or expired link');
          if (data?.user || data?.session) {
            try {
              const nextDue = Date.now() + rememberDays * 24 * 60 * 60 * 1000;
              window.localStorage.setItem('ok_reauth_next_due_ts', String(nextDue));
            } catch (_) {}
            setStatus('success');
            setTimeout(() => { try { navigate('/compte', { replace: true }); } catch (_) { navigate('/compte'); } }, 400);
            return;
          }
        }
        setStatus('error');
        setVerifyError('Lien invalide ou expiré.');
      } catch (e) {
        console.error('reauth link processing error:', e);
        setStatus('error');
        setVerifyError((e && (e.message || e.error_description)) || 'Lien invalide ou expiré.');
      } finally {
        setLinkProcessing(false);
      }
    })();
  }, [remember, rememberDays, navigate]);

  const verifyReauthToken = async (mail, tok) => {
    try {
      console.info('verifyOtp try type: email');
      const res = await supabase.auth.verifyOtp({ email: mail, token: tok, type: 'email' });
      if (res?.data?.user || res?.data?.session) return { ok: true, data: res.data };
      return { ok: false, error: res?.error };
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
      // Si on traite un lien (token_hash/access_token), ne pas envoyer d'OTP maintenant
      const q = new URLSearchParams(window.location.search || '');
      if (q.get('token_hash') || q.get('access_token')) return;
      // Anti-spam: éviter d'appeler signInWithOtp si un envoi a eu lieu il y a < 12s
      let lastSend = 0;
      try { lastSend = parseInt(window.localStorage.getItem('ok_reauth_last_send_ts') || '0', 10) || 0; } catch (_) {}
      const since = Date.now() - lastSend;
      const mustThrottle = since >= 0 && since < 12000; // 12s de marge
      if (mustThrottle) {
        setStatus('awaiting');
        try {
          // Laisser le code précédent fonctionner sans renvoyer immédiatement
          let left = 45;
          setCooldownLeft(left);
          const id = setInterval(() => {
            left -= 1;
            setCooldownLeft((v) => (v > 0 ? v - 1 : 0));
            if (left <= 0) clearInterval(id);
          }, 1000);
        } catch (_) {}
        return;
      }

      setStatus('loading');
      const e2 = await sendEmailOtp(mail);
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
    };
    bootstrap();
    return () => { mounted = false; };
  }, [navigate]);

  useEffect(() => {
    const token = String(code || '').trim();
    const tSan = sanitizeCode(token);
    if (!verifyLoading && email && tSan.length === 6 && autoTriedTokenRef.current !== tSan && !verifyError) {
      autoTriedTokenRef.current = tSan;
      const t = setTimeout(() => {
        (async () => {
          setVerifyError('');
          setVerifyLoading(true);
          try {
            console.info('verifyOtp payload (masked):', { type: 'email', email: maskEmail(email), tokenLen: tSan.length });
            const { ok, data, error } = await verifyReauthToken(email, tSan);
            if (!ok) {
              console.error('reauth verify error:', error);
              const msg = (error && (error.message || error.error_description)) || 'Code invalide ou expiré.';
              setVerifyError(msg);
            } else if (data?.user || data?.session) {
              try {
                const nextDue = Date.now() + rememberDays * 24 * 60 * 60 * 1000;
                window.localStorage.setItem('ok_reauth_next_due_ts', String(nextDue));
              } catch (_) {}
              setStatus('success');
              setTimeout(() => { try { navigate('/compte', { replace: true }); } catch (_) { navigate('/compte'); } }, 600);
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
    const token = sanitizeCode(code);
    if (!email || token.length < 4) {
      setVerifyError('Veuillez saisir le code reçu.');
      return;
    }
    setVerifyLoading(true);
    try {
      console.info('verifyOtp payload (masked):', { type: 'email', email: maskEmail(email), tokenLen: token.length });
      const { ok, data, error } = await verifyReauthToken(email, token);
      if (!ok) {
        console.error('reauth verify error (manual):', error);
        const msg = (error && (error.message || error.error_description)) || 'Code invalide ou expiré.';
        setVerifyError(msg);
      } else if (data?.user || data?.session) {
        try {
          const nextDue = Date.now() + rememberDays * 24 * 60 * 60 * 1000;
          window.localStorage.setItem('ok_reauth_next_due_ts', String(nextDue));
        } catch (_) {}
        setStatus('success');
        setTimeout(() => { try { navigate('/compte', { replace: true }); } catch (_) { navigate('/compte'); } }, 600);
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
      // Respecter le throttle serveur (10s minimum)
      let lastSend = 0;
      try { lastSend = parseInt(window.localStorage.getItem('ok_reauth_last_send_ts') || '0', 10) || 0; } catch (_) {}
      const since = Date.now() - lastSend;
      if (since >= 0 && since < 12000) {
        setResendError('Patientez quelques secondes avant de demander un nouvel envoi.');
        return;
      }
      const { error: e2 } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/reauth` } });
      if (e2) {
        setResendError(e2.message || "Impossible de renvoyer le code.");
      } else {
        setResendDone(true);
        autoTriedTokenRef.current = '';
        setCode('');
        try {
          window.localStorage.setItem('ok_reauth_last_send_ts', String(Date.now()));
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
