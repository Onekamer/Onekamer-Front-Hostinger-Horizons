import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Loader2, MapPin, Calendar, FileText, Users, TrendingUp, Newspaper, Heart } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import MediaDisplay from '@/components/MediaDisplay';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const getRencontrePhoto = (record) => {
  if (!record) return null;
  const photosArray = Array.isArray(record.photos) ? record.photos.filter(Boolean) : [];
  const firstPhoto = photosArray.length > 0 ? photosArray[0] : null;
  const candidates = [record.image_url, firstPhoto].filter(Boolean);
  const absolute = candidates.find((c) => typeof c === 'string' && /^https?:\/\//i.test(c));
  return absolute || candidates[0] || null;
};

const ResultCard = ({ item, type }) => {
    const navigate = useNavigate();
    let content;

    const formatPrice = (price, devise) => {
        const priceNumber = parseFloat(price);
        if (isNaN(priceNumber) || priceNumber <= 0) return 'Gratuit';
        const symbol = devise?.symbole || '€';
        return `${priceNumber.toFixed(2).replace('.', ',')} ${symbol}`;
    };

    switch (type) {
        case 'annonces':
            content = (
                <div className="flex gap-4" onClick={() => navigate('/annonces')}>
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                        <MediaDisplay bucket="annonces" path={item.media_url} alt={item.titre} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Annonce</p>
                        <h3 className="font-bold truncate">{item.titre}</h3>
                        <p className="text-sm text-gray-600 truncate">{item.description}</p>
                        <p className="font-semibold text-[#2BA84A]">{formatPrice(item.prix, item.devises)}</p>
                    </div>
                </div>
            );
            break;
        case 'partenaires':
            content = (
                <div className="flex gap-4" onClick={() => navigate('/partenaires')}>
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                        <MediaDisplay bucket="partenaires" path={item.media_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Partenaire</p>
                        <h3 className="font-bold truncate">{item.name}</h3>
                        <p className="text-sm text-gray-600 truncate">{item.address}</p>
                    </div>
                </div>
            );
            break;
        case 'evenements':
            content = (
                <div className="flex gap-4" onClick={() => navigate('/evenements')}>
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                        <MediaDisplay bucket="evenements" path={item.media_url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Événement</p>
                        <h3 className="font-bold truncate">{item.title}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(item.date).toLocaleDateString('fr-FR')}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-1 truncate"><MapPin className="h-3 w-3" /> {item.location}</p>
                    </div>
                </div>
            );
            break;
        case 'posts':
            content = (
                <div className="flex gap-4" onClick={() => navigate('/echange')}>
                    <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                         <MediaDisplay bucket="avatars" path={item.profiles?.avatar_url} alt={item.profiles?.username} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Post de {item.profiles?.username}</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{item.content}</p>
                        <p className="text-xs text-gray-500 mt-1">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: fr })}</p>
                    </div>
                </div>
            );
            break;
        case 'faits_divers':
            content = (
                <div className="flex gap-4" onClick={() => navigate('/faits-divers')}>
                     <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                        <MediaDisplay bucket="faits_divers" path={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Fait Divers</p>
                        <h3 className="font-bold truncate">{item.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">{item.excerpt}</p>
                    </div>
                </div>
            );
            break;
        case 'rencontres': {
            const rencontrePhoto = getRencontrePhoto(item);
            const bucket = rencontrePhoto ? 'rencontres' : 'avatars';
            const path = rencontrePhoto || item.profiles?.avatar_url;
            content = (
                <div className="flex gap-4" onClick={() => navigate(`/rencontre?rid=${item.id}`)}>
                    <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                        <MediaDisplay bucket={bucket} path={path} alt={item.profiles?.username || item.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Heart className="h-3 w-3" /> Profil Rencontre</p>
                        <h3 className="font-bold truncate">{item.profiles?.username || item.name}</h3>
                        <p className="text-sm text-gray-600 truncate">{item.name}</p>
                    </div>
                </div>
            );
            break;
        }
        default:
            content = null;
    }

    return (
        <Card className="cursor-pointer hover:bg-gray-50 transition-colors">
            <CardContent className="p-4">
                {content}
            </CardContent>
        </Card>
    );
};


const Rechercher = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [suggestions, setSuggestions] = useState([]); // [{type, data}]
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef(null);

  const filters = [
    { value: 'all', label: 'Tout', icon: Search },
    { value: 'annonces', label: 'Annonces', icon: FileText },
    { value: 'partenaires', label: 'Partenaires', icon: Users },
    { value: 'evenements', label: 'Événements', icon: Calendar },
    { value: 'posts', label: 'Posts', icon: TrendingUp },
    { value: 'faits_divers', label: 'Faits Divers', icon: Newspaper },
    { value: 'rencontres', label: 'Rencontres', icon: Heart },
  ];

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Recherche vide",
        description: "Veuillez entrer un terme de recherche",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    const searchPromises = [];
    const query = `%${searchTerm.trim()}%`;

    if (filter === 'all' || filter === 'annonces') {
        searchPromises.push(
            supabase.from('annonces').select('*, devises(symbole)').ilike('titre', query).limit(10)
            .then(res => ({ type: 'annonces', ...res }))
        );
    }
    if (filter === 'all' || filter === 'partenaires') {
        searchPromises.push(
            supabase.from('partenaires').select('*').ilike('name', query).limit(10)
            .then(res => ({ type: 'partenaires', ...res }))
        );
    }
    if (filter === 'all' || filter === 'evenements') {
        searchPromises.push(
            supabase.from('evenements').select('*').ilike('title', query).limit(10)
            .then(res => ({ type: 'evenements', ...res }))
        );
    }
    if (filter === 'all' || filter === 'posts') {
        searchPromises.push(
            supabase.from('posts').select('*, profiles(username, avatar_url)').ilike('content', query).limit(10)
            .then(res => ({ type: 'posts', ...res }))
        );
    }
     if (filter === 'all' || filter === 'faits_divers') {
        searchPromises.push(
            supabase.from('faits_divers').select('*').ilike('title', query).limit(10)
            .then(res => ({ type: 'faits_divers', ...res }))
        );
    }
    if (filter === 'all' || filter === 'rencontres') {
        searchPromises.push(
            supabase.from('rencontres').select('id, user_id, name, image_url, photos, profiles(username, avatar_url)').ilike('name', query).limit(10)
            .then(res => ({ type: 'rencontres', ...res }))
        );
    }

    const responses = await Promise.all(searchPromises);
    
    let allResults = [];
    responses.forEach(response => {
        if (response.error) {
            console.error(`Error searching in ${response.type}:`, response.error);
        } else if (response.data) {
            allResults = [...allResults, ...response.data.map(item => ({ type: response.type, data: item }))]
        }
    });

    setResults(allResults);
    setLoading(false);

  }, [searchTerm, filter]);

  // Autocomplete multi-sections (visible selon filtre, cumulé si 'all')
  useEffect(() => {
    if (!filter) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = searchTerm.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      const like = `%${term}%`;
      try {
        const promises = [];
        const push = (p, type) => promises.push(p.then(res => ({ type, res })).catch(() => ({ type, res: { data: [], error: null } })));
        const want = (t) => filter === 'all' || filter === t;
        if (want('rencontres')) {
          const qR1 = supabase.from('rencontres').select('id, user_id, name, image_url, photos, profiles(username, avatar_url)').ilike('name', like).limit(5);
          const qR2 = supabase.from('rencontres').select('id, user_id, name, image_url, photos, profiles!inner(username, avatar_url)').ilike('profiles.username', like).limit(5);
          push(qR1, 'rencontres');
          push(qR2, 'rencontres');
        }
        if (want('annonces')) push(supabase.from('annonces').select('id, titre, description, media_url').ilike('titre', like).limit(5), 'annonces');
        if (want('partenaires')) push(supabase.from('partenaires').select('id, name, media_url, address').ilike('name', like).limit(5), 'partenaires');
        if (want('evenements')) push(supabase.from('evenements').select('id, title, media_url, date, location').ilike('title', like).limit(5), 'evenements');
        if (want('posts')) push(supabase.from('posts').select('id, content, profiles(username, avatar_url)').ilike('content', like).limit(5), 'posts');
        if (want('faits_divers')) push(supabase.from('faits_divers').select('id, title, image_url').ilike('title', like).limit(5), 'faits_divers');
        const responses = await Promise.all(promises);
        const list = [];
        responses.forEach(({ type, res }) => {
          const arr = Array.isArray(res?.data) ? res.data : [];
          arr.forEach((d) => list.push({ type, data: d }));
        });
        const seenRencontre = new Set();
        const merged = list.filter((item) => {
          if (item.type !== 'rencontres') return true;
          if (seenRencontre.has(item.data.id)) return false;
          seenRencontre.add(item.data.id);
          return true;
        }).slice(0, 12);
        setSuggestions(merged);
      } catch { setSuggestions([]); }
      setSuggestLoading(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchTerm, filter]);

  return (
    <>
      <Helmet>
        <title>Rechercher - OneKamer.co</title>
        <meta name="description" content="Recherchez sur OneKamer.co" />
      </Helmet>

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-[#2BA84A] mb-4">Rechercher</h1>
        </motion.div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Que cherchez-vous ?"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setHasSearched(false); }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-grow"
              />
               <Button 
                className="bg-[#2BA84A]"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchTerm.trim() && suggestions.length >= 0 && (
              <div className="space-y-2">
                {suggestLoading && (
                  <div className="text-sm text-gray-500">Chargement...</div>
                )}
                {!suggestLoading && suggestions.length > 0 && (
                  <div className="space-y-2">
                    {suggestions.map(({type, data}) => {
                      switch (type) {
                        case 'rencontres': {
                          const rencontrePhoto = getRencontrePhoto(data);
                          const bucket = rencontrePhoto ? 'rencontres' : 'avatars';
                          const path = rencontrePhoto || data.profiles?.avatar_url;
                          return (
                            <div key={`r-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/rencontre?rid=${data.id}`)}>
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                <MediaDisplay bucket={bucket} path={path} alt={data.profiles?.username || data.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.profiles?.username || data.name}</div>
                                <div className="text-xs text-gray-600 truncate">Profil Rencontre</div>
                              </div>
                            </div>
                          );
                        }
                        case 'annonces':
                          return (
                            <div key={`a-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/annonces')}>
                              <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                                <MediaDisplay bucket="annonces" path={data.media_url} alt={data.titre} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.titre}</div>
                                <div className="text-xs text-gray-600 truncate">Annonce</div>
                              </div>
                            </div>
                          );
                        case 'partenaires':
                          return (
                            <div key={`p-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/partenaires')}>
                              <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                                <MediaDisplay bucket="partenaires" path={data.media_url} alt={data.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.name}</div>
                                <div className="text-xs text-gray-600 truncate">Partenaire</div>
                              </div>
                            </div>
                          );
                        case 'evenements':
                          return (
                            <div key={`e-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/evenements')}>
                              <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                                <MediaDisplay bucket="evenements" path={data.media_url} alt={data.title} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.title}</div>
                                <div className="text-xs text-gray-600 truncate">Événement</div>
                              </div>
                            </div>
                          );
                        case 'posts':
                          return (
                            <div key={`po-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/echange')}>
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                <MediaDisplay bucket="avatars" path={data.profiles?.avatar_url} alt={data.profiles?.username} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.profiles?.username}</div>
                                <div className="text-xs text-gray-600 truncate">Post</div>
                              </div>
                            </div>
                          );
                        case 'faits_divers':
                          return (
                            <div key={`fd-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/faits-divers')}>
                              <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                                <MediaDisplay bucket="faits_divers" path={data.image_url} alt={data.title} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.title}</div>
                                <div className="text-xs text-gray-600 truncate">Fait Divers</div>
                              </div>
                            </div>
                          );
                        default:
                          return null;
                      }
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-5 w-5 text-[#6B6B6B]" />
              {filters.map((f) => (
                <Button
                  key={f.value}
                  variant={filter === f.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f.value)}
                  className={`${filter === f.value ? 'bg-[#2BA84A] text-white' : ''} flex items-center gap-2`}
                >
                  <f.icon className="h-4 w-4" />
                  {f.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-[#2BA84A]" />
            </div>
        ) : hasSearched ? (
            results.length > 0 ? (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Résultats de la recherche</h2>
                    {results.map((result, index) => (
                        <motion.div key={`${result.type}-${result.data.id}-${index}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                            <ResultCard item={result.data} type={result.type} />
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-[#6B6B6B] py-12">
                    <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="font-semibold">Aucun résultat trouvé</p>
                    <p className="text-sm">Essayez avec d'autres mots-clés.</p>
                </div>
            )
        ) : (
            <div className="text-center text-[#6B6B6B] py-12">
                <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Entrez un terme de recherche pour commencer</p>
            </div>
        )}
      </div>
    </>
  );
};

export default Rechercher;