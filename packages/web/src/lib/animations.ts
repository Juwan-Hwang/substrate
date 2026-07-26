/**
 * GSAP + Lenis — smooth scroll and animation utilities.
 *
 * Lenis provides buttery smooth scrolling (replaces native scroll with
 * a rAF-driven interpolated scroll). GSAP's ScrollTrigger integrates
 * with Lenis for scroll-driven animations.
 *
 * Also exports reusable GSAP timeline factories for the three subsystems.
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
 *
 * ```tsx
 * useEffect(() => {
 *   const cleanup = initSmoothScroll();
 *   return cleanup;
 * }, []);
 * ```
 */
export function initSmoothScroll(options?: {
  duration?: number;
  easing?: (t: number) => number;
}) {
  if (typeof window === 'undefined') return () => {};

  const lenis = new Lenis({
    duration: options?.duration ?? 1.2,
    easing: options?.easing ?? ((t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))),
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
export function scrollTo(target: string | number | HTMLElement, options?: { offset?: number; duration?: number }) {
  lenisInstance?.scrollTo(target, {
    offset: options?.offset ?? 0,
    duration: options?.duration ?? 1.2,
  });
}

// ── GSAP animation factories ────────────────────────────────────────

/**
 * Fade-in-up animation for page sections.
 *
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useEffect(() => fadeInUp(ref.current!), []);
 * ```
 */
export function fadeInUp(target: HTMLElement | string, delay = 0) {
  return gsap.fromTo(
    target,
    { opacity: 0, y: 40 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      delay,
      ease: 'power3.out',
      scrollTrigger: typeof target === 'string' ? target : undefined,
    },
  );
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
 * Lattice canvas entrance — scale + rotate.
 */
export function latticeEntrance(target: HTMLElement | string) {
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
 * Crucible experiment card flip — 3D Y-axis rotation.
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
