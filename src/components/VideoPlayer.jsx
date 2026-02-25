import React, { useEffect, useMemo, useRef, useState } from 'react';

const OK_LOGO_URL = 'https://onekamer-media-cdn.b-cdn.net/logo/IMG_0885%202.PNG';

const buildEmbedUrl = (url) => {
  try {
    const u = new URL(url);
    if (!/iframe\.mediadelivery\.net/.test(u.hostname)) return url;
    // Append autoplay params if not present
    const qp = u.search ? `${u.search}&` : '?';
    return `${u.origin}${u.pathname}${qp}autoplay=true&muted=true&loop=true&preload=metadata`;
  } catch {
    return url;
  }
};

const isBunnyEmbed = (url) => /https?:\/\/iframe\.mediadelivery\.net\/embed\//i.test(String(url || ''));

const VideoPlayer = ({
  src,
  className = '',
  autoPlayOnView = true,
  loop = true,
  controls = true,
  muted = true,
  fitContain = false,
  allowSoundAutoplay = false,
  onOpenLightbox = null,
}) => {
  const videoRef = useRef(null);
  const useEmbed = useMemo(() => isBunnyEmbed(src), [src]);
  const embedUrl = useMemo(() => (useEmbed ? buildEmbedUrl(src) : null), [useEmbed, src]);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (!autoPlayOnView || useEmbed) return;
    const el = videoRef.current;
    if (!el) return;

    let wasVisible = false;
    const onIntersect = (entries) => {
      const entry = entries[0];
      const nowVisible = entry && entry.isIntersecting && entry.intersectionRatio >= 0.5;
      if (nowVisible && !wasVisible) {
        if (allowSoundAutoplay) {
          el.muted = false;
          el.play().catch(() => {
            // Autoplay avec son bloqué: fallback muet
            el.muted = true;
            try { el.play(); } catch {}
          });
        } else {
          el.muted = true; // autoplay muet par défaut
          el.play().catch(() => {});
        }
      } else if (!nowVisible && wasVisible) {
        try { el.pause(); } catch {}
      }
      wasVisible = nowVisible;
    };

    const io = new IntersectionObserver(onIntersect, { threshold: [0.5] });
    io.observe(el);
    return () => {
      try { io.disconnect(); } catch {}
    };
  }, [autoPlayOnView, useEmbed, allowSoundAutoplay]);

  // Suivre l'état muet pour afficher un bouton overlay
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onVol = () => setIsMuted(el.muted || el.volume === 0);
    el.addEventListener('volumechange', onVol);
    onVol();
    return () => {
      try { el.removeEventListener('volumechange', onVol); } catch {}
    };
  }, [videoRef.current]);

  const wrapperClass = `relative ${className} ${fitContain ? 'aspect-video overflow-hidden bg-black/5' : ''}`;
  const videoClass = `rounded-lg ${fitContain ? 'w-full h-full object-contain' : 'w-full h-auto'}`;
  return (
    <div className={wrapperClass}>
      {useEmbed ? (
        <iframe
          src={embedUrl}
          title="video"
          loading="lazy"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className={`w-full h-full rounded-lg`}
          style={{ border: '0' }}
        />
      ) : (
        <video
          ref={videoRef}
          src={src}
          controls={controls}
          muted={muted}
          loop={loop}
          playsInline
          preload="metadata"
          className={videoClass}
        />
      )}
      {onOpenLightbox ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); try { onOpenLightbox(); } catch (_) {} }}
          className="absolute top-2 right-2 z-10 text-xs px-2 py-1 rounded bg-black/60 text-white"
        >
          Plein écran
        </button>
      ) : null}
      {!useEmbed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const el = videoRef.current;
            if (!el) return;
            el.muted = !el.muted;
            if (!el.muted && el.paused) {
              el.play().catch(() => {});
            }
          }}
          className="absolute bottom-2 left-2 z-10 text-xs px-2 py-1 rounded bg-black/60 text-white"
        >
          {isMuted ? 'Activer le son' : 'Couper le son'}
        </button>
      )}
      {/* Watermark OneKamer (overlay non bloquant) */}
      <img
        src={OK_LOGO_URL}
        alt=""
        className="pointer-events-none select-none opacity-80 absolute bottom-2 right-2 w-12 h-auto"
      />
    </div>
  );
};

export default VideoPlayer;
