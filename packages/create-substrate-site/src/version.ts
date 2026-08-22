/**
 * create-substrate-site — version resolution.
 *
 * Resolves the version specifier for @substrate-platform/* dependencies
 * written into a generated site's package.json.
 *
 * ## Design
 *
 * The old script read the version from the monorepo's root package.json.
 * That was wrong for two reasons:
 *
 *   1. The root package.json is `0.1.0` while the npm-published packages
 *      are `0.2.0-canary.0` — `^0.1.0` doesn't match `0.2.0-canary.0`.
 *
 *   2. A scaffold CLI published to npm has no monorepo root to read from
 *      at the consumer's machine.
 *
 * The new design uses an explicit `--channel` flag (default: `canary`)
 * or an explicit `--version` flag, and resolves to a dist-tag specifier
 * that npm understands:
 *
 *   --channel canary  →  @substrate-platform/site@canary
 *   --channel latest   →  @substrate-platform/site@latest
 *   --version 0.2.0    →  @substrate-platform/site@^0.2.0
 *
 * Dist-tag specifiers (e.g. `canary`) are valid npm version ranges —
 * `bun install` / `npm install` resolves them at install time.
 * This means the scaffold does NOT need to query the registry during
 * generation — it writes `canary` or `latest` as the version string,
 * and the package manager resolves it during `install`.
 *
 * For `--version`, we write `^<version>` so the consumer gets
 * compatible patch/minor updates.
 */

import type { Channel } from './types';

// ── Public API ────────────────────────────────────────────────────

/**
 * Resolve the version specifier to write into the generated site's
 * package.json for @substrate-platform/* dependencies.
 *
 * @param channel   The dist-tag channel (canary / latest).
 * @param version   Optional explicit version — takes precedence over channel.
 * @returns A string valid as an npm version range (e.g. "canary", "latest", "^0.2.0").
 */
export function resolveSubstrateVersion(channel: Channel, version?: string): string {
  // Explicit version always wins — pins an exact semver range.
  if (version) {
    // If the user passes a version that already has a range prefix, use it as-is.
    if (/^[~^>=<]/.test(version)) return version;
    // Otherwise, add caret range.
    return `^${version}`;
  }

  // Dist-tag channels are valid npm specifiers on their own.
  // `bun install @substrate-platform/site@canary` resolves to the
  // current canary version at install time.
  return channel;
}

/**
 * Human-readable description of the version source, for logging.
 */
export function describeVersionSource(channel: Channel, version?: string): string {
  if (version) return `pinned ^${version.replace(/^[~^]/, '')}`;
  return `dist-tag ${channel}`;
}
