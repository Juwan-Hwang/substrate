/**
 * @substrate/web — Aevum site application entry.
 *
 * The public-facing site is branded Aevum and comprises three subsystems:
 *  - Lattice   — GPU / knowledge graph / visual system
 *  - Crucible  — runnable experiments / benchmark lab
 *  - Archive   — articles / projects / notes
 *
 * Built with Next.js 16.3, React 19.2 + React Compiler,
 * Tailwind CSS v4.3, GSAP + Lenis motion, View Transitions API.
 */
export const SITE_BRAND = 'Aevum' as const;
export const SITE_URL = 'https://aevum.dev' as const;

export const SUBSYSTEMS = ['Lattice', 'Crucible', 'Archive'] as const;
export type Subsystem = (typeof SUBSYSTEMS)[number];

export const SUBSYSTEM_META: Record<Subsystem, { description: string; href: string }> = {
  Lattice: { description: 'GPU / knowledge graph / visual system', href: '/lattice' },
  Crucible: { description: 'Runnable experiments / benchmark lab', href: '/crucible' },
  Archive: { description: 'Articles / projects / notes', href: '/archive' },
};

export { SITE_BRAND as default };
