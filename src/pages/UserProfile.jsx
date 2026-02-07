import React, { useState, useEffect } from 'react';

import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Shield, Award, MessageSquare as MessageSquareQuote, Gem, Star, Crown, Loader2, Flag } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import MediaDisplay from '@/components/MediaDisplay';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
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
  const { onlineUserIds, user: authUser, profile: myProfile, blockUser, unblockUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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
                    label={`Niveau ${profile.level || 1} - ${profile.levelName || 'Bronze'}`}
                    colorClass="bg-purple-100 text-purple-800"
                  />
                  <Badge 
                    icon={<Crown className="h-4 w-4" />} 
                    label={profile.plan || 'Free'}
                    colorClass={planColors[profile.plan] || 'bg-gray-200 text-gray-800'}
                  />
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