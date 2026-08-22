/**
 * create-substrate-site — file system operations.
 *
 * Template discovery, directory copying, and in-place file rewriting.
 * All functions are pure I/O — no business logic.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { platform } from 'node:process';

// ── Monorepo detection ────────────────────────────────────────────

/**
 * Check whether a directory looks like the Substrate monorepo root.
 */
function isMonorepoRoot(root: string): boolean {
  return (
    existsSync(join(root, 'packages')) &&
    existsSync(join(root, 'examples')) &&
    existsSync(join(root, 'package.json'))
  );
}

/**
 * Find the Substrate monorepo root by walking up from a starting directory.
 * Returns `null` when running as an installed npm package (no monorepo).
 */
export function findMonorepoRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 15; i++) {
    if (isMonorepoRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── Template discovery ────────────────────────────────────────────

/**
 * Resolve the template directory path.
 *
 * Strategy (in order):
 *   1. If running inside the monorepo → examples/<templateName>/
 *   2. If running as an npm package → ./templates/<templateName>/ (shipped in tarball)
 *   3. Fallback: check relative to the module file location
 *
 * @param scriptDir  The directory of the currently executing module.
 * @param templateName  The template name (e.g. "northstar").
 * @param monorepoRoot  The detected monorepo root, or null.
 */
export function resolveTemplateDir(
  scriptDir: string,
  templateName: string,
  monorepoRoot: string | null,
): string {
  // 1. Monorepo mode — read from examples/.
  if (monorepoRoot) {
    return join(monorepoRoot, 'examples', templateName);
  }

  // 2. npm package mode — templates/ is shipped in the tarball.
  const bundledTemplate = join(scriptDir, '..', 'templates', templateName);
  if (existsSync(bundledTemplate)) {
    return bundledTemplate;
  }

  // 3. Fallback — try two levels up (covers bun run scenarios).
  const fallback = join(scriptDir, '..', '..', 'examples', templateName);
  return fallback;
}

// ── Directory copying ─────────────────────────────────────────────

/**
 * Recursively copy a directory, skipping build artifacts.
 */
export function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.turbo') continue;
    if (entry.endsWith('.tsbuildinfo')) continue;
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
    }
  }
}

// ── File rewriting ────────────────────────────────────────────────

/**
 * Apply a sequence of regex replacements to a file in-place.
 * If the file doesn't exist, this is a no-op.
 */
export function rewriteFile(filePath: string, replacements: Array<[RegExp, string]>): void {
  if (!existsSync(filePath)) return;
  let content = readFileSync(filePath, 'utf-8');
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  writeFileSync(filePath, content);
}

// ── Platform helper ───────────────────────────────────────────────

/**
 * Get the script directory (directory of the current module).
 * Handles Windows leading-slash quirk.
 */
export function getScriptDir(importMetaUrl: string): string {
  let dir = dirname(new URL(importMetaUrl).pathname);
  if (platform === 'win32') {
    dir = dir.replace(/^\//, '');
  }
  return dir;
}
