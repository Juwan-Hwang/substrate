/**
 * @substrate-platform/ui — Component library for Substrate.
 *
 * Ported from Zephyr's design system, adapted for React 19 + Tailwind v4.
 * Primitives shared across all Substrate-based sites.
 */

export { setup3DEffect } from './3d-effect';
export type {
  BadgeProps,
  ButtonProps,
  ButtonVariant,
  GlassCardProps,
  PrimitiveProps,
  SwitchProps,
} from './components';
export { Badge, Box, Button, GlassCard, Stack, Switch } from './components';
export { registerPaintWorklets } from './paint-worklets';
export { createStatusRing } from './status-ring';
