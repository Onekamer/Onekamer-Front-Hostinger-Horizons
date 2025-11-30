import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ImageOff } from 'lucide-react';
import { normalizeMediaUrl } from '@/utils/normalizeMediaUrl';

const defaultImages = {
  annonces: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/deafb02734097cfca203ab9aad10f6ba.png',
  evenements: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/e3c7a83af237fb7227a561adbdc2fb56.png',
  partenaires: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/fbbe30b8a750bf10ddf4da2c7de7bfd3.png',
  groupes: 'https://onekamer-media-cdn.b-cdn.net/misc/Photo%20D%C3%A9faut%20Groupe.jpg',
  faits_divers: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/3426b67577181940ee97b83de9829d6d.png',
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
                setLoading(false);
                return;
              }
            } catch (e) {
              const cdnUrl = `https://onekamer-media-cdn.b-cdn.net/${bkt}/${rel}`;
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
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(normalized);
        setMediaType(isVideo ? 'video' : 'image');
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