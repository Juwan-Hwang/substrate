/**
 * create-substrate-site — shared utility helpers.
 *
 * Pure functions with no side effects. Used across the scaffold modules.
 */

import type { ContentModel } from './types';

// ── String helpers ────────────────────────────────────────────────

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function titleCase(s: string): string {
  return s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Content model helpers ──────────────────────────────────────────

/**
 * The plural noun used in routes, imports, and variable names.
 */
export function contentNoun(model: ContentModel): string {
  if (model === 'article') return 'articles';
  return 'content';
}

/**
 * The type name in PascalCase (e.g. for type definitions).
 */
export function contentTypeName(model: ContentModel): string {
  if (model === 'article') return 'Article';
  return 'ContentEntry';
}

/**
 * The singular variable name used in loops and destructuring.
 */
export function contentSingular(model: ContentModel): string {
  if (model === 'article') return 'article';
  return 'entry';
}

/**
 * The display heading shown on the home page (e.g. "Articles", "Content").
 */
export function contentHeading(model: ContentModel): string {
  if (model === 'article') return 'Articles';
  return 'Content';
}
