import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import subscribeForPush from '@/lib/push/subscribeForPush';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [permissions, setPermissions] = useState({});

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  }, []);

  const fetchBalance = useCallback(async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('okcoins_users_balance')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching balance:', error);
      return null;
    }
    return data;
  }, []);

  const checkFeaturePermission = useCallback(async (userId, featureKey) => {
    if (!userId) return false;
    const { data, error } = await supabase.rpc('user_has_feature', {
      p_user_id: userId,
      p_feature_key: featureKey,
    });
    if (error) {
      console.error(`Error checking permission for ${featureKey}:`, error);
      return false;
    }
    return data;
  }, []);

  const fetchAllPermissions = useCallback(async (userId) => {
    if (!userId) return {};
    const featureKeys = [
      'annonces_read', 'create_annonce', 'rencontre_access', 
      'partenaires_access', 'position_access', 'evenements_read',
      'faits_divers_read', 'groupes_read'
    ];
    const permissionChecks = featureKeys.map(key => checkFeaturePermission(userId, key));
    const results = await Promise.all(permissionChecks);
    const userPermissions = featureKeys.reduce((acc, key, index) => {
      acc[key] = results[index];
      return acc;
    }, {});
    setPermissions(userPermissions);
    return userPermissions;
  }, [checkFeaturePermission]);

  const handleSession = useCallback(async (session) => {
    setSession(session);
    const currentUser = session?.user ?? null;
    setUser(currentUser);

    if (currentUser) {
      const [userProfile, userBalance, userPermissions] = await Promise.all([
        fetchProfile(currentUser.id),
        fetchBalance(currentUser.id),
        fetchAllPermissions(currentUser.id)
      ]);
      setProfile(userProfile);
      setBalance(userBalance);
      setPermissions(userPermissions);
    } else {
      setProfile(null);
      setBalance(null);
      setPermissions({});
    }
    setLoading(false);
  }, [fetchProfile, fetchBalance, fetchAllPermissions]);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session) {
          await handleSession(session);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setProfile(null);
          setBalance(null);
          setPermissions({});
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession]);

  useEffect(() => {
    const provider = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal';
    if (provider !== 'supabase_light') return;
    if (!user) return;

    (async () => {
      try {
        const result = await subscribeForPush(user.id);
        if (result?.error) console.warn('Push subscribe error (PROD):', result.error);
      } catch (e) {
        console.warn('Push subscribe failed (PROD):', e?.message || e);
      }
    })();
  }, [user]);

  const refreshBalance = useCallback(async () => {
    if (user) {
      const userBalance = await fetchBalance(user.id);
      setBalance(userBalance);
    }
  }, [user, fetchBalance]);
  
  const refreshProfile = useCallback(async () => {
    if (user) {
      const userProfile = await fetchProfile(user.id);
      setProfile(userProfile);
      await fetchAllPermissions(user.id);
    }
  }, [user, fetchProfile, fetchAllPermissions]);

  useEffect(() => {
    if (!user) return;
    const balanceChannel = supabase.channel(`balance-updates-for-${user.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'okcoins_users_balance', filter: `user_id=eq.${user.id}`}, payload => { setBalance(payload.new); toast({ title: 'Solde mis à jour ! 💰', description: `Votre nouveau solde est de ${payload.new.coins_balance} pièces.` }); }).subscribe();
    const notificationChannel = supabase.channel(`notifications-for-${user.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'okcoins_notifications', filter: `user_id=eq.${user.id}`}, payload => { toast({ title: 'Nouvelle notification ! 🔔', description: payload.new.message }); refreshBalance(); }).subscribe();
    const profileChannel = supabase.channel(`profile-updates-for-${user.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}`}, payload => { setProfile(payload.new); fetchAllPermissions(user.id); toast({ title: 'Profil mis à jour!', description: 'Votre abonnement a été mis à jour.' }); }).subscribe();
    return () => { supabase.removeChannel(balanceChannel); supabase.removeChannel(notificationChannel); supabase.removeChannel(profileChannel); }
  }, [user, toast, refreshBalance, fetchAllPermissions]);

      const signUp = useCallback(async (credentials, {data, emailRedirectTo}) => {
        const { error } = await supabase.auth.signUp({ ...credentials, options: { data, emailRedirectTo } });
        if (error) { toast({ variant: "destructive", title: "L'inscription a échoué", description: error.message || "Quelque chose s'est mal passé" }); }
        return { error };
      }, [toast]);

      const signIn = useCallback(async (credentials) => {
        const { error } = await supabase.auth.signInWithPassword(credentials);
        if (error) { toast({ variant: "destructive", title: "La connexion a échoué", description: error.message || "Quelque chose s'est mal passé" }); }
        return { error };
      }, [toast]);

      const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
          setUser(null);
          setProfile(null);
          setBalance(null);
          setPermissions({});
          return { error: null };
        }

        try {
          // Fallback: si le logout serveur échoue (ex: 403), on force la déconnexion locale.
          // supabase-js v2 supporte parfois { scope: 'local' }.
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {}

          const keysToRemove = [];
          for (let i = 0; i < window.localStorage.length; i += 1) {
            const k = window.localStorage.key(i);
            if (!k) continue;
            if ((k.startsWith('sb-') && k.includes('-auth-token')) || k === 'supabase.auth.token') {
              keysToRemove.push({ storage: 'local', key: k });
            }
          }
          for (let i = 0; i < window.sessionStorage.length; i += 1) {
            const k = window.sessionStorage.key(i);
            if (!k) continue;
            if ((k.startsWith('sb-') && k.includes('-auth-token')) || k === 'supabase.auth.token') {
              keysToRemove.push({ storage: 'session', key: k });
            }
          }
          keysToRemove.forEach(({ storage, key }) => {
            if (storage === 'local') window.localStorage.removeItem(key);
            else window.sessionStorage.removeItem(key);
          });

          setUser(null);
          setProfile(null);
          setBalance(null);
          setPermissions({});
          toast({ title: 'Déconnexion réussie', description: 'Session supprimée localement.' });
          return { error: null };
        } catch {
          toast({ variant: "destructive", title: "La déconnexion a échoué", description: error.message || "Quelque chose s'est mal passé" });
          return { error };
        }
      }, [toast]);

      const updateUser = useCallback(async (updates) => {
        const { data, error } = await supabase.auth.updateUser(updates);
        if (error) { toast({ variant: "destructive", title: "La mise à jour a échoué", description: error.message || "Quelque chose s'est mal passé" }); }
        return { data, error };
      }, [toast]);
      
      const value = useMemo(() => ({
        user, session, profile, balance, loading, permissions, signUp, signIn, signOut, updateUser, refreshProfile, refreshBalance, checkFeaturePermission
      }), [user, session, profile, balance, loading, permissions, signUp, signIn, signOut, updateUser, refreshProfile, refreshBalance, checkFeaturePermission]);

      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
    };

    export const useAuth = () => {
      const context = useContext(AuthContext);
      if (context === undefined) { throw new Error('useAuth must be used within an AuthProvider'); }
      return context;
    };