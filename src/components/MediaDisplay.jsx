import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ImageOff } from 'lucide-react';
import { normalizeMediaUrl } from '@/utils/normalizeMediaUrl';

 const MEDIA_CACHE_TTL_MS = 5 * 60 * 1000;
 const mediaCache = new Map();

 const getCacheKey = (bucket, path) => {
   if (!bucket || !path) return null;
   if (typeof path !== 'string') return `${bucket}|${String(path)}`;
 
   if (/^https?:\/\//i.test(path)) {
     try {
       const u = new URL(normalizeMediaUrl(path));
       // Ancienne URL signée Supabase : on ignore le token et on se base sur bkt+chemin
       if (/\/storage\/v1\/object\/sign\//.test(u.pathname)) {
         const signedPath = u.pathname.replace(/\/storage\/v1\/object\/sign\//, '');
         const [bkt, ...restParts] = signedPath.split('/');
         const rel = restParts.join('/');
         return `signed|${bkt}|${rel}`;
       }
       // Pour les URLs externes/CDN, ignorer la querystring (cache stable)
       return `url|${u.origin}${u.pathname}`;
     } catch {
       return `${bucket}|${path}`;
     }
   }

   let p = path.replace(/^\/+/, '');
   if (bucket && p.startsWith(`${bucket}/${bucket}/`)) {
     p = p.replace(new RegExp(`^${bucket}/`), '');
   }
   if (bucket && p.startsWith(`${bucket}/`)) {
     p = p.slice(bucket.length + 1);
   }
   return `sb|${bucket}|${p}`;
 };

const defaultImages = {
  // Fallback générique: on réutilise une image Bunny déjà connue
  annonces: 'https://onekamer-media-cdn.b-cdn.net/misc/Photo%20D%C3%A9faut%20Rencontre.jpg',
  evenements: 'https://onekamer-media-cdn.b-cdn.net/misc/Photo%20D%C3%A9faut%20Rencontre.jpg',
  partenaires: 'https://onekamer-media-cdn.b-cdn.net/misc/Photo%20D%C3%A9faut%20Rencontre.jpg',
  faits_divers: 'https://onekamer-media-cdn.b-cdn.net/misc/Photo%20D%C3%A9faut%20Rencontre.jpg',
  groupes: 'https://onekamer-media-cdn.b-cdn.net/misc/Photo%20D%C3%A9faut%20Groupe.jpg',
  rencontres: 'https://onekamer-media-cdn.b-cdn.net/misc/Photo%20D%C3%A9faut%20Rencontre.jpg',
};

const MediaDisplay = ({ bucket, path, alt, className }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(false);
  const [backupUrl, setBackupUrl] = useState(null);

  useEffect(() => {
    const loadMedia = async () => {
      const cacheKey = getCacheKey(bucket, path);
      if (cacheKey) {
        const hit = mediaCache.get(cacheKey);
        if (hit && Date.now() - hit.ts < MEDIA_CACHE_TTL_MS) {
          setBackupUrl(null);
          setErrorState(false);
          setMediaUrl(hit.mediaUrl);
          setMediaType(hit.mediaType);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setErrorState(false);

      if (!path) {
        setMediaUrl(defaultImages[bucket] || null);
        setLoading(false);
        return;
      }

      // Si un path interne ressemble à un "default_*" (ex: default_faits_divers), évite toute requête
      if (!/^https?:\/\//i.test(path) && /default_faits_divers/i.test(path)) {
        setMediaUrl(defaultImages[bucket] || null);
        setMediaType('image');
        setLoading(false);
        return;
      }

      // URL externe/CDN
      if (path.startsWith('http')) {
        const normalized = normalizeMediaUrl(path);
        try {
          const u = new URL(normalized);
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
            setMediaUrl(defaultImages[bucket] || null);
            setMediaType('image');
            setLoading(false);
            return;
          }
          // Ancienne URL signée Supabase → régénérer une signature
          if (/\/storage\/v1\/object\/sign\//.test(u.pathname)) {
            const signedPath = u.pathname.replace(/\/storage\/v1\/object\/sign\//, '');
            const [bkt, ...restParts] = signedPath.split('/');
            let rel = restParts.join('/');
            if (rel.startsWith(`${bkt}/`)) {
              rel = rel.slice(bkt.length + 1);
            }
            try {
              const { data, error } = await supabase.storage.from(bkt).createSignedUrl(rel, 3600);
              if (!error && data?.signedUrl) {
                setMediaUrl(data.signedUrl);
                const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(rel);
                setMediaType(isVideo ? 'video' : 'image');
                const cacheKey = getCacheKey(bucket, path);
                if (cacheKey) {
                  mediaCache.set(cacheKey, { mediaUrl: data.signedUrl, mediaType: isVideo ? 'video' : 'image', ts: Date.now() });
                }
                setLoading(false);
                return;
              }

              const cdnUrl = `https://onekamer-media-cdn.b-cdn.net/${bkt}/${rel}`;
              setMediaUrl(cdnUrl);
              const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(rel);
              setMediaType(isVideo ? 'video' : 'image');
              const cacheKey = getCacheKey(bucket, path);
              if (cacheKey) {
                mediaCache.set(cacheKey, { mediaUrl: cdnUrl, mediaType: isVideo ? 'video' : 'image', ts: Date.now() });
              }
              setLoading(false);
              return;
            } catch (e) {
              const cdnUrl = `https://onekamer-media-cdn.b-cdn.net/${bkt}/${rel}`;
              setMediaUrl(cdnUrl);
              const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(rel);
              setMediaType(isVideo ? 'video' : 'image');
              const cacheKey = getCacheKey(bucket, path);
              if (cacheKey) {
                mediaCache.set(cacheKey, { mediaUrl: cdnUrl, mediaType: isVideo ? 'video' : 'image', ts: Date.now() });
              }
              setLoading(false);
              return;
            }
          }
        } catch {}
        setBackupUrl(null);
        setMediaUrl(normalized);
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(normalized);
        setMediaType(isVideo ? 'video' : 'image');
        {
          const cacheKey = getCacheKey(bucket, path);
          if (cacheKey) {
            mediaCache.set(cacheKey, { mediaUrl: normalized, mediaType: isVideo ? 'video' : 'image', ts: Date.now() });
          }
        }
        setLoading(false);
        return;
      }

      // Sinon: path Supabase (normalisation du chemin)
      try {
        let p = path || '';
        p = p.replace(/^\/+/, '');
        if (bucket && p.startsWith(`${bucket}/${bucket}/`)) {
          p = p.replace(new RegExp(`^${bucket}/`), '');
        }
        if (bucket && p.startsWith(`${bucket}/`)) {
          p = p.slice(bucket.length + 1);
        }
        // Tentative 1: chemin normalisé
        let signPath = p;
        let signed = null;
        try {
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(signPath, 3600);
          if (!error && data?.signedUrl) signed = data.signedUrl;
        } catch {}

        // Tentative 2 (fallback legacy "rencontres/<p>") si le fichier a été stocké sous un sous-dossier supplémentaire
        if (!signed && bucket === 'rencontres') {
          const alt = signPath.startsWith('rencontres/') ? signPath : `rencontres/${signPath}`;
          try {
            const { data, error } = await supabase.storage.from(bucket).createSignedUrl(alt, 3600);
            if (!error && data?.signedUrl) {
              signed = data.signedUrl;
              signPath = alt;
            }
          } catch {}
        }

        if (!signed) throw new Error('sign_failed');
        setBackupUrl(null);
        setMediaUrl(signed);
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(signPath);
        setMediaType(isVideo ? 'video' : 'image');
        {
          const cacheKey = getCacheKey(bucket, path);
          if (cacheKey) {
            mediaCache.set(cacheKey, { mediaUrl: signed, mediaType: isVideo ? 'video' : 'image', ts: Date.now() });
          }
        }
      } catch (err) {
        console.warn('⚠️ Erreur media Supabase:', err?.message || err);
        // Fallback BunnyCDN si possible
        if (bucket) {
          let rel = (path || '').replace(/^\/+/, '');
          if (rel.startsWith(`${bucket}/`)) {
            rel = rel.slice(bucket.length + 1);
          }
          // Fallback supplémentaire: si objet réellement sous 'rencontres/<rel>', réessayer CDN avec ce préfixe
          let cdnRel = rel;
          if (bucket === 'rencontres' && !/^(rencontres\/)/.test(rel)) {
            cdnRel = `rencontres/${rel}`;
          }
          if (cdnRel) {
            const cdnUrl = `https://onekamer-media-cdn.b-cdn.net/${bucket}/${cdnRel}`.replace(/(?<!:)\/\/+/, '/');
            setMediaUrl(cdnUrl);
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(cdnRel);
            setMediaType(isVideo ? 'video' : 'image');
            setErrorState(false);
            {
              const cacheKey = getCacheKey(bucket, path);
              if (cacheKey) {
                mediaCache.set(cacheKey, { mediaUrl: cdnUrl, mediaType: isVideo ? 'video' : 'image', ts: Date.now() });
              }
            }
          } else {
            setMediaUrl(defaultImages[bucket] || null);
            setErrorState(false);
          }
        } else {
          setMediaUrl(null);
          setErrorState(true);
        }
      } finally {
        setLoading(false);
      }
    };

    loadMedia();
  }, [bucket, path]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (errorState || !mediaUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-200 ${className}`}>
        <ImageOff className="h-8 w-8 text-gray-500" />
        <p className="text-xs text-gray-500 mt-1">Média indisponible</p>
      </div>
    );
  }

  if (mediaType === 'video') {
    return <video src={mediaUrl} controls className={className} playsInline />;
  }

  return (
    <img
      src={mediaUrl}
      alt={alt || 'Image'}
      className={className}
      onError={(e) => {
        console.warn('⚠️ Erreur de chargement image → tentative backup ou fallback');
        if (backupUrl) {
          const next = backupUrl;
          setBackupUrl(null);
          e.target.src = next;
          return;
        }
        e.target.onerror = null;
        e.target.src = defaultImages[bucket] || defaultImages.annonces;
      }}
    />
  );
};

export default MediaDisplay;