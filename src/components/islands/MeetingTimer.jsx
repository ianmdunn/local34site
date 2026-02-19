import { useState, useEffect, useRef } from 'react';
import { GROWTH_PER_SECOND } from '~/lib/yaleWealthGrowth';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function MeetingTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const startRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      if (startRef.current != null) {
        setElapsed((Date.now() - startRef.current) / 1000);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  function handleStart() {
    startRef.current = Date.now();
    setElapsed(0);
    setRunning(true);
    setDone(false);
    if (typeof window.__trackEvent === 'function') {
      window.__trackEvent('endowment_timer_start', {
        source: window.opener ? 'popup' : 'page',
      });
    }
  }

  function handleStop() {
    if (startRef.current != null) {
      setElapsed((Date.now() - startRef.current) / 1000);
    }
    const durationSec = startRef.current ? (Date.now() - startRef.current) / 1000 : 0;
    const amount = durationSec * GROWTH_PER_SECOND;
    setRunning(false);
    setDone(true);
    if (typeof window.__trackEvent === 'function') {
      window.__trackEvent('endowment_timer_complete', {
        source: window.opener ? 'popup' : 'page',
        duration_seconds: Math.round(durationSec),
        endowment_amount: Math.round(amount),
      });
    }
  }

  const amountGained = elapsed * GROWTH_PER_SECOND;

  return (
    <div className="meeting-timer">
      <h1 className="meeting-timer__title">Timer</h1>
      <p className="meeting-timer__subtitle">
        Time your shift, your commute, your meeting—anything. See how much Yale&apos;s endowment grew while you were
        busy.
      </p>

      {!done ? (
        <>
          <div className="meeting-timer__display" aria-live="polite">
            {formatTime(elapsed)}
          </div>
          <div className="meeting-timer__live">
            {running && <span className="meeting-timer__live-value">{formatCurrency(amountGained)} and counting…</span>}
          </div>
          <div className="meeting-timer__actions">
            {!running ? (
              <button type="button" className="meeting-timer__btn meeting-timer__btn--start" onClick={handleStart}>
                Start
              </button>
            ) : (
              <button type="button" className="meeting-timer__btn meeting-timer__btn--stop" onClick={handleStop}>
                Done
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="meeting-timer__result">
          <p className="meeting-timer__result-duration">
            That took <strong>{formatTime(elapsed)}</strong>.
          </p>
          <p className="meeting-timer__result-amount">
            Yale&apos;s endowment grew by <strong>{formatCurrency(amountGained)}</strong> during that time.
          </p>
          <button
            type="button"
            className="meeting-timer__btn meeting-timer__btn--again"
            onClick={() => {
              if (typeof window.__trackEvent === 'function') {
                window.__trackEvent('endowment_timer_again', { source: window.opener ? 'popup' : 'page' });
              }
              handleStart();
            }}
          >
            Time another
          </button>
        </div>
      )}
    </div>
  );
}
