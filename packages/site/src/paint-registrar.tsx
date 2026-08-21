/**
 * Registers Houdini Paint Worklets on mount.
 * Renders nothing — it's a side-effect-only component.
 */
'use client';

import { registerPaintWorklets } from '@substrate-platform/ui';
import { useEffect } from 'react';

export function PaintRegistrar() {
  useEffect(() => {
    registerPaintWorklets();
  }, []);

  return null;
}
