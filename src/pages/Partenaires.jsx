import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Star, Share2, MessageSquare, Mail, ArrowLeft, Lock, MapPin, Pencil, Trash2 } from 'lucide-react';
import { canUserAccess } from '@/lib/accessControl';
import FavoriteButton from '@/components/FavoriteButton';
import { applyAutoAccessProtection } from "@/lib/autoAccessWrapper";

const PartenaireDetail = ({ partenaire, onBack, onRecommander, onDelete, recoCount = 0, recommendedByMe = false }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const isAdmin =
    profile?.is_admin === true ||
    profile?.is_admin === 1 ||
    profile?.is_admin === 'true' ||
    String(profile?.role || '').toLowerCase() === 'admin';
  const isOwner = user?.id && partenaire?.user_id === user.id;
  const canManage = Boolean(isOwner || isAdmin);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: partenaire.name,
        text: `Découvrez ${partenaire.name} sur OneKamer.co !`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert("La fonction de partage n'est pas supportée sur ce navigateur.");
    }
  };

  const handleOpenMaps = () => {
    if (!partenaire) return;

    const { latitude, longitude, address } = partenaire;

    if (latitude && longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
      window.open(url, "_blank");
      return;
    }

    if (address) {
      const encoded = encodeURIComponent(address);
      const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      window.open(url, "_blank");
      return;
    }

    toast({
      title: 'Adresse indisponible',
      description: "Aucune information de localisation disponible pour ce partenaire.",
      variant: 'destructive',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-[#FDF9F9] to-[#CDE1D5] overflow-y-auto pt-16 pb-16"
    >
      <div className="container mx-auto px-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <Card className="shadow-xl rounded-2xl">
          {partenaire.media_url && (
            <img
              src={partenaire.media_url}
              alt={partenaire.name || "Partenaire"}
              className="w-full h-48 object-cover rounded-t-2xl"
              onError={(e) => {
                const industry = partenaire.partenaires_categories?.industrie?.toLowerCase() || partenaire.partenaires_categories?.nom?.toLowerCase() || "";
                let fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_mode.png";

                if (industry.includes("restauration")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_restauration.png";
                else if (industry.includes("finance")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_finances.png";
                else if (industry.includes("immobilier")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_immobilier.png";
                else if (industry.includes("santé") || industry.includes("bien-être") || industry.includes("beaute")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_bien-etre.png";
                else if (industry.includes("technologie") || industry.includes("numérique")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_technologies.png";
                else if (industry.includes("formation") || industry.includes("éducation")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_formations.png";
                else if (industry.includes("mode") || industry.includes("commerce")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_mode.png";
                else if (industry.includes("culture") || industry.includes("événementiel")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_culture_evenementiel.png";
                else if (industry.includes("transport")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_transport.png";

                e.target.src = fallback;
              }}
            />
          )}
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-2xl font-bold text-gray-800">{partenaire.name}</CardTitle>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-1 rounded-full">{partenaire.partenaires_categories?.nom || 'Partenaire'}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{partenaire.description}</p>

            {canManage && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate(`/publier/partenaire?partnerId=${encodeURIComponent(partenaire.id)}`)}
                >
                  <Pencil className="w-4 h-4 mr-2" /> Modifier
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={async () => {
                    if (!onDelete) return;
                    const ok = window.confirm('Confirmer la suppression de ce partenaire ?');
                    if (!ok) return;
                    await onDelete(partenaire);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                </Button>
              </div>
            )}
            <div className="text-sm text-gray-500 space-y-2">
              <p><span className="font-semibold">Adresse:</span> {partenaire.address}</p>
              <p><span className="font-semibold">Téléphone:</span> <a href={`tel:${partenaire.phone}`} className="text-green-600">{partenaire.phone}</a></p>
              {partenaire.website && <p><span className="font-semibold">Site web:</span> <a href={partenaire.website} target="_blank" rel="noopener noreferrer" className="text-green-600">{partenaire.website}</a></p>}
            </div>
            <button
              onClick={handleOpenMaps}
              className="mt-3 bg-[#2BA84A] hover:bg-[#24903f] text-white px-3 py-2 rounded-md text-sm w-full"
            >
              Ouvrir la localisation
            </button>
            <p className="text-sm text-gray-500 italic border-t pt-4">Recommandé par {recoCount} membres</p>
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={() => onRecommander(partenaire.id)} className="flex-1">
                <Star className="w-4 h-4 mr-2" /> {recommendedByMe ? 'Ne plus recommander' : 'Recommander'}
              </Button>
              <Button onClick={handleShare} variant="outline" className="flex-1">
                <Share2 className="w-4 h-4 mr-2" /> Partager
              </Button>
            </div>
            <div className="flex gap-2">
              {partenaire.phone && (
                <a href={`sms:${partenaire.phone}`} className="flex-1">
                  <Button variant="secondary" className="w-full"><MessageSquare className="w-4 h-4 mr-2" /> Contacter par SMS</Button>
                </a>
              )}
              {partenaire.email && (
                <a href={`mailto:${partenaire.email}`} className="flex-1">
                  <Button variant="secondary" className="w-full"><Mail className="w-4 h-4 mr-2" /> Contacter par Email</Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

const Partenaires = () => {
  const [partenaires, setPartenaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPartenaire, setSelectedPartenaire] = useState(null);
  const [recos, setRecos] = useState({}); // { [partnerId]: { partner_id, count, recommended_by_me } }
  const { toast } = useToast();
  const { user, session, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [canCreate, setCanCreate] = useState(false);
  const [searchParams] = useSearchParams();

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com';
  const API_PREFIX = `${serverUrl.replace(/\/$/, '')}/api`;

  const isAdmin =
    profile?.is_admin === true ||
    profile?.is_admin === 1 ||
    profile?.is_admin === 'true' ||
    String(profile?.role || '').toLowerCase() === 'admin';

  // 🟢 Vérifie automatiquement les droits d'accès à la page "Partenaires"
  useEffect(() => {
    if (authLoading) return;
    applyAutoAccessProtection(user, navigate, window.location.pathname);
  }, [user, navigate, authLoading]);

  // 🟢 Vérifie si l'utilisateur peut créer un partenaire
  useEffect(() => {
    if (user) {
      canUserAccess(user, 'partenaires', 'create').then(setCanCreate);
    } else {
      setCanCreate(false);
    }
  }, [user]);

  const fetchPartenaires = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from('view_partenaires_accessible').select('*, partenaires_categories(id, nom, industrie)');
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les partenaires.' });
        console.error(error);
        setPartenaires([]);
      } else {
        setPartenaires(data);
        // Charger les recommandations pour les partenaires affichés
        const ids = (data || []).map((p) => p?.id).filter(Boolean);
        if (ids.length > 0) {
          try {
            const qs = new URLSearchParams({ ids: ids.join(',') });
            const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
            const res = await fetch(`${API_PREFIX}/partners/recommendations?${qs.toString()}`, { headers });
            const out = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray(out?.items)) {
              const map = {};
              out.items.forEach((it) => { if (it?.partner_id != null) map[String(it.partner_id)] = it; });
              setRecos((prev) => ({ ...prev, ...map }));
            }
          } catch {}
        }
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de charger les partenaires.' });
      setPartenaires([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, toast]);

  useEffect(() => {
    fetchPartenaires();
  }, [fetchPartenaires]);

  const selectPartenaireWithOwner = useCallback(async (p) => {
    if (!p?.id) {
      setSelectedPartenaire(null);
      return;
    }
    try {
      if (p.user_id) {
        setSelectedPartenaire(p);
        return;
      }
      const { data, error } = await supabase.from('partenaires').select('user_id').eq('id', p.id).maybeSingle();
      if (error) throw error;
      setSelectedPartenaire({ ...p, user_id: data?.user_id || null });
    } catch {
      setSelectedPartenaire(p);
    }
  }, []);

  // Deeplink : ouverture automatique d'un partenaire via ?partnerId=
  useEffect(() => {
    if (!partenaires || partenaires.length === 0) return;
    const partnerId = searchParams.get('partnerId');
    if (!partnerId) return;

    const found = partenaires.find((p) => String(p.id) === String(partnerId));
    if (found) {
      selectPartenaireWithOwner(found);
    }
  }, [partenaires, searchParams, selectPartenaireWithOwner]);

  const handleProposerClick = async () => {
    if (!user) {
        toast({
            title: "Connexion requise",
            variant: "destructive",
        });
        navigate("/auth");
        return;
    }
    if (await canUserAccess(user, 'partenaires', 'create')) {
      navigate('/publier/partenaire');
    } else {
      toast({
        title: "Accès restreint",
        description: "Cette fonctionnalité est réservée aux membres VIP.",
        variant: "destructive",
      });
      navigate("/forfaits");
    }
  };

  const handleRecommander = async (partenaireId) => {
    if (!user || !session?.access_token) {
      toast({ title: 'Connexion requise', description: 'Connectez-vous pour recommander ce partenaire.', variant: 'destructive' });
      navigate('/auth');
      return;
    }
    try {
      const res = await fetch(`${API_PREFIX}/partners/${encodeURIComponent(partenaireId)}/recommend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
      setRecos((prev) => {
        const key = String(partenaireId);
        const prevInfo = prev[key] || { partner_id: partenaireId, count: 0, recommended_by_me: false };
        const nextInfo = {
          ...prevInfo,
          count: typeof data?.count === 'number' ? data.count : prevInfo.count,
          recommended_by_me: data?.action === 'added' ? true : data?.action === 'removed' ? false : prevInfo.recommended_by_me,
        };
        return { ...prev, [key]: nextInfo };
      });
      toast({ title: data?.action === 'added' ? 'Recommandé' : 'Recommandation retirée' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Action impossible.' });
    }
  };

  const handleDeletePartenaire = async (partenaire) => {
    if (!partenaire?.id) return;
    if (!user) {
      toast({ title: 'Connexion requise', variant: 'destructive' });
      return;
    }

    const isOwner = partenaire?.user_id === user.id;

    try {
      if (isAdmin && !isOwner) {
        const token = session?.access_token;
        if (!token) throw new Error('Session expirée');
        const res = await fetch(`${API_PREFIX}/admin/partenaires/${encodeURIComponent(partenaire.id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
      } else {
        const { error } = await supabase.from('partenaires').delete().eq('id', partenaire.id);
        if (error) throw error;
      }

      setPartenaires((prev) => (prev || []).filter((p) => String(p.id) !== String(partenaire.id)));
      setSelectedPartenaire(null);
      toast({ title: 'Succès', description: 'Partenaire supprimé.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Suppression impossible.', variant: 'destructive' });
    }
  };

  const handleOpenMapsQuick = (e, partenaire) => {
    e.stopPropagation();
    if (!partenaire) return;

    const { latitude, longitude, address } = partenaire;

    if (latitude && longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
      window.open(url, "_blank");
      return;
    }

    if (address) {
      const encoded = encodeURIComponent(address);
      const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      window.open(url, "_blank");
      return;
    }

    toast({
      title: 'Adresse indisponible',
      description: "Aucune information de localisation disponible pour ce partenaire.",
      variant: 'destructive',
    });
  };

  return (
  <>
    <Helmet>
      <title>Partenaires - OneKamer.co</title>
      <meta name="description" content="Découvrez les partenaires de confiance de la communauté OneKamer." />
    </Helmet>

    <AnimatePresence>
      {selectedPartenaire && (
        <PartenaireDetail 
          partenaire={selectedPartenaire} 
          onBack={() => setSelectedPartenaire(null)} 
          onRecommander={handleRecommander}
          onDelete={handleDeletePartenaire}
          recoCount={(recos[String(selectedPartenaire.id)]?.count) || 0}
          recommendedByMe={Boolean(recos[String(selectedPartenaire.id)]?.recommended_by_me)}
        />
      )}
    </AnimatePresence>
      
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-[#2BA84A]"
          >
            Partenaires
          </motion.h1>
          <Button onClick={handleProposerClick} disabled={!canCreate}>
            {canCreate ? <Plus className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
            {canCreate ? 'Proposer' : 'Verrouillé'}
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <Input 
            placeholder="Rechercher un partenaire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partenaires.map((partenaire, index) => (
              <motion.div
                key={partenaire.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => selectPartenaireWithOwner(partenaire)}
                className="cursor-pointer"
              >
                <Card className="relative overflow-hidden hover:shadow-xl transition-shadow h-full flex flex-col group">
                  <div className="h-40 w-full relative">
                    <img
                      src={partenaire.media_url}
                      alt={partenaire.name || "Partenaire"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const industry = partenaire.partenaires_categories?.industrie?.toLowerCase() || partenaire.partenaires_categories?.nom?.toLowerCase() || "";
                        let fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_mode.png";

                        if (industry.includes("restauration")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_restauration.png";
                        else if (industry.includes("finance")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_finances.png";
                        else if (industry.includes("immobilier")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_immobilier.png";
                        else if (industry.includes("santé") || industry.includes("bien-être") || industry.includes("beaute")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_bien-etre.png";
                        else if (industry.includes("technologie") || industry.includes("numérique")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_technologies.png";
                        else if (industry.includes("formation") || industry.includes("éducation")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_formations.png";
                        else if (industry.includes("mode") || industry.includes("commerce")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_mode.png";
                        else if (industry.includes("culture") || industry.includes("événementiel")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_culture_evenementiel.png";
                        else if (industry.includes("transport")) fallback = "https://onekamer-media-cdn.b-cdn.net/partenaires/default_partenaires_transport.png";

                        e.target.src = fallback;
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full">
                      {partenaire.partenaires_categories?.nom || 'Général'}
                    </div>
                    <div className="absolute top-2 right-2 flex space-x-1">
                      <FavoriteButton contentType="partenaire" contentId={partenaire.id} className="text-white hover:text-yellow-400" />
                      <Button variant="ghost" size="icon" className="text-white hover:text-blue-400">
                        <Share2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg font-semibold">{partenaire.name}</CardTitle>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M12 18.7c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/><circle cx="12" cy="12" r="2"/><path d="M12 22s-8-4-8-10c0-4.4 3.6-8 8-8s8 3.6 8 8c0 6-8 10-8 10z"/></svg>
                      {partenaire.address}
                    </p>
                    <p className="text-xs text-gray-500">Recommandé par {(recos[String(partenaire.id)]?.count) || 0} membres</p>
                  </CardHeader>
                  <CardContent className="flex justify-around border-t pt-4 pb-3">
                    <Button
                      onClick={(e) => handleOpenMapsQuick(e, partenaire)}
                      className="bg-[#2BA84A] hover:bg-[#24903f] text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>S'y rendre</span>
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MessageSquare className="w-5 h-5 text-[#2BA84A]" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Mail className="w-5 h-5 text-[#2BA84A]" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
            </div>
  </>
);
};

export default Partenaires;
