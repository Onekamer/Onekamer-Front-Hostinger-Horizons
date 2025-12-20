
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, PlusCircle, Bell, Loader2, Lock, Search, Mail } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Input } from '@/components/ui/input';
import { canUserAccess } from '@/lib/accessControl';
import MediaDisplay from '@/components/MediaDisplay';

const Groupes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [groupes, setGroupes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [invitationCount, setInvitationCount] = useState(0);

  useEffect(() => {
    if (user) {
      canUserAccess(user, 'groupes', 'create').then(setCanCreate);
    }
  }, [user]);

  const fetchGroups = useCallback(async () => {
    if (!user) {
        setLoading(false);
        return;
    }
    setLoading(true);

    let query = supabase.from('view_groupes_accessible').select('*');
    
    if (searchTerm) {
      query = query.ilike('nom', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching groupes:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les groupes.', variant: 'destructive' });
      setGroupes([]);
    } else {
        const groupesWithCount = await Promise.all(data.map(async (groupe) => {
            const { count, error: countError } = await supabase.from('groupes_membres').select('*', { count: 'exact' }).eq('groupe_id', groupe.id);
            if(countError) console.error("Error fetching member count", countError);
            return { ...groupe, membres_count: count || 0 };
        }));
        setGroupes(groupesWithCount);
    }
    setLoading(false);
  }, [user, searchTerm, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if(!user) return;
    const fetchInvitationCount = async () => {
        const { count, error: invitationError } = await supabase
          .from('groupes_invitations')
          .select('*', { count: 'exact', head: true })
          .eq('invited_user_id', user.id)
          .eq('status', 'pending');
        
        if (invitationError) {
            console.error("Error fetching invitation count", invitationError);
        } else {
            setInvitationCount(count);
        }
    }
    fetchInvitationCount();
  }, [user]);

  const handleCreateGroupClick = async () => {
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    
    if (await canUserAccess(user, 'groupes', 'create')) {
      navigate('/groupes/creer');
    } else {
      toast({
        title: "Accès restreint",
        description: "La création de groupe est réservée aux membres Standard et VIP.",
        variant: "destructive",
      });
      navigate("/forfaits");
    }
  };
  
  const GroupCard = ({ group }) => (
    <Link to={`/groupes/${group.id}`} className="block">
      <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
      >
        <Card className="hover:shadow-lg transition-shadow duration-300 overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
            <div className="h-16 w-16 flex-shrink-0">
                <MediaDisplay bucket="groupes" path={group.image_url} alt={group.nom} className="h-16 w-16 rounded-full object-cover" />
            </div>
            <div className="flex-grow min-w-0">
                <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold truncate" title={group.nom}>{group.nom}</h3>
                {group.est_prive ? (
                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full flex-shrink-0">Privé</span>
                ) : (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex-shrink-0">Public</span>
                )}
                </div>
                <p className="text-sm text-gray-500 truncate mt-1">{group.description}</p>
                <div className="flex items-center text-sm text-gray-500 mt-1">
                <Users className="h-4 w-4 mr-1" />
                <span>{group.membres_count || 0} membre{group.membres_count > 1 ? 's' : ''}</span>
                </div>
            </div>
            </CardContent>
        </Card>
      </motion.div>
    </Link>
  );

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" /></div>;
  }

  return (
    <>
      <Helmet>
        <title>Groupes - OneKamer.co</title>
        <meta name="description" content="Rejoignez ou créez des groupes de discussion sur OneKamer.co." />
      </Helmet>
      <div className="max-w-4xl mx-auto p-4 sm:p-0">
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2BA84A]">Groupes</h1>
          <div className="flex gap-2 self-end sm:self-center">
            <Button variant="outline" onClick={() => navigate('/groupes/invitations')} className="relative">
              <Mail className="h-5 w-5 mr-2" /> Invitations
              {invitationCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {invitationCount}
                </span>
              )}
            </Button>
            <Button onClick={handleCreateGroupClick}>
              {canCreate ? <PlusCircle className="h-5 w-5 mr-2" /> : <Lock className="h-5 w-5 mr-2" />}
              Créer
            </Button>
          </div>
        </motion.div>
        
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <Input 
            placeholder="Rechercher un groupe..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Découvrir les groupes</h2>
            {groupes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groupes.map(group => <GroupCard key={group.id} group={group} />)}
              </div>
            ) : (
              <p className="text-gray-500 text-center mt-8">Aucun groupe ne correspond à votre recherche.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default Groupes;
