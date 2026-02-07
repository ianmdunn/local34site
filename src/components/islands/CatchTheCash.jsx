import React, { useEffect, useState, useRef } from 'react';
import Matter from 'matter-js';
import { GROWTH_PER_SECOND } from '~/lib/yaleWealthGrowth';
import { CATCH_GAME_ACTIVATE, CATCH_GAME_STOP, CATCH_GAME_ACTIVE_CHANGED } from '~/lib/catchGameEvents';

import bill1 from '~/assets/bills/1.png';
import bill5 from '~/assets/bills/5.png';
import bill10 from '~/assets/bills/10.png';
import bill20 from '~/assets/bills/20.png';
import dogFrame1 from '~/assets/images/Frame1.svg';
import dogFrame2 from '~/assets/images/Frame2.svg';
import dogFrame3 from '~/assets/images/Frame3.svg';
import dogFrame4 from '~/assets/images/Frame4.svg';
import dogFrame5 from '~/assets/images/Frame5.svg';

const DOG_FRAMES = [dogFrame1, dogFrame2, dogFrame3, dogFrame4, dogFrame5];

// -----------------------------------------------------------------------------
// Game config
// -----------------------------------------------------------------------------

const GAME_CONFIG = {
  maxBills: 500,
  maxBillsPerFrame: 100,
  spawnRateScale: 1.0,
  minSpawnThreshold: 20,
  minBillAmount: 20,

  bill: {
    width: 25,
    aspectRatio: 2.61,
    restitution: 0.0,       // No bounce (paper)
    friction: 0.01,        // Very slippery (so they slide off the dog's back)
    frictionAir: 0.04,      // Less drag (faster falling)
    frictionStatic: 0.2,    // No static friction (prevent piling up)
    density: 0.001,         // Light
    initialAngularVelocity: 0.9,
    spawnXSpread: 200,
    spawnYMin: -60,
    spawnYRange: 80,
    textureFallbackWidth: 100,
    textureFallbackHeight: 50,
  },

  dog: {
    spriteScale: 1,
    animFps: 15,
    mouthOffsetX: 0.52,
    mouthOffsetY: 0.40,
    collisionRadius: 35,
    restitution: 0.8,
  },

  suction: {
    collectRadius: 40,
    range: 150,             // Restored base size
    influenceRadius: 220,
    pullStrength: 35,
    shrinkStartDist: 150,
    suckProgressRate: 0.6,
    squeezeX: 1.5,
    finalPull: 1.5,
  },

  joystick: {
    size: 120,
    thumbSize: 48,
    baseOpacity: 0.6,
    thumbOpacity: 0.9,
    moveSpeed: 340,
  },

  physics: {
    gravityScale: 1.5,      // Slightly increased gravity to help clear screen
    wallThickness: 10,
    wallOffset: 15,
    floorOffset: 10,
    groundSnapThreshold: 20,
    groundYOffset: 10,
    offBottomThreshold: 80,
    windFreq1: 0.0005,        // Faster wind fluctuation
    windFreq2: 0.002,
    windAmp1: 0.0015,       // Stronger wind for flutter
    windAmp2: 0.0010,
  },

  layout: {
    navBarOffset: 20,
    padding: 12,
    hudBottomOffset: 20,
    hudRightOffset: 20,
    zIndex: { overlay: 50, pointer: 100, hud: 200 },
  },

  pointer: {
    offscreenX: -1000,
    offscreenY: -1000,
    visibleThreshold: -500,
  },

  billTint: 'rgba(0, 206, 0, 0.06)',
};

// $1, $5, and $10 bills (sorted high to low for spawn logic)
const BILL_DENOMINATIONS = [
  { value: 20, img: bill20 },
  { value: 10, img: bill10 },
  { value: 5, img: bill5 },
  { value: 1, img: bill1 },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getImageSrc(img) {
  return typeof img === 'string' ? img : (img && img.src) || '';
}

function createBillTexture(img, tintColor = GAME_CONFIG.billTint) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = tintColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

function createBillPhysicsBody(billData, texture, viewportWidth) {
  const { Bodies } = Matter;
  const c = GAME_CONFIG.bill;
  const height = c.width / c.aspectRatio;
  const textureW = (texture && texture.width) != null ? texture.width : c.textureFallbackWidth;
  const textureH = (texture && texture.height) != null ? texture.height : c.textureFallbackHeight;

  const body = Bodies.rectangle(
    viewportWidth / 2 + (Math.random() - 0.5) * c.spawnXSpread,
    c.spawnYMin - Math.random() * c.spawnYRange,
    c.width,
    height,
    {
      restitution: c.restitution,
      friction: c.friction,
      frictionAir: c.frictionAir,
      frictionStatic: c.frictionStatic ?? 0.5,
      density: c.density,
      angle: Math.random() * Math.PI * 2,
      render: {
        sprite: {
          texture,
          xScale: c.width / textureW,
          yScale: height / textureH,
          originalWidth: textureW,
          originalHeight: textureH,
        },
      },
    }
  );
  Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * c.initialAngularVelocity);
  body.billValue = billData.value;
  return body;
}

// -----------------------------------------------------------------------------
// Thumb joystick for mobile
// -----------------------------------------------------------------------------

