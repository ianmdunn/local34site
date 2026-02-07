import React, { useState, useEffect } from 'react';
import { CATCH_GAME_ACTIVATE, CATCH_GAME_STOP, CATCH_GAME_ACTIVE_CHANGED } from '~/lib/catchGameEvents';
import dogFrame1 from '~/assets/images/Frame1.svg';

const SESSION_DURATION_SEC = 25;

export default function GameLaunchButton() {
  const [isGameActive, setIsGameActive] = useState(false);

  useEffect(() => {
    function onActiveChanged(e) {
      setIsGameActive(e.detail?.active === true);
    }
    window.addEventListener(CATCH_GAME_ACTIVE_CHANGED, onActiveChanged);
    return () => window.removeEventListener(CATCH_GAME_ACTIVE_CHANGED, onActiveChanged);
  }, []);

  function handleClick() {
    if (isGameActive) {
      window.dispatchEvent(new CustomEvent(CATCH_GAME_STOP));
    } else {
      window.dispatchEvent(
        new CustomEvent(CATCH_GAME_ACTIVATE, { detail: { durationSec: SESSION_DURATION_SEC } })
      );
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999, // High z-index to ensure it's on top
        width: 60,
        height: 60,
        opacity: isGameActive ? 0 : 1,
        pointerEvents: isGameActive ? 'none' : 'auto',
        transition: 'opacity 0.3s ease',
      }}
    >
        <button
          type="button"
          onClick={handleClick}
          aria-label={isGameActive ? 'Quit the endowment catch game' : 'Launch the endowment catch game'}
          style={{
            width: '100%',
            height: '100%',
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <img 
            src={dogFrame1.src || dogFrame1} 
            alt="Play Catch the Cash" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))'
            }} 
          />
        </button>
    </div>
  );
}
