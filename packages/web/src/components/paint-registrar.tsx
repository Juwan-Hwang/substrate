/**
 * Registers Houdini Paint Worklets on mount.
 * Renders nothing — it's a side-effect-only component.
 */
'use client';

import { useEffect } from 'react';
import { registerPaintWorklets } from '@substrate/ui';

export function PaintRegistrar() {
  useEffect(() => {
    registerPaintWorklets();
  }, []);

  return null;
}
