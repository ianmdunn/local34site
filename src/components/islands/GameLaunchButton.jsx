import { useState, useEffect } from 'react';
import { CATCH_GAME_ACTIVATE, CATCH_GAME_STOP, CATCH_GAME_ACTIVE_CHANGED } from '~/lib/catchGameEvents';
import dogFrame1 from '~/assets/images/Frame1.svg';

const SESSION_DURATION_SEC = 25;

const clockIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const iconStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function GameLaunchButton() {
  const [isGameActive, setIsGameActive] = useState(false);

  useEffect(() => {
    function onActiveChanged(e) {
      setIsGameActive(e.detail?.active === true);
    }
    window.addEventListener(CATCH_GAME_ACTIVE_CHANGED, onActiveChanged);
    return () => window.removeEventListener(CATCH_GAME_ACTIVE_CHANGED, onActiveChanged);
  }, []);

  function handleGameClick() {
    if (isGameActive) {
      window.dispatchEvent(new CustomEvent(CATCH_GAME_STOP));
    } else {
      window.dispatchEvent(new CustomEvent(CATCH_GAME_ACTIVATE, { detail: { durationSec: SESSION_DURATION_SEC } }));
      if (typeof window.__trackEvent === 'function') window.__trackEvent('catch_cash_launch', {});
    }
  }

  function handleTimerClick(e) {
    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
    if (isMobile) {
      // On mobile, window.open with features is often blocked. Let the link's target="_blank" work.
      if (typeof window.__trackEvent === 'function') window.__trackEvent('endowment_timer_open', {});
      return;
    }
    e.preventDefault();
    window.open('/timer-popup', 'meeting-timer', 'width=400,height=320,scrollbars=no,resizable=yes');
    if (typeof window.__trackEvent === 'function') window.__trackEvent('endowment_timer_open', {});
  }

  const buttonBase = {
    width: 56,
    height: 56,
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
        opacity: isGameActive ? 0 : 1,
        pointerEvents: isGameActive ? 'none' : 'auto',
        transition: 'opacity 0.3s ease',
      }}
    >
      <a
        href="/timer-popup"
        target="_blank"
        rel="noopener"
        aria-label="Open timer in new window"
        onClick={handleTimerClick}
        style={{
          ...buttonBase,
          color: '#fff',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <span style={iconStyle}>{clockIcon}</span>
      </a>
      <button
        type="button"
        onClick={handleGameClick}
        aria-label={isGameActive ? 'Quit the endowment catch game' : 'Launch the endowment catch game'}
        style={{ ...buttonBase, width: 45, height: 45 }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <img
          src={dogFrame1.src || dogFrame1}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </button>
    </div>
  );
}
