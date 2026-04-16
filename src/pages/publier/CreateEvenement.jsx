import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Clock, Euro, MapPin, Image as ImageIcon, Loader2, X, Tag, Phone, Mail, Globe, User } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { notifyNewEvenement } from '@/services/oneSignalNotifications';
import imageCompression from 'browser-image-compression';
import { GoogleMap, Marker, useJsApiLoader, Autocomplete } from '@react-google-maps/api';
 

const mapContainerStyle = {
  width: '100%',
  height: '250px',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: 48.8566,
  lng: 2.3522,
};

const libraries = ['places'];

const CreateEvenement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, session } = useAuth();
  const eventId = searchParams.get('eventId');
  const isEditMode = !!eventId;
  const [formData, setFormData] = useState({ title: '', date: '', time: '', end_date: '', end_time: '', location: '', price: '', description: '', type_id: '', telephone: '', email: '', site_web: '', organisateur: '', latitude: null, longitude: null, devise_id: '' });

  const [types, setTypes] = useState([]);
  const [devises, setDevises] = useState([]);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [existingEvent, setExistingEvent] = useState(null);
  const mediaInputRef = useRef(null);

  const [coords, setCoords] = useState(null);
  const autocompleteRef = useRef(null);

  const serverUrl = (import.meta.env.VITE_SERVER_URL || 'https://onekamer-server.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverUrl;
  const API_PREFIX = `${apiBaseUrl}/api`;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: typesData, error: typesError } = await supabase.from('evenements_types').select('id, nom');
      if (typesError) {
        toast({ title: 'Erreur', description: 'Impossible de charger les types d\'événements.', variant: 'destructive' });
      } else {
        setTypes(typesData);
      }
      const { data: devisesData, error: devisesError } = await supabase.from('devises').select('id, nom, symbole');
      if (devisesError) toast({ title: 'Erreur', description: 'Impossible de charger les devises.', variant: 'destructive' });
      else {
        setDevises(devisesData);
        const defaultDevise = devisesData.find(d => d.code_iso === 'EUR') || devisesData[0];
        if (defaultDevise) {
          setFormData(prev => ({ ...prev, devise_id: defaultDevise.id }));
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
          .from('evenements')
          .select('id, user_id, title, date, time, end_date, end_time, location, price, description, type_id, telephone, email, site_web, organisateur, latitude, longitude, devise_id, media_url, media_type')
          .eq('id', eventId)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          toast({ title: 'Événement introuvable', variant: 'destructive' });
          navigate('/evenements');
          return;
        }

        const isAdmin =
          profile?.is_admin === true ||
          profile?.is_admin === 1 ||
          profile?.is_admin === 'true' ||
          String(profile?.role || '').toLowerCase() === 'admin';
        const isOwner = user?.id === data.user_id;
        if (!isAdmin && !isOwner) {
          toast({ title: 'Accès refusé', description: "Vous n'êtes pas autorisé à modifier cet événement.", variant: 'destructive' });
          navigate('/evenements');
          return;
        }

        setExistingEvent(data);
        setFormData({
          title: data.title || '',
          date: data.date || '',
          time: data.time || '',
          end_date: data.end_date || '',
          end_time: data.end_time || '',
          location: data.location || '',
          price: data.price ?? '',
          description: data.description || '',
          type_id: data.type_id || '',
          telephone: data.telephone || '',
          email: data.email || '',
          site_web: data.site_web || '',
          organisateur: data.organisateur || '',
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          devise_id: data.devise_id || '',
        });
        if (data.latitude && data.longitude) {
          setCoords({ lat: data.latitude, lng: data.longitude });
        }
        setMediaPreview(data.media_url || null);
        setMediaFile(null);
      } catch (e) {
        toast({ title: 'Erreur', description: e?.message || "Impossible de charger l'événement.", variant: 'destructive' });
        navigate('/evenements');
      }
    };
    run();
  }, [eventId, isEditMode, navigate, profile?.is_admin, profile?.role, user]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    if (id === 'price') {
      const numericValue = value.replace(/[^0-9,.]/g, '').replace(',', '.');
      setFormData(prev => ({ ...prev, [id]: numericValue }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleMediaChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const firstVideo = files.find((f) => String(f.type || '').startsWith('video/'));
    if (firstVideo) {
      setMediaFile(firstVideo);
      setMediaPreview(URL.createObjectURL(firstVideo));
      setMediaFiles([]);
      setMediaPreviews([]);
      try { e.target.value = ''; } catch (_) {}
      return;
    }
    const images = files.filter((f) => String(f.type || '').startsWith('image/'));
    if (images.length) {
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
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaFiles([]);
    setMediaPreviews([]);
    setMediaPreview(null);
  };

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current !== null) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setCoords({ lat, lng });
        setFormData(prev => ({ ...prev, location: place.formatted_address, latitude: lat, longitude: lng }));
      } else {
        setFormData(prev => ({ ...prev, location: place.name }));
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast({ title: 'Erreur', description: 'Vous devez être connecté pour publier.', variant: 'destructive' });
      return;
    }
    if (!formData.title || !formData.type_id || !formData.organisateur || !formData.date || !formData.time || !formData.location || !formData.description || !formData.devise_id) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs obligatoires.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    let mediaUrl = existingEvent?.media_url || null;
    let mediaType = existingEvent?.media_type || null;
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
          const safe = new File(
            [finalImg],
            finalImg.name || `upload_${Date.now()}.${(finalImg.type || 'image/jpeg').split('/')[1]}`,
            { type: finalImg.type || 'image/jpeg' }
          );
          fd.append('file', safe);
          fd.append('type', 'evenements');
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
          if (!out?.url && out?.success === false) throw new Error('Réponse upload invalide');
          imageUrls.push(out.url || out.path || out.cdnUrl);
          base += finalImg.size || 0;
          setUploadProgress(Math.max(0, Math.min(99, Math.floor((base / totalBytes) * 100))));
        }
        mediaUrl = imageUrls[0];
        mediaType = 'image';
      } else if (mediaFile) {
        let finalFile = mediaFile;
        if (mediaFile.type.startsWith('image')) {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
          finalFile = await imageCompression(mediaFile, options);
        }
        const safeFile = new File(
          [finalFile],
          finalFile.name || `upload_${Date.now()}.${(finalFile.type || 'application/octet-stream').split('/')[1]}`,
          { type: finalFile.type || 'application/octet-stream' }
        );
        const totalBytes = safeFile.size || 1;
        const uploadFormData = new FormData();
        uploadFormData.append('file', safeFile);
        uploadFormData.append('type', 'evenements');
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

      const payload = { ...formData, media_url: mediaUrl, media_type: mediaType, price: parseFloat(formData.price) || 0 };
      // end_date / end_time réellement optionnels → envoyer null si vides
      if (!payload.end_date) payload.end_date = null;
      if (!payload.end_time) payload.end_time = null;
      if (imageUrls && imageUrls.length) payload.image_urls = imageUrls;

      if (isEditMode) {
        const isAdmin =
          profile?.is_admin === true ||
          profile?.is_admin === 1 ||
          profile?.is_admin === 'true' ||
          String(profile?.role || '').toLowerCase() === 'admin';
        const isOwner = user?.id && existingEvent?.user_id === user.id;

        if (isAdmin && !isOwner) {
          const token = session?.access_token;
          if (!token) throw new Error('Session expirée');
          const resp = await fetch(`${API_PREFIX}/admin/evenements/${encodeURIComponent(eventId)}`, {
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
            .from('evenements')
            .update({ ...payload })
            .eq('id', eventId);
          if (error) throw error;
        }

        toast({ title: 'Succès !', description: 'Événement modifié.' });
        navigate('/evenements');
        return;
      }

      const submissionData = { ...payload, user_id: user.id, author_id: user.id };

      const { data: newEvent, error } = await supabase
        .from('evenements')
        .insert([submissionData])
        .select()
        .single();

      if (error) throw error;

      if (newEvent) {
        try {
          const catName = (types.find((t) => String(t.id) === String(newEvent.type_id))?.nom) || '';
          setTimeout(() => {
            try {
              const k = `nev:${user.id}:${newEvent.id}`;
              const last = Number((typeof sessionStorage !== 'undefined' && sessionStorage.getItem(k)) || 0);
              if (Date.now() - last < 8000) return;
              if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(k, String(Date.now()));
              const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('ok_notif_prefs') : null;
              if (raw) { try { const prefs = JSON.parse(raw); if (prefs && prefs.evenements === false) return; } catch {} }
            } catch {}
            notifyNewEvenement({
              eventId: newEvent.id,
              title: newEvent.title,
              date: newEvent.date,
              time: newEvent.time,
              location: newEvent.location,
              authorName: profile?.username || user?.email || 'Un membre OneKamer',
              categoryName: catName,
            }).catch(() => {});
          }, 1500);
        } catch (notificationError) {
          console.error('Erreur notification OneSignal (événement):', notificationError);
        }
      }

      toast({ title: 'Succès !', description: 'Votre événement a été publié.' });
      navigate('/evenements');

    } catch (error) {
      toast({ title: 'Erreur de publication', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Helmet><title>Créer un Événement - OneKamer.co</title></Helmet>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Button>
          <h1 className="text-3xl font-bold text-[#2BA84A] mb-6">{isEditMode ? 'Modifier un événement' : 'Créer un événement'}</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader><CardTitle>Informations de l'événement</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2"><Label htmlFor="title">Titre de l'événement *</Label><Input id="title" placeholder="Ex: Soirée Makossa" required value={formData.title} onChange={handleInputChange} /></div>
                <div className="space-y-2"><Label htmlFor="organisateur">Organisateur *</Label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><Input id="organisateur" placeholder="Nom de l'organisateur ou de l'association" className="pl-10" required value={formData.organisateur} onChange={handleInputChange} /></div></div>
                <div className="space-y-2">
                  <Label htmlFor="type_id">Type d'événement *</Label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <select id="type_id" value={formData.type_id} onChange={handleInputChange} className="pl-10 flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm" required>
                      <option value="" disabled>Sélectionner un type</option>
                      {types.map(type => <option key={type.id} value={type.id}>{type.nom}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="date">Date *</Label><Input id="date" type="date" required value={formData.date} onChange={handleInputChange} /></div>
                  <div className="space-y-2"><Label htmlFor="time">Heure *</Label><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><Input id="time" type="time" className="pl-10" required value={formData.time} onChange={handleInputChange} /></div></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="end_date">Date de fin (optionnel)</Label><Input id="end_date" type="date" value={formData.end_date} onChange={handleInputChange} /></div>
                  <div className="space-y-2"><Label htmlFor="end_time">Heure de fin (optionnel)</Label><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><Input id="end_time" type="time" className="pl-10" value={formData.end_time} onChange={handleInputChange} /></div></div>
                </div>
                {useMemo(() => {
                  const d = formData.date?.trim();
                  const t = formData.time?.trim();
                  const de = formData.end_date?.trim();
                  const te = formData.end_time?.trim();
                  if (!d || !de) return null;
                  try {
                    const start = new Date(`${d}T${t || '00:00'}:00`);
                    const end = new Date(`${de}T${te || '00:00'}:00`);
                    const ms = end - start;
                    if (!Number.isFinite(ms) || ms <= 0) return null;
                    const totalMin = Math.floor(ms / 60000);
                    const days = Math.floor(totalMin / (60 * 24));
                    const hours = Math.floor((totalMin % (60 * 24)) / 60);
                    const mins = totalMin % 60;
                    const parts = [];
                    if (days > 0) parts.push(`${days} j`);
                    if (hours > 0) parts.push(`${hours} h`);
                    if (mins > 0) parts.push(`${mins} min`);
                    const label = parts.length ? parts.join(' ') : 'moins d\'une heure';
                    return (
                      <div className="text-xs text-gray-600 -mt-2">Durée estimée: {label}</div>
                    );
                  } catch (_) { return null; }
                }, [formData.date, formData.time, formData.end_date, formData.end_time])}
                <div className="space-y-2">
                  <Label htmlFor="location">Lieu *</Label>
                  {isLoaded ? (
                    <Autocomplete onLoad={(ref) => (autocompleteRef.current = ref)} onPlaceChanged={onPlaceChanged}>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input id="location" placeholder="Rechercher une adresse..." className="pl-10" required value={formData.location} onChange={handleInputChange} />
                      </div>
                    </Autocomplete>
                  ) : (
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input id="location" placeholder="Saisir l'adresse..." className="pl-10" required value={formData.location} onChange={handleInputChange} />
                    </div>
                  )}
                  {isLoaded ? (
                    <GoogleMap mapContainerStyle={mapContainerStyle} center={coords || defaultCenter} zoom={coords ? 15 : 10}>
                      <>{coords && <Marker position={coords} />}</>
                    </GoogleMap>
                  ) : (
                    loadError ? <div>Erreur de chargement de la carte.</div> : <div className="text-xs text-gray-500 mt-1">Carte indisponible pour le moment.</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Prix</Label>
                    <div className="relative">
                      <Input id="price" type="text" inputMode="decimal" placeholder="Ex: 25" value={formData.price} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="devise_id">Devise *</Label>
                    <div className="relative">
                      <select id="devise_id" value={formData.devise_id} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm" required>
                        <option value="" disabled>Choisir</option>
                        {devises.map(d => <option key={d.id} value={d.id}>{d.nom} ({d.symbole})</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telephone">Téléphone de contact</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input id="telephone" type="tel" title="Veuillez entrer un numéro de téléphone valide au format international (ex: +33612345678)." className="pl-10" value={formData.telephone} onChange={handleInputChange} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Format international suggéré (ex: +33612345678)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email de contact</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input id="email" type="email" className="pl-10" value={formData.email} onChange={handleInputChange} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2"><Label htmlFor="site_web">Site web (billetterie)</Label><div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><Input id="site_web" type="url" placeholder="https://..." className="pl-10" value={formData.site_web} onChange={handleInputChange} /></div></div>
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
                <div className="space-y-2"><Label htmlFor="description">Description *</Label><Textarea id="description" placeholder="Décrivez l'événement..." rows={4} required value={formData.description} onChange={handleInputChange} /></div>
                <Button type="submit" className="w-full bg-[#2BA84A] hover:bg-[#2BA84A]/90" disabled={isUploading}>
                  {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Publication...</> : isEditMode ? 'Modifier l\'événement' : 'Publier l\'événement'}
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

export default CreateEvenement;