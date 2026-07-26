/**
 * @substrate/ui — Component library for Aevum.
 *
 * Ported from Zephyr's design system, adapted for React 19 + Tailwind v4.
 * Primitives shared across Lattice, Crucible, and Archive subsystems.
 */

export { setup3DEffect } from './3d-effect';
export { createStatusRing } from './status-ring';
export { Box, Stack, GlassCard, Button, Switch, Badge } from './components';
export type {
  PrimitiveProps,
  ButtonProps,
  ButtonVariant,
  GlassCardProps,
  SwitchProps,
  BadgeProps,
} from './components';
