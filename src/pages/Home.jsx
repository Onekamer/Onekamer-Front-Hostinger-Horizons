
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
import OfficialBadge from '@/components/OfficialBadge';

const toHashLabel = (name) => {
  try {
    const base = String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_');
    return base ? `#${base}` : '#contenu';
  } catch (_) {
    return '#contenu';
  }
};

const InlineRefTag = ({ typ, rid, href }) => {
  const [label, setLabel] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        let out = '';
        if (typ === 'evenement') {
          const { data } = await supabase.from('evenements').select('title').eq('id', rid).maybeSingle();
          out = data?.title || '';
        } else if (typ === 'annonce') {
          const { data } = await supabase.from('annonces').select('titre').eq('id', rid).maybeSingle();
          out = data?.titre || '';
        } else if (typ === 'partenaire') {
          const { data } = await supabase.from('partenaires').select('name').eq('id', rid).maybeSingle();
          out = data?.name || '';
        } else if (typ === 'groupe') {
          const { data } = await supabase.from('groupes').select('nom').eq('id', rid).maybeSingle();
          out = data?.nom || '';
        } else {
          const { data } = await supabase.from('faits_divers').select('title').eq('id', rid).maybeSingle();
          out = data?.title || '';
        }
        if (mounted) setLabel(out || '');
      } catch (_) {}
    };
    load();
    return () => { mounted = false; };
  }, [typ, rid]);

  const text = toHashLabel(label);
  return (
    <a href={href} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#2BA84A]/10 text-[#2BA84A] text-xs font-medium">{text}</a>
  );
};

const parseMentions = (text) => {
  if (!text) return '';
  const re = /(\[\[m:([^\]]{1,60})\]\])|(\[\[ref:([a-z_]+):([^\]]+)\]\])|(^|[\s])[@\uFF20](?:\u200B)?([A-Za-z0-9À-ÖØ-öø-ÿ'’._-]+(?:\s+[A-Za-z0-9À-ÖØ-öø-ÿ'’._-]+){0,4})/g;
  const out = [];
  let lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const full = m[0];
    const isTokenM = !!m[1];
    const isRef = !!m[3];
    const username = (isTokenM ? m[2] : m[7]) || '';
    const before = (isTokenM || isRef) ? '' : (m[6] || '');
    if (start > lastIndex) out.push(text.slice(lastIndex, start));
    if (before) out.push(before);
    if (isRef) {
      const typ = String(m[4] || '').toLowerCase();
      const rid = String(m[5] || '');
      const path = (
        typ === 'evenement' ? `/evenements?eventId=${encodeURIComponent(rid)}` :
        typ === 'annonce' ? `/annonces?annonceId=${encodeURIComponent(rid)}` :
        typ === 'partenaire' ? `/partenaires?partnerId=${encodeURIComponent(rid)}` :
        typ === 'groupe' ? `/groupes/${encodeURIComponent(rid)}` :
        `/faits-divers?articleId=${encodeURIComponent(rid)}`
      );
      out.push(<InlineRefTag key={`ref-${start}-${typ}-${rid}`} typ={typ} rid={rid} href={path} />);
    } else {
      let u = username;
      if (!u) {
        try {
          const afterAt = full.replace(/^[^@\uFF20]*[@\uFF20](?:\u200B)?/, '');
          const m2 = afterAt.match(/^([A-Za-z0-9À-ÖØ-öø-ÿ'’._-]+(?:\s+[A-Za-z0-9À-ÖØ-öø-ÿ'’._-]+){0,4})/);
          if (m2 && m2[1]) u = m2[1];
        } catch (_) {}
      }
      out.push(<span key={`${start}-${u}`} className="mention text-[#2BA84A] font-semibold">@{u}</span>);
    }
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
};

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

