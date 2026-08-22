/**
 * create-substrate-site — constants and lookup tables.
 */

import type { ContentModel, Preset } from './types';

// ── Preset metadata ───────────────────────────────────────────────

export const PRESET_TO_MANIFEST: Record<Preset, string> = {
  minimal: 'minimalSiteFeatures',
  graphics: 'graphicsLabFeatures',
  'ai-archive': 'aiArchiveFeatures',
  realtime: 'realtimeRoomFeatures',
  reference: 'referenceFeatures',
};

export const PRESET_DESCRIPTIONS: Record<Preset, string> = {
  minimal: 'Pure static content site — no backend, no database',
  graphics: 'WebGPU / WASM / R3F interactive graphics demos',
  'ai-archive': 'AI-powered knowledge base with RAG, hybrid search, chat',
  realtime: 'Realtime collaboration via Cloudflare Durable Objects',
  reference: 'All features enabled — platform reference surface',
};

// ── Content model metadata ────────────────────────────────────────

export const CONTENT_MODEL_DESCRIPTIONS: Record<ContentModel, string> = {
  generic: 'Neutral content model — no assumed content type (default)',
  article: 'Article/blog model — content named "articles"',
  none: 'No content model — blank slate',
};

// ── Template ──────────────────────────────────────────────────────

/**
 * The base template is always `northstar` — it exercises the full platform
 * API surface, so scaffolding from it guarantees the generated site uses
 * every integration point a consumer would need.
 */
export const TEMPLATE_DIR = 'northstar' as const;

// ── Platform packages ─────────────────────────────────────────────

/**
 * Substrate platform packages that consumers depend on.
 * In monorepo mode, these stay as `workspace:*`.
 * In standalone mode, they are replaced with the channel/version range.
 */
export const PLATFORM_PACKAGE_NAMES = [
  '@substrate-platform/site',
  '@substrate-platform/ui',
  '@substrate-platform/content',
  '@substrate-platform/config',
  '@substrate-platform/contracts',
] as const;

// ── Stable versions ───────────────────────────────────────────────

/**
 * Stable version ranges for non-Substrate dependencies.
 * The template pins canary/preview versions; standalone consumers
 * should get stable ranges that satisfy the platform's peerDeps.
 */
export const STABLE_VERSIONS: Record<string, string> = {
  react: '^19.0.0',
  'react-dom': '^19.0.0',
  next: '^16.0.0',
  '@types/react': '^19.0.0',
  '@types/react-dom': '^19.0.0',
};

/**
 * Dev dependencies that must be injected into standalone sites.
 * In the monorepo, these are hoisted to the root package.json.
 * Standalone consumers need them explicitly listed.
 */
export const STANDALONE_INJECT_DEVDEPS: Record<string, string> = {
  typescript: '^7.0.2',
  '@types/node': '^22.0.0',
};

// ── Brand colour remapping ────────────────────────────────────────

/**
 * Northstar's accent colours mapped to the neutral default for generated sites.
 * The user can change these after scaffolding.
 */
export const COLOUR_REPLACEMENTS: Array<[RegExp, string]> = [
  [/#d4a052/g, '#7c8ba0'],
  [/rgba\(212, 160, 82, 0\.15\)/g, 'rgba(124, 139, 160, 0.15)'],
  [/#0b0d14/g, '#0a0a0c'],
  [/#12141f/g, '#131316'],
  [/#1a1d2c/g, '#1a1a20'],
  [/#e6e4dc/g, '#e8e8ea'],
  [/#9b988e/g, '#999'],
  [/#5e5c54/g, '#666'],
  [/#282b3d/g, '#2a2a30'],
  [/#8a6a2e/g, '#4a5568'],
];

/**
 * Colour replacements for the OG image route — a subset (hex only, no rgba).
 */
export const OG_COLOUR_REPLACEMENTS: Array<[RegExp, string]> = [
  [/#d4a052/g, '#7c8ba0'],
  [/#0b0d14/g, '#0a0a0c'],
  [/#12141f/g, '#131316'],
  [/#e6e4dc/g, '#e8e8ea'],
  [/#9b988e/g, '#999'],
  [/#5e5c54/g, '#666'],
  [/#8a6a2e/g, '#4a5568'],
];
