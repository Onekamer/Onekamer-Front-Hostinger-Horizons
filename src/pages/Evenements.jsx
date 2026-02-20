import React, { useState, useEffect, useCallback } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Card, CardContent } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Calendar, MapPin, Clock, Banknote, Share2, ArrowLeft, Ticket, Plus, Loader2, Trash2, Pencil, Filter } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import MediaDisplay from '@/components/MediaDisplay';
    import FavoriteButton from '@/components/FavoriteButton';
    import { canUserAccess } from '@/lib/accessControl';
    import { applyAutoAccessProtection } from "@/lib/autoAccessWrapper";

    const formatPrice = (price, devise) => {
        const priceNumber = parseFloat(price);
        if (isNaN(priceNumber) || priceNumber <= 0) {
            return 'Gratuit';
        }
        const symbol = devise?.symbole || '€';
        return `${priceNumber.toFixed(2).replace('.', ',')} ${symbol}`;
    };

    const OuvrirGoogleMaps = ({ latitude, longitude, location }) => {
      const { toast } = useToast();
      const [open, setOpen] = useState(false);

      const hasLocation = Boolean((latitude && longitude) || location);
      const isiOS = (() => {
        const ua = navigator.userAgent || '';
        return /iPad|iPhone|iPod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
      })();

      const buildUrls = () => {
        if (latitude && longitude) {
          const label = location ? encodeURIComponent(location) : 'Destination';
          const apple = isiOS ? `maps://?q=${label}&ll=${latitude},${longitude}` : `https://maps.apple.com/?daddr=${latitude},${longitude}`;
          const google = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
          return { apple, google };
        }
        const encoded = encodeURIComponent(location || 'Destination');
        const apple = isiOS ? `maps://?q=${encoded}` : `https://maps.apple.com/?q=${encoded}`;
        const google = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
        return { apple, google };
      };

      const handleOpenSelector = () => {
        if (!hasLocation) {
          toast({ title: 'Lieu indisponible', description: "Aucune information de localisation disponible pour cet événement.", variant: 'destructive' });
          return;
        }
        setOpen(true);
      };

      const { apple, google } = buildUrls();

      return (
        <>
          <button
            onClick={handleOpenSelector}
            className="mt-3 bg-[#2BA84A] hover:bg-[#24903f] text-white px-3 py-2 rounded-md text-sm w-full flex items-center justify-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            <span>S'y rendre</span>
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ouvrir avec</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2">
                <Button onClick={() => { try { window.location.href = apple; } catch { window.open(apple, '_blank'); } }}>Plans (Apple)</Button>
                <Button onClick={() => { window.open(google, '_blank'); }}>Google Maps</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      );
    };


    const EvenementDetail = ({ event, onBack, onDelete, onEdit, apiPrefix, session }) => {
      const { user, profile } = useAuth();
      const { toast } = useToast();
      const navigate = useNavigate();
      const isOwner = user?.id === event.user_id;
      const isAdmin =
        profile?.is_admin === true ||
        profile?.is_admin === 1 ||
        profile?.is_admin === 'true' ||
        String(profile?.role || '').toLowerCase() === 'admin';
      const [interestLoading, setInterestLoading] = useState(true);
      const [interested, setInterested] = useState(false);
      const [interestCount, setInterestCount] = useState(0);

      useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            if (!user || !apiPrefix) { setInterestLoading(false); return; }
            const token = session?.access_token;
            if (!token) { setInterestLoading(false); return; }
            const res = await fetch(`${apiPrefix}/evenements/${encodeURIComponent(String(event.id))}/interest/status`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json().catch(() => ({}));
            if (mounted && res.ok) {
              setInterested(!!data?.interested);
              setInterestCount(Number(data?.interests_count || 0));
            }
          } catch {}
          if (mounted) setInterestLoading(false);
        })();
        return () => { mounted = false };
      }, [user, session, apiPrefix, event?.id]);

      const handleToggleInterest = async (e) => {
        e?.stopPropagation?.();
        try {
          if (!user) { toast({ title: 'Connexion requise', description: "Connectez-vous pour indiquer votre intérêt.", variant: 'destructive' }); return; }
          const token = session?.access_token;
          if (!token) { toast({ title: 'Session requise', description: "Veuillez vous reconnecter.", variant: 'destructive' }); return; }
          const res = await fetch(`${apiPrefix}/evenements/${encodeURIComponent(String(event.id))}/interest`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
          setInterested(!!data?.interested);
          setInterestCount(Number(data?.interests_count || 0));
        } catch (err) {
          toast({ title: 'Erreur', description: err?.message || 'Action impossible.', variant: 'destructive' });
        }
      };
      
      const handleShare = async () => {
        const shareData = { title: event.title, text: event.description, url: window.location.href };
        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch (err) {
            if (err.name !== 'AbortError') {
              toast({ title: "Erreur de partage", description: err.message, variant: "destructive" });
            }
          }
        } else {
          toast({ title: "Partage non disponible" });
        }
      };

      const getReservationLink = () => {
        if (event.site_web) return event.site_web;
        if (event.telephone) return `tel:${event.telephone}`;
        if (event.email) return `mailto:${event.email}`;
        return null;
      };

      const handleAddToCalendar = () => {
        const startDate = new Date(`${event.date}T${event.time}`);
        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

        const googleCalendarUrl = new URL("https://www.google.com/calendar/render");
        googleCalendarUrl.searchParams.append("action", "TEMPLATE");
        googleCalendarUrl.searchParams.append("text", event.title);
        googleCalendarUrl.searchParams.append("dates", `${startDate.toISOString().replace(/-|:|\.\d\d\d/g, "")}/${endDate.toISOString().replace(/-|:|\.\d\d\d/g, "")}`);
        googleCalendarUrl.searchParams.append("details", event.description);
        googleCalendarUrl.searchParams.append("location", event.location);

        window.open(googleCalendarUrl, '_blank');
      };
      
      const navigateToProfile = (e) => {
        e.stopPropagation();
        const allowProfile = event?.profiles?.profile_public !== false;
        if (allowProfile && event.user_id && event.profiles?.username) {
          navigate(`/profil/${event.user_id}`);
        }
      }

      const reservationLink = getReservationLink();

      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-gradient-to-br from-[#FDF9F9] to-[#CDE1D5] overflow-y-auto"
        >
          <div className="relative pt-safe">
             <MediaDisplay bucket="evenements" path={event.media_url} alt={event.title} className="w-full h-64 object-cover" />
             <div className="absolute left-4 z-20 top-4 top-safe-4">
              <button onClick={onBack} className="bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md">
                <ArrowLeft className="h-6 w-6 text-gray-800" />
              </button>
            </div>
            <div className="absolute right-4 flex items-center gap-2 z-20 top-4 top-safe-4">
                <FavoriteButton contentType="evenement" contentId={event.id} />
                <Button variant="outline" size="sm" onClick={handleToggleInterest} disabled={interestLoading} className="bg-white/80 backdrop-blur-sm">
                  {interested ? 'Je ne suis plus intéressé(e)' : 'Je suis intéressé(e)'}{!interestLoading ? ` (${interestCount})` : ''}
                </Button>
                {(isOwner || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-700 bg-white/80 backdrop-blur-sm rounded-full h-8 w-8"
                    onClick={() => onEdit(event.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {(isOwner || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 bg-white/80 backdrop-blur-sm rounded-full h-8 w-8"
                    onClick={async () => {
                      await onDelete(event.id, event.media_url);
                      onBack();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={handleShare} className="bg-white/80 backdrop-blur-sm rounded-full h-8 w-8"><Share2 className="h-4 w-4 text-gray-500" /></Button>
            </div>
          </div>
          <div className="p-4 -mt-8">
            <Card className="shadow-xl rounded-2xl">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                    <span className="bg-[#CDE1D5] text-[#2BA84A] text-xs font-semibold px-2.5 py-1 rounded-full">{event.evenements_types?.nom || 'Type'}</span>
                    <h1 className="text-2xl font-bold text-gray-800 mt-2">{event.title}</h1>
                    <p className="text-sm text-gray-500">Organisé par <span className="font-semibold text-gray-700">{event.organisateur || '—'}</span></p>
                    <p className="text-sm text-gray-500">
                      Créé par {event?.profiles?.profile_public === false ? (
                        <span className="font-semibold text-gray-700">un membre</span>
                      ) : (
                        <span className={`font-semibold text-gray-700 ${event.user_id && event.profiles?.username ? 'cursor-pointer hover:underline' : ''}`} onClick={navigateToProfile}>
                          {event.profiles?.username || 'un membre'}
                        </span>
                      )}
                    </p>
                </div>
                
                <div className="space-y-3 text-gray-700 border-t pt-4">
                  <div className="flex items-center gap-3"><Calendar className="h-5 w-5 text-[#2BA84A]" /> <span>{new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                  <div className="flex items-center gap-3"><Clock className="h-5 w-5 text-[#2BA84A]" /> <span>{event.time}</span></div>
                  <div className="flex items-center gap-3"><MapPin className="h-5 w-5 text-[#2BA84A]" /> <span>{event.location}</span></div>
                  <div className="flex items-center gap-3"><Banknote className="h-5 w-5 text-[#2BA84A]" /> <span className="font-semibold">{formatPrice(event.price, event.devises)}</span></div>
                </div>

                <div>
                  <h2 className="font-semibold text-gray-800 mb-1">Description</h2>
                  <p className="text-gray-600 text-sm">{event.description}</p>
                </div>
                
                <OuvrirGoogleMaps
                  latitude={event.latitude}
                  longitude={event.longitude}
                  location={event.location}
                />

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      className="w-full sm:flex-1 bg-[#E0222A] hover:bg-[#E0222A]/90 text-white"
                      onClick={() => navigate(`/compte/mon-qrcode?eventId=${encodeURIComponent(event.id)}`)}
                    >
                      <Ticket className="h-4 w-4 mr-2" /> Mon QRcode
                    </Button>
                    {reservationLink && (
                      <Button asChild variant="outline" className="w-full sm:flex-1">
                        <a href={reservationLink} target="_blank" rel="noopener noreferrer">
                          <Ticket className="h-4 w-4 mr-2" /> Contacter
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" className="w-full sm:flex-1" onClick={handleAddToCalendar}><Calendar className="h-4 w-4 mr-2" /> Ajouter au calendrier</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      );
    };

    const EvenementCard = ({ event, onSelect, apiPrefix, session }) => {
        const { toast } = useToast();
        const { user } = useAuth();
        const [interestLoading, setInterestLoading] = useState(true);
        const [interested, setInterested] = useState(false);
        const [interestCount, setInterestCount] = useState(0);
        useEffect(() => {
          let mounted = true;
          (async () => {
            try {
              if (!user || !apiPrefix) { setInterestLoading(false); return; }
              const token = session?.access_token;
              if (!token) { setInterestLoading(false); return; }
              const res = await fetch(`${apiPrefix}/evenements/${encodeURIComponent(String(event.id))}/interest/status`, { headers: { Authorization: `Bearer ${token}` } });
              const data = await res.json().catch(() => ({}));
              if (mounted && res.ok) {
                setInterested(!!data?.interested);
                setInterestCount(Number(data?.interests_count || 0));
              }
            } catch {}
            if (mounted) setInterestLoading(false);
          })();
          return () => { mounted = false };
        }, [user, session, apiPrefix, event?.id]);
        const handleToggleInterest = async (e) => {
          e.stopPropagation();
          try {
            if (!user) { toast({ title: 'Connexion requise', description: 'Connectez-vous pour indiquer votre intérêt.', variant: 'destructive' }); return; }
            const token = session?.access_token;
            if (!token) { toast({ title: 'Session requise', description: 'Veuillez vous reconnecter.', variant: 'destructive' }); return; }
            const res = await fetch(`${apiPrefix}/evenements/${encodeURIComponent(String(event.id))}/interest`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
            setInterested(!!data?.interested);
            setInterestCount(Number(data?.interests_count || 0));
          } catch (err) {
            toast({ title: 'Erreur', description: err?.message || 'Action impossible.', variant: 'destructive' });
          }
        };
        const handleShare = async (e) => {
            e.stopPropagation();
            if (navigator.share) {
                try {
                    await navigator.share({ title: event.title, text: event.description, url: window.location.href });
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        toast({ title: "Erreur de partage", description: err.message, variant: "destructive" });
                    }
                }
            } else {
                toast({ title: "Partage non disponible" });
            }
        };
        const [mapsOpen, setMapsOpen] = useState(false);
        const handleOpenMapsQuick = (e) => {
          e.stopPropagation();
          const hasLocation = Boolean((event.latitude && event.longitude) || event.location);
          if (!hasLocation) {
            toast({ title: 'Lieu indisponible', description: "Aucune information de localisation disponible pour cet événement.", variant: 'destructive' });
            return;
          }
          setMapsOpen(true);
        };
        const isiOS2 = (() => {
          const ua = navigator.userAgent || '';
          return /iPad|iPhone|iPod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
        })();
        const buildUrls2 = () => {
          const { latitude, longitude, location } = event;
          if (latitude && longitude) {
            const label = location ? encodeURIComponent(location) : 'Destination';
            const apple = isiOS2 ? `maps://?q=${label}&ll=${latitude},${longitude}` : `https://maps.apple.com/?daddr=${latitude},${longitude}`;
            const google = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
            return { apple, google };
          }
          const encoded = encodeURIComponent(location || 'Destination');
          const apple = isiOS2 ? `maps://?q=${encoded}` : `https://maps.apple.com/?q=${encoded}`;
          const google = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
          return { apple, google };
        };
        const { apple: apple2, google: google2 } = buildUrls2();
        
        return (
            <Card onClick={() => onSelect(event)} className="cursor-pointer group overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 h-full flex flex-col rounded-lg">
                <div className="relative h-48 bg-gray-200">
                    <MediaDisplay bucket="evenements" path={event.media_url} alt={event.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="relative p-2 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="bg-[#E0222A] text-white px-3 py-1 rounded-full text-xs font-semibold">{event.evenements_types?.nom || 'Catégorie'}</div>
                            <div className="flex items-center gap-2">
                                <FavoriteButton contentType="evenement" contentId={event.id} />
                                <Button variant="ghost" size="icon" onClick={handleShare} className="text-white bg-black/20 hover:bg-black/40 rounded-full h-8 w-8">
                                    <Share2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={handleToggleInterest} disabled={interestLoading} className="text-white bg-black/20 hover:bg-black/40 rounded-full px-2 h-8">
                                  {interested ? 'Intéressé' : 'Intéressé ?'}{!interestLoading ? ` (${interestCount})` : ''}
                                </Button>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg truncate">{event.title}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-200"><MapPin className="h-4 w-4" />{event.location}</div>
                        </div>
                    </div>
                </div>
                <CardContent className="p-4 flex-grow flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-600"><Calendar className="h-4 w-4 text-[#2BA84A]" /><span>{new Date(event.date).toLocaleDateString('fr-FR')} à {event.time}</span></div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-2xl font-bold text-[#2BA84A]">{formatPrice(event.price, event.devises)}</span>
                      <>
                        <Button
                          onClick={handleOpenMapsQuick}
                          className="bg-[#2BA84A] hover:bg-[#24903f] text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm"
                        >
                          <MapPin className="h-4 w-4" />
                          <span>S'y rendre</span>
                        </Button>
                        <Dialog open={mapsOpen} onOpenChange={setMapsOpen}>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Ouvrir avec</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-2">
                              <Button onClick={() => { try { window.location.href = apple2; } catch { window.open(apple2, '_blank'); } }}>Plans (Apple)</Button>
                              <Button onClick={() => { window.open(google2, '_blank'); }}>Google Maps</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    </div>
                </CardContent>
            </Card>
        );
    };

   const Evenements = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, profile, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [canCreateEvent, setCanCreateEvent] = useState(false);
  const [types, setTypes] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [countryFilter, setCountryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tmpTypeFilter, setTmpTypeFilter] = useState('');
  const [tmpCountryFilter, setTmpCountryFilter] = useState('');
  const [tmpCityFilter, setTmpCityFilter] = useState('');
  const [tmpDateFrom, setTmpDateFrom] = useState('');
  const [tmpDateTo, setTmpDateTo] = useState('');

  const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;
  const API_PREFIX = `${apiBaseUrl}/api`;

  // 🟢 Vérifie automatiquement les droits d'accès (Supabase)
  useEffect(() => {
    if (authLoading) return;
    applyAutoAccessProtection(user, navigate, window.location.pathname);
  }, [user, navigate, authLoading]);

  // 🟢 Vérifie si l'utilisateur peut créer un événement
  useEffect(() => {
    if (user) {
      canUserAccess(user, "evenements", "create").then(setCanCreateEvent);
    } else {
      setCanCreateEvent(false);
    }
  }, [user]);

      const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
          let query = supabase
            .from('view_evenements_accessible')
            .select('*, evenements_types(nom), profiles(username, profile_public), devises(symbole)');

          if (typeFilter) query = query.eq('type_id', typeFilter);
          if (countryFilter) {
            const countryName = (countries || []).find((c) => String(c.id) === String(countryFilter))?.nom;
            if (countryName) query = query.ilike('location', `%${countryName}%`);
          }
          if (cityFilter) {
            const cityName = (cities || []).find((v) => String(v.id) === String(cityFilter))?.nom;
            if (cityName) query = query.ilike('location', `%${cityName}%`);
          }
          if (dateFrom) query = query.gte('date', dateFrom);
          if (dateTo) query = query.lte('date', dateTo);

          query = query.order('date', { ascending: true });

          const { data, error } = await query;
          if (error) {
            console.error("Error fetching events:", error);
            toast({ title: 'Erreur', description: "Impossible de charger les événements.", variant: 'destructive' });
            setEvents([]);
          } else {
            setEvents(data);
          }
        } catch (e) {
          toast({ title: 'Erreur', description: e?.message || "Impossible de charger les événements.", variant: 'destructive' });
          setEvents([]);
        } finally {
          setLoading(false);
        }
      }, [toast, typeFilter, countryFilter, cityFilter, dateFrom, dateTo, countries, cities]);
      
      useEffect(() => {
        fetchEvents();
        
        const channel = supabase.channel('public:evenements')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'evenements' }, fetchEvents)
          .subscribe();
          
        return () => supabase.removeChannel(channel);
      }, [fetchEvents]);

      useEffect(() => {
        (async () => {
          try {
            const { data: typeData, error: typeErr } = await supabase.from('evenements_types').select('id, nom');
            if (!typeErr) setTypes(typeData || []);
          } catch {}
          try {
            const { data: paysData, error: paysErr } = await supabase.from('pays').select('id, nom');
            if (!paysErr) setCountries(paysData || []);
          } catch {}
        })();
      }, []);

      const fetchCities = useCallback(async (paysId) => {
        if (!paysId) { setCities([]); return; }
        try {
          const { data, error } = await supabase.from('villes').select('id, nom').eq('pays_id', paysId);
          if (!error) setCities(data || []);
        } catch {}
      }, []);

      // Deep link : ouvre un événement précis via ?eventId=
      useEffect(() => {
        if (!events || events.length === 0) return;

        // On lit toujours la valeur actuelle de l'URL
        const params = new URLSearchParams(location.search || '');
        const eventId = params.get('eventId');
        if (!eventId) return;

        const found = events.find((evt) => String(evt.id) === String(eventId));
        if (found) {
          setSelectedEvent(found);
        }
      }, [events, location.search]);
      
      const handleDelete = async (eventId, mediaUrl) => {
        if (!user) return;
        try {
          const isAdmin =
            profile?.is_admin === true ||
            profile?.is_admin === 1 ||
            profile?.is_admin === 'true' ||
            String(profile?.role || '').toLowerCase() === 'admin';
          const isOwner = user?.id && events.find((e) => e.id === eventId)?.user_id === user.id;

          if (isAdmin && !isOwner) {
            const token = session?.access_token;
            if (!token) throw new Error('Session expirée');
            const res = await fetch(`${API_PREFIX}/admin/evenements/${encodeURIComponent(eventId)}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
            toast({ title: 'Succès', description: 'Événement supprimé (admin).' });
            setEvents((prev) => (prev || []).filter((e) => e.id !== eventId));
            return;
          }

          if (mediaUrl) await supabase.storage.from('evenements').remove([mediaUrl]);
          const { error } = await supabase.from('evenements').delete().eq('id', eventId);
          if (error) throw error;
          toast({ title: 'Succès', description: 'Événement supprimé.' });
          setEvents((prev) => (prev || []).filter((e) => e.id !== eventId));
        } catch (error) {
          toast({ title: "Erreur de suppression", description: error.message, variant: "destructive" });
        }
      };

      const handleEdit = (eventId) => {
        navigate(`/publier/evenement?eventId=${encodeURIComponent(eventId)}`);
      };

      const handleCreateClick = async () => {
        if (!user) {
          toast({title: "Connexion requise", description: "Veuillez vous connecter pour créer un événement.", variant: "destructive"});
          return;
        }
        if (canCreateEvent) {
          navigate('/publier/evenement');
        } else {
          const allowed = await canUserAccess(user, 'evenements', 'create');
          if (allowed) {
            navigate('/publier/evenement');
          } else {
            toast({title: "Accès restreint", description: "Passez VIP pour créer un événement.", variant: "destructive"});
            navigate('/forfaits');
          }
        }
      };

      return (
  <>
    <Helmet>
      <title>Événements - OneKamer.co</title>
      <meta name="description" content="Découvrez les événements de la communauté OneKamer.co" />
    </Helmet>

    <AnimatePresence>
  {selectedEvent && (
    <EvenementDetail 
      event={selectedEvent} 
      onBack={() => setSelectedEvent(null)} 
      onDelete={handleDelete}
      onEdit={handleEdit}
      apiPrefix={API_PREFIX}
      session={session}
    />
  )}
</AnimatePresence>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold text-[#2BA84A]">Événements</h1>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => {
                    setTmpTypeFilter(typeFilter);
                    setTmpCountryFilter(countryFilter);
                    setTmpCityFilter(cityFilter);
                    setTmpDateFrom(dateFrom);
                    setTmpDateTo(dateTo);
                    setFiltersOpen(true);
                  }}>
                    <Filter className="mr-2 h-4 w-4" /> Filtrer
                  </Button>
                  <Button onClick={handleCreateClick} className="bg-gradient-to-r from-[#2BA84A] to-[#F5C300] text-white">
                    <Plus className="mr-2 h-4 w-4" /> Créer
                  </Button>
                </div>
              </div>
              <Dialog open={filtersOpen} onOpenChange={(open) => {
                setFiltersOpen(open);
                if (open) {
                  setTmpTypeFilter(typeFilter);
                  setTmpCountryFilter(countryFilter);
                  setTmpCityFilter(cityFilter);
                  setTmpDateFrom(dateFrom);
                  setTmpDateTo(dateTo);
                  if (countryFilter) fetchCities(countryFilter);
                }
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Filtrer les événements</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative">
                        <Label className="mb-1 block">Type</Label>
                        <select value={tmpTypeFilter} onChange={(e) => setTmpTypeFilter(e.target.value)} className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm">
                          <option value="">Tous les types</option>
                          {types.map((t) => (<option key={t.id} value={t.id}>{t.nom}</option>))}
                        </select>
                      </div>
                      <div className="relative">
                        <Label className="mb-1 block">Pays</Label>
                        <select value={tmpCountryFilter} onChange={async (e) => { const val = e.target.value; setTmpCountryFilter(val); setTmpCityFilter(''); await fetchCities(val); }} className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm">
                          <option value="">Tous les pays</option>
                          {countries.map((p) => (<option key={p.id} value={p.id}>{p.nom}</option>))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative">
                        <Label className="mb-1 block">Ville</Label>
                        <select value={tmpCityFilter} onChange={(e) => setTmpCityFilter(e.target.value)} disabled={!tmpCountryFilter || cities.length === 0} className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm disabled:opacity-50">
                          <option value="">Toutes les villes</option>
                          {cities.map((v) => (<option key={v.id} value={v.id}>{v.nom}</option>))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="mb-1 block">Du</Label>
                        <Input type="date" value={tmpDateFrom} onChange={(e) => setTmpDateFrom(e.target.value)} />
                      </div>
                      <div>
                        <Label className="mb-1 block">Au</Label>
                        <Input type="date" value={tmpDateTo} onChange={(e) => setTmpDateTo(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => {
                      setTmpTypeFilter('');
                      setTmpCountryFilter('');
                      setTmpCityFilter('');
                      setTmpDateFrom('');
                      setTmpDateTo('');
                      setTypeFilter('');
                      setCountryFilter('');
                      setCityFilter('');
                      setDateFrom('');
                      setDateTo('');
                      setFiltersOpen(false);
                    }}>Réinitialiser</Button>
                    <Button onClick={() => {
                      setTypeFilter(tmpTypeFilter || '');
                      setCountryFilter(tmpCountryFilter || '');
                      setCityFilter(tmpCityFilter || '');
                      setDateFrom(tmpDateFrom || '');
                      setDateTo(tmpDateTo || '');
                      setFiltersOpen(false);
                    }}>Appliquer</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </motion.div>

            {loading ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" /></div> :
            events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((event, index) => (
                  <motion.div key={event.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                    <EvenementCard event={event} onSelect={setSelectedEvent} apiPrefix={API_PREFIX} session={session} />
                  </motion.div>
                ))}
              </div>
            ) : (
                 <div className="text-center py-12 text-gray-500">
                    <p>Aucun événement pour le moment.</p>
                </div>
            )}
         </div>
  </>
);
};

export default Evenements;
