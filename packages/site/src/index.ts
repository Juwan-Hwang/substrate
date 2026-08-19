/**
 * @substrate/site — site shell primitives for Substrate-based Next.js sites.
 *
 * This package provides the minimal set of components, hooks, and
 * utilities that every Substrate site needs. It does NOT include
 * any application-specific features (newsletter, search, auth, etc.).
 *
 * ## Usage
 *
 * ```tsx
 * // app/layout.tsx
 * import {
 *   SubstrateLayout,
 *   SubstrateProviders,
 *   SubstrateFooter,
 *   createMetadata,
 *   ThemeScript,
 *   SmoothScroll,
 *   PaintRegistrar,
 * } from '@substrate/site';
 * import '@substrate/site/globals.css';
 * ```
 *
 * ## Dependency invariant
 *
 * `@substrate/site` only depends on platform packages:
 *   @substrate/ui, @substrate/contracts, @substrate/config, @substrate/observability
 *
 * It MUST NOT depend on any application package. Applications depend
 * on `@substrate/site`, never the reverse.
 */

// ── Animation utilities ────────────────────────────────────────────
export {
  cardFlip,
  fadeInUp,
  getLenis,
  initSmoothScroll,
  magneticHover,
  scaleEntrance,
  scrollTo,
  staggerReveal,
} from './animations';
// ── Instrumentation ────────────────────────────────────────────────
export { type InstrumentationConfig, registerInstrumentation } from './instrumentation';
// ── Layout primitives ──────────────────────────────────────────────
export {
  type PoweredByConfig,
  SubstrateFooter,
  SubstrateLayout,
  type SubstrateLayoutProps,
} from './layout';
// ── Metadata helpers ───────────────────────────────────────────────
export { createMetadata } from './metadata';
export { PaintRegistrar } from './paint-registrar';
// ── Providers ──────────────────────────────────────────────────────
export { SubstrateProviders, type SubstrateProvidersProps } from './providers';
// ── Error / Loading / Not-Found shells ─────────────────────────────
export {
  type ErrorShellProps,
  SubstrateError,
  SubstrateGlobalError,
  SubstrateLoading,
  SubstrateNotFound,
} from './shells';
// ── Side-effect components ─────────────────────────────────────────
export { SmoothScroll } from './smooth-scroll';
// ── Theme ──────────────────────────────────────────────────────────
export { ThemeScript } from './theme-script';
