import React, { useState, useEffect } from 'react';
import { getAccumulatedGrowth } from '~/lib/yaleWealthGrowth';

function formatGrowth(value) {
  const n = Math.max(0, Math.floor(value));
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatAsOf(date) {
  const dateStr = date.toLocaleDateString('en-US', { dateStyle: 'medium' });
  const h24 = date.getHours();
  const h12 = h24 % 12 || 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const m = date.getMinutes();
  const s = date.getSeconds();
  const tenths = Math.floor(date.getMilliseconds() / 100);
  const timeStr = `${h12}:${pad2(m)}:${pad2(s)}.${tenths} ${ampm}`;
  return `${dateStr}, ${timeStr}`;
}

/** Placeholder shown during SSR and first client paint so server and client match (avoids hydration error). */
const PLACEHOLDER_VALUE = '$0';
const PLACEHOLDER_AS_OF = '—';

export default function YaleWealthProjectedReturns({ children }) {
  const [mounted, setMounted] = useState(false);
  const [value, setValue] = useState(0);
  const [asOf, setAsOf] = useState(PLACEHOLDER_AS_OF);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const tick = () => {
      setValue(getAccumulatedGrowth());
      setAsOf(formatAsOf(new Date()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mounted]);

  const showLive = typeof window !== 'undefined' && mounted;
  return (
    <div className="yale-wealth-billboard__counter-block" aria-live="polite">
      <div className="yale-wealth-endowment-card__value">
        <span className="yale-wealth-ticker">
          <span className="yale-wealth-ticker__value" suppressHydrationWarning>
            {showLive ? formatGrowth(value) : PLACEHOLDER_VALUE}
          </span>
        </span>
      </div>
      <div className="yale-wealth-billboard__counter-meta">{children}</div>
      <div className="yale-wealth-billboard__counter-meta" suppressHydrationWarning>
        As of: {showLive ? asOf : PLACEHOLDER_AS_OF}
      </div>
    </div>
  );
}
