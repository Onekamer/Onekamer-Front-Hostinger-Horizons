import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Camera, Pencil, MapPin, Briefcase, User, Ruler, Weight, Users, Cigarette, GlassWater, Baby, Paintbrush, Gem, Tv, Music, Film, Book, Sparkles, Languages, Code, Award, GraduationCap, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import imageCompression from 'browser-image-compression';
import MediaDisplay from '@/components/MediaDisplay';
import { Switch } from "@/components/ui/switch";

async function normalizeToJpeg(file, maxSide = 1600) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
    const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    const out = new File([blob], (file.name || 'upload').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    return out;
  } finally {
    URL.revokeObjectURL(src);
  }
}

async function processImageFile(inputFile) {
  try {
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85 };
    const out = await imageCompression(inputFile, options);
    return out;
  } catch (_e) {
    return await normalizeToJpeg(inputFile, 1600);
  }
}

const ChoiceButton = ({ value, selectedValue, onSelect, children }) => (
    <Button
      type="button"
      variant={selectedValue === value ? "default" : "outline"}
      onClick={() => onSelect(value)}
      className="flex-1"
    >
      {children}
    </Button>
);

const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="flex flex-col items-start">
    <div className="flex items-center text-sm text-gray-500 gap-2">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
    <p className="font-semibold text-gray-800 mt-1">{value || '-'}</p>
  </div>
);

const ArrayDetailItem = ({ icon: Icon, label, values }) => (
    <div className="flex flex-col items-start col-span-2 md:col-span-3">
        <div className="flex items-center text-sm text-gray-500 gap-2">
            <Icon className="h-4 w-4" />
            <span>{label}</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
            {(values && values.length > 0) ? values.map((item, index) => (
                <span key={index} className="bg-gray-100 text-gray-800 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">{item}</span>
            )) : <p className="font-semibold text-gray-800">-</p>}
        </div>
    </div>
);


