import { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import YaleWealthProjectedReturns from './YaleWealthProjectedReturns.jsx';
import EndowmentAssumptionsInfo from './EndowmentAssumptionsInfo.jsx';

export default function YaleWealthBillboard() {
  const [counterMeta, setCounterMeta] = useState('Since June 30, 2025 • As of: —');
  const contentRef = useRef(null);
  const titleRef = useRef(null);
  const numberRef = useRef(null);
  const descRef = useRef(null);
  const counterRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      const duration = prefersReducedMotion ? 0.01 : 0.7;
      const delay = prefersReducedMotion ? 0 : 0.15;

      gsap.from(titleRef.current, {
        opacity: 0,
        y: 24,
        duration,
        ease: 'power3.out',
      });
      gsap.from(numberRef.current, {
        opacity: 0,
        scale: 0.92,
        duration: prefersReducedMotion ? 0.01 : 1,
        delay: delay * 1,
        ease: 'power3.out',
      });
      gsap.from(descRef.current, {
        opacity: 0,
        y: 16,
        duration,
        delay: delay * 2,
        ease: 'power3.out',
      });
      gsap.from(counterRef.current, {
        opacity: 0,
        y: 20,
        duration,
        delay: delay * 3,
        ease: 'power3.out',
      });
      gsap.from(sourceRef.current, {
        opacity: 0,
        duration: duration * 0.8,
        delay: delay * 4,
        ease: 'power2.out',
      });
    }, contentRef);

    return () => ctx.revert();
  }, []);

  return (
    <article ref={contentRef} className="yale-wealth-billboard__content" aria-live="polite">
      <div ref={titleRef} className="yale-wealth-billboard__title-group">
        <div className="yale-wealth-billboard__title-row">
          <h2 className="yale-wealth-billboard__title">The Yale Endowment</h2>
          <a
            ref={sourceRef}
            href="https://news.yale.edu/2025/10/24/yale-reports-investment-return-fiscal-2025"
            target="_blank"
            rel="noopener"
            className="yale-wealth-billboard__source"
            aria-label="Source: Yale News FY2025 Report"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
        <p ref={descRef} className="yale-wealth-billboard__desc">
          As of June 30, 2025
        </p>
      </div>
      <p className="yale-wealth-billboard__value" aria-label="44 billion 100 million dollars">
        <span ref={numberRef} className="yale-wealth-billboard__number">
          <span className="yale-wealth-billboard__number-prefix">$</span>
          <span className="yale-wealth-billboard__number-value">44,100,000,000</span>
        </span>
      </p>
      <div ref={counterRef} className="yale-wealth-billboard__counter">
        <div className="yale-wealth-billboard__counter-title-group">
          <div className="yale-wealth-billboard__counter-title-row">
            <h3 className="yale-wealth-billboard__counter-title">Yale's Projected Returns</h3>
            <EndowmentAssumptionsInfo />
          </div>
          <div className="yale-wealth-billboard__counter-meta" suppressHydrationWarning>
            {counterMeta}
          </div>
        </div>
        <YaleWealthProjectedReturns onMetaChange={setCounterMeta} />
      </div>
    </article>
  );
}
