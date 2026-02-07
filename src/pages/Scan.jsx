import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

const formatMinorAmount = (minor, currency) => {
  const cur = (currency || '').toLowerCase();
  const amount = typeof minor === 'number' ? minor : 0;
  const major = ['eur', 'usd', 'cad'].includes(cur) ? amount / 100 : amount;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: (cur || 'eur').toUpperCase(),
    }).format(major);
  } catch {
    return `${major} ${cur || ''}`.trim();
  }
};

const getPaymentLabel = (p) => {
  const s = p?.status;
  if (s === 'paid') return 'PAYÉ';
  if (s === 'deposit_paid') return 'ACOMPTE PAYÉ';
  if (s === 'unpaid') return 'DOIT PAYER';
  if (s === 'free') return 'GRATUIT';
  return null;
};

const Scan = () => {
  const { session } = useAuth();
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [mode, setMode] = useState('secret');
  const [jwtToken, setJwtToken] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [canUseCamera] = useState(() => {
    try { return !!(navigator?.mediaDevices?.getUserMedia); } catch { return false; }
  });
  const [canDetect] = useState(() => {
    try { return 'BarcodeDetector' in window; } catch { return false; }
  });
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef(null);
  const scanTimerRef = useRef(null);

  useEffect(() => { if (session?.access_token) setJwtToken(session.access_token); }, [session]);

  const onVerify = async () => {
    if (!API_PREFIX) { setError('API non configurée (VITE_API_URL)'); return; }
    if (!code) { setError('Saisissez le code'); return; }
    if (mode === 'secret' && !secret) { setError('Saisissez le secret admin'); return; }
    if (mode === 'jwt' && !jwtToken) { setError('Saisissez le token JWT'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const url = mode === 'jwt'
        ? `${API_PREFIX}/qrcode/verify-jwt?qrcode_value=${encodeURIComponent(code)}`
        : `${API_PREFIX}/qrcode/verify?qrcode_value=${encodeURIComponent(code)}`;
      const headers = mode === 'jwt' ? { Authorization: `Bearer ${jwtToken}` } : { 'x-admin-secret': secret };
      const res = await fetch(url, { method: 'GET', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
      setResult(data);
    } catch (e) { setError(e?.message || 'Erreur interne'); }
    finally { setLoading(false); }
  };

  const startScan = async () => {
    try {
      setError(null); setResult(null);
      if (!canUseCamera) { setError('Caméra non disponible'); return; }
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      setStream(s); setScanning(true);
    } catch (e) { setError(e?.message || 'Accès caméra refusé'); }
  };

  const stopScan = () => {
    setScanning(false); setVideoReady(false);
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
  };

  useEffect(() => {
    if (!videoRef.current) return;
    if (stream) {
      videoRef.current.srcObject = stream;
      const onCanPlay = () => { setVideoReady(true); videoRef.current.play().catch(() => {}); };
      videoRef.current.addEventListener('canplay', onCanPlay, { once: true });
      return () => videoRef.current && videoRef.current.removeEventListener('canplay', onCanPlay);
    }
  }, [stream]);

  useEffect(() => {
    let detector;
    const tick = async () => {
      try {
        if (!canDetect) return;
        if (!detector) detector = new BarcodeDetector({ formats: ['qr_code'] });
        const v = videoRef.current; if (!v) return;
        const codes = await detector.detect(v);
        if (Array.isArray(codes) && codes.length > 0) {
          const raw = codes[0]?.rawValue || '';
          if (raw) { setCode(raw); stopScan(); }
        }
      } catch {}
    };
    if (scanning && videoReady) {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      scanTimerRef.current = setInterval(tick, 400);
    }
    return () => { if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; } };
  }, [scanning, videoReady, canDetect]);

  // No ZXing fallback; manual input remains available if not supported.

  return (
    <>
      <Helmet><title>Scanner un QR Code - OneKamer</title></Helmet>
      <div className="max-w-xl mx-auto space-y-6">
        <Card>
          <CardHeader><CardTitle>Vérification QR Code (Admin)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={mode === 'secret' ? undefined : 'outline'} onClick={() => setMode('secret')}>Mode Secret</Button>
              <Button variant={mode === 'jwt' ? undefined : 'outline'} onClick={() => setMode('jwt')}>Mode JWT</Button>
            </div>
            {canUseCamera && (
              <div className="space-y-2">
                {!scanning ? (
                  <Button onClick={startScan} className="bg-[#2BA84A] text-white w-full">Activer la caméra</Button>
                ) : (
                  <Button onClick={stopScan} variant="outline" className="w-full">Arrêter la caméra</Button>
                )}
                {scanning && (
                  <div className="rounded-lg overflow-hidden bg-black">
                    <video ref={videoRef} playsInline muted className="w-full h-64 object-cover" />
                  </div>
                )}
                {!canDetect && (
                  <div className="text-xs text-gray-600">Aperçu caméra sans détection automatique. Utilisez la saisie manuelle du code.</div>
                )}
              </div>
            )}
            {!canUseCamera && (
              <div className="text-sm text-gray-600">La caméra n'est pas disponible sur cet appareil. Utilisez la saisie manuelle.</div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Code QR (valeur)</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Collez la valeur scannée" />
            </div>
            {mode === 'secret' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Secret Admin</label>
                <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="x-admin-secret" type="password" />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Token JWT Admin</label>
                <Input value={jwtToken} onChange={(e) => setJwtToken(e.target.value)} placeholder="Bearer token" />
              </div>
            )}
            <Button onClick={onVerify} disabled={loading || !code || (mode === 'secret' ? !secret : !jwtToken)} className="bg-[#2BA84A] text-white w-full">
              {loading ? 'Vérification…' : 'Vérifier'}
            </Button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader><CardTitle>Résultat</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm">Valide: <span className="font-medium">{String(result.valid)}</span></div>
              {result.message && <div className="text-sm">Message: {result.message}</div>}
              {result.payment && (
                <div className="text-sm">
                  <div>Paiement: <span className="font-medium">{getPaymentLabel(result.payment) || '—'}</span></div>
                  {typeof result.payment?.remaining === 'number' && result.payment.remaining > 0 && (
                    <div>Reste à payer: {formatMinorAmount(result.payment.remaining, result.payment.currency)}</div>
                  )}
                </div>
              )}
              {result.event && (
                <div className="text-sm">
                  <div>Événement: <span className="font-medium">{result.event.title}</span></div>
                  <div>Date: {result.event.date}</div>
                  <div>Lieu: {result.event.location}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default Scan;
