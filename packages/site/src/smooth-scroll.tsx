/**
 * SmoothScroll — initializes Lenis smooth scrolling on mount.
 * Renders nothing — it's a side-effect-only component.
 */
'use client';

import { useEffect } from 'react';
import { initSmoothScroll } from './animations';

export function SmoothScroll() {
  useEffect(() => {
    const cleanup = initSmoothScroll();
    return cleanup;
  }, []);

  return null;
}
