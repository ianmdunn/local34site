import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const INTERVAL_MS = 5000;
const FADE_MS = 600;

interface Props {
  imageUrls?: string[];
}

/**
 * Full-viewport background (img + overlay + vignette). Portals to document.body
 * so it escapes View Transitions / transform ancestors and truly covers the viewport.
 */
export default function BackgroundCycler({ imageUrls = [] }: Props) {
  const n = imageUrls.length;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (n <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % n);
        setVisible(true);
      }, FADE_MS);
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [n]);

  const url = imageUrls.length > 0 ? imageUrls[index % n] : null;
  const content = (
    <div className="timer-page__bg-wrap" aria-hidden="true">
      {url && (
        <div className="timer-page__bg-cycle">
          <img
            src={url}
            alt=""
            className={`timer-page__bg-layer ${visible ? 'is-visible' : ''}`}
            loading="eager"
            decoding="async"
          />
        </div>
      )}
      <div className="timer-page__overlay" />
      <div className="timer-page__vignette" />
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body) as unknown as React.ReactNode;
  }

  return content;
}
