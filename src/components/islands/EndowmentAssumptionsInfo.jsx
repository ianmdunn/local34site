import { useState, useRef, useEffect } from 'react';

/**
 * Info button + popup for endowment assumptions. Placed next to "Yale's Projected Returns".
 */
export default function EndowmentAssumptionsInfo() {
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!showPopup) return;
    const handler = (e) => {
      if (popupRef.current?.contains(e.target) || containerRef.current?.contains(e.target)) {
        return;
      }
      setShowPopup(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showPopup]);

  return (
    <div className="yale-wealth-assumptions" ref={containerRef}>
      <button
        type="button"
        className="yale-wealth-assumptions__info"
        onClick={(e) => {
          e.stopPropagation();
          setShowPopup((v) => !v);
        }}
        aria-expanded={showPopup}
        aria-haspopup="dialog"
        aria-label="Explain real vs nominal return"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      </button>
      {showPopup && (
        <div
          ref={popupRef}
          className="yale-wealth-assumptions__popup"
          role="dialog"
          aria-label="About projected returns"
        >
          <p className="yale-wealth-assumptions__popup-text">
            This is Yale&apos;s endowment growing in real time—roughly $10 million a day. Yale says it needs this rate
            of return just to stand still. When Yale claims it can&apos;t afford a fair contract, remember: the 8% tax
            touches only a sliver of these gains. The rest is untaxed.
          </p>
          <button
            type="button"
            className="yale-wealth-assumptions__popup-close"
            onClick={() => setShowPopup(false)}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
