/**
 * @substrate/web — Aevum site application entry.
 *
 * The public-facing site is branded Aevum and comprises three subsystems:
 *  - Lattice   — GPU / knowledge graph / visual system
 *  - Crucible  — runnable experiments / benchmark lab
 *  - Archive   — articles / projects / notes
 */
export const SITE_BRAND = 'Aevum' as const;

export const SUBSYSTEMS = ['Lattice', 'Crucible', 'Archive'] as const;
export type Subsystem = (typeof SUBSYSTEMS)[number];

export { SITE_BRAND as default };
