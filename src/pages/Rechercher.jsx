import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Filter, Loader2, MapPin, Calendar, FileText, Users, TrendingUp, Newspaper, ShoppingBag, Package, Star } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import MediaDisplay from '@/components/MediaDisplay';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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
        case 'groupes':
            content = (
                <div className="flex gap-4" onClick={() => navigate(`/groupes/${item.id}`)}>
                    <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                        <MediaDisplay bucket="groupes" path={item.image_url} alt={item.nom} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Groupe</p>
                        <h3 className="font-bold truncate">{item.nom}</h3>
                        {item.description ? <p className="text-sm text-gray-600 truncate">{item.description}</p> : null}
                    </div>
                </div>
            );
            break;
        case 'market_boutiques':
            content = (
                <div className="flex gap-4" onClick={() => navigate(`/marketplace/partner/${encodeURIComponent(item.id)}`)}>
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                        {item.logo_url ? (
                          <img src={item.logo_url} alt={item.display_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Boutique</p>
                        <h3 className="font-bold truncate">{item.display_name || 'Boutique partenaire'}</h3>
                        <p className="text-sm text-gray-600 truncate">{item.category || ''}</p>
                    </div>
                </div>
            );
            break;
        case 'market_produits': {
            const priceEur = Number(item?.base_price_amount || 0) / 100;
            content = (
                <div className="flex gap-4" onClick={() => navigate(`/marketplace/partner/${encodeURIComponent(item.partnerId)}`)}>
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                        {item?.media?.image_url ? (
                          <img src={item.media.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Produit</p>
                        <h3 className="font-bold truncate">{item.title || 'Article'}</h3>
                        {item.description ? <p className="text-sm text-gray-600 truncate">{item.description}</p> : null}
                        <p className="text-sm font-semibold text-[#2BA84A]">{Number.isFinite(priceEur) ? `${priceEur.toFixed(2)} €` : ''}</p>
                    </div>
                </div>
            );
            break;
        }
        case 'market_avis': {
            const n = Math.max(Math.min(Number(item?.rating || 0), 5), 0);
            const stars = '★'.repeat(n) + '☆'.repeat(5 - n);
            content = (
                <div className="flex gap-4" onClick={() => navigate(`/marketplace/partner/${encodeURIComponent(item.partnerId)}`)}>
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200">
                        {item.partnerLogo ? (
                          <img src={item.partnerLogo} alt={item.partnerName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Avis • {item.partnerName || 'Boutique'}</p>
                        <h3 className="font-bold truncate">{stars}</h3>
                        {item.comment ? <p className="text-sm text-gray-600 line-clamp-2">{item.comment}</p> : null}
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
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;

  const filters = [
    { value: 'all', label: 'Tout', icon: Search },
    { value: 'annonces', label: 'Annonces', icon: FileText },
    { value: 'partenaires', label: 'Partenaires', icon: Users },
    { value: 'evenements', label: 'Événements', icon: Calendar },
    { value: 'posts', label: 'Posts', icon: TrendingUp },
    { value: 'faits_divers', label: 'Faits Divers', icon: Newspaper },
    { value: 'groupes', label: 'Groupes', icon: Users },
    { value: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
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
            supabase.from('posts').select('*, profiles(username, avatar_url, is_deleted)').ilike('content', query).limit(10)
            .then(res => ({ type: 'posts', ...res }))
        );
    }
     if (filter === 'all' || filter === 'faits_divers') {
        searchPromises.push(
            supabase.from('faits_divers').select('*').ilike('title', query).limit(10)
            .then(res => ({ type: 'faits_divers', ...res }))
        );
    }
    if (filter === 'all' || filter === 'groupes') {
        searchPromises.push(
            supabase.from('view_groupes_accessible').select('id, nom, image_url, description').ilike('nom', query).limit(10)
            .then(res => ({ type: 'groupes', ...res }))
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

    // Marketplace aggregator (boutiques, produits publiés, avis)
    if (filter === 'all' || filter === 'marketplace') {
      try {
        const res = await fetch(`${apiBaseUrl}/api/market/partners`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.partners)) {
          const term = searchTerm.trim().toLowerCase();
          const partners = data.partners;
          const partnerMatches = partners.filter((p) => {
            const name = String(p?.display_name || '').toLowerCase();
            const cat = String(p?.category || '').toLowerCase();
            const desc = String(p?.description || '').toLowerCase();
            return name.includes(term) || cat.includes(term) || desc.includes(term);
          });
          // Boutiques
          allResults = [
            ...allResults,
            ...partnerMatches.slice(0, 10).map((p) => ({ type: 'market_boutiques', data: p }))
          ];

          // Produits publiés (recherche titre/description) – limiter à 8-10 partenaires
          const productPartners = partnerMatches.slice(0, 8);
          const productsArrays = await Promise.all(
            productPartners.map(async (p) => {
              try {
                const r = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(p.id)}/items`);
                const j = await r.json().catch(() => ({}));
                if (!r.ok || !Array.isArray(j?.items)) return [];
                const arr = j.items.filter((it) => it?.is_published === true);
                return arr.filter((it) => {
                  const t = String(it?.title || '').toLowerCase();
                  const d = String(it?.description || '').toLowerCase();
                  return t.includes(term) || d.includes(term);
                }).map((it) => ({ ...it, partnerId: p.id }));
              } catch { return []; }
            })
          );
          const products = productsArrays.flat().slice(0, 12);
          allResults = [
            ...allResults,
            ...products.map((it) => ({ type: 'market_produits', data: it }))
          ];

          // Avis (recherche texte commentaire) – limiter à 5 partenaires
          const ratingPartners = partnerMatches.slice(0, 5);
          const ratingsArrays = await Promise.all(
            ratingPartners.map(async (p) => {
              try {
                const qs = new URLSearchParams({ limit: '20', offset: '0' });
                const r = await fetch(`${apiBaseUrl}/api/market/public/partners/${encodeURIComponent(p.id)}/ratings?${qs.toString()}`);
                const j = await r.json().catch(() => ({}));
                if (!r.ok || !Array.isArray(j?.ratings)) return [];
                return j.ratings.filter((rv) => String(rv?.comment || '').toLowerCase().includes(term)).map((rv) => ({
                  ...rv,
                  partnerId: p.id,
                  partnerName: p.display_name,
                  partnerLogo: p.logo_url,
                }));
              } catch { return []; }
            })
          );
          const ratings = ratingsArrays.flat().slice(0, 12);
          allResults = [
            ...allResults,
            ...ratings.map((rv) => ({ type: 'market_avis', data: rv }))
          ];
        }
      } catch {}
    }

    // Exclure les posts dont l'auteur est supprimé
    allResults = allResults.filter((r) => !(r.type === 'posts' && r.data?.profiles?.is_deleted === true));
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
        if (want('groupes')) push(supabase.from('view_groupes_accessible').select('id, nom, image_url, description').ilike('nom', like).limit(5), 'groupes');
        if (want('annonces')) push(supabase.from('annonces').select('id, titre, description, media_url').ilike('titre', like).limit(5), 'annonces');
        if (want('partenaires')) push(supabase.from('partenaires').select('id, name, media_url, address').ilike('name', like).limit(5), 'partenaires');
        if (want('evenements')) push(supabase.from('evenements').select('id, title, media_url, date, location').ilike('title', like).limit(5), 'evenements');
        if (want('posts')) push(supabase.from('posts').select('id, content, profiles(username, avatar_url, is_deleted)').ilike('content', like).limit(5), 'posts');
        if (want('faits_divers')) push(supabase.from('faits_divers').select('id, title, image_url').ilike('title', like).limit(5), 'faits_divers');
        const responses = await Promise.all(promises);
        const list = [];
        responses.forEach(({ type, res }) => {
          const arr = Array.isArray(res?.data) ? res.data : [];
          arr.forEach((d) => list.push({ type, data: d }));
        });
        // Suggestions Marketplace (boutiques + produits publiés)
        if (want('marketplace')) {
          try {
            const res = await fetch(`${apiBaseUrl}/api/market/partners`);
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(data?.partners)) {
              const term = searchTerm.trim().toLowerCase();
              const partners = data.partners;
              const partnerMatches = partners.filter((p) => {
                const name = String(p?.display_name || '').toLowerCase();
                const cat = String(p?.category || '').toLowerCase();
                const desc = String(p?.description || '').toLowerCase();
                return name.includes(term) || cat.includes(term) || desc.includes(term);
              });
              partnerMatches.slice(0, 5).forEach((p) => list.push({ type: 'market_boutiques', data: p }));
              const productPartners = partnerMatches.slice(0, 3);
              const productsArrays = await Promise.all(
                productPartners.map(async (p) => {
                  try {
                    const r = await fetch(`${apiBaseUrl}/api/market/partners/${encodeURIComponent(p.id)}/items`);
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok || !Array.isArray(j?.items)) return [];
                    const arr = j.items.filter((it) => it?.is_published === true);
                    return arr.filter((it) => {
                      const t = String(it?.title || '').toLowerCase();
                      const d = String(it?.description || '').toLowerCase();
                      return t.includes(term) || d.includes(term);
                    }).map((it) => ({ ...it, partnerId: p.id }));
                  } catch { return []; }
                })
              );
              productsArrays.flat().slice(0, 5).forEach((it) => list.push({ type: 'market_produits', data: it }));
            }
          } catch {}
        }
        const filtered = list.filter((x) => !(x.type === 'posts' && x.data?.profiles?.is_deleted === true));
        setSuggestions(filtered.slice(0, 12));
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
                        case 'groupes':
                          return (
                            <div key={`g-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/groupes/${data.id}`)}>
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                <MediaDisplay bucket="groupes" path={data.image_url} alt={data.nom} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.nom}</div>
                                <div className="text-xs text-gray-600 truncate">Groupe</div>
                              </div>
                            </div>
                          );
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
                        case 'market_boutiques':
                          return (
                            <div key={`mb-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/marketplace/partner/${encodeURIComponent(data.id)}`)}>
                              <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                                {data.logo_url ? (
                                  <img src={data.logo_url} alt={data.display_name} className="w-full h-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.display_name || 'Boutique'}</div>
                                <div className="text-xs text-gray-600 truncate">{data.category || 'Marketplace'}</div>
                              </div>
                            </div>
                          );
                        case 'market_produits':
                          return (
                            <div key={`mp-${data.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/marketplace/partner/${encodeURIComponent(data.partnerId)}`)}>
                              <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                                {data?.media?.image_url ? (
                                  <img src={data.media.image_url} alt={data.title} className="w-full h-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{data.title || 'Article'}</div>
                                <div className="text-xs text-gray-600 truncate">Produit</div>
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