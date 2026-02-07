import React, { useEffect, useRef } from 'react';
import { CATCH_GAME_ACTIVATE, CATCH_GAME_STOP, CATCH_GAME_ACTIVE_CHANGED } from '~/lib/catchGameEvents';

const TRIGGER_CONFIG = {
  dollarSignSelector: '.yale-wealth-billboard__number-prefix',
  retryDelaysMs: [100, 300, 600, 1000, 1500, 2500, 4000, 6000],
};

export default function DollarSignTrigger() {
  const gameActiveRef = useRef(false);

  useEffect(() => {
    let detach = null;

    function attach() {
      if (typeof window === 'undefined') return null;

      const el = document.querySelector(TRIGGER_CONFIG.dollarSignSelector);
      if (!el) return null;

      function onClick() {
        if (gameActiveRef.current) {
          window.dispatchEvent(new CustomEvent(CATCH_GAME_STOP));
        } else {
          window.dispatchEvent(new CustomEvent(CATCH_GAME_ACTIVATE));
        }
      }

      function onActiveChanged(e) {
        gameActiveRef.current = e.detail?.active === true;
      }

      el.addEventListener('click', onClick);
      window.addEventListener(CATCH_GAME_ACTIVE_CHANGED, onActiveChanged);
      el.style.cursor = 'pointer';

      return () => {
        el.removeEventListener('click', onClick);
        window.removeEventListener(CATCH_GAME_ACTIVE_CHANGED, onActiveChanged);
        el.style.cursor = '';
      };
    }

    const timers = [];
    timers.push(setTimeout(() => {
      detach = attach();
      if (!detach) {
        TRIGGER_CONFIG.retryDelaysMs.forEach((delay) => {
          timers.push(setTimeout(() => { if (!detach) detach = attach(); }, delay));
        });
      }
    }, 0));

    return () => {
      timers.forEach(clearTimeout);
      if (detach) detach();
    };
  }, []);

  return null;
}
