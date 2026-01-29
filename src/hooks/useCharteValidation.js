import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useCharteValidation = () => {
  const { user, profile, loading, refreshProfile, session } = useAuth();
  const { toast } = useToast();
  const [showCharte, setShowCharte] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  const API_PREFIX = API_BASE_URL ? (API_BASE_URL.endsWith('/api') ? API_BASE_URL : `${API_BASE_URL}/api`) : '';

  useEffect(() => {
    (async () => {
      try {
        if (!API_PREFIX) return;
        const res = await fetch(`${API_PREFIX}/terms/config`);
        const data = await res.json().catch(() => ({}));
        const v = data?.app?.version || null;
        setCurrentVersion(v);
      } catch {}
    })();
  }, [API_PREFIX]);

  useEffect(() => {
    if (loading) return;
    if (!user || !profile) {
      setShowCharte(false);
      return;
    }
    const accepted = Boolean(profile.has_accepted_charts ?? profile.has_accepted_charte);
    const versionOk = currentVersion ? String(profile.chart_terms_version || '') === String(currentVersion) : accepted;
    setShowCharte(!(accepted && versionOk));
  }, [user, profile, loading, currentVersion]);

  const acceptCharte = useCallback(async () => {
    if (!user || !session?.access_token || !API_PREFIX) return;
    try {
      const res = await fetch(`${API_PREFIX}/terms/app/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'accept_failed');
      toast({ title: 'Charte acceptée !', description: 'Bienvenue dans la communauté OneKamer.co !' });
      await refreshProfile();
      setShowCharte(false);
    } catch (e) {
      toast({ title: 'Erreur', description: "Impossible d'accepter la charte. Veuillez réessayer.", variant: 'destructive' });
    }
  }, [user, session?.access_token, API_PREFIX, refreshProfile, toast]);

  return { showCharte, acceptCharte };
};