const RencontreProfil = () => {
  const { user, profile: userProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    fume: 'Non',
    bois: 'Non',
    tatouage: 'Non',
    enfant: 'Non',
    nombre_enfant: null,
    show_taille: true,
    show_poids: true,
    show_ethnie: true,
    show_nombre_enfant: true,
    centres_interet: [],
    langues_parlees: [],
    competences_techniques: [],
    competences_humaines: [],
    photos: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [rencontreTypes, setRencontreTypes] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPath, setLightboxPath] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('rencontres').select('*, pays:pays_id(id, nom), ville:ville_id(id, nom)').eq('user_id', user.id).single();

    if (error && error.code === 'PGRST116') {
      setIsEditing(true);
      setHasProfile(false);
      if (userProfile?.avatar_url) {
        setImagePreview(userProfile.avatar_url);
      }
      setProfile(p => ({ ...p, image_url: userProfile?.avatar_url, name: userProfile?.username, user_id: user.id }))
    } else if (data) {
      setProfile(prev => ({...prev, ...data, photos: Array.isArray(data.photos) ? data.photos : []}));
      // 🧩 Génère une URL signée si image_url est un chemin de stockage
      try {
        if (data.image_url && typeof data.image_url === 'string') {
          if (data.image_url.startsWith('http')) {
            setImagePreview(data.image_url);
          } else {
            const { data: signed, error: signErr } = await supabase.storage
              .from('rencontres')
              .createSignedUrl(data.image_url, 3600);
            if (!signErr && signed?.signedUrl) {
              setImagePreview(signed.signedUrl);
            } else {
              setImagePreview(null);
            }
          }
        } else {
          setImagePreview(null);
        }
      } catch {
        setImagePreview(null);
      }
      setHasProfile(true);
    } else if (error) {
       toast({ title: 'Erreur', description: 'Impossible de charger votre profil Rencontre.', variant: 'destructive' });
    }
    setLoading(false);
  }, [user, userProfile, toast]);

  const fetchInitialData = useCallback(async () => {
    const [countriesRes, typesRes] = await Promise.all([
      supabase.from('pays').select('*').order('nom'),
      supabase.from('rencontres_types').select('*').order('nom')
    ]);

    setCountries(countriesRes.data || []);
    setRencontreTypes(typesRes.data || []);
  }, []);

  const fetchCities = useCallback(async (countryId) => {
    if (!countryId) {
      setCities([]);
      return;
    };
    const { data } = await supabase.from('villes').select('*').eq('pays_id', countryId).order('nom');
    setCities(data || []);
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchInitialData();
  }, [fetchProfile, fetchInitialData]);

  useEffect(() => {
    if (profile.pays_id) {
      fetchCities(typeof profile.pays_id === 'object' ? profile.pays_id.id : profile.pays_id);
    }
  }, [profile.pays_id, fetchCities]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    if (['centres_interet', 'langues_parlees', 'competences_techniques', 'competences_humaines'].includes(name)) {
      setProfile(prev => ({ ...prev, [name]: value.split(',').map(s => s.trim()).filter(s => s) }));
    } else {
      const processedValue = type === 'number' ? (value === '' ? null : parseInt(value, 10)) : value;
      setProfile(prev => ({ ...prev, [name]: processedValue }));
    }
  };

  const handleSelectChange = (name, value) => {
    setProfile(prev => ({ ...prev, [name]: value}));
    if (name === 'pays_id') {
      setProfile(prev => ({ ...prev, ville_id: null }));
      fetchCities(value);
    }
  };
  
  const handleChoiceChange = (name, value) => {
    setProfile(prev => ({ ...prev, [name]: value }));
    if (name === 'enfant' && value === 'Non') {
      setProfile(prev => ({ ...prev, nombre_enfant: null }));
    }
  };
  
  const handleSwitchChange = (name, checked) => {
    setProfile(prev => ({ ...prev, [name]: checked }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const processed = await processImageFile(file);
      setImageFile(processed);
      setImagePreview(URL.createObjectURL(processed));
    } catch (error) {
      toast({ title: "Erreur d'image", description: error.message, variant: "destructive" });
    }
  };

  const handleGalleryChange = async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  // 🔒 Limite à 6 photos max
  const remainingSlots = 6 - (profile.photos.length + galleryFiles.length);
  if (remainingSlots <= 0) {
    toast({
      title: 'Limite atteinte',
      description: 'Vous pouvez ajouter jusqu’à 6 photos.',
      variant: 'destructive',
    });
    e.target.value = '';
    return;
  }

  const filesToProcess = files.slice(0, remainingSlots);

  const newGalleryItems = [];
  for (const file of filesToProcess) {
    try {
      const compressedFile = await processImageFile(file);
      newGalleryItems.push({
        id: `${Date.now()}-${Math.random()}`,
        file: compressedFile,
        preview: URL.createObjectURL(compressedFile),
      });
    } catch (error) {
      toast({
        title: "Erreur d'image",
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  if (newGalleryItems.length > 0) {
    setGalleryFiles((prev) => [...prev, ...newGalleryItems]);

    // 🖼️ Correction principale : afficher immédiatement la première image
    // si aucune photo principale n'est encore visible
    if (!imagePreview) {
      setImagePreview(newGalleryItems[0].preview);
    }
  }

  e.target.value = '';
};

  const handleRemovePhoto = (url) => {
    setProfile(prev => ({ ...prev, photos: prev.photos.filter(photo => photo !== url) }));
  };

  const handleRemoveNewPhoto = (id) => {
    setGalleryFiles(prev => {
      const toRemove = prev.find(item => item.id === id);
      if (toRemove?.preview) {
        URL.revokeObjectURL(toRemove.preview);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!user) return;
  setSaving(true);
  try {
    let imageUrl = profile.image_url;

    // 📸 Upload de la photo principale via serveur LAB (BunnyCDN)
    if (imageFile) {
      try {
        const formData = new FormData();
        const safeFile = new File(
          [imageFile],
          imageFile.name || `upload_${Date.now()}.jpg`,
          { type: imageFile.type || "image/jpeg" }
        );
        formData.append("file", safeFile);
        formData.append("type", "rencontres");
        formData.append("user_id", user.id); // ✅ sous-dossier utilisateur

        const res = await fetch("https://onekamer-server.onrender.com/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          console.error("Erreur d'upload principale :", await res.text());
          toast({
            title: "Erreur d'upload",
            description: "La mise à jour de l'image a échoué.",
            variant: "destructive",
          });
          return;
        }

        const data = await res.json();
        // ✅ Utilise le chemin de stockage Supabase pour un affichage fiable
        if (data.path) imageUrl = data.path;
      } catch (err) {
        console.error("Network/upload error (main):", err);
        toast({ title: "Erreur réseau", description: "Échec de l'upload de la photo principale.", variant: "destructive" });
        return;
      }
    }

    // 🖼️ Upload des images de la galerie
    const uploadedGalleryUrls = [];
    for (const item of galleryFiles) {
      try {
        const formData = new FormData();
        const safeFile = new File(
          [item.file],
          item.file.name || `gallery_${Date.now()}.jpg`,
          { type: item.file.type || "image/jpeg" }
        );
        formData.append("file", safeFile);
        formData.append("type", "rencontres");
        formData.append("user_id", user.id);

        const res = await fetch("https://onekamer-server.onrender.com/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          console.error("Erreur d’upload galerie :", await res.text());
          toast({ title: "Erreur d'upload", description: "L'envoi d'une photo a échoué.", variant: "destructive" });
          return;
        }

        const data = await res.json();
        // ✅ Stocke le chemin Supabase dans la galerie
        if (data.path) uploadedGalleryUrls.push(data.path);
      } catch (err) {
        console.error("Network/upload error (gallery):", err);
        toast({ title: "Erreur réseau", description: "Échec de l'upload d'une photo de la galerie.", variant: "destructive" });
        return;
      }
    }

    // 🔗 Fusion des anciennes et nouvelles images
    const finalGallery = [...(profile.photos || []), ...uploadedGalleryUrls];
    const coverImage = imageUrl || finalGallery[0] || null;

    const { created_at, id, pays, ville, ...rest } = profile;

    const updateData = {
      ...rest,
      photos: finalGallery,
      image_url: coverImage,
      user_id: user.id,
      updated_at: new Date(),
    };

    if (
      updateData.enfant === "Oui" &&
      (!updateData.nombre_enfant || updateData.nombre_enfant <= 0)
    ) {
      toast({ title: "Information manquante", description: "Veuillez indiquer le nombre d'enfants.", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("rencontres")
      .upsert(updateData, { onConflict: "user_id", defaultToNull: false });

    if (error) {
      console.error("Supabase upsert error:", error);
      toast({ title: "Erreur", description: `La mise à jour a échoué: ${error.message}` , variant: "destructive" });
    } else {
      toast({ title: "Succès", description: "Votre profil a été mis à jour !" });
      await refreshProfile();
      await fetchProfile();
      setIsEditing(false);
      galleryFiles.forEach((item) => item.preview && URL.revokeObjectURL(item.preview));
      setGalleryFiles([]);
      if (!imageFile) {
        setImagePreview(coverImage);
      }
    }
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>;
  }
  
  if (!isEditing) {
    const enfantValue = `${profile.enfant}${profile.enfant === 'Oui' && profile.show_nombre_enfant ? ` (${profile.nombre_enfant || 'N/A'})` : ''}`;
    const galleryPhotos = (() => {
      const existing = Array.isArray(profile.photos) ? profile.photos.filter(Boolean) : [];
      if (profile.image_url && !existing.includes(profile.image_url)) {
        return [profile.image_url, ...existing];
      }
      return existing;
    })();

    return (
      <>
        <Helmet>
          <title>Aperçu Profil Rencontres - OneKamer.co</title>
        </Helmet>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto pb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/rencontre')}><ArrowLeft className="h-6 w-6" /></Button>
              <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-transparent bg-clip-text">Mon Profil Rencontres</h1>
              <Button onClick={() => setIsEditing(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white"><Pencil className="h-4 w-4 mr-2" />Modifier</Button>
            </div>
            <Card className="p-4 md:p-6 space-y-6">
                <div className="text-center">
                    <div className="w-32 h-32 rounded-full mx-auto mb-4 overflow-hidden border-4 border-green-200 cursor-pointer" onClick={() => { if (profile.image_url) { setLightboxPath(profile.image_url); setLightboxOpen(true); } }}>
                      <MediaDisplay bucket="rencontres" path={profile.image_url} alt={profile.name} className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800">{profile.name?.split(' ')[0]}, {profile.age}</h2>
                    <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 text-gray-500 text-sm mt-2">
                      <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {profile.ville?.nom || profile.city}</span>
                      <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {profile.profession}</span>
                    </div>
                    {galleryPhotos.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <h3 className="font-semibold text-gray-800">Mes photos</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {(() => {
    const normalizePhotoPath = (photo) => {
      if (!photo) return null;
      console.log("🧩 Chemin brut :", photo);

      // Si déjà une URL complète (Supabase signée, BunnyCDN, etc.)
      if (photo.startsWith("http")) {
        console.log("✅ URL complète :", photo);
        return photo;
      }

      // Si doublon "rencontres/rencontres/"
      if (photo.startsWith("rencontres/rencontres/")) {
        const cleaned = photo.replace(/^rencontres\//, "");
        console.log("🧹 Nettoyage doublon ->", cleaned);
        return cleaned;
      }

      // Si commence par "rencontres/"
      if (photo.startsWith("rencontres/")) {
        console.log("✅ Chemin correct :", photo);
        return photo;
      }

      // Sinon on préfixe proprement
      const prefixed = `rencontres/${photo}`;
      console.log("📦 Préfixé automatiquement ->", prefixed);
      return prefixed;
    };

    console.log("🖼️ Liste complète des photos galerie :", galleryPhotos);

    return galleryPhotos.slice(0, 6).map((photo, index) => {
      const normalizedPath = normalizePhotoPath(photo);
      if (!normalizedPath) {
        console.warn("⚠️ Photo ignorée (chemin vide ou invalide) :", photo);
        return null;
      }

      return (
        <div onClick={() => { setLightboxPath(normalizedPath); setLightboxOpen(true); }}
          key={`${photo}-${index}`}
          className="aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer"
        >
          <MediaDisplay
            bucket="rencontres"
            path={normalizedPath}
            alt={`${profile.name} - Photo ${index + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      );
    });
  })()}
</div>
</div>
)}
</div>

                <div className="space-y-2">
                    {profile.bio && (
                      <>
                        <h3 className="font-bold text-lg text-gray-800">Bio</h3>
                        <p className="text-gray-600 font-medium italic mb-2">{profile.bio}</p>
                      </>
                    )}
                    <h3 className="font-bold text-lg text-gray-800">À propos de moi</h3>
                    <p className="text-gray-600">{profile.long_bio}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6 pt-2">
                  <DetailItem icon={User} label="Sexe" value={profile.sexe} />
                  {profile.show_taille && <DetailItem icon={Ruler} label="Taille" value={profile.taille} />}
                  {profile.show_poids && <DetailItem icon={Weight} label="Poids" value={profile.poids} />}
                  {profile.show_ethnie && <DetailItem icon={Users} label="Ethnie" value={profile.ethnie} />}
                  <DetailItem icon={Cigarette} label="Fume" value={profile.fume} />
                  <DetailItem icon={GlassWater} label="Bois" value={profile.bois} />
                  <DetailItem icon={Baby} label="Enfant(s)" value={enfantValue} />
                  <DetailItem icon={Paintbrush} label="Tatouage(s)" value={profile.tatouage} />
                  <DetailItem icon={Gem} label="Piercing(s)" value={profile.piercing} />
                  <DetailItem icon={Film} label="Film préféré" value={profile.film} />
                  <DetailItem icon={Tv} label="Série préférée" value={profile.serie} />
                  <DetailItem icon={Music} label="Musique préférée" value={profile.musique} />
                  <DetailItem icon={Book} label="Livre préféré" value={profile.livre} />
                  <DetailItem icon={GraduationCap} label="Niveau d'études" value={profile.niveau_etudes} />
                  <DetailItem icon={Award} label="Secteur d'activité" value={profile.secteur_activite} />
                  <ArrayDetailItem icon={Sparkles} label="Centres d'intérêt" values={profile.centres_interet} />
                  <ArrayDetailItem icon={Languages} label="Langues parlées" values={profile.langues_parlees} />
                  <ArrayDetailItem icon={Code} label="Compétences techniques" values={profile.competences_techniques} />
                  <ArrayDetailItem icon={Users} label="Compétences humaines" values={profile.competences_humaines} />
                </div>
            </Card>
        </motion.div>
        {lightboxOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center" onClick={() => setLightboxOpen(false)}>
            <div className="max-w-[95vw] max-h-[95vh] p-2" onClick={(e) => e.stopPropagation()}>
              <MediaDisplay bucket="rencontres" path={lightboxPath} alt="media" className="max-h-[90vh] max-w-[90vw] object-contain" />
            </div>
            <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white" onClick={() => setLightboxOpen(false)} aria-label="Fermer">
              <X className="h-6 w-6" />
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Modifier Profil Rencontres - OneKamer.co</title>
      </Helmet>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto pb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" onClick={() => hasProfile ? setIsEditing(false) : navigate('/rencontre')}><ArrowLeft className="h-6 w-6" /></Button>
          <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-transparent bg-clip-text">Modifier Mon Profil</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                    {imagePreview ? (
                      <AvatarImage src={imagePreview} alt="Aperçu" />
                    ) : null }
                    <AvatarFallback>
                      <User className="h-16 w-16 text-gray-400" />
                    </AvatarFallback>
                  </Avatar>
                  <Button type="button" size="icon" className="absolute bottom-0 right-0 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white" onClick={() => fileInputRef.current.click()}>
                    <Camera className="h-5 w-5" />
                  </Button>
                  <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="font-semibold">Galerie de photos</Label>
                  <span className="text-sm text-gray-500">{profile.photos.length + galleryFiles.length}/6</span>
                </div>
                <p className="text-sm text-gray-500">Ajoutez jusqu'à 6 photos pour présenter votre univers.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {profile.photos.map((photo, index) => (
                    <div key={`${photo}-${index}`} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                      <MediaDisplay bucket="rencontres" path={photo} alt={`${profile.name} - Photo ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                        aria-label="Supprimer la photo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {galleryFiles.map(item => (
                    <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                      <img src={item.preview} alt="Aperçu de la nouvelle photo" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveNewPhoto(item.id)}
                        className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                        aria-label="Supprimer la nouvelle photo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {(profile.photos.length + galleryFiles.length) < 6 && (
  <button
    type="button"
    onClick={() => galleryInputRef.current?.click()}
    className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-500 transition"
  >
    <Plus className="h-8 w-8" />
    <span className="mt-2 text-sm font-medium">Ajouter</span>
  </button>
)}

{/* 🖼️ Aperçu instantané des nouvelles photos avant enregistrement */}
{galleryFiles.length > 0 && (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
    {galleryFiles.map(item => (
      <div
        key={item.id}
        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group"
      >
        <img
          src={item.preview}
          alt="Aperçu"
          className="w-full h-full object-cover"
        />
        <button
          type="button"
          onClick={() => handleRemoveNewPhoto(item.id)}
          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
          aria-label="Supprimer la nouvelle photo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ))}
  </div>
)}

<input
  type="file"
  accept="image/*"
  multiple
  ref={galleryInputRef}
  onChange={handleGalleryChange}
  className="hidden"
/>
</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><Label htmlFor="name">Nom/Pseudo</Label><Input id="name" name="name" value={profile.name || ''} onChange={handleChange} /></div>
                <div><Label htmlFor="age">Âge</Label><Input id="age" name="age" type="number" value={profile.age || ''} onChange={handleChange} /></div>
                <div><Label htmlFor="sexe">Sexe</Label>
                  <Select onValueChange={(value) => handleSelectChange('sexe', value)} value={profile.sexe || ''}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez votre sexe" /></SelectTrigger>
                    <SelectContent><SelectItem value="Homme">Homme</SelectItem><SelectItem value="Femme">Femme</SelectItem><SelectItem value="Autre">Autre</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="type_rencontre_souhaite_id">Type de rencontre</Label>
                  <Select onValueChange={(value) => handleSelectChange('type_rencontre_souhaite_id', value ? parseInt(value) : null)} value={profile.type_rencontre_souhaite_id?.toString() || ''}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez un type" /></SelectTrigger>
                    <SelectContent>{rencontreTypes.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="pays_id">Pays</Label>
                  <Select onValueChange={(value) => handleSelectChange('pays_id', value)} value={profile.pays_id?.id?.toString() || profile.pays_id?.toString() || ''}>
                    <SelectTrigger><SelectValue placeholder="Sélectionnez un pays" /></SelectTrigger>
                    <SelectContent position="popper" className="max-h-[20rem]">{countries.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="ville_id">Ville</Label>
                  <Select onValueChange={(value) => handleSelectChange('ville_id', value)} value={profile.ville_id?.id?.toString() || profile.ville_id?.toString() || ''} disabled={!profile.pays_id || cities.length === 0}>
                    <SelectTrigger><SelectValue placeholder={!profile.pays_id ? "Sélectionnez un pays" : "Sélectionnez une ville"} /></SelectTrigger>
                    <SelectContent position="popper" className="max-h-[20rem]">{cities.map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="profession">Profession</Label><Input id="profession" name="profession" value={profile.profession || ''} onChange={handleChange} /></div>
                
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="taille">Taille (ex: 1m80)</Label>
                      <Switch id="show_taille" checked={profile.show_taille} onCheckedChange={(c) => handleSwitchChange('show_taille', c)} />
                    </div>
                    <Input id="taille" name="taille" value={profile.taille || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="poids">Poids (ex: 75kg)</Label>
                      <Switch id="show_poids" checked={profile.show_poids} onCheckedChange={(c) => handleSwitchChange('show_poids', c)} />
                    </div>
                    <Input id="poids" name="poids" value={profile.poids || ''} onChange={handleChange} />
                </div>
                <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ethnie">Ethnie</Label>
                      <Switch id="show_ethnie" checked={profile.show_ethnie} onCheckedChange={(c) => handleSwitchChange('show_ethnie', c)} />
                    </div>
                    <Input id="ethnie" name="ethnie" value={profile.ethnie || ''} onChange={handleChange} />
                </div>

                <div className="md:col-span-2"><Label htmlFor="bio">Bio Courte (max 255)</Label><Textarea id="bio" name="bio" value={profile.bio || ''} onChange={handleChange} maxLength={255} /></div>
                <div className="md:col-span-2"><Label htmlFor="long_bio">À propos de moi</Label><Textarea id="long_bio" name="long_bio" value={profile.long_bio || ''} onChange={handleChange} rows={5} /></div>
                
                <div><Label htmlFor="film">Film préféré</Label><Input id="film" name="film" value={profile.film || ''} onChange={handleChange} /></div>
                <div><Label htmlFor="serie">Série préférée</Label><Input id="serie" name="serie" value={profile.serie || ''} onChange={handleChange} /></div>
                <div><Label htmlFor="musique">Musique préférée</Label><Input id="musique" name="musique" value={profile.musique || ''} onChange={handleChange} /></div>
                <div><Label htmlFor="livre">Livre préféré</Label><Input id="livre" name="livre" value={profile.livre || ''} onChange={handleChange} /></div>
                <div><Label htmlFor="niveau_etudes">Niveau d'études</Label><Input id="niveau_etudes" name="niveau_etudes" value={profile.niveau_etudes || ''} onChange={handleChange} /></div>
                <div><Label htmlFor="secteur_activite">Secteur d'activité</Label><Input id="secteur_activite" name="secteur_activite" value={profile.secteur_activite || ''} onChange={handleChange} /></div>

                <div className="md:col-span-2"><Label htmlFor="centres_interet">Centres d'intérêt (séparés par une virgule)</Label><Textarea id="centres_interet" name="centres_interet" value={profile.centres_interet?.join(', ') || ''} onChange={handleChange} /></div>
                <div className="md:col-span-2"><Label htmlFor="langues_parlees">Langues parlées (séparées par une virgule)</Label><Input id="langues_parlees" name="langues_parlees" value={profile.langues_parlees?.join(', ') || ''} onChange={handleChange} /></div>
                <div className="md:col-span-2"><Label htmlFor="competences_techniques">Compétences techniques (séparées par une virgule)</Label><Input id="competences_techniques" name="competences_techniques" value={profile.competences_techniques?.join(', ') || ''} onChange={handleChange} /></div>
                <div className="md:col-span-2"><Label htmlFor="competences_humaines">Compétences humaines (séparées par une virgule)</Label><Input id="competences_humaines" name="competences_humaines" value={profile.competences_humaines?.join(', ') || ''} onChange={handleChange} /></div>

                <div className="space-y-2">
                    <Label>Fumeur/se ?</Label>
                    <div className="flex items-center space-x-2">
                        <ChoiceButton value="Oui" selectedValue={profile.fume} onSelect={(v) => handleChoiceChange('fume', v)}>Oui</ChoiceButton>
                        <ChoiceButton value="Non" selectedValue={profile.fume} onSelect={(v) => handleChoiceChange('fume', v)}>Non</ChoiceButton>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Buveur/se ?</Label>
                    <div className="flex items-center space-x-2">
                        <ChoiceButton value="Oui" selectedValue={profile.bois} onSelect={(v) => handleChoiceChange('bois', v)}>Oui</ChoiceButton>
                        <ChoiceButton value="Non" selectedValue={profile.bois} onSelect={(v) => handleChoiceChange('bois', v)}>Non</ChoiceButton>
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label>Tatouage(s) ?</Label>
                    <div className="flex items-center space-x-2">
                        <ChoiceButton value="Oui" selectedValue={profile.tatouage} onSelect={(v) => handleChoiceChange('tatouage', v)}>Oui</ChoiceButton>
                        <ChoiceButton value="Non" selectedValue={profile.tatouage} onSelect={(v) => handleChoiceChange('tatouage', v)}>Non</ChoiceButton>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Enfant(s) ?</Label>
                     <div className="flex items-center space-x-2">
                        <ChoiceButton value="Oui" selectedValue={profile.enfant} onSelect={(v) => handleChoiceChange('enfant', v)}>Oui</ChoiceButton>
                        <ChoiceButton value="Non" selectedValue={profile.enfant} onSelect={(v) => handleChoiceChange('enfant', v)}>Non</ChoiceButton>
                    </div>
                </div>
                 {profile.enfant === 'Oui' && (
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="nombre_enfant">Nombre d'enfants</Label>
                      <Switch id="show_nombre_enfant" checked={profile.show_nombre_enfant} onCheckedChange={(c) => handleSwitchChange('show_nombre_enfant', c)} />
                    </div>
                    <Input id="nombre_enfant" name="nombre_enfant" type="number" value={profile.nombre_enfant || ''} onChange={handleChange} min="1" />
                  </div>
                )}
</div> {/* ✅ ferme le grid principal */}
</div> {/* ✅ ferme le bloc supérieur space-y-3 */}
              <div className="flex justify-end pt-4"><Button type="submit" disabled={saving} className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer</Button></div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default RencontreProfil;

