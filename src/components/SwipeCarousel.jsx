import React, { useEffect, useMemo, useRef, useState } from 'react';

// Carrousel léger en CSS scroll-snap + dots tricolores
// - images: string[] (URLs absolues/CDN)
// - zoomable: boolean (tap-to-zoom sur image)
// - className: classes container externes (taille, arrondis, etc.)
// - imgClassName: classes appliquées aux <img>

const DOT_COLORS = [
  'rgba(43,168,74,0.9)',   // vert #2BA84A, 90%
  'rgba(224,34,42,0.9)',   // rouge #E0222A, 90%
  'rgba(245,195,0,0.9)',   // jaune #F5C300, 90%
];

const SwipeCarousel = ({ images = [], zoomable = true, className = '', imgClassName = '' }) => {
  const containerRef = useRef(null);
  const [active, setActive] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const overlayRef = useRef(null);
  const [overlayActive, setOverlayActive] = useState(0);

  const safeImages = useMemo(
    () => (Array.isArray(images) ? images.filter(Boolean) : []),
    [images]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      try {
        const w = el.clientWidth || 1;
        const i = Math.round(el.scrollLeft / w);
        setActive(Math.max(0, Math.min(safeImages.length - 1, i)));
      } catch (_) {}
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [safeImages.length]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el || lightboxIndex == null) return;
    const w = el.clientWidth || 1;
    el.scrollTo({ left: lightboxIndex * w, behavior: 'auto' });
    setOverlayActive(lightboxIndex);
  }, [lightboxIndex]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const onScroll = () => {
      try {
        const w = el.clientWidth || 1;
        const i = Math.round(el.scrollLeft / w);
        setOverlayActive(Math.max(0, Math.min(safeImages.length - 1, i)));
      } catch (_) {}
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [safeImages.length, lightboxIndex]);

  const scrollToIndex = (i) => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    el.scrollTo({ left: i * w, behavior: 'smooth' });
  };

  if (!safeImages.length) return null;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {safeImages.map((src, idx) => (
          <div key={idx} className="flex-none w-full snap-center">
            <img
              src={src}
              alt={`media-${idx + 1}`}
              className={`w-full bg-black/5 select-none ${zoomable ? 'cursor-zoom-in' : ''} ${imgClassName}`}
              draggable={false}
              onClick={() => {
                if (zoomable) setLightboxIndex(idx);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                return false;
              }}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://onekamer-media-cdn.b-cdn.net/posts/default_post_image.png';
              }}
            />
          </div>
        ))}
      </div>

      {safeImages.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2">
          {safeImages.map((_, i) => {
            const color = DOT_COLORS[i % DOT_COLORS.length];
            const isActive = i === active;
            return (
              <button
                key={i}
                type="button"
                onClick={() => scrollToIndex(i)}
                className={`rounded-full transition-all ${isActive ? 'w-3 h-3' : 'w-2.5 h-2.5'}`}
                style={{ backgroundColor: color }}
                aria-label={`Aller à l'image ${i + 1}`}
              />
            );
          })}
        </div>
      )}

      {zoomable && lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="w-full h-full">
            <div
              ref={overlayRef}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar w-full h-full"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {safeImages.map((src, idx) => (
                <div key={`lb-${idx}`} className="flex-none w-full h-full snap-center">
                  <img
                    src={src}
                    alt={`media-zoom-${idx + 1}`}
                    className="w-full h-full object-contain select-none"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
            {safeImages.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
                {safeImages.map((_, i) => {
                  const color = DOT_COLORS[i % DOT_COLORS.length];
                  const isActive = i === overlayActive;
                  return (
                    <button
                      key={`lbd-${i}`}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); const el = overlayRef.current; if (!el) return; const w = el.clientWidth || 1; el.scrollTo({ left: i * w, behavior: 'smooth' }); setOverlayActive(i); }}
                      className={`rounded-full transition-all ${isActive ? 'w-3 h-3' : 'w-2.5 h-2.5'}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Aller à l'image ${i + 1}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SwipeCarousel;
