import React, { useEffect, useMemo, useRef, useState } from 'react';

const OK_LOGO_URL = 'https://onekamer-media-cdn.b-cdn.net/logo/IMG_0885%202.PNG';

const buildEmbedUrl = (url, { muted = true } = {}) => {
  try {
    const u = new URL(url);
    if (!/iframe\.mediadelivery\.net/.test(u.hostname)) return url;
    // Append autoplay params if not present
    const qp = u.search ? `${u.search}&` : '?';
    const mutedVal = muted ? 'true' : 'false';
    return `${u.origin}${u.pathname}${qp}autoplay=true&muted=${mutedVal}&loop=true`;
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
  // Désactivation de l'embed Bunny : forcer la lecture native CDN
  const useEmbed = false;
  const embedUrl = null;
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    // Reset load state when source changes
    setEmbedLoaded(false);
    setRetry(0);
  }, [embedUrl]);

  useEffect(() => {
    if (!useEmbed || embedLoaded) return;
    let tries = 0;
    const maxTries = 24; // ~2 minutes à 5s l’intervalle
    const iv = setInterval(() => {
      tries += 1;
      setRetry((r) => r + 1);
      if (tries >= maxTries) {
        clearInterval(iv);
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [useEmbed, embedUrl, embedLoaded]);

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

  // Pas de boutons overlay; l'ouverture plein écran se fait au clic global si onOpenLightbox est fourni

  const wrapperClass = `relative ${className} ${fitContain && !useEmbed ? 'aspect-video overflow-hidden bg-black/5' : ''} ${onOpenLightbox ? 'cursor-zoom-in' : ''}`;
  const videoClass = `rounded-lg ${fitContain ? 'w-full h-full object-contain' : 'w-full h-auto'}`;
  const handleWrapperClick = (e) => {
    if (!onOpenLightbox) return;
    e.stopPropagation();
    try { onOpenLightbox(); } catch {}
  };
  const mutedAttr = allowSoundAutoplay ? false : muted;
  return (
    <div className={wrapperClass} onClick={handleWrapperClick}>
      <video
        ref={videoRef}
        src={src}
        controls={controls}
        muted={mutedAttr}
        loop={loop}
        playsInline
        preload="metadata"
        className={videoClass}
      />
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
