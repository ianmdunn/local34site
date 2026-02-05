import React, { useState, useMemo, useRef, useEffect } from 'react';

/**
 * Our Inflation Penalty – starting wages vs. CPI-W since 2021.
 * Penalty = (2021 starting wage × (1 + CPI-W growth since 2021) − current starting wage) × 1,950 hours.
 * Sources: BLS CPI-W; Local 34 Wage Structure (2021 and 2026 minimums).
 */

/** Local 34 minimum hourly rates by grade, effective 1/18/2026 (Wage Structure) */
const LOCAL_34_PAY_GRADES = [
  { grade: 'A', label: 'Grade A', rate: 22.58 },
  { grade: 'B', label: 'Grade B', rate: 25.41 },
  { grade: 'C', label: 'Grade C', rate: 28.43 },
  { grade: 'D', label: 'Grade D', rate: 31.83 },
  { grade: 'E', label: 'Grade E', rate: 35.64 },
];

/** Starting wage (hourly) by grade as of 2021 – update from Local 34 wage history / Wage Structure. */
const STARTING_WAGE_2021_BY_GRADE = {
  A: 20.52,
  B: 23.1,
  C: 25.85,
  D: 28.94,
  E: 32.4,
};

/** CPI-W cumulative growth from 2021 to present (e.g. 0.18 = 18%). Update from BLS CPI-W series. */
const CPI_W_GROWTH_SINCE_2021 = 0.18;

const HOURS_PER_YEAR = 1950;
const YALE_ENDOWMENT_HOURLY_GROWTH = 415325;

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatSeconds(seconds) {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} minute${m !== 1 ? 's' : ''}` : `${m} minute${m !== 1 ? 's' : ''} ${s} seconds`;
}

export default function YaleWealthCalculator() {
  const [selectedGrade, setSelectedGrade] = useState(LOCAL_34_PAY_GRADES[0]);
  const [showCpiPopup, setShowCpiPopup] = useState(false);
  const cpiPopupRef = useRef(null);

  useEffect(() => {
    if (!showCpiPopup) return;
    function handleClickOutside(e) {
      if (cpiPopupRef.current && !cpiPopupRef.current.contains(e.target)) {
        setShowCpiPopup(false);
      }
    }
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, [showCpiPopup]);

  const annualSalary = useMemo(() => selectedGrade.rate * HOURS_PER_YEAR, [selectedGrade]);

  const penaltyData = useMemo(() => {
    const rate2021 = STARTING_WAGE_2021_BY_GRADE[selectedGrade.grade];
    const rateCurrent = selectedGrade.rate;
    if (rate2021 == null) return { penalty: 0, seconds: 0, adjustedAnnual: null, adjustedHourly: null };
    const wageIfKeptPaceWithCPI = rate2021 * (1 + CPI_W_GROWTH_SINCE_2021);
    const adjustedAnnual = wageIfKeptPaceWithCPI * HOURS_PER_YEAR;
    const penaltyAnnual = (wageIfKeptPaceWithCPI - rateCurrent) * HOURS_PER_YEAR;
    const penalty = Math.max(0, penaltyAnnual);
    const seconds =
      penalty <= 0 ? 0 : Math.round(penalty / (YALE_ENDOWMENT_HOURLY_GROWTH / 3600));
    return { penalty, seconds, adjustedAnnual, adjustedHourly: wageIfKeptPaceWithCPI };
  }, [selectedGrade.grade, selectedGrade.rate]);

  const inflationPenalty = Math.round(penaltyData.penalty);
  const costToYaleSeconds = penaltyData.seconds;
  const adjustedStartingWageAnnual = penaltyData.adjustedAnnual;

  return (
    <div className={`yale-wealth-calc${showCpiPopup ? ' yale-wealth-calc--popup-open' : ''}`}>
      {/* 1. Grade picker */}
      <div className="yale-wealth-calc__picker">
        <div className="yale-wealth-calc__grades" role="group" aria-label="Labor grade minimum rate">
          {LOCAL_34_PAY_GRADES.map((g) => (
            <button
              key={g.grade}
              type="button"
              className={`yale-wealth-calc__grade ${selectedGrade.grade === g.grade ? 'yale-wealth-calc__grade--active' : ''}`}
              onClick={() => setSelectedGrade(g)}
            >
              <span className="yale-wealth-calc__grade-rate">{formatCurrency(g.rate)}/hr</span>
              <span className="yale-wealth-calc__grade-label">{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. The comparison — what we make vs what we should make */}
      <div className="yale-wealth-calc__comparison" aria-label="Minimum rate comparison">
        <div className="yale-wealth-calc__comparison-card">
          <span className="yale-wealth-calc__comparison-value">{formatCurrency(annualSalary)}</span>
          <span className="yale-wealth-calc__comparison-meta">Grade {selectedGrade.grade} minimum rate, annualized</span>
        </div>
        <div className="yale-wealth-calc__comparison-gap" aria-hidden="true">
          <span className="yale-wealth-calc__comparison-gap-label">Shortfall</span>
          <span className="yale-wealth-calc__comparison-gap-value">−{formatCurrency(inflationPenalty)}</span>
        </div>
        <div className="yale-wealth-calc__comparison-card yale-wealth-calc__comparison-card--cpi" ref={cpiPopupRef}>
          <span className="yale-wealth-calc__comparison-value-row">
            <span className="yale-wealth-calc__comparison-value">
              {adjustedStartingWageAnnual != null ? formatCurrency(adjustedStartingWageAnnual) : '—'}
            </span>
            <button
              type="button"
              className="yale-wealth-calc__cpi-info"
              onClick={(e) => { e.stopPropagation(); setShowCpiPopup((v) => !v); }}
              aria-expanded={showCpiPopup}
              aria-haspopup="dialog"
              aria-label="Explain CPI-W calculation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </button>
          </span>
          {showCpiPopup && (
            <div className="yale-wealth-calc__cpi-popup" role="dialog" aria-label="CPI-W calculation explanation">
              <p>
                This number is what we&apos;d be making today if our <strong>2021 minimum rate</strong> had kept up with the cost of living.
              </p>
              <p>
                CPI-W is the federal measure of how much prices have risen for workers (Bureau of Labor Statistics). It&apos;s gone up about <strong>18% since 2021</strong>. We take the 2021 minimum rate for this grade, add that 18%, then multiply by 1,950 hours to get this annual amount.
              </p>
              <p className="yale-wealth-calc__cpi-popup-note">
                <em>All figures use minimum rates only—the rate when you first start in a grade—not step increases.</em>
              </p>
              <button type="button" className="yale-wealth-calc__cpi-popup-close" onClick={() => setShowCpiPopup(false)} aria-label="Close">×</button>
            </div>
          )}
          <span className="yale-wealth-calc__comparison-meta">If 2021 minimum rate had kept pace with inflation (CPI-W)</span>
        </div>
      </div>

      {/* 3. Takeaway */}
      <div className="yale-wealth-calc__takeaway" aria-label="Impact">
        <p className="yale-wealth-calc__takeaway-line">
          That&apos;s how much we&apos;re behind on the minimum rate this year. Yale&apos;s endowment earns that in <strong>{formatSeconds(costToYaleSeconds)}</strong>.
        </p>
      </div>
    </div>
  );
}
