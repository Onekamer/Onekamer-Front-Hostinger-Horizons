import React, { useEffect, useMemo, useRef } from 'react';

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
}) => {
  const videoRef = useRef(null);
  const useEmbed = useMemo(() => isBunnyEmbed(src), [src]);
  const embedUrl = useMemo(() => (useEmbed ? buildEmbedUrl(src) : null), [useEmbed, src]);

  useEffect(() => {
    if (!autoPlayOnView || useEmbed) return;
    const el = videoRef.current;
    if (!el) return;

    let wasVisible = false;
    const onIntersect = (entries) => {
      const entry = entries[0];
      const nowVisible = entry && entry.isIntersecting && entry.intersectionRatio >= 0.5;
      if (nowVisible && !wasVisible) {
        el.muted = true; // ensure autoplay works on mobile
        el.play().catch(() => {});
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
  }, [autoPlayOnView, useEmbed]);

  return (
    <div className={`relative ${className}`}>
      {useEmbed ? (
        <iframe
          src={embedUrl}
          title="video"
          loading="lazy"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          className="w-full h-full rounded-lg"
          style={{ aspectRatio: '16 / 9', border: '0' }}
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
          className="w-full h-auto rounded-lg"
        />
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
