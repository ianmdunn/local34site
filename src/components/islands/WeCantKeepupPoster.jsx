/**
 * Worker Profile Campaign poster view: one item at a time, styled like the PDF posters.
 * Props: items from fetchWeCantKeepUpItems().
 * Watches for resize (user or content) so layout can respond.
 */
import { useState, useCallback, useRef, useEffect } from 'react';

/** @typedef {{ id: number | string; name: string; department: string; testimonial: string; profile_image_url: string | null; profile_image_focus_x?: number | null; profile_image_focus_y?: number | null }} PosterItem */

/** @param {{ items?: PosterItem[]; logoUrl?: string }} props */
export default function WeCantKeepupPoster({ items = [], logoUrl }) {
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rootRef = useRef(/** @type {HTMLElement | null} */ (null));

  const item = items[index] ?? null;
  const hasMultiple = items.length > 1;
  const goPrev = useCallback(() => {
    setIndex((i) => {
      const next = i <= 0 ? items.length - 1 : i - 1;
      if (typeof window.__trackEvent === 'function')
        window.__trackEvent('wecantkeepup_poster_nav', { direction: 'prev', index: next });
      return next;
    });
  }, [items.length]);
  const goNext = useCallback(() => {
    setIndex((i) => {
      const next = i >= items.length - 1 ? 0 : i + 1;
      if (typeof window.__trackEvent === 'function')
        window.__trackEvent('wecantkeepup_poster_nav', { direction: 'next', index: next });
      return next;
    });
  }, [items.length]);

  // Watch for resize from user (window) or content (e.g. profile switch) so layout recalculates
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.round(width), height: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!item) {
    return (
      <div className="wecantkeepup-poster wecantkeepup-poster--empty">
        <p className="wecantkeepup-poster__empty-text">
          No worker profiles yet. Add items to the wecantkeepup collection in Directus.
        </p>
      </div>
    );
  }

  return (
    <article
      ref={rootRef}
      className="wecantkeepup-poster wecantkeepup-poster--cover"
      aria-label={`Worker profile: ${item.name}, ${item.department}`}
      aria-live="polite"
      data-container-width={size.width || undefined}
      data-container-height={size.height || undefined}
    >
      <div className="wecantkeepup-poster__cover" aria-hidden="true">
        <div className="wecantkeepup-poster__cover-frame">
          <div className="wecantkeepup-poster__cover-img-wrap">
            <div className="wecantkeepup-poster__cover-img-flow">
              {item.profile_image_url ? (
                <img
                  src={item.profile_image_url}
                  alt={`Portrait of ${item.name}, ${item.department}`}
                  className="wecantkeepup-poster__cover-img"
                  decoding="async"
                  fetchPriority="high"
                  style={
                    item.profile_image_focus_x != null && item.profile_image_focus_y != null
                      ? {
                          objectPosition: `${item.profile_image_focus_x * 100}% ${item.profile_image_focus_y * 100}%`,
                        }
                      : undefined
                  }
                />
              ) : null}
            </div>
          </div>
          {/* Text overlay (poster-content-overlay): content text + nav after */}
          <div className="wecantkeepup-poster__frame-overlay">
            <div className="wecantkeepup-poster__overlay-content">
              <h2 className="wecantkeepup-poster__name">{item.name}</h2>
              <p className="wecantkeepup-poster__department">{item.department}</p>
              <div className="wecantkeepup-poster__testimonial-wrap">
                {logoUrl && <div className="wecantkeepup-poster__logo-shape" aria-hidden="true" />}
                {item.testimonial ? (
                  <blockquote className="wecantkeepup-poster__testimonial">&ldquo;{item.testimonial}&rdquo;</blockquote>
                ) : null}
              </div>
              {(hasMultiple || logoUrl) && (
                <div className="wecantkeepup-poster__bottom-bar">
                  {hasMultiple ? (
                    <nav className="wecantkeepup-poster__nav" aria-label="Switch worker profile">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="wecantkeepup-poster__btn wecantkeepup-poster__btn--prev"
                        aria-label="Previous profile"
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        className="wecantkeepup-poster__btn wecantkeepup-poster__btn--next"
                        aria-label="Next profile"
                      >
                        Next →
                      </button>
                    </nav>
                  ) : null}
                  {logoUrl && (
                    <img src={logoUrl} alt="" className="wecantkeepup-poster__logo-overlay" aria-hidden="true" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
