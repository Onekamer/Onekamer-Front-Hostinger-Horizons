
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Users, FileText, TrendingUp, MapPin, Clock, Heart, MessageCircle, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import MediaDisplay from '@/components/MediaDisplay';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const SectionHeader = ({ title, icon: Icon, path, navigate }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <Icon className="h-6 w-6 text-[#2BA84A]" />
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
    </div>
    <Button variant="link" className="text-sm font-semibold text-[#2BA84A] hover:underline p-0 h-auto" onClick={() => navigate(path)}>
      Voir tout
    </Button>
  </div>
);

const Home = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [events, setEvents] = useState([]);
  const [faitsDivers, setFaitsDivers] = useState([]); // Changed from partners
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Tendances: Top 2 posts + audios (7j) classés par likes
      const fetchTrendingPosts = supabase
        .from('posts')
        .select('*, profiles(username, avatar_url)')
        .gte('created_at', sevenDaysAgo)
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      const fetchTrendingAudios = supabase
        .from('comments')
        .select('*, author:profiles (username, avatar_url)')
        .eq('content_type', 'echange')
        .is('parent_comment_id', null)
        .gte('created_at', sevenDaysAgo)
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      const fetchEvents = supabase
        .from('evenements')
        .select('*')
        .order('date', { ascending: true })
        .limit(2);

      const fetchFaitsDivers = supabase // Changed from fetchPartners
        .from('faits_divers') // Changed table
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

      const fetchAnnonces = supabase
        .from('annonces')
        .select('*, devises(symbole)')
        .order('created_at', { ascending: false })
        .limit(2);

      const [
        trendingPostsResult,
        trendingAudiosResult,
        eventsResult,
        faitsDiversResult, // Changed from partnersResult
        annoncesResult
      ] = await Promise.all([fetchTrendingPosts, fetchTrendingAudios, fetchEvents, fetchFaitsDivers, fetchAnnonces]); // Changed from partnersResult

      // Fusionner posts et audios, trier par likes puis date, garder Top 2
      const normalizedPosts = (trendingPostsResult.data || []).map(p => ({
        id: p.id,
        type: 'post',
        created_at: p.created_at,
        content: p.content,
        likes_count: Number(p.likes_count) || 0,
        comments_count: Number(p.comments_count) || 0,
        profiles: p.profiles || null,
      }));

      const normalizedAudios = (trendingAudiosResult.data || []).map(a => ({
        id: a.id,
        type: 'audio_post',
        created_at: a.created_at,
        content: a.content,
        likes_count: Number(a.likes_count) || 0,
        comments_count: Number(a.comments_count) || 0,
        profiles: a.author || null,
      }));

      const merged = [...normalizedPosts, ...normalizedAudios]
        .sort((a, b) => (b.likes_count - a.likes_count) || (new Date(b.created_at) - new Date(a.created_at)))
        .slice(0, 2);

      setTrending(merged);
      setEvents(eventsResult.data || []);
      setFaitsDivers(faitsDiversResult.data || []); // Changed from setPartners
      setAnnonces(annoncesResult.data || []);
      
      setLoading(false);
    };

    fetchData();
  }, []);

  const formatPrice = (price, devise) => {
    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber) || priceNumber <= 0) {
        return 'Gratuit';
    }
    const symbol = devise?.symbole || '€';
    return `${priceNumber.toFixed(2).replace('.', ',')} ${symbol}`;
  };

  return (
    <>
      <Helmet>
        <title>Accueil - OneKamer.co</title>
        <meta name="description" content="Bienvenue sur OneKamer.co, la communauté camerounaise en ligne" />
      </Helmet>

      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-left">
          <h1 className="text-3xl font-bold text-[#2BA84A] mb-2 leading-tight">
            Bienvenue sur OneKamer<span className="text-xl font-normal text-[#2BA84A]">.co</span>
          </h1>
          <p className="text-md text-[#6B6B6B]">Le premier repère de la communauté camerounaise qui regroupe tous ses ressortissant(e)s et sa diaspora à travers le monde.</p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" /></div>
        ) : (
          <>
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
              <SectionHeader title="Tendances" icon={TrendingUp} path="/echange" navigate={navigate} />
              <div className="space-y-4">
                {trending.map(item => (
                  <Card key={`${item.type}-${item.id}`} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/echange')}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                          <MediaDisplay bucket="avatars" path={item.profiles?.avatar_url} alt={item.profiles?.username} className="w-full h-full object-cover" fallback={
                            <div className="w-10 h-10 bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                              {item.profiles?.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                          }/>
                        </div>
                        <div className="flex-grow">
                          <p className="font-bold text-sm">{item.profiles?.username}</p>
                          <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: fr })}</p>
                          <p className="text-sm text-gray-700 my-2 line-clamp-2">{item.content}</p>
                          <div className="flex items-center gap-4 text-gray-500">
                            <span className="flex items-center gap-1 text-xs"><Heart className="h-4 w-4 text-red-500" /> {item.likes_count}</span>
                            <span className="flex items-center gap-1 text-xs"><MessageCircle className="h-4 w-4 text-blue-500" /> {item.comments_count}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.section>

            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <SectionHeader title="Événements à venir" icon={Calendar} path="/evenements" navigate={navigate} />
              <div className="space-y-4">
                {events.map(event => (
                  <Card key={event.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/evenements')}>
                    <MediaDisplay bucket="evenements" path={event.media_url} alt={event.title} className="w-full h-32 object-cover" />
                    <CardContent className="p-4">
                      <h3 className="font-bold text-md mb-2 truncate">{event.title}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(event.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.section>

            {/* Section for Faits Divers - Replaced Partners */}
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <SectionHeader title="Faits Divers" icon={FileText} path="/faits-divers" navigate={navigate} /> {/* Updated title, icon, and path */}
              <div className="grid grid-cols-1 gap-4"> {/* Changed grid layout to 1 column for article format */}
                {faitsDivers.map(fait => ( // Changed from partners to faitsDivers
                  <Card key={fait.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/faits-divers')}>
                    <MediaDisplay bucket="faits_divers" path={fait.image_url} alt={fait.title} className="w-full h-40 object-cover" /> {/* Updated image display */}
                    <CardContent className="p-4">
                      <h3 className="font-bold text-md mb-2 truncate">{fait.title}</h3> {/* Display title */}
                      <p className="text-xs text-gray-500 line-clamp-2">{fait.excerpt}</p> {/* Display excerpt */}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.section>

            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <SectionHeader title="Annonces récentes" icon={FileText} path="/annonces" navigate={navigate} />
              <div className="space-y-4">
                {annonces.map(annonce => (
                  <Card key={annonce.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/annonces')}>
                    <MediaDisplay bucket="annonces" path={annonce.media_url} alt={annonce.titre} className="w-full h-32 object-cover" />
                    <CardContent className="p-4">
                      <h3 className="font-bold text-md truncate">{annonce.titre}</h3>
                      <p className="text-lg font-semibold text-[#2BA84A]">{formatPrice(annonce.prix, annonce.devises)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.section>
          </>
        )}
      </div>
    </>
  );
};

export default Home;
