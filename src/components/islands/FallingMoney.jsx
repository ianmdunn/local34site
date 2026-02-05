import React, { useEffect, useState, useRef } from 'react';
import Matter from 'matter-js';
import { GROWTH_PER_SECOND } from '~/lib/yaleWealthGrowth';

import bill10 from '~/assets/bills/10.png';
import bill20 from '~/assets/bills/20.png';
import bill50 from '~/assets/bills/50.png';
import bill100 from '~/assets/bills/100.png';

const BILL_DATA = [
  { val: 10, img: bill10 },
  { val: 20, img: bill20 },
  { val: 50, img: bill50 },
  { val: 100, img: bill100 },
];

const MAX_BODIES = 5000;
const DENOM_CYCLE_DURATION = 8000; // ms

const FALL_DURATION_SEC = 20;

export default function FallingMoney() {
  const [isActive, setIsActive] = useState(false);
  
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const renderLoopRef = useRef(null);
  const runnerRef = useRef(null);
  
  // Track accumulated value to determine when to spawn
  const accumulationRef = useRef(0);
  const lastTimeRef = useRef(0);
  
  // Keep track of hover state for the trigger element
  const isHoveringRef = useRef(false);
  const fallTimeoutRef = useRef(null);
  
  // Keep track of loaded textures/images
  const texturesRef = useRef({});

    // Trigger Logic (Konami / Click)
    useEffect(() => {
      let cleanupFn = null;

      // Attach listener to title if available
      const attachListener = () => {
        // Disable on mobile
        if (window.matchMedia('(max-width: 768px)').matches) return null;

        // Look for the specific "$" element
        const triggerEl = document.querySelector('.yale-wealth-billboard__number-prefix');
        if (!triggerEl) return null;

        const updateStyles = () => {
          if (isActive || isHoveringRef.current) {
            triggerEl.style.textShadow = '0 0 15px rgba(21, 128, 61, 0.8), 0 0 30px rgba(21, 128, 61, 0.4)';
            triggerEl.style.transition = 'text-shadow 0.3s ease, transform 0.3s ease';
            triggerEl.style.transform = 'scale(1.1)';
          } else {
            triggerEl.style.textShadow = 'none';
            triggerEl.style.transform = 'scale(1)';
          }
        };

        const handleClick = () => {
          if (isActive) return; // Already running
          if (fallTimeoutRef.current) clearTimeout(fallTimeoutRef.current);
          setIsActive(true);
          accumulationRef.current = 0;
          fallTimeoutRef.current = setTimeout(() => {
            setIsActive(false);
            fallTimeoutRef.current = null;
          }, FALL_DURATION_SEC * 1000);
        };

        const handleMouseEnter = () => {
          isHoveringRef.current = true;
          updateStyles();
        };

        const handleMouseLeave = () => {
          isHoveringRef.current = false;
          updateStyles();
        };

        triggerEl.addEventListener('click', handleClick);
        triggerEl.addEventListener('mouseenter', handleMouseEnter);
        triggerEl.addEventListener('mouseleave', handleMouseLeave);
        triggerEl.style.cursor = 'pointer';
        
        // Apply initial styles
        updateStyles();
        
        return () => {
          triggerEl.removeEventListener('click', handleClick);
          triggerEl.removeEventListener('mouseenter', handleMouseEnter);
          triggerEl.removeEventListener('mouseleave', handleMouseLeave);
          if (fallTimeoutRef.current) {
            clearTimeout(fallTimeoutRef.current);
            fallTimeoutRef.current = null;
          }
        };
      };

      // Try to attach immediately
      cleanupFn = attachListener();

      // Retry a few times in case DOM isn't ready immediately
      if (!cleanupFn) {
        const timer = setTimeout(() => {
          cleanupFn = attachListener();
        }, 1000);
        return () => {
          clearTimeout(timer);
          if (cleanupFn) cleanupFn();
        };
      }
      
      return () => {
        if (cleanupFn) cleanupFn();
      };
    }, [isActive]);

  // Preload and tint images
  useEffect(() => {
    BILL_DATA.forEach(data => {
      const img = new Image();
      img.src = data.img.src;
      img.onload = () => {
        // Create an offscreen canvas to tint the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original
        ctx.drawImage(img, 0, 0);

        // Composite green overlay
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(0, 120, 0, 0.2)'; // Lighter green tint
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Reset composite
        ctx.globalCompositeOperation = 'source-over';

        // Store canvas as texture
        texturesRef.current[data.val] = canvas;
      };
    });
  }, []);

  // Physics & Rendering
  useEffect(() => {
    if (!isActive) return;
    
    const { Engine, Render, World, Bodies, Body, Events, Composite, Runner, Mouse, MouseConstraint } = Matter;

    // Setup Engine
    const engine = Engine.create();
    engineRef.current = engine;
    
    const world = engine.world;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Setup Renderer (Custom)
    const canvas = sceneRef.current;
    if (!canvas) return; // Should not happen if isActive is true and render returns div
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Create Floor and Walls
    // Floor needs to be solid and visible to catch items
    const wallOptions = { isStatic: true, render: { visible: false } };
    
    // Position floor such that its top edge is at `height`.
    // Bodies.rectangle arguments are (x, y, width, height). The y is the center.
    // So if we want top edge at `height`, center should be `height + (thickness / 2)`.
    const floorThickness = 100;
    const floor = Bodies.rectangle(width / 2, height + floorThickness / 2, width, floorThickness, wallOptions);
    
    const leftWall = Bodies.rectangle(-30, height / 2, 60, height * 2, wallOptions);
    const rightWall = Bodies.rectangle(width + 30, height / 2, 60, height * 2, wallOptions);
    
    // Mouse Interaction Body (The "Physical Pointer")
    const mousePointer = Bodies.circle(0, 0, 40, {
      isStatic: true,
      render: { visible: false }
    });

    World.add(world, [floor, leftWall, rightWall, mousePointer]);

    // Mouse Interaction for grabbing
    const mouse = Mouse.create(canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false }
      }
    });
    World.add(world, mouseConstraint);

    // Update physical pointer position
    Events.on(engine, 'beforeUpdate', () => {
      if (mouse.position.x) {
        Body.setPosition(mousePointer, { 
          x: mouse.position.x, 
          y: mouse.position.y 
        });
      }
    });

    // Physics Runner
    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    // Wind & Gravity
    Events.on(engine, 'beforeUpdate', (event) => {
      const time = engine.timing.timestamp;
      // Varying wind force
      const wind = Math.sin(time * 0.001) * 0.0005 + Math.cos(time * 0.002) * 0.0002;
      
      Composite.allBodies(world).forEach(body => {
        if (!body.isStatic) {
            // Apply wind
            Body.applyForce(body, body.position, { x: wind * body.mass, y: 0 });
        }
      });
    });

    // Render Loop
    let animationFrameId;
    const render = () => {
      // Clear
      ctx.clearRect(0, 0, width, height);
      
      // Draw Bodies
      const bodies = Composite.allBodies(world);
      bodies.forEach(body => {
        if (body.render.visible === false) return;
        
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        
        // Draw sprite
        const sprite = body.render.sprite;
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

      // Stats / Info Overlay removed
      // ctx.fillStyle = 'rgba(0,0,0,0.5)';
      // ctx.fillRect(10, 10, 240, 60);
      // ctx.fillStyle = '#fff';
      // ctx.font = '14px sans-serif';
      // ctx.fillText(`Growth Rate: $${Math.round(GROWTH_PER_SECOND).toLocaleString()}/sec`, 20, 30);
      // ctx.fillText(`Dropping: Mixed bills`, 20, 50);

      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      Runner.stop(runner);
      Engine.clear(engine);
      World.clear(world);
    };
  }, [isActive]); // Only run once when active

  // Spawner Loop (Runs alongside physics)
  useEffect(() => {
    if (!isActive) return;
    
    let spawnerFrameId;
    lastTimeRef.current = 0; // Reset timer on start
    const { Bodies, Composite, World } = Matter;

    const spawnLoop = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Accumulate value
      accumulationRef.current += GROWTH_PER_SECOND * dt;

      // Spawn bills if accumulated enough value
      // Limit iterations to prevent freezing
      let spawnCount = 0;
      const MAX_SPAWN_PER_FRAME = 10; 

      // Attempt to spawn bills matching growth rate
      // We process denominations from largest to smallest to represent the value added accurately
      const sortedDenoms = [...BILL_DATA].sort((a, b) => b.val - a.val);

      for (const billData of sortedDenoms) {
        while (spawnCount < MAX_SPAWN_PER_FRAME && accumulationRef.current >= billData.val) {
            accumulationRef.current -= billData.val;
            spawnCount++;
            
            if (engineRef.current) {
                const world = engineRef.current.world;
                const allBodies = Composite.allBodies(world);
                
                // Remove oldest if too many
                if (allBodies.length > MAX_BODIES) {
                    const toRemove = allBodies.find(b => !b.isStatic);
                    if (toRemove) World.remove(world, toRemove);
                }

                const texture = texturesRef.current[billData.val];

                // Create new bill - Optimized Size
                const billWidth = 34; // Increased by ~40% (from 24)
                const billHeight = billWidth / 2.61;
                
                // Use random x across viewport width
                const x = Math.random() * (window.innerWidth - 20) + 10;
                // Spawn above the viewport top
                const y = -50 - Math.random() * 50;
                
                const bill = Bodies.rectangle(x, y, billWidth, billHeight, {
                    restitution: 0.1, 
                    friction: 0.5,
                    frictionAir: 0.05 + Math.random() * 0.08, 
                    angle: Math.random() * Math.PI * 2,
                    render: {
                        sprite: {
                            texture: texture,
                            xScale: billWidth / (texture ? texture.width : 1),
                            yScale: billHeight / (texture ? texture.height : 1),
                            originalWidth: texture ? texture.width : 100,
                            originalHeight: texture ? texture.height : 50
                        }
                    }
                });

                Matter.Body.setAngularVelocity(bill, (Math.random() - 0.5) * 0.5);
                World.add(world, bill);
            }
        }
      }

      spawnerFrameId = requestAnimationFrame(spawnLoop);
    };
    
    spawnerFrameId = requestAnimationFrame(spawnLoop);
    
    return () => cancelAnimationFrame(spawnerFrameId);
  }, [isActive]);

  // Avoid returning null: Astro SSR triggers "Invalid hook call" when a component uses hooks
  // and returns null (https://github.com/withastro/astro/issues/12283). Use empty fragment instead.
  if (!isActive) return <></>;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 50, pointerEvents: 'none' }}>
      <canvas ref={sceneRef} style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  );
}