// Icônes de badges communauté (non cliquables) à partir de user_badges
const UserBadgeIconsStatic = ({ userId, max = 3, className = '' }) => {
  const [icons, setIcons] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!userId) { if (mounted) setIcons([]); return; }
        const { data: ub } = await supabase
          .from('user_badges')
          .select('badge_id')
          .eq('user_id', userId);
        const ids = (ub || []).map((r) => r.badge_id).filter(Boolean);
        if (!ids.length) { if (mounted) setIcons([]); return; }
        const { data: bs } = await supabase
          .from('badges_communaute')
          .select('id, name, code, icon, icon_url')
          .in('id', ids);
        const list = Array.isArray(bs) ? bs.filter((b) => String(b.code || '').toLowerCase() !== 'new_member') : [];
        if (mounted) setIcons(list);
      } catch {
        if (mounted) setIcons([]);
      }
    })();
    return () => { mounted = false; };
  }, [userId]);

  if (!icons.length) return null;
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {icons.slice(0, max).map((b) => (
        <span key={b.id} className="inline-flex items-center justify-center">
          {b.icon ? (
            <span className="text-[14px] leading-none">{b.icon}</span>
          ) : b.icon_url ? (
            <img src={b.icon_url} alt={b.name || b.code || 'badge'} className="w-4 h-4 object-contain" />
          ) : null}
        </span>
      ))}
    </div>
  );
};

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
        .select('*, profiles(id, username, avatar_url, is_official)')
        .gte('created_at', sevenDaysAgo)
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      const fetchTrendingAudios = supabase
        .from('comments')
        .select('*, author:profiles (id, username, avatar_url, is_official)')
        .eq('content_type', 'echange')
        .is('parent_comment_id', null)
        .gte('created_at', sevenDaysAgo)
        .order('likes_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);

      const fetchEvents = supabase
        .from('evenements')
        .select('*')
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
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
        image_url: p.image_url || null,
        video_url: p.video_url || null,
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
                  <Card
                    key={`${item.type}-${item.id}`}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      const param = item.type === 'audio_post' ? 'audioId' : 'postId';
                      navigate(`/echange?${param}=${encodeURIComponent(item.id)}`);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                          <MediaDisplay bucket="avatars" path={item.profiles?.avatar_url} alt={item.profiles?.username} className="w-full h-full object-cover" forceImage={true} disableLightbox={true} fallback={
                            <div className="w-10 h-10 bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                              {item.profiles?.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                          }/>
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center gap-1">
                            <p className="font-bold text-sm">{item.profiles?.username}</p>
                            {item.profiles?.is_official ? (<OfficialBadge />) : null}
                            {item.profiles?.id ? (<UserBadgeIconsStatic userId={item.profiles.id} className="ml-1" />) : null}
                          </div>
                          <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: fr })}</p>
                          <div className="text-sm text-gray-700 my-2 line-clamp-2">{parseMentions(item.content)}</div>
                          {item?.video_url ? (
                            <MediaDisplay
                              bucket="posts"
                              path={item.video_url}
                              className="w-full rounded-md mt-2 aspect-video overflow-hidden bg-black/5"
                              disableLightbox={true}
                              fitContain={true}
                              videoControls={false}
                            />
                          ) : item?.image_url ? (
                            <MediaDisplay
                              bucket="posts"
                              path={item.image_url}
                              className="w-full h-40 object-cover rounded-md mt-2"
                              disableLightbox={true}
                            />
                          ) : null}
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
                    <MediaDisplay bucket="evenements" path={event.media_url} alt={event.title} className="w-full h-32 object-cover" forceImage={true} disableLightbox={true} />
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

            {/* Section Actualités */}
            <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <SectionHeader title="Actualités" icon={FileText} path="/faits-divers" navigate={navigate} />
              <div className="grid grid-cols-1 gap-4"> {/* Changed grid layout to 1 column for article format */}
                {faitsDivers.map(fait => ( // Changed from partners to faitsDivers
                  <Card key={fait.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/faits-divers')}>
                    <MediaDisplay bucket="faits_divers" path={fait.image_url} alt={fait.title} className="w-full h-40 object-cover" forceImage={true} disableLightbox={true} /> {/* Updated image display */}
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
                    <MediaDisplay bucket="annonces" path={annonce.media_url} alt={annonce.titre} className="w-full h-32 object-cover" forceImage={true} disableLightbox={true} />
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
