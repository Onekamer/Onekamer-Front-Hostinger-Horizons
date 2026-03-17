import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { ArrowLeft, Image as ImageIcon, Tag, Euro, MapPin, Loader2, X, Globe, Phone, Mail } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { notifyNewAnnonce } from '@/services/oneSignalNotifications';
import imageCompression from 'browser-image-compression';
 

const CreateAnnonce = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, session } = useAuth();
  const annonceId = searchParams.get('annonceId');
  const isEditMode = !!annonceId;
  const [formData, setFormData] = useState({ 
    titre: '', 
    categorie_id: '', 
    prix: '', 

    pays_id: '',
    ville_id: '',
    telephone: '',
    email: '',
    description: '',
    devise_id: ''
  });
  const [categories, setCategories] = useState([]);
  const [pays, setPays] = useState([]);
  const [villes, setVilles] = useState([]);
  const [devises, setDevises] = useState([]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [existingAnnonce, setExistingAnnonce] = useState(null);
  const mediaInputRef = useRef(null);

  const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;
  const API_PREFIX = `${apiBaseUrl}/api`;

  const fetchVilles = useCallback(async (paysId) => {
    if (!paysId) {
      setVilles([]);
      return;
    }

    const { data, error } = await supabase.from('villes').select('id, nom').eq('pays_id', paysId);
    if (error) {
      toast({ title: 'Erreur', description: 'Impossible de charger les villes.', variant: 'destructive' });
    } else {
      setVilles(data);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: categoriesData, error: categoriesError } = await supabase.from('annonces_categories').select('id, nom');
      if (categoriesError) toast({ title: 'Erreur', description: 'Impossible de charger les catégories.', variant: 'destructive' });
      else setCategories(categoriesData);

      const { data: paysData, error: paysError } = await supabase.from('pays').select('id, nom');
      if (paysError) toast({ title: 'Erreur', description: 'Impossible de charger les pays.', variant: 'destructive' });
      else setPays(paysData);

      const { data: devisesData, error: devisesError } = await supabase.from('devises').select('id, nom, symbole');
      if (devisesError) toast({ title: 'Erreur', description: 'Impossible de charger les devises.', variant: 'destructive' });
      else {
        setDevises(devisesData);
        const defaultDevise = devisesData.find(d => d.code_iso === 'EUR') || devisesData[0];
        if(defaultDevise) {
          setFormData(prev => ({...prev, devise_id: defaultDevise.id}));
        }
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!isEditMode) return;
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('annonces')
          .select('id, user_id, titre, categorie_id, prix, devise_id, pays_id, ville_id, telephone, email, description, media_url, media_type')
          .eq('id', annonceId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast({ title: 'Annonce introuvable', variant: 'destructive' });
          navigate('/annonces');
          return;
        }

        const isAdmin =
          profile?.is_admin === true ||
          profile?.is_admin === 1 ||
          profile?.is_admin === 'true' ||
          String(profile?.role || '').toLowerCase() === 'admin';
        const isOwner = user?.id === data.user_id;
        if (!isAdmin && !isOwner) {
          toast({ title: 'Accès refusé', description: "Vous n'êtes pas autorisé à modifier cette annonce.", variant: 'destructive' });
          navigate('/annonces');
          return;
        }

        setExistingAnnonce(data);
        setFormData({
          titre: data.titre || '',
          categorie_id: data.categorie_id || '',
          prix: data.prix ?? '',
          pays_id: data.pays_id || '',
          ville_id: data.ville_id || '',
          telephone: data.telephone || '',
          email: data.email || '',
          description: data.description || '',
          devise_id: data.devise_id || '',
        });

        if (data.pays_id) {
          await fetchVilles(data.pays_id);
        }
        setMediaPreview(data.media_url || null);
        setMediaFile(null);
      } catch (e) {
        toast({ title: 'Erreur', description: e?.message || "Impossible de charger l'annonce.", variant: 'destructive' });
        navigate('/annonces');
      }
    };
    run();
  }, [annonceId, fetchVilles, isEditMode, navigate, profile?.is_admin, profile?.role, user]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    if (id === 'pays_id') {
      fetchVilles(value);
      setFormData(prev => ({ ...prev, ville_id: '' }));
    }
  };

  const handleMediaChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const firstVideo = files.find((f) => String(f.type || '').startsWith('video/'));
    if (firstVideo) {
      setMediaFiles([]);
      setMediaPreviews([]);
      setMediaFile(firstVideo);
      setMediaPreview(URL.createObjectURL(firstVideo));
      try { e.target.value = ''; } catch (_) {}
      return;
    }
    const images = files.filter((f) => String(f.type || '').startsWith('image/'));
    if (!images.length) return;
    setMediaFile(null);
    let mergedRef = [];
    setMediaFiles((prev) => {
      const seen = new Set(prev.map((p) => `${p.name}:${p.size}`));
      const merged = [...prev];
      for (const img of images) {
        const key = `${img.name}:${img.size}`;
        if (!seen.has(key)) { merged.push(img); seen.add(key); }
      }
      mergedRef = merged.slice(0, 5);
      return mergedRef;
    });
    setMediaPreviews(() => mergedRef.map((f) => URL.createObjectURL(f)));
    setMediaPreview((prev) => prev || (mergedRef[0] ? URL.createObjectURL(mergedRef[0]) : null));
    try { e.target.value = ''; } catch (_) {}
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaFiles([]);
    setMediaPreviews([]);
    setMediaPreview(null);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Erreur', description: 'Vous devez être connecté pour publier.', variant: 'destructive' });
      return;
    }

    if (!formData.categorie_id || !formData.pays_id || !formData.ville_id || !formData.devise_id) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs obligatoires.', variant: 'destructive' });
      return;
    }
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (formData.telephone && !phoneRegex.test(formData.telephone)) {
        toast({ title: 'Format invalide', description: 'Veuillez entrer un numéro de téléphone valide au format international (ex: +33612345678).', variant: 'destructive' });
        return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    let mediaUrl = existingAnnonce?.media_url || null;
    let mediaType = existingAnnonce?.media_type || null;
    let imageUrls = null;

    try {
      if (mediaFiles && mediaFiles.length > 0) {
        imageUrls = [];
        const queue = [];
        for (const img of mediaFiles) {
          let f = img;
          if (img.type.startsWith('image')) {
            try { f = await imageCompression(img, { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true }); } catch (_) {}
          }
          queue.push(f);
        }
        const totalBytes = queue.reduce((acc, f) => acc + (f.size || 0), 0) || 1;
        let base = 0;
        for (const finalImg of queue) {
          const fd = new FormData();
          const safe = new File([finalImg], finalImg.name || `upload_${Date.now()}.${(finalImg.type || 'image/jpeg').split('/')[1]}`, { type: finalImg.type || 'image/jpeg' });
          fd.append('file', safe);
          fd.append('type', 'annonces');
          fd.append('recordId', user.id);
          const out = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_PREFIX}/upload`);
            xhr.upload.onprogress = (e) => {
              if (e && e.lengthComputable) {
                const p = Math.floor(((base + e.loaded) / totalBytes) * 100);
                setUploadProgress(Math.max(0, Math.min(99, p)));
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ success: true, url: '' }); }
              } else {
                reject(new Error('La mise à jour du fichier a échoué'));
              }
            };
            xhr.onerror = () => reject(new Error('La mise à jour du fichier a échoué'));
            xhr.send(fd);
          });
          if (!out?.success || !out?.url) throw new Error('Réponse upload invalide');
          imageUrls.push(out.url);
          base += finalImg.size || 0;
          setUploadProgress(Math.max(0, Math.min(99, Math.floor((base / totalBytes) * 100))));
        }
        mediaUrl = imageUrls[0];
        mediaType = 'image';
      } else if (mediaFile) {
        const safeFile = new File(
          [mediaFile],
          mediaFile.name || `upload_${Date.now()}.${(mediaFile.type || 'application/octet-stream').split('/')[1]}`,
          { type: mediaFile.type || 'application/octet-stream' }
        );
        const totalBytes = safeFile.size || 1;
        const uploadFormData = new FormData();
        uploadFormData.append('file', safeFile);
        uploadFormData.append('type', 'annonces');
        uploadFormData.append('recordId', user.id);
        const out = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_PREFIX}/upload`);
          xhr.upload.onprogress = (e) => {
            if (e && e.lengthComputable) {
              const p = Math.floor((e.loaded / totalBytes) * 100);
              setUploadProgress(Math.max(0, Math.min(99, p)));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({ url: '' }); }
            } else {
              reject(new Error('La mise à jour du fichier a échoué'));
            }
          };
          xhr.onerror = () => reject(new Error('La mise à jour du fichier a échoué'));
          xhr.send(uploadFormData);
        });
        mediaUrl = out.url;
        mediaType = mediaFile.type.startsWith('video') ? 'video' : 'image';
      }
      setUploadProgress(100);

      if (isEditMode) {
        const isAdmin =
          profile?.is_admin === true ||
          profile?.is_admin === 1 ||
          profile?.is_admin === 'true' ||
          String(profile?.role || '').toLowerCase() === 'admin';
        const isOwner = user?.id && existingAnnonce?.user_id === user.id;

        const payload = {
          titre: formData.titre,
          categorie_id: formData.categorie_id,
          prix: formData.prix ? parseFloat(formData.prix) : null,
          devise_id: formData.devise_id,
          pays_id: formData.pays_id,
          ville_id: formData.ville_id,
          telephone: formData.telephone,
          email: formData.email,
          description: formData.description,
          media_url: mediaUrl,
          media_type: mediaType,
        };
        if (imageUrls && imageUrls.length) payload.image_urls = imageUrls;

        if (isAdmin && !isOwner) {
          const token = session?.access_token;
          if (!token) throw new Error('Session expirée');
          const resp = await fetch(`${API_PREFIX}/admin/annonces/${encodeURIComponent(annonceId)}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const out = await resp.json().catch(() => ({}));
          if (!resp.ok) throw new Error(out?.error || 'Erreur serveur');
        } else {
          const { error } = await supabase
            .from('annonces')
            .update({ ...payload, updated_at: new Date().toISOString() })
            .eq('id', annonceId);
          if (error) throw error;
        }

        toast({ title: 'Succès !', description: 'Annonce modifiée.' });
        navigate('/annonces');
        return;
      }

      const { data: newAnnonce, error } = await supabase
        .from('annonces')
        .insert([
          {
            titre: formData.titre,
            categorie_id: formData.categorie_id,
            prix: formData.prix ? parseFloat(formData.prix) : null,
            devise_id: formData.devise_id,
            pays_id: formData.pays_id,
            ville_id: formData.ville_id,
            telephone: formData.telephone,
            email: formData.email,
            description: formData.description,
            user_id: user.id,
            author_id: user.id,
            media_url: mediaUrl,
            media_type: mediaType,
            ...(imageUrls && imageUrls.length ? { image_urls: imageUrls } : {}),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (newAnnonce) {
        try {
          const catName = (categories.find((c) => String(c.id) === String(newAnnonce.categorie_id))?.nom) || '';
          setTimeout(() => {
            try {
              const k = `nna:${user.id}:${newAnnonce.id}`;
              const last = Number((typeof sessionStorage !== 'undefined' && sessionStorage.getItem(k)) || 0);
              if (Date.now() - last < 8000) return;
              if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, String(Date.now()));
              const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('ok_notif_prefs') : null;
              if (raw) { try { const prefs = JSON.parse(raw); if (prefs && prefs.annonces === false) return; } catch {} }
            } catch {}
            notifyNewAnnonce({
              annonceId: newAnnonce.id,
              title: newAnnonce.titre,
              authorName: profile?.username || user?.email || 'Un membre OneKamer',
              price: newAnnonce.prix,
              categoryName: catName,
              body: newAnnonce.description || '',
            }).catch(() => {});
          }, 1500);
        } catch (notificationError) {
          console.error('Erreur notification OneSignal (annonce):', notificationError);
        }
      }

      toast({ title: 'Succès !', description: 'Votre annonce a été publiée.' });
      navigate('/annonces');
    } catch (error) {
      toast({ title: 'Erreur de publication', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Helmet><title>Publier une Annonce - OneKamer.co</title></Helmet>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
          <h1 className="text-3xl font-bold text-[#2BA84A] mb-6">{isEditMode ? "Modifier une annonce" : "Publier une annonce"}</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader><CardTitle>Détails de l'annonce</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="titre">Titre de l'annonce</Label>
                  <Input id="titre" placeholder="Ex: iPhone 13 Pro en excellent état" required value={formData.titre} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categorie_id">Catégorie</Label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select id="categorie_id" value={formData.categorie_id} onChange={handleInputChange} className="pl-10 flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm" required>
                      <option value="" disabled>Sélectionner une catégorie</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nom}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prix">Prix</Label>
                    <div className="relative">
                      <Input id="prix" type="number" min="0" step="0.01" placeholder="Ex: 29.99" value={formData.prix} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="devise_id">Devise</Label>
                    <div className="relative">
                      <select id="devise_id" value={formData.devise_id} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm" required>
                        <option value="" disabled>Choisir</option>
                        {devises.map(d => <option key={d.id} value={d.id}>{d.nom} ({d.symbole})</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pays_id">Pays</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select id="pays_id" value={formData.pays_id} onChange={handleInputChange} className="pl-10 flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm" required>
                        <option value="" disabled>Sélectionner un pays</option>
                        {pays.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ville_id">Ville</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select id="ville_id" value={formData.ville_id} onChange={handleInputChange} className="pl-10 flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm" required disabled={!formData.pays_id || villes.length === 0}>
                        <option value="" disabled>Sélectionner une ville</option>
                        {villes.map(v => <option key={v.id} value={v.id}>{v.nom}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input id="telephone" type="tel" placeholder="+33612345678" pattern="^\+?[1-9]\d{1,14}$" className="pl-10" value={formData.telephone} onChange={handleInputChange} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Format international attendu.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input id="email" type="email" placeholder="contact@email.com" className="pl-10" value={formData.email} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Image / Vidéo</Label>
                  <Card className="p-4 border-dashed"><CardContent className="flex flex-col items-center justify-center text-center p-0">
                      {(mediaPreview || (mediaFiles && mediaFiles.length > 0)) ? (
                        <div className="relative">
                          {mediaFile && mediaFile.type.startsWith('video') ? (
                            <video src={mediaPreview} className="max-h-48 rounded-md mb-4" controls />
                          ) : mediaFiles && mediaFiles.length > 1 ? (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                              {mediaPreviews.map((src, idx) => (
                                <img
                                  key={idx}
                                  src={src}
                                  alt={`Aperçu ${idx + 1}`}
                                  className="w-16 h-16 rounded-md object-cover flex-none"
                                  draggable={false}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="w-40 h-40">
                              <img alt="Aperçu" src={mediaPreview} className="w-full h-full rounded-md object-cover" />
                            </div>
                          )}
                          <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={removeMedia}><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (<ImageIcon className="h-12 w-12 text-gray-400 mb-2" />)}
                      <Button type="button" onClick={() => mediaInputRef.current?.click()} className="text-[#2BA84A] font-semibold" variant="link">
                        {mediaPreview || (mediaFiles && mediaFiles.length > 0) ? 'Changer le média' : 'Choisir une image ou vidéo'}
                      </Button>
                      <Input ref={mediaInputRef} id="media-upload" type="file" className="hidden" accept="image/*,video/*" onChange={handleMediaChange} multiple />
                  </CardContent></Card>
                </div>
                <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" placeholder="Décrivez votre article ou service en détail..." rows={5} required value={formData.description} onChange={handleInputChange} /></div>
                <Button type="submit" className="w-full bg-[#E0222A] hover:bg-[#E0222A]/90" disabled={isUploading}>
                  {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publication...</> : isEditMode ? "Modifier l'annonce" : "Publier l'annonce"}
                </Button>
              </CardContent>
            </Card>
          </form>
        </motion.div>
      </div>
      {isUploading && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-md px-4 py-3 flex items-center gap-2">
            <Loader2 className="h-5 w-5 text-gray-700 animate-spin" />
            <span className="text-sm font-medium text-gray-800">{uploadProgress > 0 ? `Envoi en cours… ${uploadProgress}%` : 'Envoi en cours…'}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateAnnonce;