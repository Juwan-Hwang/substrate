/**
 * GSAP + Lenis — smooth scroll and animation utilities.
 *
 * Lenis provides buttery smooth scrolling (replaces native scroll with
 * a rAF-driven interpolated scroll). GSAP's ScrollTrigger integrates
 * with Lenis for scroll-driven animations.
 *
 * All factories are generic — no application-specific names or semantics.
 */
'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Register GSAP plugin (client-side only).
gsap.registerPlugin(ScrollTrigger);

// ── Lenis smooth scroll ─────────────────────────────────────────────

let lenisInstance: Lenis | null = null;

/**
 * Initialize Lenis smooth scrolling.
 * Call once in a client component's useEffect.
 */
export function initSmoothScroll(options?: { duration?: number; easing?: (t: number) => number }) {
  if (typeof window === 'undefined') return () => {};

  const lenis = new Lenis({
    duration: options?.duration ?? 1.2,
    easing: options?.easing ?? ((t: number) => Math.min(1, 1.001 - 2 ** (-10 * t))),
    smoothWheel: true,
  });

  lenisInstance = lenis;

  // Sync Lenis with GSAP ScrollTrigger.
  lenis.on('scroll', ScrollTrigger.update);

  // Drive Lenis via GSAP's ticker for unified rAF loop.
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return () => {
    lenis.destroy();
    lenisInstance = null;
  };
}

/** Get the current Lenis instance (if initialized). */
export function getLenis() {
  return lenisInstance;
}

/** Scroll to a target element or position smoothly. */
export function scrollTo(
  target: string | number | HTMLElement,
  options?: { offset?: number; duration?: number },
) {
  lenisInstance?.scrollTo(target, {
    offset: options?.offset ?? 0,
    duration: options?.duration ?? 1.2,
  });
}

// ── GSAP animation factories ────────────────────────────────────────

/**
 * Fade-in-up animation for page sections.
 */
export function fadeInUp(target: HTMLElement | string, delay = 0) {
  const vars: gsap.TweenVars = {
    opacity: 1,
    y: 0,
    duration: 0.8,
    delay,
    ease: 'power3.out',
  };
  if (typeof target === 'string') {
    vars.scrollTrigger = target;
  }
  return gsap.fromTo(target, { opacity: 0, y: 40 }, vars);
}

/**
 * Stagger reveal for grid items.
 */
export function staggerReveal(target: HTMLElement | string, stagger = 0.1) {
  return gsap.fromTo(
    target,
    { opacity: 0, y: 30, scale: 0.95 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.6,
      stagger,
      ease: 'power2.out',
    },
  );
}

/**
 * Scale + rotate entrance for hero / canvas elements.
 */
export function scaleEntrance(target: HTMLElement | string) {
  return gsap.fromTo(
    target,
    { opacity: 0, scale: 0.8, rotation: -5 },
    {
      opacity: 1,
      scale: 1,
      rotation: 0,
      duration: 1.2,
      ease: 'power4.out',
    },
  );
}

/**
 * 3D Y-axis rotation card flip.
 */
export function cardFlip(target: HTMLElement | string) {
  return gsap.fromTo(
    target,
    { rotationY: 90, opacity: 0 },
    {
      rotationY: 0,
      opacity: 1,
      duration: 0.6,
      ease: 'back.out(1.7)',
      transformPerspective: 800,
      transformOrigin: 'center center',
    },
  );
}

/**
 * Magnetic hover effect — element follows cursor slightly.
 */
export function magneticHover(target: HTMLElement, strength = 0.3) {
  const onMove = (e: MouseEvent) => {
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(target, {
      x: x * strength,
      y: y * strength,
      duration: 0.4,
      ease: 'power2.out',
    });
  };

  const onLeave = () => {
    gsap.to(target, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: 'elastic.out(1, 0.3)',
    });
  };

  target.addEventListener('mousemove', onMove);
  target.addEventListener('mouseleave', onLeave);

  return () => {
    target.removeEventListener('mousemove', onMove);
    target.removeEventListener('mouseleave', onLeave);
  };
}
