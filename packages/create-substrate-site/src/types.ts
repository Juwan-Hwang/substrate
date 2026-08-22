/**
 * create-substrate-site — type definitions.
 *
 * All public types exported by the CLI package. Consumers can use
 * `scaffoldSite()` programmatically by importing from the root entry.
 */

// ── Presets & Content Models ──────────────────────────────────────

export type Preset = 'minimal' | 'graphics' | 'ai-archive' | 'realtime' | 'reference';

export type ContentModel = 'generic' | 'article' | 'none';

// ── Release Channel ───────────────────────────────────────────────

/**
 * The npm distribution tag for Substrate platform packages.
 *
 * - `canary` → `@substrate-platform/*@canary` (bleeding-edge, every CI build)
 * - `latest` → `@substrate-platform/*@latest` (stable releases)
 *
 * When `--version` is explicitly provided, it takes precedence over
 * the channel and produces a pinned semver range.
 */
export type Channel = 'canary' | 'latest';

// ── CLI Args ───────────────────────────────────────────────────────

/**
 * Parsed CLI arguments. All fields optional — the CLI fills defaults
 * or prompts interactively for missing values.
 */
export interface CliArgs {
  name?: string;
  preset?: Preset;
  contentModel?: ContentModel;
  author?: string;
  siteUrl?: string;
  channel?: Channel;
  version?: string;
  standalone?: boolean;
  help?: boolean;
}

// ── Scaffold Answers ──────────────────────────────────────────────

/**
 * Fully resolved scaffold configuration — every field is populated
 * after CLI parsing and/or interactive prompts.
 */
export interface ScaffoldAnswers {
  name: string;
  preset: Preset;
  contentModel: ContentModel;
  author: string;
  siteUrl: string;
  /** npm dist-tag or explicit version used for @substrate-platform/* deps. */
  channel: Channel;
  /** When set, overrides channel — pins an exact semver range. */
  version?: string;
}

// ── Scaffold Options ──────────────────────────────────────────────

/**
 * Options passed to `scaffoldSite()` for programmatic use.
 *
 * `templateDir` must point to a northstar-format template directory.
 */
export interface ScaffoldOptions extends ScaffoldAnswers {
  /** Directory containing the northstar template to scaffold from. */
  templateDir: string;
  /** Output directory for the generated site. */
  targetDir: string;
  /** When true, generate npm version deps instead of workspace:*. */
  standalone: boolean;
}

// ── Scaffold Result ───────────────────────────────────────────────

/**
 * Result of a successful scaffold operation.
 */
export interface ScaffoldResult {
  /** Absolute path to the generated site directory. */
  targetDir: string;
  /** The slug used as package name and directory name. */
  slug: string;
  /** The version specifier written into package.json deps. */
  substrateVersion: string;
  /** Whether the site was generated in standalone (npm) mode. */
  standalone: boolean;
}
