import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

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
    const isIOS = typeof window !== 'undefined' && window?.Capacitor?.getPlatform?.() === 'ios';
    // CGU acceptée si timestamp présent (fallback sur anciens booleans)
    const acceptedCGU = Boolean(profile.charter_accepted_at || profile.has_accepted_charte || profile.has_accepted_charts);
    // EULA requise uniquement sur iOS
    const acceptedEULA = isIOS ? Boolean(profile.apple_eula_accepted_at) : true;
    // Version: on garde la compat avec chart_terms_version si fournie par l'API
    const versionOk = currentVersion ? String(profile.chart_terms_version || '') === String(currentVersion) : acceptedCGU;
    setShowCharte(!(acceptedCGU && acceptedEULA && versionOk));
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
      // Renseigner les timestamps d'acceptation si absents
      if (!profile?.charter_accepted_at) {
        try {
          await supabase
            .from('profiles')
            .update({ charter_accepted_at: new Date().toISOString() })
            .eq('id', user.id);
        } catch (_) {}
      }
      // iOS: si l'EULA n'est pas encore marquée comme acceptée, on la renseigne côté profil
      const isIOS = typeof window !== 'undefined' && window?.Capacitor?.getPlatform?.() === 'ios';
      if (isIOS && !profile?.apple_eula_accepted_at) {
        try {
          await supabase
            .from('profiles')
            .update({ apple_eula_accepted_at: new Date().toISOString() })
            .eq('id', user.id);
        } catch (_) {}
      }
      toast({ title: 'Charte acceptée !', description: 'Bienvenue dans la communauté OneKamer.co !' });
      await refreshProfile();
      setShowCharte(false);
    } catch (e) {
      toast({ title: 'Erreur', description: "Impossible d'accepter la charte. Veuillez réessayer.", variant: 'destructive' });
    }
  }, [user, session?.access_token, API_PREFIX, refreshProfile, toast]);

  return { showCharte, acceptCharte };
};