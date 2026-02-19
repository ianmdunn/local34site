import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const DURATION = 0.6;
const STAGGER = 0.08;

export default function YaleWealthCardsAnim() {
  const rootRef = useRef(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const realitySection = document.querySelector('.yale-wealth-reality');
    const article = document.querySelector('.yale-wealth-reality__article');
    const timeline = document.querySelector('.yale-wealth-reality__timeline');

    const ctx = gsap.context(() => {
      const triggerOpts = { start: 'top 88%', toggleActions: 'play none none none' };

      if (realitySection && article) {
        gsap.from(article, {
          opacity: 0,
          y: 24,
          duration: DURATION,
          ease: 'power3.out',
          scrollTrigger: { trigger: realitySection, ...triggerOpts },
        });
        gsap.from(realitySection.querySelector('.yale-wealth-reality__title'), {
          opacity: 0,
          y: 12,
          duration: DURATION * 0.9,
          delay: STAGGER,
          ease: 'power3.out',
          scrollTrigger: { trigger: realitySection, ...triggerOpts },
        });
        gsap.from(realitySection.querySelector('.yale-wealth-reality__lead'), {
          opacity: 0,
          y: 10,
          duration: DURATION * 0.9,
          delay: STAGGER * 1.5,
          ease: 'power3.out',
          scrollTrigger: { trigger: realitySection, ...triggerOpts },
        });
        if (timeline) {
          gsap.from(timeline, {
            opacity: 0,
            y: 12,
            duration: DURATION * 0.7,
            delay: STAGGER * 2,
            ease: 'power3.out',
            scrollTrigger: { trigger: realitySection, ...triggerOpts },
          });
        }
        gsap.from(
          realitySection.querySelectorAll(
            '.yale-wealth-reality__body, .yale-wealth-reality__bridge, .yale-wealth-reality__wages, .yale-wealth-reality__close'
          ),
          {
            opacity: 0,
            y: 8,
            duration: DURATION * 0.6,
            stagger: STAGGER,
            delay: STAGGER * 2.5,
            ease: 'power3.out',
            scrollTrigger: { trigger: realitySection, ...triggerOpts },
          }
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return <div ref={rootRef} className="yale-wealth-cards-anim" aria-hidden="true" style={{ display: 'none' }} />;
}
