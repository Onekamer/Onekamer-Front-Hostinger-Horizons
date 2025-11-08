import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ImageOff } from 'lucide-react';

const defaultImages = {
  annonces: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/deafb02734097cfca203ab9aad10f6ba.png',
  evenements: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/e3c7a83af237fb7227a561adbdc2fb56.png',
  partenaires: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/fbbe30b8a750bf10ddf4da2c7de7bfd3.png',
  groupes: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/0d1b14eb0b6bbb002d83d44342b4afd2.png',
  faits_divers: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/3426b67577181940ee97b83de9829d6d.png',
  rencontres: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/deafb02734097cfca203ab9aad10f6ba.png',
};

const MediaDisplay = ({ bucket, path, alt, className }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mediaType, setMediaType] = useState(null);
  const [errorState, setErrorState] = useState(false);
  const [backupUrl, setBackupUrl] = useState(null); // legacy single-backup usage (kept for compatibility)
  const [cdnCandidates, setCdnCandidates] = useState([]);
  const [cdnIndex, setCdnIndex] = useState(0);

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      setErrorState(false);
      setMediaUrl(null);
      setCdnCandidates([]);
      setCdnIndex(0);

      if (!path) {
        setMediaUrl(defaultImages[bucket] || null);
        setMediaType('image');
        setLoading(false);
        if (!defaultImages[bucket]) {
          setErrorState(true);
        }
        return;
      }
      
      if (path.startsWith('http') || path.startsWith('blob:')) {
        const normalized = (() => {
          if (path.startsWith('blob:')) return path;
          // minimal normalization: enforce https and collapse duplicate slashes
          let u = path.replace(/^http:\/\//i, 'https://');
          u = u.replace(/(?<!:)\/\/+/, '/');
          return u;
        })();
        try {
          const u = new URL(normalized);
          // legacy Supabase signed URL -> regenerate fresh signed URL
          if (/\/storage\/v1\/object\/sign\//.test(u.pathname)) {
            const signedPath = u.pathname.replace(/\/storage\/v1\/object\/sign\//, '');
            const [bkt, ...restParts] = signedPath.split('/');
            let rel = restParts.join('/');
            if (rel.startsWith(`${bkt}/`)) rel = rel.slice(bkt.length + 1);
            try {
              const { data, error } = await supabase.storage.from(bkt).createSignedUrl(rel, 3600);
              if (!error && data?.signedUrl) {
                setMediaUrl(data.signedUrl);
                const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(rel);
                setMediaType(isVideo ? 'video' : 'image');
                setLoading(false);
                return;
              }
            } catch (e) {
              // fallback to CDN if regeneration fails
              const cdnPath = rel.startsWith(`${bkt}/`) ? rel : `${bkt}/${rel}`;
              const cdnUrl = `https://onekamer-media-cdn.b-cdn.net/${cdnPath}`.replace(/(?<!:)\/\/+/, '/');
              console.log('🛰️ CDN (legacy-signed fallback) →', cdnUrl);
              setMediaUrl(cdnUrl);
              const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(rel);
              setMediaType(isVideo ? 'video' : 'image');
              setLoading(false);
              return;
            }
          }
        } catch {}
        setBackupUrl(null);
        setMediaUrl(normalized);
        const isVideo = normalized.startsWith('blob:video') || /\.(mp4|webm|ogg|mov)$/i.test(normalized);
        setMediaType(isVideo ? 'video' : 'image');
        setLoading(false);
        return;
      }

      try {
        // Normalisation du chemin interne
        let p = (path || '').replace(/^\/+/, '');
        if (bucket && p.startsWith(`${bucket}/${bucket}/`)) {
          p = p.replace(new RegExp(`^${bucket}/`), '');
        }
        if (bucket && p.startsWith(`${bucket}/`)) {
          p = p.slice(bucket.length + 1);
        }

        // Pour 'rencontres', tenter Supabase signé d'abord (couverture des anciens profils encore en storage)
        if (bucket === 'rencontres') {
          try {
            const { data, error } = await supabase.storage.from(bucket).createSignedUrl(p, 3600);
            if (!error && data?.signedUrl) {
              setBackupUrl(null);
              setCdnCandidates([]);
              setCdnIndex(0);
              setMediaUrl(data.signedUrl);
              const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(p);
              setMediaType(isVideo ? 'video' : 'image');
              setLoading(false);
              return;
            }
            console.warn('ℹ️ Supabase signé indisponible pour rencontres, on tente CDN');
          } catch (e) {
            console.warn('ℹ️ Supabase createSignedUrl a échoué, on tente CDN', e?.message || e);
          }
          const candidates = [
            `https://onekamer-media-cdn.b-cdn.net/${bucket}/${p}`,
            `https://onekamer-media-cdn.b-cdn.net/${p}`,
            `https://onekamer-media-cdn.b-cdn.net/${bucket}/${bucket}/${p}`,
          ].map(u => u.replace(/(?<!:)\/\/+/, '/'));
          console.log('🛰️ CDN (prioritaire) rencontres → candidates', candidates);
          setCdnCandidates(candidates);
          setCdnIndex(0);
          setMediaUrl(candidates[0]);
          const isVideoCdn = /\.(mp4|webm|ogg|mov)$/i.test(p);
          setMediaType(isVideoCdn ? 'video' : 'image');
          setLoading(false);
          return;
        }

        // Autres buckets → URL signée Supabase
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(p, 3600);
        if (error) throw error;
        setBackupUrl(null);
        setMediaUrl(data.signedUrl);
        const fileExt = (p.split('.').pop() || '').toLowerCase();
        setMediaType(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(fileExt) ? 'video' : 'image');
      } catch (error) {
        console.error(`Error fetching media for path "${path}" in bucket "${bucket}":`, error.message);
        // Fallback générique vers CDN si possible
        if (bucket) {
          let rel = (path || '').replace(/^\/+/, '');
          if (rel.startsWith(`${bucket}/`)) rel = rel.slice(bucket.length + 1);
          if (rel) {
            const candidates = [
              `https://onekamer-media-cdn.b-cdn.net/${bucket}/${rel}`,
              `https://onekamer-media-cdn.b-cdn.net/${rel}`,
              `https://onekamer-media-cdn.b-cdn.net/${bucket}/${bucket}/${rel}`,
            ].map(u => u.replace(/(?<!:)\/\/+/, '/'));
            console.log('🛰️ CDN (fallback) → candidates', candidates);
            setCdnCandidates(candidates);
            setCdnIndex(0);
            setMediaUrl(candidates[0]);
            setMediaType(/\.(mp4|webm|ogg|mov)$/i.test(rel) ? 'video' : 'image');
          } else {
            setMediaUrl(defaultImages[bucket] || null);
            setMediaType('image');
          }
        } else {
          setMediaUrl(defaultImages[bucket] || null);
          setMediaType('image');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [path, bucket]);

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
      alt={alt}
      className={className}
      onError={(e) => {
        const failed = e.currentTarget.currentSrc || e.currentTarget.src;
        console.warn('⚠️ Image load failed →', failed);
        // rotate through cdnCandidates if any remain
        if (cdnCandidates.length && cdnIndex < cdnCandidates.length - 1) {
          const nextIndex = cdnIndex + 1;
          const nextUrl = cdnCandidates[nextIndex];
          console.log('🔁 Trying next CDN candidate →', nextUrl);
          setCdnIndex(nextIndex);
          e.currentTarget.src = nextUrl;
          return;
        }
        // legacy single backup usage
        if (backupUrl) {
          const next = backupUrl;
          setBackupUrl(null);
          console.log('🔁 Trying legacy backupUrl →', next);
          e.currentTarget.src = next;
          return;
        }
        e.currentTarget.onerror = null;
        e.currentTarget.src = defaultImages[bucket] || defaultImages.rencontres;
      }}
    />
  );
};

export default MediaDisplay;