function ThumbJoystick({ onInput, containerRef }) {
  const baseRef = useRef(null);
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const isActiveRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    onInput.current = (out) => {
      out.x = stickPos.x;
      out.y = stickPos.y;
    };
    return () => { onInput.current = null; };
  }, [stickPos, onInput]);

  const handleStart = (clientX, clientY) => {
    const base = baseRef.current;
    if (!base || !containerRef?.current) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    startPosRef.current = { x: clientX - cx, y: clientY - cy };
    isActiveRef.current = true;
  };

  const handleMove = (clientX, clientY) => {
    if (!isActiveRef.current || !baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const j = GAME_CONFIG.joystick;
    const maxR = (j.size - j.thumbSize) / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      const s = maxR / dist;
      dx *= s;
      dy *= s;
    }
    const nx = dist > 0 ? dx / maxR : 0;
    const ny = dist > 0 ? dy / maxR : 0;
    setStickPos({ x: nx, y: ny });
  };

  const handleEnd = () => {
    isActiveRef.current = false;
    setStickPos({ x: 0, y: 0 });
  };

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    const onTouchStart = (e) => {
      e.preventDefault();
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = (e) => {
      e.preventDefault();
      handleEnd();
    };
    const onTouchCancel = (e) => {
      e.preventDefault();
      handleEnd();
    };

    base.addEventListener('touchstart', onTouchStart, { passive: false });
    base.addEventListener('touchmove', onTouchMove, { passive: false });
    base.addEventListener('touchend', onTouchEnd, { passive: false });
    base.addEventListener('touchcancel', onTouchCancel, { passive: false });

    return () => {
      base.removeEventListener('touchstart', onTouchStart);
      base.removeEventListener('touchmove', onTouchMove);
      base.removeEventListener('touchend', onTouchEnd);
      base.removeEventListener('touchcancel', onTouchCancel);
    };
  }, []);

  const j = GAME_CONFIG.joystick;
  const thumbOffsetX = stickPos.x * (j.size - j.thumbSize) / 2;
  const thumbOffsetY = stickPos.y * (j.size - j.thumbSize) / 2;

  return (
    <div
      ref={baseRef}
      role="slider"
      aria-label="Virtual joystick to steer the dog"
      tabIndex={-1}
      style={{
        position: 'absolute',
        bottom: GAME_CONFIG.layout.padding + 80,
        left: GAME_CONFIG.layout.padding + 16,
        width: j.size,
        height: j.size,
        borderRadius: '50%',
        background: `rgba(0, 0, 0, ${j.baseOpacity})`,
        border: '3px solid rgba(255, 255, 255, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        pointerEvents: 'auto',
        zIndex: GAME_CONFIG.layout.zIndex.hud + 1,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: j.thumbSize,
          height: j.thumbSize,
          marginLeft: -j.thumbSize / 2 + thumbOffsetX,
          marginTop: -j.thumbSize / 2 + thumbOffsetY,
          borderRadius: '50%',
          background: `rgba(255, 255, 255, ${j.thumbOpacity})`,
          border: '2px solid rgba(34, 197, 94, 0.6)',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export default function CatchTheCash() {
  const [isActive, setIsActive] = useState(false);
  const [showPopup, setShowPopup] = useState(true);
  const [isStopped, setIsStopped] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const canvasRef = useRef(null);
  const sessionStartRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const pointerOverlayRef = useRef(null);
  const engineRef = useRef(null);
  const gameRectRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const growthAccumulatorRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const billTexturesRef = useRef({});
  const dogSpritesRef = useRef([null, null, null, null, null]);
  const sessionTimeoutRef = useRef(null);
  const pointerPositionRef = useRef({ x: GAME_CONFIG.pointer.offscreenX, y: GAME_CONFIG.pointer.offscreenY });
  const pointerFacingRef = useRef(1); // 1 = right, -1 = left
  const lastPointerXRef = useRef(null);
  const joystickInputRef = useRef(null);
  const isActiveRef = useRef(false);
  const [isMobile] = useState(() => isMobileDevice());
  const [totalMoneyCollected, setTotalMoneyCollected] = useState(0);
  const [highScores, setHighScores] = useState([]);
  const [newHighScoreRank, setNewHighScoreRank] = useState(null);
  const [initials, setInitials] = useState('');

  // Load high scores on mount
  useEffect(() => {
    const fetchScores = async () => {
      // Use GCP Function URL directly
      const API_URL = import.meta.env.PUBLIC_LEADERBOARD_API || 'https://leaderboard-fbzec7gezq-uc.a.run.app';
      
      try {
        const res = await fetch(API_URL);
        if (res.ok) {
          const cloudScores = await res.json();
          setHighScores(cloudScores);
          // Update local backup
          localStorage.setItem('catch_the_cash_high_scores', JSON.stringify(cloudScores));
          return;
        }
      } catch (e) {
        console.warn('Failed to load global leaderboard, falling back to local cache', e);
      }

      // Fallback to local storage (offline support only)
      try {
        const saved = localStorage.getItem('catch_the_cash_high_scores');
        if (saved) setHighScores(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load local high scores', e);
      }
    };

    fetchScores();
  }, []);

  // Check for high score when stopped
  useEffect(() => {
    if (isStopped && totalMoneyCollected > 50) { // Minimum score to qualify
      const checkScore = async () => {
        try {
          let scores = [];
          // Try fetching from GCP Function
          // Use GCP Function URL directly
          const API_URL = import.meta.env.PUBLIC_LEADERBOARD_API || 'https://leaderboard-fbzec7gezq-uc.a.run.app';

          try {
            const res = await fetch(API_URL);
            if (res.ok) {
              scores = await res.json();
            } else {
              // Fallback to local storage (offline)
              console.warn('Leaderboard API unreachable, using local cache');
              const saved = localStorage.getItem('catch_the_cash_high_scores');
              if (saved) scores = JSON.parse(saved);
            }
          } catch (e) {
            console.warn('Leaderboard fetch error', e);
            const saved = localStorage.getItem('catch_the_cash_high_scores');
            if (saved) scores = JSON.parse(saved);
          }

          setHighScores(scores);

          // Check if qualifies for top 10 (since we store 10 in cloud)
          let qualifies = false;
          if (scores.length < 10) {
            qualifies = true;
          } else {
            const lowest = scores[scores.length - 1];
            if (totalMoneyCollected > lowest.score) qualifies = true;
          }

          if (qualifies) {
            // Find rank
            let rank = scores.findIndex(s => totalMoneyCollected > s.score);
            if (rank === -1) rank = scores.length;
            setNewHighScoreRank(rank);
            setInitials('');
          } else {
            setNewHighScoreRank(null);
          }
        } catch (e) {
          console.error('Error checking high score', e);
        }
      };
      checkScore();
    }
  }, [isStopped, totalMoneyCollected]);

  const saveHighScore = async () => {
    if (initials.trim().length === 0) return;
    
    const newEntry = { initials: initials.toUpperCase().slice(0, 3), score: totalMoneyCollected };
    
    // Optimistic update for UI
    const optimisticScores = [...highScores];
    const rank = newHighScoreRank !== null ? newHighScoreRank : optimisticScores.length;
    optimisticScores.splice(rank, 0, { ...newEntry, date: Date.now() });
    setHighScores(optimisticScores.slice(0, 10));
    setNewHighScoreRank(null);

    try {
      // Save to Cloud
      // Use GCP Function URL directly
      const API_URL = import.meta.env.PUBLIC_LEADERBOARD_API || 'https://leaderboard-fbzec7gezq-uc.a.run.app';
      
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(newEntry),
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const cloudScores = await res.json();
        setHighScores(cloudScores);
      } else {
        // Fallback to local (offline)
        localStorage.setItem('catch_the_cash_high_scores', JSON.stringify(optimisticScores.slice(0, 10)));
      }
    } catch (e) {
      console.error('Failed to save score to cloud', e);
      localStorage.setItem('catch_the_cash_high_scores', JSON.stringify(optimisticScores.slice(0, 10)));
    }
  };

  isActiveRef.current = isActive;

  // ---------------------------------------------------------------------------
  // Game lifecycle: listen for start/stop from triggers
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function onActivate(e) {
      // Clear any existing timeout (game never ends automatically)
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
      isActiveRef.current = true;
      setIsActive(true);
      growthAccumulatorRef.current = 0;
      setTotalMoneyCollected(0);
      setShowPopup(true);
      window.dispatchEvent(new CustomEvent(CATCH_GAME_ACTIVE_CHANGED, { detail: { active: true } }));
      // Game runs indefinitely - only stops when CATCH_GAME_STOP event is dispatched
    }

    function onStop() {
      if (!isActiveRef.current) return;
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }
      isActiveRef.current = false;
      setIsActive(false);
      window.dispatchEvent(new CustomEvent(CATCH_GAME_ACTIVE_CHANGED, { detail: { active: false } }));
    }

    window.addEventListener(CATCH_GAME_ACTIVATE, onActivate);
    window.addEventListener(CATCH_GAME_STOP, onStop);
    return () => {
      window.removeEventListener(CATCH_GAME_ACTIVATE, onActivate);
      window.removeEventListener(CATCH_GAME_STOP, onStop);
      if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Session elapsed timer (for HUD)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (showPopup) return;
    const tick = () => {
      if (sessionStartRef.current) {
        setElapsedMs(Date.now() - sessionStartRef.current);
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [showPopup]);

  // ---------------------------------------------------------------------------
  // Pointer tracking: dog follows mouse (desktop only)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isActive || isMobile) return;
    const overlay = pointerOverlayRef.current;
    if (!overlay) return;

    function onMove(e) {
      const r = gameRectRef.current;
      const x = r.width ? e.clientX - r.left : e.clientX;
      const y = r.height ? e.clientY - r.top : e.clientY;
      if (lastPointerXRef.current !== null) {
        if (x > lastPointerXRef.current) pointerFacingRef.current = 1;
        else if (x < lastPointerXRef.current) pointerFacingRef.current = -1;
      }
      lastPointerXRef.current = x;
      pointerPositionRef.current = { x, y };
    }
    function onLeave() {
      pointerPositionRef.current = { x: GAME_CONFIG.pointer.offscreenX, y: GAME_CONFIG.pointer.offscreenY };
      lastPointerXRef.current = null;
    }
    function onPointerDown(e) {
      const r = gameRectRef.current;
      pointerPositionRef.current = {
        x: r.width ? e.clientX - r.left : e.clientX,
        y: r.height ? e.clientY - r.top : e.clientY,
      };
    }
    function onPointerUp(e) {
      if (e.pointerType === 'touch') {
        pointerPositionRef.current = { x: GAME_CONFIG.pointer.offscreenX, y: GAME_CONFIG.pointer.offscreenY };
        lastPointerXRef.current = null;
      }
    }

    function updateRect() {
      const el = canvasContainerRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        gameRectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
    }
    updateRect();
    window.addEventListener('resize', updateRect);

    const usePointer = typeof PointerEvent !== 'undefined';
    if (usePointer) {
      overlay.addEventListener('pointermove', onMove, { passive: true });
      overlay.addEventListener('pointerleave', onLeave);
      overlay.addEventListener('pointerdown', onPointerDown);
      overlay.addEventListener('pointerup', onPointerUp);
      overlay.addEventListener('pointercancel', onPointerUp);
    } else {
      overlay.addEventListener('mousemove', onMove);
      overlay.addEventListener('mouseout', onLeave);
      overlay.addEventListener('mousedown', onPointerDown);
      overlay.addEventListener('mouseup', onPointerUp);
    }
    return () => {
      window.removeEventListener('resize', updateRect);
      if (usePointer) {
        overlay.removeEventListener('pointermove', onMove);
        overlay.removeEventListener('pointerleave', onLeave);
        overlay.removeEventListener('pointerdown', onPointerDown);
        overlay.removeEventListener('pointerup', onPointerUp);
        overlay.removeEventListener('pointercancel', onPointerUp);
      } else {
        overlay.removeEventListener('mousemove', onMove);
        overlay.removeEventListener('mouseout', onLeave);
        overlay.removeEventListener('mousedown', onPointerDown);
        overlay.removeEventListener('mouseup', onPointerUp);
      }
    };
  }, [isActive, isMobile]);

  // ---------------------------------------------------------------------------
  // Asset preload
  // ---------------------------------------------------------------------------

  useEffect(() => {
    BILL_DENOMINATIONS.forEach(({ value, img }) => {
      const image = new Image();
      image.src = getImageSrc(img);
      image.onload = () => {
        billTexturesRef.current[value] = createBillTexture(image);
      };
    });
  }, []);

  useEffect(() => {
    DOG_FRAMES.forEach((src, i) => {
      const img = new Image();
      img.src = typeof src === 'string' ? src : (src && src.src) || '';
      img.onload = () => {
        dogSpritesRef.current[i] = img;
      };
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Physics engine + render loop
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isActive) return;

    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let viewportWidth = 0;
    let viewportHeight = 0;
    function updateBounds() {
      const r = container.getBoundingClientRect();
      gameRectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
      viewportWidth = r.width;
      viewportHeight = r.height;

      canvas.width = Math.round(viewportWidth * dpr);
      canvas.height = Math.round(viewportHeight * dpr);
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
    }

    function createWalls() {
      const { Bodies } = Matter;
      const p = GAME_CONFIG.physics;
      const wallOpts = {
        isStatic: true,
        friction: 0,
        frictionStatic: 0,
        restitution: 0.5,
        render: { visible: false },
        label: 'wall',
      };
      
      const leftWall = Bodies.rectangle(
        -p.wallThickness / 2 - p.wallOffset,
        viewportHeight / 2,
        p.wallThickness,
        viewportHeight * 2,
        wallOpts
      );
      
      const rightWall = Bodies.rectangle(
        viewportWidth + p.wallThickness / 2 + p.wallOffset,
        viewportHeight / 2,
        p.wallThickness,
        viewportHeight * 2,
        wallOpts
      );

      return [leftWall, rightWall];
    }

    const { Engine, World, Bodies, Body, Events, Composite, Runner } = Matter;
    const gScale = GAME_CONFIG.physics.gravityScale ?? 1;
    const engine = Engine.create({
      gravity: { x: 0, y: 1.1 * gScale },
    });
    engineRef.current = engine;
    const world = engine.world;

    updateBounds(); // Initialize viewport dimensions
    let currentWalls = createWalls();
    World.add(world, currentWalls);

    const d = GAME_CONFIG.dog;
    const dogBody = Bodies.circle(
      GAME_CONFIG.pointer.offscreenX,
      GAME_CONFIG.pointer.offscreenY,
      d.collisionRadius,
      {
        isStatic: true,
        restitution: d.restitution,
        friction: 0,
        frictionAir: 0,
        label: 'dog',
        render: { visible: false },
      }
    );
    World.add(world, dogBody);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      Engine.clear(engine);
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const resizeObserver = new ResizeObserver(() => {
      updateBounds();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // Remove old walls and add new ones for new viewport size
      World.remove(world, currentWalls);
      currentWalls = createWalls();
      World.add(world, currentWalls);
    });
    resizeObserver.observe(container);

    // Mobile: update dog position from joystick (or init to center)
    const joystickSpeed = GAME_CONFIG.joystick.moveSpeed;
    Events.on(engine, 'beforeUpdate', () => {
      if (!isMobile) return;
      const r = gameRectRef.current;
      let px = pointerPositionRef.current.x;
      let py = pointerPositionRef.current.y;
      if (px < GAME_CONFIG.pointer.visibleThreshold) {
        pointerPositionRef.current = { x: (r.width || viewportWidth) / 2, y: (r.height || viewportHeight) / 2 };
        return;
      }
      if (joystickInputRef.current) {
        const out = { x: 0, y: 0 };
        joystickInputRef.current(out);
        if (out.x > 0) pointerFacingRef.current = 1;
        else if (out.x < 0) pointerFacingRef.current = -1;
        const dt = (engine.timing.delta || 16) / 1000;
        px += out.x * joystickSpeed * dt;
        py += out.y * joystickSpeed * dt;
        px = Math.max(0, Math.min(r.width || viewportWidth, px));
        py = Math.max(0, Math.min(r.height || viewportHeight, py));
        pointerPositionRef.current = { x: px, y: py };
      }
    });

    // Dog body: move to pointer so bills collide and bounce
    Events.on(engine, 'beforeUpdate', () => {
      const px = pointerPositionRef.current.x;
      const py = pointerPositionRef.current.y;
      const thresh = GAME_CONFIG.pointer.visibleThreshold;
      Body.setPosition(dogBody, {
        x: px > thresh && py > thresh ? px : GAME_CONFIG.pointer.offscreenX,
        y: px > thresh && py > thresh ? py : GAME_CONFIG.pointer.offscreenY,
      });
    });

    // Suction: RADIAL MOUTH FIELD (Omni-directional gentle pull)
      Events.on(engine, 'beforeUpdate', () => {
        const px = pointerPositionRef.current.x;
        const py = pointerPositionRef.current.y;
        const facingLeft = lastPointerXRef.current != null
          ? pointerFacingRef.current < 0
          : px > viewportWidth / 2;
        const s = GAME_CONFIG.suction;
        const d = GAME_CONFIG.dog;
        const dogSize = s.range * d.spriteScale;
        const mouthOffsetX = facingLeft ? 1 - d.mouthOffsetX : d.mouthOffsetX;
        const mouthX = px + (mouthOffsetX - 0.5) * dogSize;
        const mouthY = py + (d.mouthOffsetY - 0.5) * dogSize;

        const toCollect = [];
        Composite.allBodies(world).forEach((body) => {
          if (body.billValue == null) return;
          
          const dx = body.position.x - mouthX;
          const dy = body.position.y - mouthY;
          const dist = Math.hypot(dx, dy);
          
          // Check if bill is in front of the dog (relative to dog center)
          // Positive buffer allows catching bills slightly behind the visual center point
          const dxCenter = body.position.x - px;
          const isInFront = facingLeft ? dxCenter < 20 : dxCenter > -20;

          const radius = s.influenceRadius ?? 250;
          
          if (body.suctionProgress != null) {
            body.suctionProgress += s.suckProgressRate ?? 0.2;
            const pull = (s.finalPull ?? 1.0) * body.mass;
            const invDist = 1 / (dist + 1);
            Body.applyForce(body, body.position, { x: (-dx * invDist) * pull, y: (-dy * invDist) * pull });
            
            if (dist < 15 || body.suctionProgress >= 1) {
              toCollect.push({ body, value: body.billValue });
              if (body.render) {
                body.render.visible = false;
                body.render.opacity = 0;
              }
            }
          } else if (dist < s.collectRadius && isInFront) {
            body.suctionProgress = 0;
            body.isSensor = true; // Disable collisions once eating starts so it can't be knocked away
          } else if (dist < radius && isInFront) {
            const t = 1 - dist / radius; // 0 at edge, 1 at center
          // Gentle linear pull
          const force = (s.pullStrength ?? 25) * t * body.mass * 0.0001; 
          
          const ux = dx / dist;
          const uy = dy / dist;
          
          // Add flutter
          const fx = (Math.random() - 0.5) * force * 2;
          const fy = (Math.random() - 0.5) * force * 2;

          Body.applyForce(body, body.position, { 
            x: -ux * force + fx, 
            y: -uy * force + fy 
          });
          
          // Damping: slow down to spiral in instead of orbit
          Body.setVelocity(body, {
            x: body.velocity.x * 0.92,
            y: body.velocity.y * 0.92
          });
          
          const shrinkStart = s.shrinkStartDist ?? 100;
          body.suctionScale = dist < shrinkStart ? Math.max(0.4, dist / shrinkStart) : 1;
        } else {
          delete body.suctionScale;
        }
      });

      if (toCollect.length > 0) {
        const totalValue = toCollect.reduce((sum, { value }) => sum + value, 0);
        setTotalMoneyCollected((prev) => prev + totalValue);
        toCollect.forEach(({ body }) => World.remove(world, body));
      }

      // Remove bills that fall off screen (bottom or sides)
      const p = GAME_CONFIG.physics;
      const toRemove = [];
      Composite.allBodies(world).forEach((body) => {
        if (body.isStatic || body.label === 'dog' || body.billValue == null) return;
        const { x, y } = body.position;
        if (y > viewportHeight + p.offBottomThreshold) toRemove.push(body);
        else if (x < -p.offBottomThreshold || x > viewportWidth + p.offBottomThreshold) toRemove.push(body);
      });
      toRemove.forEach((body) => World.remove(world, body));
    });

    Events.on(engine, 'beforeUpdate', () => {
      const w = GAME_CONFIG.physics;
      const wind = Math.sin(engine.timing.timestamp * w.windFreq1) * w.windAmp1 + Math.cos(engine.timing.timestamp * w.windFreq2) * w.windAmp2;
      Composite.allBodies(world).forEach((body) => {
        if (!body.isStatic) Body.applyForce(body, body.position, { x: wind * body.mass, y: 0 });
      });
    });

    const runner = Runner.create();
    Runner.run(runner, engine);

    let rafId;
    function render() {
      ctx.clearRect(0, 0, viewportWidth, viewportHeight);

      Composite.allBodies(world).forEach((body) => {
        if (body.render && (body.render.visible === false || body.render.opacity === 0)) return;
        ctx.save();
        ctx.globalAlpha = body.render?.opacity ?? 1;
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        let alpha = body.render?.opacity ?? 1;
        let scaleX = 1;
        let scaleY = 1;

        if (body.suctionProgress != null) {
          const p = Math.min(1, body.suctionProgress);
          scaleY = Math.max(0.02, 1 - p);
          scaleX = Math.max(0.02, (1 - p) / (GAME_CONFIG.suction.squeezeX ?? 1.3));
          // Fade out as it shrinks
          alpha *= Math.max(0, 1 - p);
        } else if (body.suctionScale != null && body.suctionScale < 1) {
          scaleX = scaleY = body.suctionScale;
        }

        if (alpha < 0.05) return; // Skip if fully shrunk/invisible

        ctx.scale(scaleX, scaleY);
        ctx.globalAlpha = alpha;
        const sprite = body.render && body.render.sprite;
        if (sprite && sprite.texture) {
          const w = sprite.xScale * sprite.originalWidth;
          const h = sprite.yScale * sprite.originalHeight;
          ctx.drawImage(sprite.texture, -w / 2, -h / 2, w, h);
        } else {
          ctx.fillStyle = '#ccc';
          ctx.fillRect(-20, -10, 40, 20);
        }
        ctx.restore();
      });

      const px = pointerPositionRef.current.x;
      const py = pointerPositionRef.current.y;
      const thresh = GAME_CONFIG.pointer.visibleThreshold;
      if (px > thresh && py > thresh) {
        const s = GAME_CONFIG.suction;
        const d = GAME_CONFIG.dog;
        const dogSize = s.range * d.spriteScale;
        const dogSprites = dogSpritesRef.current;
        const frameIndex = Math.floor(performance.now() / 1000 * d.animFps) % DOG_FRAMES.length;
        const dogImg = dogSprites[frameIndex];
        if (dogImg) {
          ctx.save();
          ctx.translate(px, py);
          if (pointerFacingRef.current >= 0) ctx.scale(-1, 1);
          ctx.drawImage(dogImg, -dogSize / 2, -dogSize / 2, dogSize, dogSize);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(render);
    }
    render();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(rafId);
      Runner.stop(runner);
      Engine.clear(engine);
      World.clear(world);
    };
  }, [isActive, isMobile]);

  // ---------------------------------------------------------------------------
  // Bill spawner
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isActive || isStopped) return;

    const { Composite, World } = Matter;
    lastSpawnTimeRef.current = 0;

    let rafId;
    function spawnLoop(timestamp) {
      const dt = lastSpawnTimeRef.current ? (timestamp - lastSpawnTimeRef.current) / 1000 : 0;
      lastSpawnTimeRef.current = timestamp;
      growthAccumulatorRef.current += GROWTH_PER_SECOND * dt * GAME_CONFIG.spawnRateScale;

      let spawned = 0;
      const world = engineRef.current && engineRef.current.world;
      if (!world) {
        rafId = requestAnimationFrame(spawnLoop);
        return;
      }

      while (spawned < GAME_CONFIG.maxBillsPerFrame) {
        // Find all affordable bills
        const affordable = BILL_DENOMINATIONS.filter((d) => growthAccumulatorRef.current >= d.value);
        if (affordable.length === 0) break;

        // Pick one randomly to ensure variety (mix of $1, $5, $10, $20)
        const idx = Math.floor(Math.random() * affordable.length);
        const billData = affordable[idx];
        
        growthAccumulatorRef.current -= billData.value;
        spawned++;

        const allBodies = Composite.allBodies(world);
        if (allBodies.length > GAME_CONFIG.maxBills) {
          const oldest = allBodies.find((b) => !b.isStatic);
          if (oldest) World.remove(world, oldest);
        }

        const texture = billTexturesRef.current[billData.value];
        const vw = gameRectRef.current.width || window.innerWidth;
        const bill = createBillPhysicsBody(billData, texture, vw);
        World.add(world, bill);
      }

      rafId = requestAnimationFrame(spawnLoop);
    }
    rafId = requestAnimationFrame(spawnLoop);

    return () => cancelAnimationFrame(rafId);
  }, [isActive, isStopped]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isActive) return <></>;

  const layout = GAME_CONFIG.layout;
  const playAreaTop = layout.padding;

  return (
    <div
      style={{
        position: 'fixed',
        top: layout.navBarOffset,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: layout.zIndex.overlay,
        pointerEvents: 'none',
        boxSizing: 'border-box',
        fontFamily: '"VT323", "Courier New", monospace', // Global font for the game
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&display=swap');
        
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes glow {
          0% { text-shadow: 0 0 2px #ffaa00, 0 0 5px #ffaa00; }
          50% { text-shadow: 0 0 5px #ffaa00, 0 0 10px #ffaa00; }
          100% { text-shadow: 0 0 2px #ffaa00, 0 0 5px #ffaa00; }
        }
        
        .crt-overlay {
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%, 
            rgba(0, 0, 0, 0.1) 50%
          );
          background-size: 100% 4px;
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 999;
          box-shadow: inset 0 0 100px rgba(0,0,0,0.5);
        }
      `}</style>

      <div className="crt-overlay" />

      {/* Intro popup */}
      {showPopup && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            pointerEvents: 'auto',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              maxWidth: 480,
              background: '#1a1a1a',
              borderRadius: 4,
              padding: '8px', // Outer bezel padding
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
              border: '2px solid #444',
            }}
          >
            <div style={{
              border: '4px solid #000',
              background: '#000',
              padding: '32px 28px',
              textAlign: 'center',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
            }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '3.5rem',
                  fontWeight: 400,
                  color: '#ffaa00',
                  textShadow: '0 0 10px rgba(255, 170, 0, 0.5)',
                  lineHeight: 1,
                  textTransform: 'uppercase',
                  marginBottom: '16px',
                }}
              >
                Catch the Cash
              </h2>
              <p
                style={{
                  margin: '16px 0 32px',
                  fontSize: '1.5rem',
                  lineHeight: 1.4,
                  color: '#fbbf24',
                  textShadow: '0 0 2px #b45309',
                }}
              >
                The money falling is Yale&apos;s endowment growth—in real time. Every dollar represents what the $44 billion fund gains each second.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowPopup(false);
                  sessionStartRef.current = Date.now();
                }}
                aria-label="Start the game"
                style={{
                  padding: '12px 40px',
                  fontSize: '2rem',
                  fontWeight: 400,
                  color: '#000',
                  background: '#ffaa00',
                  border: '4px solid #b45309',
                  cursor: 'pointer',
                  boxShadow: '0 0 15px rgba(255, 170, 0, 0.4)',
                  fontFamily: '"VT323", monospace',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={e => e.target.style.background = '#ffc54d'}
                onMouseLeave={e => e.target.style.background = '#ffaa00'}
              >
                INSERT COIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HUD: Elapsed + Yale Earns + Caught */}
      {!showPopup && !isStopped && (
        <div
          style={{
            position: 'absolute',
            bottom: layout.padding + layout.hudBottomOffset,
            right: layout.padding + layout.hudRightOffset,
            zIndex: layout.zIndex.hud,
            pointerEvents: 'auto',
          }}
        >
          {/* Pinball HUD Card */}
          <div
            style={{
              background: '#000',
              border: '4px solid #333',
              borderRadius: '4px',
              padding: '4px', // Inner bezel
              boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
              minWidth: '200px', // Reduced width
              textAlign: 'right',
            }}
          >
            <div style={{
              background: '#111',
              border: '2px solid #222',
              padding: '10px', // Reduced padding
              boxShadow: 'inset 0 0 10px #000',
            }}>
              {/* Timer Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                borderBottom: '2px dashed #333',
                paddingBottom: '4px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse-red 1.5s infinite' }} />
                  <span style={{ fontSize: '1rem', color: '#ef4444', letterSpacing: '0.1em' }}>REC</span>
                </div>
                <span style={{ fontSize: '1.2rem', color: '#ef4444', letterSpacing: '0.1em' }}>
                  {`${Math.floor(elapsedMs / 60000)}:${String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0')}`}
                </span>
              </div>

              {/* Yale Stats */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', marginBottom: '0px' }}>
                  YALE JACKPOT
                </div>
                <div style={{ fontSize: '2rem', color: '#ffaa00', lineHeight: '0.9', textShadow: '0 0 8px rgba(255, 170, 0, 0.4)' }}>
                  ${Math.floor((elapsedMs / 1000) * GROWTH_PER_SECOND).toLocaleString()}
                </div>
              </div>

              {/* Player Stats */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '0.9rem', color: '#666', textTransform: 'uppercase', marginBottom: '0px' }}>
                  YOUR SCORE
                </div>
                <div style={{ fontSize: '2rem', color: '#22c55e', lineHeight: '0.9', textShadow: '0 0 8px rgba(34, 197, 94, 0.4)' }}>
                  ${totalMoneyCollected.toLocaleString()}
                </div>
              </div>

              {/* Stop Button */}
              <button
                onClick={() => setIsStopped(true)}
                style={{
                  marginTop: '4px',
                  width: '100%',
                  padding: '4px',
                  background: '#330000',
                  color: '#ef4444',
                  border: '2px solid #ef4444',
                  fontSize: '1.2rem',
                  fontFamily: '"VT323", monospace',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#ef4444';
                  e.target.style.color = '#000';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#330000';
                  e.target.style.color = '#ef4444';
                }}
              >
                STOP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stopped Summary Popup */}
      {isStopped && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            pointerEvents: 'auto',
            background: 'rgba(0, 0, 0, 0.9)',
          }}
        >
          <div
            style={{
              maxWidth: 500,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#1a1a1a',
              borderRadius: 4,
              padding: '4px', // Reduced bezel
              border: '2px solid #444',
              boxShadow: '0 0 50px rgba(255, 170, 0, 0.2)',
            }}
          >
            <div style={{
              background: '#000',
              border: '4px solid #000',
              padding: '20px', // Reduced padding
              textAlign: 'center',
              boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)',
            }}>
              <h2
                style={{
                  margin: '0 0 16px',
                  fontSize: '3rem', // Reduced font size
                  fontWeight: 400,
                  color: '#ffaa00',
                  textTransform: 'uppercase',
                  textShadow: '0 0 10px #ffaa00',
                  lineHeight: 0.9,
                  animation: 'glow 2s infinite',
                }}
              >
                {newHighScoreRank !== null ? 'HIGH SCORE!' : 'GAME OVER'}
              </h2>
              
              <div style={{ margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '2px dashed #333', paddingBottom: '16px' }}>
                  <div style={{ fontSize: '1rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>
                    YALE JACKPOT
                  </div>
                  <div style={{ fontSize: '2.5rem', color: '#fff', textShadow: '0 0 5px #fff', lineHeight: 1 }}>
                    ${Math.floor((elapsedMs / 1000) * GROWTH_PER_SECOND).toLocaleString()}
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: '1rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>
                    YOUR SCORE
                  </div>
                  <div style={{ fontSize: '2.5rem', color: '#22c55e', textShadow: '0 0 5px #22c55e', lineHeight: 1 }}>
                    ${totalMoneyCollected.toLocaleString()}
                  </div>
                </div>

                {/* Pinball Leaderboard */}
                <div style={{ 
                  background: '#111', 
                  border: '2px solid #333',
                  padding: '12px',
                  fontFamily: '"VT323", monospace',
                  marginTop: '8px',
                  boxShadow: 'inset 0 0 20px #000'
                }}>
                  <div style={{ 
                    color: '#ffaa00', 
                    fontSize: '1.2rem',
                    textAlign: 'center', 
                    marginBottom: '8px',
                    textDecoration: 'underline',
                    textUnderlineOffset: '4px',
                  }}>
                    HALL OF FAME
                  </div>
                  
                  {highScores.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: i === newHighScoreRank ? '#fff' : '#d97706', fontSize: '1.2rem', marginBottom: '4px', textShadow: i === newHighScoreRank ? '0 0 5px #fff' : 'none' }}>
                      <span>{i + 1}. {entry.initials}</span>
                      <span>${entry.score.toLocaleString()}</span>
                    </div>
                  ))}
                  
                  {newHighScoreRank !== null && (
                    <div style={{ marginTop: '12px', borderTop: '2px dashed #333', paddingTop: '12px' }}>
                      <div style={{ color: '#fff', marginBottom: '8px', fontSize: '1.2rem', animation: 'glow 1s infinite' }}>ENTER INITIALS</div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <input
                          autoFocus
                          value={initials}
                          onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 3))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveHighScore();
                          }}
                          style={{
                            background: '#000',
                            border: '2px solid #ffaa00',
                            color: '#ffaa00',
                            fontSize: '1.5rem',
                            fontFamily: '"VT323", monospace',
                            width: '100px',
                            textAlign: 'center',
                            padding: '4px',
                            outline: 'none',
                            letterSpacing: '4px'
                          }}
                          placeholder="___"
                        />
                        <button
                          onClick={saveHighScore}
                          style={{
                            background: '#ffaa00',
                            color: '#000',
                            border: 'none',
                            padding: '0 16px',
                            fontSize: '1.2rem',
                            fontFamily: '"VT323", monospace',
                            cursor: 'pointer'
                          }}
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsStopped(false);
                  setNewHighScoreRank(null);
                  setInitials('');
                  sessionStartRef.current = Date.now();
                  setElapsedMs(0);
                  setTotalMoneyCollected(0);
                }}
                style={{
                  padding: '10px 32px',
                  fontSize: '1.5rem',
                  fontWeight: 400,
                  color: '#000',
                  background: '#fff',
                  border: '4px solid #999',
                  cursor: 'pointer',
                  fontFamily: '"VT323", monospace',
                  textTransform: 'uppercase',
                  boxShadow: '0 0 10px rgba(255,255,255,0.3)',
                }}
                onMouseEnter={e => e.target.style.background = '#e5e5e5'}
                onMouseLeave={e => e.target.style.background = '#fff'}
              >
                INSERT COIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pointer overlay for desktop mouse tracking */}
      {!isMobile && (
        <div
          ref={pointerOverlayRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: layout.zIndex.pointer,
            pointerEvents: 'auto',
            touchAction: 'none',
            cursor: 'none',
          }}
          aria-hidden="true"
        />
      )}

      {/* Mobile thumb joystick */}
      {isMobile && !showPopup && (
        <ThumbJoystick onInput={joystickInputRef} containerRef={canvasContainerRef} />
      )}

      <div
        ref={canvasContainerRef}
        style={{
          position: 'absolute',
          top: playAreaTop,
          left: layout.padding,
          right: layout.padding,
          bottom: layout.padding,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
