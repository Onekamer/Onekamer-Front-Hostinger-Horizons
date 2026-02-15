import { supabase } from '@/lib/customSupabaseClient';

const accessCache = new Map();
const ACCESS_CACHE_TTL_MS = 30 * 1000;

export async function canUserAccess(user, section, action = "read") {
  if (!user?.id) {
    console.warn("⚠️ Aucun utilisateur connecté, accès refusé.");
    return false;
  }

  const cacheKey = `${user.id}:${section}:${action}`;
  const cached = accessCache.get(cacheKey);
  if (cached && Date.now() - cached.t < ACCESS_CACHE_TTL_MS) {
    return cached.v;
  }

  try {
    // 1️⃣ Récupération du plan et attributs admin depuis la table profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, role, is_admin')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error("❌ Erreur chargement profil :", profileError?.message);
      return false;
    }

    const plan = (profile.plan || 'free').toLowerCase();
    console.log(`🔍 [canUserAccess] Utilisateur ${user.id} | Plan = ${plan} | Section = ${section} | Action = ${action}`);

    if (section === 'rencontre') {
      if (['read', 'create', 'view'].includes(action)) {
        accessCache.set(cacheKey, { v: true, t: Date.now() });
        return true;
      }
    }

    // 3️⃣ Vérification via Supabase (autorité) avec fallback app
    console.log(`🧠 Vérification via Supabase RPC check_user_access(${section}, ${action})...`);
    const { data, error } = await supabase.rpc("check_user_access", {
      p_user_id: user.id,
      p_section: section,
      p_action: action
    });

    if (!error) {
      const allowedFromServer = data === true;

      let forcedDeny = false;
      const isAdmin = (
        profile?.is_admin === true ||
        profile?.is_admin === 1 ||
        profile?.is_admin === 'true' ||
        String(profile?.role || '').toLowerCase() === 'admin'
      );

      const needsTighten = (
        (section === 'annonces' && action === 'create') ||
        (section === 'evenements' && action === 'create') ||
        (section === 'partenaires' && action === 'create') ||
        (section === 'groupes' && action === 'create') ||
        (section === 'partenaires' && action === 'read') ||
        (section === 'rencontre' && action === 'view') ||
        (section === 'rencontre' && action === 'interact')
      );

      if (allowedFromServer && needsTighten) {
        let effective = plan;
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess?.session?.access_token;
          const API_PREFIX = import.meta.env.VITE_API_URL || '/api';
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const r = await fetch(`${API_PREFIX}/iap/subscription?userId=${encodeURIComponent(user.id)}`, { headers });
          if (r.ok) {
            const j = await r.json().catch(() => ({}));
            const sub = j?.subscription || null;
            if (sub?.plan_name && sub?.end_date) {
              const active = new Date(sub.end_date).getTime() > Date.now();
              if (active) effective = String(sub.plan_name || effective).toLowerCase();
              else effective = 'free';
            }
          }
        } catch {}

        if (section === 'annonces' && action === 'create') {
          forcedDeny = !(isAdmin || effective === 'vip');
        } else if (section === 'evenements' && action === 'create') {
          forcedDeny = !(isAdmin || effective === 'vip');
        } else if (section === 'partenaires' && action === 'create') {
          forcedDeny = !(isAdmin || effective === 'vip');
        } else if (section === 'groupes' && action === 'create') {
          forcedDeny = !(isAdmin || effective === 'vip');
        } else if (section === 'partenaires' && action === 'read') {
          forcedDeny = !(isAdmin || effective === 'standard' || effective === 'vip');
        } else if (section === 'rencontre' && action === 'interact') {
          forcedDeny = !(isAdmin || effective === 'vip');
        }
      }

      const finalAllowed = allowedFromServer && !forcedDeny;
      accessCache.set(cacheKey, { v: finalAllowed, t: Date.now() });
      return finalAllowed;
    }

    console.error("❌ Erreur RPC check_user_access:", error.message);

    // 3bis️⃣ Fallback app (uniquement pour rencontre:interact)
    if (section === 'rencontre' && action === 'interact') {
      try {
        const isAdmin = (
          profile?.is_admin === true ||
          profile?.is_admin === 1 ||
          profile?.is_admin === 'true' ||
          String(profile?.role || '').toLowerCase() === 'admin'
        );

        // Récupérer la session pour appeler l'API Node
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        const API_PREFIX = import.meta.env.VITE_API_URL || '/api';

        let vipActive = false;
        try {
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const r = await fetch(`${API_PREFIX}/iap/subscription?userId=${encodeURIComponent(user.id)}`, { headers });
          if (r.ok) {
            const j = await r.json().catch(() => ({}));
            const sub = j?.subscription || null;
            if (sub?.plan_name && sub?.end_date) {
              const active = new Date(sub.end_date).getTime() > Date.now();
              vipActive = active && String(sub.plan_name).toLowerCase() === 'vip';
            }
          }
        } catch {}

        const allowed = Boolean(isAdmin || vipActive);
        accessCache.set(cacheKey, { v: allowed, t: Date.now() });
        return allowed;
      } catch (e) {
        console.error('⚠️ Fallback rencontre:interact échoué:', e?.message || e);
        accessCache.set(cacheKey, { v: false, t: Date.now() });
        return false;
      }
    }

    accessCache.set(cacheKey, { v: false, t: Date.now() });
    return false;
  } catch (error) {
    console.error("💥 Erreur inattendue dans canUserAccess :", error.message);
    accessCache.set(cacheKey, { v: false, t: Date.now() });
    return false;
  }
}
