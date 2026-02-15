import React, { useState, useEffect, useMemo } from 'react';

import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Shield, Award, MessageSquare as MessageSquareQuote, Gem, Star, Crown, Loader2, Flag } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import MediaDisplay from '@/components/MediaDisplay';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDistanceToNow, differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import { fr } from 'date-fns/locale';

const Badge = ({ icon, label, colorClass }) => (
  <div className={`flex items-center gap-2 py-1 px-3 rounded-full text-sm font-semibold ${colorClass}`}>
    {icon}
    <span>{label}</span>
  </div>
);

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { onlineUserIds, user: authUser, profile: myProfile, balance, blockUser, unblockUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [postsCount, setPostsCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [levels, setLevels] = useState([]);
  const [targetBalance, setTargetBalance] = useState(null);
  const [communityBadges, setCommunityBadges] = useState([]);

  const isBlocked = React.useMemo(() => {
    const list = Array.isArray(myProfile?.blocked_user_ids) ? myProfile.blocked_user_ids.map(String) : [];
    return list.includes(String(userId));
  }, [myProfile?.blocked_user_ids, userId]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile:", error);
        toast({
            title: "Erreur de chargement",
            description: "Impossible de charger le profil de l'utilisateur.",
            variant: "destructive"
        });
      }

      setProfile(userProfile);
      setLoading(false);
    };
    loadProfile();
  }, [userId]);

  // Charger les niveaux OK Coins (pour calculer le niveau dynamiquement)
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('okcoins_levels').select('*').order('id');
        if (!error) setLevels(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, []);

  // Déterminer le solde/points de l'utilisateur affiché
  useEffect(() => {
    if (!userId) return;
    // Si on regarde notre propre profil, utiliser le balance du contexte (exactement comme la page OK Coins)
    if (authUser?.id && String(authUser.id) === String(userId)) {
      setTargetBalance(balance || null);
      return;
    }
    // Sinon, tentative de lecture du solde public de l'utilisateur (si RLS l'autorise)
    (async () => {
      try {
        const { data, error } = await supabase
          .from('okcoins_users_balance')
          .select('user_id, points_total, coins_balance')
          .eq('user_id', userId)
          .single();
        if (!error) setTargetBalance(data || null);
      } catch {
        // Silencieux si non autorisé
      }
    })();
  }, [userId, authUser?.id, balance]);

  const currentLevelForProfile = useMemo(() => {
    try {
      const pts = Number(targetBalance?.points_total ?? 0);
      if (!Array.isArray(levels) || levels.length === 0) return null;
      const match = levels.find((l) => pts >= Number(l.min_points) && pts <= Number(l.max_points));
      return match || levels[0] || null;
    } catch {
      return null;
    }
  }, [levels, targetBalance?.points_total]);

  // Badges communauté attribués (user_badges -> badges)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: ub, error: e1 } = await supabase
          .from('user_badges')
          .select('badge_id, awarded_at')
          .eq('user_id', userId);
        if (e1 || !Array.isArray(ub) || ub.length === 0) { setCommunityBadges([]); return; }
        const ids = ub.map((x) => x.badge_id).filter(Boolean);
        const { data: bs, error: e2 } = await supabase
          .from('badges_communaute')
          .select('id, name, code, icon, icon_url, description, is_special, created_at')
          .in('id', ids);
        if (e2 || !Array.isArray(bs)) { setCommunityBadges([]); return; }
        const byId = new Map(bs.map(b => [b.id, b]));
        const merged = ub
          .map(u => ({ ...(byId.get(u.badge_id) || {}), awarded_at: u.awarded_at }))
          .filter(b => b && b.id && String(b.code || '').toLowerCase() !== 'new_member');
        setCommunityBadges(merged);
      } catch {
        setCommunityBadges([]);
      }
    })();
  }, [userId]);

  useEffect(() => {
    const loadCounts = async () => {
      if (!userId) return;
      try {
        const [{ count: pCount }, { count: cCount }] = await Promise.all([
          supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('comments').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        ]);
        setPostsCount(typeof pCount === 'number' ? pCount : 0);
        setCommentsCount(typeof cCount === 'number' ? cCount : 0);
      } catch (_) {}
    };
    const loadLists = async () => {
      if (!userId) return;
      setLoadingPosts(true);
      setLoadingComments(true);
      try {
        const [{ data: userPosts }, { data: userComments }] = await Promise.all([
          supabase
            .from('posts')
            .select('id, content, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('comments')
            .select('id, content, created_at, content_type, content_id, parent_comment_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
        ]);
        setPosts(Array.isArray(userPosts) ? userPosts : []);
        setComments(Array.isArray(userComments) ? userComments : []);
        if (!postsCount && Array.isArray(userPosts)) setPostsCount(userPosts.length);
        if (!commentsCount && Array.isArray(userComments)) setCommentsCount(userComments.length);
      } catch (_) {}
      finally {
        setLoadingPosts(false);
        setLoadingComments(false);
      }
    };
    loadCounts();
    loadLists();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p>Profil non trouvé.</p>
        <Button onClick={() => navigate(-1)}>Retour</Button>
      </div>
    );
  }
  
  const planColors = {
    'Free': 'bg-gray-200 text-gray-800',
    'Standard': 'bg-blue-100 text-blue-800',
    'VIP': 'bg-yellow-200 text-yellow-800',
    'free': 'bg-gray-200 text-gray-800',
    'standard': 'bg-blue-100 text-blue-800',
    'vip': 'bg-yellow-200 text-yellow-800',
  };

  const allowsOnline = profile?.show_online_status !== false;
  const isOnline = Boolean(allowsOnline && userId && (onlineUserIds instanceof Set) && onlineUserIds.has(String(userId)));
  const statusText = (() => {
    if (!allowsOnline) return 'Hors ligne';
    if (isOnline) return 'En ligne';
    if (profile?.last_seen_at) {
      try {
        return `Vu ${formatDistanceToNow(new Date(profile.last_seen_at), { addSuffix: true, locale: fr })}`;
      } catch {
        return 'Hors ligne';
      }
    }
    return 'Hors ligne';
  })();

  const memberSinceLabel = (() => {
    const created = profile?.created_at ? new Date(profile.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) return null;
    try {
      const days = differenceInDays(new Date(), created);
      if (days < 30) return `${days} jour${days > 1 ? 's' : ''}`;
      const months = differenceInMonths(new Date(), created);
      if (months < 12) return `${months} mois`;
      const years = Math.max(1, differenceInYears(new Date(), created));
      return `${years} an${years > 1 ? 's' : ''}`;
    } catch {
      return null;
    }
  })();

  const isNewMember = (() => {
    const created = profile?.created_at ? new Date(profile.created_at) : null;
    if (!created || Number.isNaN(created.getTime())) return false;
    try {
      const days = differenceInDays(new Date(), created);
      return days < 14;
    } catch {
      return false;
    }
  })();

  const planLabel = (() => {
    const p = String(profile?.plan || '').toLowerCase();
    if (p === 'vip') return 'VIP';
    if (p === 'standard') return 'Standard';
    if (p === 'free') return 'Free';
    return profile?.plan || 'Free';
  })();

  const levelBadgeLabel = useMemo(() => {
    const id = currentLevelForProfile?.id ?? (profile?.level ?? 1);
    const nameRaw = currentLevelForProfile?.level_name || profile?.levelName || '';
    const name = String(nameRaw || '').trim();
    if (name && /^niveau/i.test(name)) return name;
    return name ? `Niveau ${id} - ${name}` : `Niveau ${id}`;
  }, [currentLevelForProfile?.id, currentLevelForProfile?.level_name, profile?.level, profile?.levelName]);

  return (
    <>
      <Helmet>
        <title>Profil de {profile.username || 'Utilisateur'} - OneKamer.co</title>
      </Helmet>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                {profile.avatar_url ? (
                  <button
                    type="button"
                    className="w-32 h-32 rounded-full overflow-hidden mb-4 focus:outline-none focus:ring-2 focus:ring-[#2BA84A]"
                    onClick={() => setLightboxOpen(true)}
                  >
                    <MediaDisplay
                      bucket="avatars"
                      path={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#2BA84A] to-[#F5C300] flex items-center justify-center text-white text-5xl font-bold mb-4">
                    {(profile.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <h1 className="text-3xl font-bold text-gray-800">{profile.username || 'Utilisateur'}</h1>
                <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span>{statusText}</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <span>
                    {memberSinceLabel ? `Membre depuis ${memberSinceLabel}` : ''}
                    {` ${memberSinceLabel ? '· ' : ''}`}{postsCount} post{postsCount > 1 ? 's' : ''} · {commentsCount} commentaire{commentsCount > 1 ? 's' : ''}
                  </span>
                </div>
                {authUser?.id && String(authUser.id) !== String(userId) && (
                  <div className="mt-3 flex items-center gap-2">
                    {isBlocked ? (
                      <Button variant="outline" onClick={() => unblockUser(userId)}>Ne plus bloquer</Button>
                    ) : (
                      <Button variant="outline" onClick={() => blockUser(userId)}>Bloquer</Button>
                    )}
                    <Button variant="ghost" onClick={() => navigate(`/aide?type=report&userId=${encodeURIComponent(userId)}`)}>
                      <Flag className="h-4 w-4 mr-1" /> Signaler
                    </Button>
                  </div>
                )}
                
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <Badge 
                    icon={<Gem className="h-4 w-4" />} 
                    label={levelBadgeLabel}
                    colorClass="bg-purple-100 text-purple-800"
                  />
                  <Badge 
                    icon={<Crown className="h-4 w-4" />} 
                    label={planLabel}
                    colorClass={planColors[profile.plan] || 'bg-gray-200 text-gray-800'}
                  />
                  {isNewMember && (
                    <Badge
                      icon={<span className="text-base">👋🏾</span>}
                      label="Nouveau membre"
                      colorClass="bg-gray-100 text-gray-800"
                    />
                  )}
                  {communityBadges.map((b) => (
                    <Badge
                      key={b.id}
                      icon={b.icon ? <span className="text-base">{b.icon}</span> : (b.icon_url ? <img src={b.icon_url} alt={b.name} className="h-4 w-4" /> : <Star className="h-4 w-4" />)}
                      label={b.name || b.code}
                      colorClass="bg-gray-100 text-gray-800"
                    />
                  ))}
                  {profile.isTopDonor && (
                    <Badge 
                      icon={<Award className="h-4 w-4" />} 
                      label="Top Donateur"
                      colorClass="bg-green-100 text-green-800"
                    />
                  )}
                  {profile.isTopCommenter && (
                    <Badge 
                      icon={<MessageSquareQuote className="h-4 w-4" />} 
                      label="Top Commentateur"
                      colorClass="bg-indigo-100 text-indigo-800"
                    />
                  )}
                  {profile.roles?.map(role => (
                     <Badge 
                      key={role}
                      icon={role === 'Modérateur' ? <Shield className="h-4 w-4" /> : <Star className="h-4 w-4" />} 
                      label={role}
                      colorClass="bg-red-100 text-red-800"
                    />
                  ))}
                </div>

                <p className="text-gray-600 mt-6 max-w-md">{profile.bio || 'Aucune biographie.'}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mt-6">
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex justify-center">
                  <TabsList>
                    <TabsTrigger value="posts">Posts</TabsTrigger>
                    <TabsTrigger value="comments">Commentaires</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="posts" className="mt-4">
                  {loadingPosts ? (
                    <div className="text-center text-gray-500">Chargement...</div>
                  ) : (
                    <div className="space-y-3">
                      {posts.length === 0 ? (
                        <div className="text-center text-gray-500">Aucun post.</div>
                      ) : (
                        posts.map((p) => (
                          <div
                            key={p.id}
                            className="border-b pb-2 cursor-pointer"
                            role="button"
                            onClick={() => navigate(`/echange?postId=${encodeURIComponent(p.id)}`)}
                          >
                            <div className="text-sm text-gray-500">{new Date(p.created_at).toLocaleString('fr-FR')}</div>
                            <div className="text-gray-800 whitespace-pre-wrap">{p.content || '(sans contenu)'}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="comments" className="mt-4">
                  {loadingComments ? (
                    <div className="text-center text-gray-500">Chargement...</div>
                  ) : (
                    <div className="space-y-3">
                      {comments.length === 0 ? (
                        <div className="text-center text-gray-500">Aucun commentaire.</div>
                      ) : (
                        comments.map((c) => (
                          <div
                            key={c.id}
                            className="border-b pb-2 cursor-pointer"
                            role="button"
                            onClick={() => {
                              const ct = String(c?.content_type || '');
                              if (ct === 'post' && c?.content_id) {
                                navigate(`/echange?postId=${encodeURIComponent(c.content_id)}&commentId=${encodeURIComponent(c.id)}`);
                              } else if (ct === 'echange' && c?.parent_comment_id) {
                                navigate(`/echange?audioId=${encodeURIComponent(c.parent_comment_id)}&commentId=${encodeURIComponent(c.id)}`);
                              } else {
                                navigate('/echange');
                              }
                            }}
                          >
                            <div className="text-sm text-gray-500">{new Date(c.created_at).toLocaleString('fr-FR')}</div>
                            <div className="text-gray-800 whitespace-pre-wrap">{c.content || '(sans contenu)'}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      {lightboxOpen && profile.avatar_url && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="max-w-[95vw] max-h-[95vh] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <MediaDisplay
              bucket="avatars"
              path={profile.avatar_url}
              alt="Avatar"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default UserProfile;